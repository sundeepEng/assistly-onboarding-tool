import { z } from 'zod';
import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { SupportRequestSchema } from '../../models/Support/support.model';
import { FormatResponse } from '../../utils/response-formatter';
import { UsersDAL } from '../../dal/users.dal';

const sesClient = new SESClient({
  region: process.env.CURRENT_AWS_REGION,
});

const usersDAL = new UsersDAL();

export const createSupportTicketHandler = async (
  requestPayload: z.infer<typeof SupportRequestSchema>
) => {
  if (!requestPayload) {
    return FormatResponse(400, {
      message: 'Support request failed',
      error: 'Request payload is required',
    });
  }

  try {
    const validatedPayload = SupportRequestSchema.parse(requestPayload);

    const { userEmail } = validatedPayload;
    const ticketId = generateTicketId();

    const userDetails = await usersDAL.getUserByEmail(userEmail);

    if (Object.keys(userDetails).length === 0) {
      return FormatResponse(404, {
        message: 'Failed to create support ticket',
        error: `User with email - ${userEmail} not found`,
      });
    }

    const { email, name, role, homeId, home } = userDetails[0];

    const toEmail = 'support@assistly.care';
    const sourceEmail = 'no-reply@assistly.live';

    const boundary = `NextPart-${Date.now()}`;
    const altBoundary = `AltPart-${Date.now()}`;

    const textBody = `Ticket ID: ${ticketId}\n\n--- SUPPORT TICKET ---\n\nSubject: ${validatedPayload.subject}\n\nDescription:\n${validatedPayload.body}\n\n--- USER DETAILS ---\nName: ${name}\nEmail: ${email}\nHome: ${home ?? 'N/A'}\nRole: ${role}\n\n---\nThis ticket was submitted via the Assistly in-app support form.`;

    const htmlBody = getSupportTicketHtml({
      ticketId,
      name,
      email,
      role,
      home,
      subject: validatedPayload.subject,
      description: validatedPayload.body,
    });

    const rawSegments: string[] = [
      `From: ${sourceEmail}`,
      `To: ${toEmail}`,
      `Reply-To: ${userEmail}`,
      `Subject: [${ticketId}] ${validatedPayload.subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      '',
      `--${altBoundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      '',
      textBody,
      '',
      `--${altBoundary}`,
      'Content-Type: text/html; charset=UTF-8',
      '',
      htmlBody,
      '',
      `--${altBoundary}--`,
    ];

    validatedPayload.attachments?.forEach((attachment) => {
      rawSegments.push(
        '',
        `--${boundary}`,
        `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
        `Content-Disposition: attachment; filename="${attachment.filename}"`,
        'Content-Transfer-Encoding: base64',
        '',
        attachment.data
      );
    });

    rawSegments.push('', `--${boundary}--`);

    const rawEmail = rawSegments.join('\r\n');

    // Send email to support@assistly.care
    await sesClient.send(
      new SendRawEmailCommand({
        Source: sourceEmail,
        Destinations: [toEmail],
        RawMessage: {
          Data: new Uint8Array(Buffer.from(rawEmail)),
        },
      })
    );

    // Send email to the user
    await sesClient.send(
      new SendEmailCommand({
        Source: sourceEmail,
        ReplyToAddresses: [toEmail],
        Destination: {
          ToAddresses: [userEmail],
        },
        Message: {
          Subject: {
            Data: `We've received your Assistly ticket ${ticketId}`,
          },
          Body: {
            Html: {
              Data: getUserConfirmationHtml({
                ticketId,
                name,
                subject: validatedPayload.subject,
                description: validatedPayload.body,
              }),
            },
            Text: {
              Data: getUserConfirmationText({
                ticketId,
                name,
                subject: validatedPayload.subject,
                description: validatedPayload.body,
              }),
            },
          },
        },
      })
    );

    return FormatResponse(200, {
      message: 'Support request submitted successfully',
      ticketId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return FormatResponse(400, {
        message: 'Request payload validation failed',
        error: error.errors,
      });
    }

    console.error('createSupportTicketHandler error:', error);
    return FormatResponse(500, {
      message: 'Failed to submit support request',
      error: error as Error,
    });
  }
};

const generateTicketId = () => {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timePart = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const entropy = (now.getMilliseconds() + Math.floor(Math.random() * 1000))
    .toString(36)
    .toUpperCase();
  return `ASST-${datePart}-${timePart}-${entropy}`;
};

const getUserConfirmationText = ({
  ticketId,
  name,
  subject,
  description,
}: {
  ticketId: string;
  name?: string;
  subject: string;
  description: string;
}) => `Hi ${name ?? 'there'},

We've received your support request and created ticket ${ticketId}.

Subject: ${subject}

Description:
${description}

Our team will review your request and follow up soon. You can reach out to us directly at support@assistly.care with your Ticket ID <strong>${ticketId}</strong> if you have any questions.

Warm Regards,
Assistly Support Team`;

const getUserConfirmationHtml = ({
  ticketId,
  name,
  subject,
  description,
}: {
  ticketId: string;
  name?: string;
  subject: string;
  description: string;
}) =>
  wrapWithAssistlyTemplate(`
    <p style="font-family: jakarta; font-size: 18px;">Hi ${name ?? 'there'},</p>
    <p style="font-family: jakarta; font-size: 18px;">Thank you for reaching out to us. We've received your support request and created ticket <strong>${ticketId}</strong>.</p>
    <div style="background-color: #ffffff; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="font-family: jakarta; font-size: 18px; margin: 0 0 10px;"><strong>Issue Raised:</strong> ${subject}</p>
      <p style="font-family: jakarta; font-size: 18px; margin: 0;"><strong>Description:</strong></p>
      <p style="font-family: jakarta; font-size: 18px; white-space: pre-wrap;">${description}</p>
    </div>
    <p style="font-family: jakarta; font-size: 18px;">Our team will review your request and follow up soon. You can reach out to us directly at support@assistly.care with your Ticket ID <strong>${ticketId}</strong> if you have any questions.</p>
  `);

