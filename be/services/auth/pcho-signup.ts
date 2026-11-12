import { UsersDAL } from '../../dal/users.dal';
import { FormatResponse } from '../../utils/response-formatter';
import { SignUpCommand } from '@aws-sdk/client-cognito-identity-provider';
import { z } from 'zod';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { GenerateRandomPassword } from '../../utils/auth-utils';
import { UserTypes } from '../../utils/constants';
import { v4 as uuidv4 } from 'uuid';
import { cognitoClient } from '../../utils/cognito-client';
import { HomeDAL } from '../../dal/home.dal';
import { CreatePCHOOrPCGLeadSchema } from '../../models/CRM/user.model';
import { HomeSchema } from '../../models/Home/home.model';
import { upsertHomeHandler } from '../home/upsert-home';

const usersDAL = new UsersDAL();
const homeDAL: HomeDAL = new HomeDAL();
const sesClient = new SESClient({
  region: process.env.CURRENT_AWS_REGION!,
});

const pchoSignUpSchema = z.object({
  home: HomeSchema.strict(),
  user: CreatePCHOOrPCGLeadSchema.extend({
    role: z.literal('PCHO', {
      message: 'Role accepts only PCHO',
    }),
    homeId: z
      .string()
      .uuid({
        message: 'homeId must has an invalid UUID format',
      })
      .optional(),
    home: z.string({ message: 'home must be a string' }).optional(),
  }).strict(),
});

