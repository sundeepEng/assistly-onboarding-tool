import { UsersDAL } from '../../../dal/users.dal';
import { getFrontendUrl } from '../../../utils/get-frontend-url';
import { FormatResponse } from '../../../utils/response-formatter';
import { getStripeClient } from '../../../utils/stripe';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { updateUserHandler } from '../../update-user';

const usersDAL: UsersDAL = new UsersDAL();
const sesClient = new SESClient({
  region: process.env.CURRENT_AWS_REGION!,
});

export const createStripeAccountHandler = async (requestPayload: any) => {
  const FRONTEND_URL = getFrontendUrl();
  try {
    const stripe = await getStripeClient();
    const { email } = requestPayload;
    if (!email) {
      console.info('Email is required');

      return FormatResponse(400, {
        message: 'Email is required',
      });
    }
    // Check if the user already exists in DynamoDB
    const existingUser = await usersDAL.getUserByEmail(email);

    if (existingUser?.length == 0) {
      console.info(`User with email - ${email} does not exist`);

      return FormatResponse(404, {
        message: 'Stripe Account creation failed',
        error: `User with email - ${email} does not exist`,
      });
    }
    const { name } = existingUser[0];

    // Create Stripe Express Account
    if (existingUser[0].stripeAccountId) {
      console.info(`Stripe account already exists for user with email - ${email}`);

      return FormatResponse(409, {
        message: 'Your account is ready. Follow the link in your email to complete the next steps.',
      });
    }

    const account = await stripe.accounts.create(
      {
        type: 'express',
        country: 'US',
        email: email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: {
          userId: existingUser[0].userId,
          role: existingUser[0].role,
          environment: process.env.STAGE!,
        },
      },
      {
        idempotencyKey: `stripe-account-${existingUser[0].userId}`, //Protect against retries / double-clicks:
      }
    );

    console.info(`Stripe account created for user with email - ${email}`);

    const updatedUserData: any = {
      ...existingUser[0],
      updatedAt: new Date().toISOString(),
      stripeAccountId: account.id,
    };

    await updateUserHandler(updatedUserData.userId, updatedUserData);

    console.info(`User data updated for user with email - ${email}`);

    const onboardPageUrl = `${FRONTEND_URL}/stripe/onboard?email=${encodeURIComponent(email)}`;

    // Send Stripe onboarding email via SES
    const input = {
      Source: 'no-reply@assistly.live',
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: 'Assistly - Stripe Onboarding: Complete Your Stripe Account Setup',
        },
        Body: {
          Html: {
            Data: `
        <html>
          <body style="font-family: jakarta; line-height: 1.6; color: #181729;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: #e9e9f9; border-radius: 8px;">

              <!-- Header -->
              <div style="display: flex; align-items: center;">
                <svg viewBox="0 0 546.75 546.75" width="45px" height="45px" xmlns="http://www.w3.org/2000/svg">
                  <g>
                    <path fill="#514ceb"
                      d="M283.43,274.33c-30.31,0-54.91,6.13-73.8,18.37-18.9,12.25-28.34,29.17-28.34,50.76..." />
                  </g>
                </svg>
                <p style="font-size: 40px; padding-left: 10px; margin:0">assistly</p>
              </div>

              <!-- Greeting -->
              <h1 style="color: #514ceb; text-align: center; font-size: 30px">
                Hello ${name},
              </h1>

              <!-- Intro -->
              <p style="font-size: 18px;">
                To receive payments through Assistly, you must complete your secure Stripe payout setup.
                Stripe is our trusted payment partner and ensures your funds are deposited safely and on time.
              </p>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${onboardPageUrl}"
                  style="background-color: #181729; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-size: 18px; display: inline-block;">
                  Complete Stripe Setup
                </a>
              </div>

              <!-- Fallback Link -->
              <p style="font-size: 16px;">
                <strong>If the button above doesn’t work, copy and paste this link into your browser:</strong><br>
                <a href="${onboardPageUrl}" style="color: #514ceb; word-break: break-all;">
                  ${onboardPageUrl}
                </a>
              </p>

              <!-- Info Box -->
              <p style="font-size: 18px; background-color: #f3f3f8; border-radius: 5px; padding:10px">
                💳 <strong>Your payout setup:</strong><br>
                This process is required to receive payments. Stripe may ask for identity verification
                and banking details to comply with financial regulations.
              </p>

              <!-- Support -->
              <p style="font-size: 18px; text-align: center;">
                Need help? Contact
                <a href="mailto:support@assistly.care" style="color: #007bff; text-decoration: none;">
                  support@assistly.care
                </a>
              </p>

              <!-- Footer -->
              <p style="font-size: 18px;">
                Thanks and Regards,<br>
                <strong>The Assistly Team</strong>
              </p>

            </div>
          </body>
        </html>
        `,
          },
        },
      },
    };

    await sesClient.send(new SendEmailCommand(input));

    console.info(`Stripe onboarding email sent to ${email}`);

    return FormatResponse(200, {
      message: `Stripe onboarding link sent to ${email}. Please complete your account setup.`,
    });
  } catch (err) {
    console.error('Stripe account creation error:', err);
    return FormatResponse(500, {
      message: 'Failed to create Stripe account',
      error: err as Error,
    });
  }
};