const getSupportTicketHtml = ({
  ticketId,
  name,
  email,
  role,
  home,
  subject,
  description,
}: {
  ticketId: string;
  name?: string;
  email?: string;
  role?: string;
  home?: string | null;
  subject: string;
  description: string;
}) =>
  wrapWithAssistlyTemplate(`
    <h1 style="color: #514ceb; text-align: center; font-family: jakarta; font-size: 30px;">New Support Ticket</h1>
    <p style="font-family: jakarta; font-size: 18px;"><strong>Ticket ID:</strong> ${ticketId}</p>
    <p style="font-family: jakarta; font-size: 18px;"><strong>Subject:</strong> ${subject}</p>
    <p style="font-family: jakarta; font-size: 18px;"><strong>Description:</strong></p>
    <p style="font-family: jakarta; font-size: 18px; white-space: pre-wrap;">${description}</p>
    <div style="background-color: #ffffff; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <h3 style="color: #514ceb; font-family: jakarta; margin-top: 0;">User Details</h3>
      <ul style="list-style: none; padding: 0; font-family: jakarta; font-size: 16px;">
        <li><strong>Name:</strong> ${name ?? 'N/A'}</li>
        <li><strong>Email:</strong> ${email ?? 'N/A'}</li>
        <li><strong>Role:</strong> ${role ?? 'N/A'}</li>
        <li><strong>Home:</strong> ${home ?? 'N/A'}</li>
      </ul>
    </div>
    <p style="font-family: jakarta; font-size: 18px;">This ticket was submitted via the Assistly in-app support form.</p>
  `);

const wrapWithAssistlyTemplate = (content: string) => `
  <html>
    <body style="font-family: jakarta; line-height: 1.6; color: #181729;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: #e9e9f9; border-radius: 8px;">
        <div style="display: flex; align-items: center;">
          <svg viewBox="0 0 546.75 546.75" width="45px" height="45px" xmlns="http://www.w3.org/2000/svg">
            <g id="Isolation_Mode" data-name="Isolation Mode">
              <g>
                <path fill="#514ceb" d="M283.43,274.33c-30.31,0-54.91,6.13-73.8,18.37-18.9,12.25-28.34,29.17-28.34,50.76,0,8.72,1.65,17.23,4.98,25.53,3.32,8.31,8.41,15.78,15.26,22.42,6.85,6.65,15.26,12.05,25.22,16.19,9.96,4.16,21.8,6.23,35.5,6.23,18.68,0,37.26-4.05,55.74-12.14,18.47-8.1,33.11-19.2,43.91-33.32,2.9-3.74,5.39-7.79,7.47-12.14,2.07-4.36,3.11-8.41,3.11-12.15v-52.94c-14.12-5.39-28.86-9.55-44.22-12.46-15.37-2.9-30.31-4.36-44.84-4.36Z" />
                <path fill="#514ceb" d="M246.83,1.25C116.42,13.55,12.7,117.9,1.11,248.38c-14.08,158.49,107.23,292.09,261.32,298.15,3.63.15,7.28.22,10.95.22h272.89v-257.1c.32-5.38.48-10.81.48-16.27C546.75,113.64,409.75-14.11,246.83,1.25ZM429.79,440c-3.33.41-6.44.72-9.34.93-2.91.2-5.4.31-7.47.31-8.31,0-15.88-2.49-22.73-7.47s-10.7-12.46-11.52-22.42l-1.25-25.53c-14.12,19.1-32.7,33.94-55.74,44.53-23.04,10.59-46.4,15.88-70.07,15.88-16.61,0-31.76-2.6-45.46-7.79-13.7-5.19-25.44-12.35-35.19-21.49-9.76-9.13-17.34-19.72-22.73-31.76-5.4-12.04-8.1-24.7-8.1-37.99,0-14.95,3.32-28.54,9.96-40.79,6.64-12.24,15.98-22.73,28.03-31.45,12.04-8.72,26.47-15.46,43.28-20.24,16.82-4.77,35.39-7.16,55.74-7.16,16.19,0,32.79,1.46,49.82,4.36,17.02,2.91,32.17,7.06,45.46,12.46v-29.27c0-28.65-8.2-51.38-24.6-68.2-16.41-16.82-38.52-25.22-66.33-25.22-17.44,0-34.78,3.33-52,9.96-17.23,6.65-34.78,16.19-52.63,28.65l-14.95-28.03c21.18-14.11,41.73-24.7,61.66-31.76,19.93-7.06,40.69-10.59,62.28-10.59,39.44,0,70.79,11.42,94.04,34.25,23.25,22.84,34.88,54.4,34.88,94.67v146.36c0,11.63,4.98,17.44,14.95,17.44v37.37Z" />
              </g>
            </g>
          </svg>
          <p style="font-family: jakarta; font-size: 40px; padding-left: 10px; margin: 0;">assistly</p>
        </div>
        ${content}
        <p style="font-family: jakarta; font-size: 18px;">
          Warm regards, <br />
          <strong style="color: #181729;">Assistly Support Team</strong>
        </p>
      </div>
    </body>
  </html>
`;
