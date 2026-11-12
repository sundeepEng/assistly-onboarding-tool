import { randomUUID } from 'crypto';
import { z } from 'zod';
import { UsersDAL } from '../../dal/users.dal';
import { HomeDAL } from '../../dal/home.dal';
import { FormatResponse } from '../../utils/response-formatter';
import { UserTypes } from '../../utils/constants';
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { HomeSchema, HomeTourSchema } from '../../models/Home/home.model';
import {
  UpdateLeadOrSeniorSchema,
  UpdatePCHOOrPCGLeadOrPCGSchema,
} from '../../models/CRM/user.model';

const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
});
const usersDAL = new UsersDAL();
const homeDAL = new HomeDAL();

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\r\n@]+@[^\r\n@]+\.[^\r\n@]+$/;
  return emailRegex.test(email) && !email.includes('\n') && !email.includes('\r');
};

const sanitizeHeader = (header: string): string => {
  return header.replace(/[\r\n]/g, '');
};

export const homeTourHandler = async (requestPayload: z.infer<typeof HomeTourSchema>) => {
  const validatedPayload = HomeTourSchema.parse(requestPayload);

  const { tourDateTime, pchoUserId, leadUserId } = validatedPayload;

  try {
    // Fetch and validate PCHO user
    const pchoUser = await usersDAL.fetchUserById(pchoUserId);

    if (!pchoUser || pchoUser.role !== UserTypes.PCHO) {
      return FormatResponse(404, {
        message: 'Failed to schedule home tour',
        error: 'PCHO user not found or invalid role',
      });
    }

    // Fetch and validate Lead user
    const leadUser = await usersDAL.fetchUserById(leadUserId);

    if (!leadUser || leadUser.role !== UserTypes.LEAD) {
      return FormatResponse(404, {
        message: 'Failed to schedule home tour',
        error: 'Lead user not found or invalid role',
      });
    }

    // Fetch home details
    const home = await homeDAL.getHomeById(pchoUser.homeId);

    // Generate ICS content
    const icsContent = generateICSCalendarInvite(
      tourDateTime,
      home as z.infer<typeof HomeSchema>,
      pchoUser as z.infer<typeof UpdatePCHOOrPCGLeadOrPCGSchema>,
      leadUser as z.infer<typeof UpdateLeadOrSeniorSchema>
    );

    const tourDate = formatTourDate(tourDateTime);
    const homeName = (home as z.infer<typeof HomeSchema>).homeName || 'N/A';
    const emailErrors: string[] = [];

    // Send PCHO email
    try {
      await sendPCHOTourEmail(
        pchoUser.email,
        icsContent,
        homeName,
        tourDate,
        pchoUser.name,
        pchoUser.mobile,
        leadUser.name,
        leadUser.email,
        leadUser.mobile
      );
    } catch (error) {
      console.error('Failed to send PCHO tour email:', error);
      emailErrors.push('PCHO');
    }

    // Send Lead email
    try {
      await sendLeadTourEmail(
        leadUser.email,
        icsContent,
        homeName,
        tourDate,
        pchoUser.name,
        pchoUser.mobile,
        leadUser.name
      );
    } catch (error) {
      console.error('Failed to send Lead tour email:', error);
      emailErrors.push('Lead');
    }

    if (emailErrors.length > 0) {
      return FormatResponse(500, {
        message: 'Tour scheduled, but email notifications failed',
        error: `Failed to send tour emails to: ${emailErrors.join(', ')}`,
      });
    }

    return FormatResponse(201, {
      message: 'Home tour scheduled successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Error in homeTourHandler:', error.errors);

      return FormatResponse(400, {
        message: 'Failed to schedule home tour',
        error: error.errors,
      });
    }

    console.error('Error in homeTourHandler:', error);

    return FormatResponse(500, {
      message: 'Failed to schedule home tour',
      error: error as Error,
    });
  }
};

const generateICSCalendarInvite = (
  tourDateTime: string,
  home: z.infer<typeof HomeSchema>,
  pchoUser: z.infer<typeof UpdatePCHOOrPCGLeadOrPCGSchema>,
  leadUser: z.infer<typeof UpdateLeadOrSeniorSchema>
) => {
  const startTime = new Date(tourDateTime);
  const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours later

  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const icsContent = `BEGIN:VCALENDAR
                          VERSION:2.0
                          PRODID:-//Assistly//Home Tour//EN
                          BEGIN:VEVENT
                              UID:${pchoUser.userId}-${
                                leadUser.userId
                              }-${startTime.getTime()}@assistly.live
                              DTSTART:${formatDate(startTime)}
                              DTEND:${formatDate(endTime)}
                              SUMMARY:Home Tour at ${home.homeName}
                              DESCRIPTION:Home tour scheduled for ${
                                home.homeName
                              }.\\n\\nContact: ${pchoUser.name}\\nPhone: ${pchoUser.mobile}
                              LOCATION:${home.homeName}
                              ORGANIZER;CN=${pchoUser.name}:mailto:${pchoUser.email}
                              ATTENDEE;CN=${leadUser.name}:mailto:${leadUser.email}
                          END:VEVENT
                      END:VCALENDAR`;

  return icsContent;
};

const formatTourDate = (tourDateTime: string) => {
  const tourDateTimeObj = new Date(tourDateTime);
  return (
    tourDateTimeObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: '2-digit',
    }) +
    ' ' +
    tourDateTimeObj.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  );
};