export const pchoSignUpHandler = async (requestPayload: z.infer<typeof pchoSignUpSchema>) => {
  // Check if the request payload is empty
  if (!requestPayload) {
    return FormatResponse(400, {
      message: 'SignUp Failed',
      error: 'Request payload is missing in body',
    });
  }

  try {
    // Validate the request payload
    pchoSignUpSchema.parse(requestPayload);

    const { role } = requestPayload?.user;

    // Check if the role is PCHO
    if (!role || role !== UserTypes.PCHO) {
      return FormatResponse(400, {
        message: 'SignUp Failed',
        error: 'Provided role is not authorized to access this resource',
      });
    }

    const pchoRedirectURL =
      process.env.STAGE! === 'main' ? 'www.assistly.live' : `${process.env.STAGE!}.assistly.live`;

    let { home, user } = requestPayload;

    // If home with provided homeName already exists, update payload with existing homeId
    const existingHome = await homeDAL.getByHomeName(home?.homeName);

    if (Object.keys(existingHome)?.length > 0) {
      console.info(`Home with name ${existingHome.homeName} already exists, using existing homeId`);

      // Check if the PCHO already exists
      const existingUser = await usersDAL.getUserByEmail(user.email);

      if (
        existingUser?.length > 0 &&
        existingUser[0]?.home?.toLowerCase() === existingHome.homeName.toLowerCase()
      ) {
        return FormatResponse(409, {
          message: 'Sign up failed',
          error: `Account already exists. Please login with your credentials or use forgot password to reset your password.`,
        });
      }

      user = {
        ...user,
        homeId: existingHome.homeId,
        home: home.homeName,
      };
    } else {
      // Create home
      const response = await upsertHomeHandler(home);

      // Update homeId for user
      user = {
        ...user,
        homeId: JSON.parse(response.body).homeId ?? '',
        home: home.homeName,
      };

      console.info('New home created successfully: ', home.homeName);
    }

    // Validate the request payload for PCHO
    const validatePayload = CreatePCHOOrPCGLeadSchema.parse(user);

    const { email, name } = validatePayload;

    console.info(`Validated SignUp payload for ${email}`, validatePayload);

    // If the PCHO already exists, then update the associatedHomeIds array
    const existingUser = await usersDAL.getUserByEmail(email);
    if (existingUser?.length > 0) {
      const existingUserData = existingUser[0];

      const updatedUser = {
        ...existingUserData,
        associatedHomeIds: Array.from(
          new Set([...(existingUserData.associatedHomeIds || []), user.homeId])
        ),
        modifiedAt: new Date().toISOString(),
      };

      await usersDAL.updateUser(updatedUser);

      return FormatResponse(200, {
        message: 'Updated Home association for existing user',
      });
    }

    //Insert the user into DB
    const updatedUserData = {
      userId: uuidv4(),
      ...validatePayload,
      createdAt: new Date().toISOString(),
    };

    await usersDAL.insertUser(updatedUserData);

    const generatedPassword = GenerateRandomPassword();

    // Crete user in Cognito User Pool
    const signUpCommand = new SignUpCommand({
      ClientId: process.env.USER_POOL_CLIENT_ID!,
      Username: email,
      Password: generatedPassword,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'custom:fullName', Value: name },
        { Name: 'custom:role', Value: role },
      ],
    });

    await cognitoClient.send(signUpCommand);

    // Send the login credentials via email using SES
    const input = {
      Source: 'no-reply@assistly.live',
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: 'Welcome to Assistly - Login Credentials',
        },
        Body: {
          Html: {
            Data: `
                  <html>

                  <body style="font-family: jakarta; line-height: 1.6; color: #181729;">
                    <!-- Container for the email body -->
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: #e9e9f9; border-radius: 8px;">

                      <!-- Assistly logo svg header -->
                      <div style="display: flex; align-items: center;">
                        <svg viewBox="0 0 546.75 546.75" width="45px" height="45px" xmlns="http://www.w3.org/2000/svg">
                          <g id="Isolation_Mode" data-name="Isolation Mode">
                            <g>
                              <path fill="#514ceb"
                                d="M283.43,274.33c-30.31,0-54.91,6.13-73.8,18.37-18.9,12.25-28.34,29.17-28.34,50.76,0,8.72,1.65,17.23,4.98,25.53,3.32,8.31,8.41,15.78,15.26,22.42,6.85,6.65,15.26,12.05,25.22,16.19,9.96,4.16,21.8,6.23,35.5,6.23,18.68,0,37.26-4.05,55.74-12.14,18.47-8.1,33.11-19.2,43.91-33.32,2.9-3.74,5.39-7.79,7.47-12.14,2.07-4.36,3.11-8.41,3.11-12.15v-52.94c-14.12-5.39-28.86-9.55-44.22-12.46-15.37-2.9-30.31-4.36-44.84-4.36Z" />
                              <path fill="#514ceb"
                                d="M246.83,1.25C116.42,13.55,12.7,117.9,1.11,248.38c-14.08,158.49,107.23,292.09,261.32,298.15,3.63.15,7.28.22,10.95.22h272.89v-257.1c.32-5.38.48-10.81.48-16.27C546.75,113.64,409.75-14.11,246.83,1.25ZM429.79,440c-3.33.41-6.44.72-9.34.93-2.91.2-5.4.31-7.47.31-8.31,0-15.88-2.49-22.73-7.47s-10.7-12.46-11.52-22.42l-1.25-25.53c-14.12,19.1-32.7,33.94-55.74,44.53-23.04,10.59-46.4,15.88-70.07,15.88-16.61,0-31.76-2.6-45.46-7.79-13.7-5.19-25.44-12.35-35.19-21.49-9.76-9.13-17.34-19.72-22.73-31.76-5.4-12.04-8.1-24.7-8.1-37.99,0-14.95,3.32-28.54,9.96-40.79,6.64-12.24,15.98-22.73,28.03-31.45,12.04-8.72,26.47-15.46,43.28-20.24,16.82-4.77,35.39-7.16,55.74-7.16,16.19,0,32.79,1.46,49.82,4.36,17.02,2.91,32.17,7.06,45.46,12.46v-29.27c0-28.65-8.2-51.38-24.6-68.2-16.41-16.82-38.52-25.22-66.33-25.22-17.44,0-34.78,3.33-52,9.96-17.23,6.65-34.78,16.19-52.63,28.65l-14.95-28.03c21.18-14.11,41.73-24.7,61.66-31.76,19.93-7.06,40.69-10.59,62.28-10.59,39.44,0,70.79,11.42,94.04,34.25,23.25,22.84,34.88,54.4,34.88,94.67v146.36c0,11.63,4.98,17.44,14.95,17.44v37.37Z" />
                            </g>
                          </g>
                        </svg>
                        <p style="font-family: jakarta; font-size: 40px; padding-left: 10px; margin:0">assistly</p>

                      </div>
                      <!-- Greeting -->
                      <h1 style="color: #514ceb; text-align: center; font-family: jakarta; font-size: 30px">Hello ${name},</h1>

                      <!-- Login link section -->
                      <p style="font-family: jakarta; font-size: 18px;">
                        You can log in to your account using the following credentials:
                      </p>

                      <!-- Login credentials -->
                      <p style="font-family: jakarta; font-size: 18px; ">
                        <strong style="color: #181729">Email:</strong> ${email} <br>
                        <strong style="color: #181729">Password:</strong> ${generatedPassword}
                      </p>

                      <!-- Activation Button -->
                      <div style="text-align: center; margin: 30px 0;">
                        <a href="${pchoRedirectURL}"
                          style="background-color: #181729; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-family: jakarta; font-size: 18px; display: inline-block;">
                          Click to Login
                        </a>
                      </div>

                      <!-- Fallback URL -->
                      <p style="font-family: jakarta; font-size: 16px;">
                        <strong>If the button above doesn't work, please copy and paste the link below into your browser:
                        </strong><br>
                        <a href="${pchoRedirectURL}" style="color: #514ceb; word-break: break-all;">
                          ${pchoRedirectURL}
                        </a>
                      </p>

                      <!-- Security note -->
                      <p style="font-family: jakarta; font-size: 18px; background-color: #f3f3f8; border-radius: 5px; padding:10px">
                        🔒 <strong style="color: #181729">For your security:</strong><br>
                        Please change your password after your first login. You can do this in the User Profile section. This helps keep
                        your account safe.
                      </p>

                      <!-- Support info -->
                      <p style="font-family: jakarta; font-size: 18px; text-align: center;">
                        If you need help, contact
                        <a href="mailto:support@assistly.care" style="color: #007bff; text-decoration: none;">support@assistly.care</a>.
                      </p>

                      <!-- Thank you note -->
                      <p style="font-family: jakarta; font-size: 18px;">
                        Warm regards, <br>
                        <strong style="color: #181729">The Assistly Team</strong>
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

    return FormatResponse(201, {
      message: `PCHO created for home - ${home.homeName}, please check email for login credentials`,
    });
  } catch (error: any) {
    console.error('Sign-up error:', error);
    if (error instanceof z.ZodError) {
      console.error('Validation Errors:', error.errors);
      return FormatResponse(400, {
        message: 'Request payload validation failed',
        error: error.errors,
      });
    }
    return FormatResponse(500, {
      message: 'Sign-up failed',
      error: error,
    });
  }
};
