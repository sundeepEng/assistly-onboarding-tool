import { FormatResponse } from '../../utils/response-formatter';
import { CampaignSchema, HomeSchema } from '../../models/Home/home.model';
import { UpdatePCHOOrPCGLeadOrPCGSchema } from '../../models/CRM/user.model';
import { HomeDAL } from '../../dal/home.dal';
import { z } from 'zod';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { UsersDAL } from '../../dal/users.dal';

const homeDAL = new HomeDAL();
const usersDAL = new UsersDAL();
const sesClient = new SESClient({
  region: process.env.CURRENT_AWS_REGION!,
});
const snsClient = new SNSClient({
  region: process.env.CURRENT_AWS_REGION!,
});

export const upsertCampaignHandler = async (requestPayload: any) => {
  try {
    const { homeId, ...campaignData } = requestPayload;

    // Zod validation against CampaignSchema
    const validatedCampaign = CampaignSchema.parse(campaignData);

    console.info('Validated campaign:', validatedCampaign);

    // Validate if homeId exists in DB using getHomeById
    const home = await homeDAL.getHomeById(homeId);

    console.info('Home found:', home.homeId);

    if (Object.keys(home).length === 0) {
      return FormatResponse(404, {
        message: 'Home not found',
        error: `Home with ID ${homeId} does not exist`,
      });
    }

    // Check if campaign exists and update or append
    const existingCampaigns = home.campaigns || [];
    const campaignIndex = existingCampaigns.findIndex(
      (campaign: z.infer<typeof CampaignSchema>) =>
        campaign.campaignId === validatedCampaign.campaignId
    );

    let updatedCampaigns;
    if (campaignIndex >= 0) {
      // Update existing campaign
      updatedCampaigns = [...existingCampaigns];
      updatedCampaigns[campaignIndex] = validatedCampaign;
    } else {
      // Append new campaign
      updatedCampaigns = [...existingCampaigns, validatedCampaign];
    }

    console.info('Updated campaigns:', updatedCampaigns);

    // Update home with new campaigns array
    const updatedHome: any = {
      ...home,
      campaigns: updatedCampaigns,
      modifiedAt: new Date().toISOString(),
    };

    // Fetch the details of the campaign sender
    const campaignSender = await usersDAL.fetchUserById(validatedCampaign.campaignCreatedByUserId);
    console.info('Campaign sender:', campaignSender.name);

    // Validate the complete home object before upserting
    const validatedHome = HomeSchema.parse(updatedHome);
    await homeDAL.upsertHome(validatedHome);

    console.info('Campaign upserted successfully for home:', updatedHome.homeName);

    // Trigger campaign based on channel
    if (validatedCampaign.campaignChannel === 'SMS') {
      console.info('Sending SMS campaign:', validatedCampaign);
      const smsResult = await sendSmsCampaign(validatedCampaign, campaignSender);
      if (smsResult) {
        // Error occurred in SMS sending
        return smsResult;
      }
    } else if (validatedCampaign.campaignChannel === 'EMAIL') {
      console.info('Sending email campaign:', validatedCampaign);
      const emailResult = await sendEmailCampaign(validatedCampaign);
      if (emailResult) {
        // Error occurred in email sending
        return emailResult;
      }
    }

    return FormatResponse(200, {
      message:
        campaignIndex >= 0 ? 'Campaign updated successfully' : 'Campaign created successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return FormatResponse(400, {
        message: 'Request payload validation failed',
        error: error.errors,
      });
    }

    console.error('Error in createCampaignHandler:', error);
    return FormatResponse(500, {
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Util function for SMS campaigns
async function sendSmsCampaign(campaign: z.infer<typeof CampaignSchema>, campaignSender: any) {
  try {
    // Filter users that have mobile numbers
    const usersWithMobile = campaign.campaignUsers.filter(
      (user) => user?.userMobile && user.userMobile !== ''
    );

    if (usersWithMobile.length === 0) {
      console.log('No users to send SMS to for campaign:', campaign.campaignId);
      return FormatResponse(404, {
        message: 'Failed to Send SMS Campaign',
        error: 'No users found to send SMS campaign',
      });
    }

    // AWS SNS has a limit on publishing rate, but we can send multiple messages
    // We'll send individual SMS messages to each user for personalization
    const sendPromises = usersWithMobile.map(async (user, index) => {
      // Format mobile number with country code if needed (assuming US numbers)
      const formattedPhoneNumber = user.userMobile!.startsWith('+1')
        ? user.userMobile!
        : `+1${user.userMobile!}`;

      // Create personalized message
      const personalizedMessage = `Hi ${user.userName},\n\n${campaign.campaignMetadata.subject}\n\n${campaign.campaignMetadata.body}`;

      const input = {
        Message: personalizedMessage,
        PhoneNumber: formattedPhoneNumber,
        MessageAttributes: {
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: 'Transactional', // Use Transactional for campaign messages
          },
        },
        // ADD THIS for delivery status
        MessageDeduplicationId: `${campaign.campaignId}-${user.userId}-${Date.now()}`,
      };

      const command = new PublishCommand(input);
      const result = await snsClient.send(command);

      console.info(
        `SMS sent successfully for campaign ${campaign.campaignId} to ${formattedPhoneNumber} for user ${user.userName} (${index + 1}/${usersWithMobile.length})`,
        `Message ID: ${result.MessageId}, Sequence Number: ${result.SequenceNumber}, Result: ${JSON.stringify(result)}`
      );
    });

    await Promise.all(sendPromises);

    console.info(
      `SMS campaign ${campaign.campaignId} completed: ${usersWithMobile.length} recipients`
    );

    return;
  } catch (error: any) {
    console.error('Error sending SMS campaign:', error);

    // Handle specific SNS errors
    if (error?.name === 'InvalidParameterException') {
      return FormatResponse(400, {
        message: 'Invalid phone number format',
        error: error.message,
      });
    }

    if (error?.name === 'ThrottlingException') {
      return FormatResponse(429, {
        message: 'SMS rate limit exceeded',
        error: error.message,
      });
    }

    if (error?.name === 'NotFoundException') {
      return FormatResponse(404, {
        message: '10DLC phone number not found or not configured',
        error: error.message,
      });
    }

    return FormatResponse(500, {
      message: 'Failed to send SMS campaign',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Util function for sending Email campaigns
async function sendEmailCampaign(campaign: z.infer<typeof CampaignSchema>) {
  try {
    // Extract user emails from campaign users, filtering out undefined values
    const userEmails = campaign.campaignUsers
      .map((user) => user?.userEmail)
      .filter((email): email is string => email !== undefined && email !== '');

    if (userEmails.length === 0) {
      console.log('No users to send email to for campaign:', campaign.campaignId);
      return FormatResponse(404, {
        message: 'Failed to Send Email Campaign',
        error: 'No users found to send email campaign',
      });
    }

    // AWS SES has a limit of 50 recipients per email (including To, CC, BCC)
    // We'll batch the emails if there are more than 50 users
    // NOTE: We also include one address in To (campaign sender), so BCC must be <= 49
    const MAX_RECIPIENTS_PER_EMAIL = 49;
    const emailBatches = [];

    for (let i = 0; i < userEmails.length; i += MAX_RECIPIENTS_PER_EMAIL) {
      emailBatches.push(userEmails.slice(i, i + MAX_RECIPIENTS_PER_EMAIL));
    }

    // Send emails in batches
    const sendPromises = emailBatches.map(async (batch, index) => {
      const input = {
        Source: 'no-reply@assistly.live',
        ReplyToAddresses: [campaign.campaignSenderEmail],
        Destination: {
          ToAddresses: [campaign.campaignSenderEmail],
          BccAddresses: batch,
        },
        Message: {
          Subject: {
            Data: campaign.campaignMetadata.subject,
          },
          Body: {
            Html: {
              Data: `
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #000000;">
                  <p>
                    ${campaign.campaignMetadata.body}
                  </p>
                  <p>
                    Best,<br>
                    ${campaign.campaignSenderEmail}
                  </p>
                </body>
                </html>
              `,
            },
          },
        },
      };

      const command = new SendEmailCommand(input);
      await sesClient.send(command);

      console.info(
        `Email batch ${index + 1} sent successfully for campaign ${campaign.campaignId} to ${batch.length} recipients`
      );
    });

    await Promise.all(sendPromises);

    const totalRecipients = userEmails.length;
    const totalBatches = emailBatches.length;

    console.info(
      `Email campaign ${campaign.campaignId} completed: ${totalRecipients} recipients in ${totalBatches} batches`
    );

    return;
  } catch (error) {
    console.error('Error sending email campaign:', error);
    return FormatResponse(500, {
      message: 'Failed to send email campaign',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