const sendRawTourEmail = async (
  toEmail: string,
  subject: string,
  textBody: string,
  htmlBody: string,
  icsContent: string
) => {
  if (!isValidEmail(toEmail)) {
    throw new Error(`Invalid email address: ${toEmail}`);
  }

  const boundary = `----=_NextPart_${randomUUID()}`;

  const rawMessage = [
    `From: noreply@assistly.live`,
    `To: ${toEmail}`,
    `Subject: ${sanitizeHeader(subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: multipart/alternative; boundary="alt-${boundary}"`,
    ``,
    `--alt-${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    textBody,
    ``,
    `--alt-${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    htmlBody,
    ``,
    `--alt-${boundary}--`,
    ``,
    `--${boundary}`,
    `Content-Type: text/calendar; name="invite.ics"`,
    `Content-Disposition: attachment; filename="invite.ics"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    Buffer.from(icsContent).toString('base64'),
    ``,
    `--${boundary}--`,
  ].join('\r\n');

  const command = new SendRawEmailCommand({
    RawMessage: {
      Data: new Uint8Array(Buffer.from(rawMessage)),
    },
  });

  await sesClient.send(command);
};

const buildEmailTemplate = (
  recipientName: string,
  tourDate: string,
  homeName: string,
  isPCHO: boolean,
  primaryName: string,
  primaryPhone: string,
  secondaryName?: string,
  secondaryEmail?: string,
  secondaryPhone?: string
) => {
  const greeting = isPCHO
    ? `A home tour has been scheduled for ${homeName}.`
    : 'Your home tour has been scheduled.';

  const htmlGreeting = isPCHO
    ? `A home tour has been scheduled for <strong>${homeName}</strong>.`
    : 'Your home tour has been scheduled!';

  const textDetails = isPCHO
    ? `  - Date & Time: ${tourDate}
  - Address: ${homeName}
  - Lead: ${secondaryName || 'N/A'}
  - Lead Email: ${secondaryEmail || 'N/A'}
  - Lead Phone: ${secondaryPhone || 'N/A'}`
    : `  - Date & Time: ${tourDate}
  - Address: ${homeName}
  - Contact Person: ${primaryName || 'N/A'}
  - Phone: ${primaryPhone || 'N/A'}`;

  const htmlDetails = isPCHO
    ? `<li><strong>Date & Time:</strong> ${tourDate}</li>
        <li><strong>Address:</strong> ${homeName}</li>
        <li><strong>Lead:</strong> ${secondaryName || 'N/A'}</li>
        <li><strong>Lead Email:</strong> ${secondaryEmail || 'N/A'}</li>
        <li><strong>Lead Phone:</strong> ${secondaryPhone || 'N/A'}</li>`
    : `<li><strong>Date & Time:</strong> ${tourDate}</li>
        <li><strong>Address:</strong> ${homeName}</li>
        <li><strong>Contact Person:</strong> ${primaryName || 'N/A'}</li>
        <li><strong>Phone:</strong> ${primaryPhone || 'N/A'}</li>`;

  const textBody = `
Dear ${recipientName || 'there'},

${greeting}

Tour Details:
${textDetails}

Please find the calendar invite attached.

Best regards,
Assistly Team
`;

  const htmlBody = `
<html>
<body style='font-family: jakarta; line-height: 1.6; color: #181729;'>
  <div style='max-width: 600px; margin: 0 auto; padding: 20px; background-color: #e9e9f9; border-radius: 8px;'>

    <div style='display: flex; align-items: center;'>
      <p style='font-family: jakarta; font-size: 40px; padding-left: 10px; margin:0'>assistly</p>
    </div>

    <h1 style='color: #514ceb; text-align: center; font-family: jakarta; font-size: 30px'>Hello ${recipientName || 'there'},</h1>

    <p style='font-family: jakarta; font-size: 18px;'>
      ${htmlGreeting} Here are the details:
    </p>

    <div style='background-color: #ffffff; padding: 15px; border-radius: 5px; margin: 20px 0;'>
      <h3 style='color: #514ceb; font-family: jakarta; margin-top: 0;'>Tour Details</h3>
      <ul style='font-family: jakarta; font-size: 16px; list-style: none; padding: 0;'>
        ${htmlDetails}
      </ul>
    </div>

    <p style='font-family: jakarta; font-size: 18px;'>
      Please find the calendar invite attached to this email. You can add it to your calendar application (Google Calendar, Outlook, etc.) for easy access.
    </p>

    <p style='font-family: jakarta; font-size: 18px;'>
      Warm regards, <br>
      <strong style='color: #181729'>The Assistly Team</strong>
    </p>
  </div>
</body>
</html>
`;

  return { textBody, htmlBody };
};

const sendPCHOTourEmail = async (
  toEmail: string,
  icsContent: string,
  homeName: string,
  tourDate: string,
  pchoName: string,
  pchoMobile: string,
  leadName: string,
  leadEmail: string,
  leadMobile?: string
) => {
  const { textBody, htmlBody } = buildEmailTemplate(
    pchoName,
    tourDate,
    homeName,
    true,
    pchoName,
    pchoMobile,
    leadName,
    leadEmail,
    leadMobile
  );

  await sendRawTourEmail(
    toEmail,
    `Home Tour Scheduled - ${homeName}`,
    textBody,
    htmlBody,
    icsContent
  );
};

const sendLeadTourEmail = async (
  toEmail: string,
  icsContent: string,
  homeName: string,
  tourDate: string,
  pchoName: string,
  pchoMobile: string,
  leadName: string
) => {
  const { textBody, htmlBody } = buildEmailTemplate(
    leadName,
    tourDate,
    homeName,
    false,
    pchoName,
    pchoMobile
  );

  await sendRawTourEmail(
    toEmail,
    `Home Tour for ${homeName} Scheduled`,
    textBody,
    htmlBody,
    icsContent
  );
};
