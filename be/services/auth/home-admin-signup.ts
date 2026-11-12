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
import { CreateHomeAdminSchema } from '../../models/CRM/user.model';

const usersDAL = new UsersDAL();
const homeDAL: HomeDAL = new HomeDAL();
const sesClient = new SESClient({
  region: process.env.CURRENT_AWS_REGION!,
});

export const homeAdminSignUpHandler = async (
  requestPayload: z.infer<typeof CreateHomeAdminSchema>
) => {
  if (!requestPayload) {
    return FormatResponse(400, {
      message: 'SignUp Failed',
      error: 'Request payload is missing in body',
    });
  }

  try {
    CreateHomeAdminSchema.parse(requestPayload);

    let user = requestPayload;

    const { role } = user;

    if (!role || role !== UserTypes.HOMEADMIN) {
      return FormatResponse(400, {
        message: 'SignUp Failed',
        error: 'Provided role is not authorized to access this resource',
      });
    }

    const homeId = user.homeId;

    if (!homeId?.length) {
      return FormatResponse(400, {
        message: 'SignUp Failed',
        error: 'homeId is required',
      });
    }

    const existingHome = await homeDAL.getHomeById(homeId);

    if (Object.keys(existingHome)?.length === 0) {
      return FormatResponse(404, {
        message: 'SignUp Failed',
        error: `Home with homeId - ${homeId} does not exist`,
      });
    }

    user = {
      ...user,
      homeId,
      home: existingHome.homeName,
    };

    const validatePayload = CreateHomeAdminSchema.parse(user);

    const { email, name } = validatePayload;

    const existingUser = await usersDAL.getUserByEmail(email);

    if (existingUser?.length > 0) {
      const existingUserData = existingUser[0];

      const updatedUser = {
        ...existingUserData,
        associatedHomeIds: Array.from(
          new Set([...(existingUserData.associatedHomeIds || []), homeId])
        ),
        modifiedAt: new Date().toISOString(),
      };

      await usersDAL.updateUser(updatedUser);

      return FormatResponse(200, {
        message: 'Updated Home association for existing user',
      });
    }

    const updatedUserData = {
      userId: uuidv4(),
      ...validatePayload,
      associatedHomeIds:
        Array.isArray((validatePayload as any).associatedHomeIds) &&
        (validatePayload as any).associatedHomeIds.length > 0
          ? (validatePayload as any).associatedHomeIds
          : [homeId],
      createdAt: new Date().toISOString(),
    };

    await usersDAL.insertUser(updatedUserData);

    const generatedPassword = GenerateRandomPassword();

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

    const redirectURL =
      process.env.STAGE! === 'main' ? 'www.assistly.live' : `${process.env.STAGE!}.assistly.live`;

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
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: #e9e9f9; border-radius: 8px;">
                      <h1 style="color: #514ceb; text-align: center; font-family: jakarta; font-size: 30px">Hello ${name},</h1>

                      <p style="font-family: jakarta; font-size: 18px;">
                        You can log in to your account using the following credentials:
                      </p>

                      <p style="font-family: jakarta; font-size: 18px; ">
                        <strong style="color: #181729">Email:</strong> ${email} <br>
                        <strong style="color: #181729">Password:</strong> ${generatedPassword}
                      </p>

                      <div style="text-align: center; margin: 30px 0;">
                        <a href="${redirectURL}"
                          style="background-color: #181729; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-family: jakarta; font-size: 18px; display: inline-block;">
                          Click to Login
                        </a>
                      </div>

                      <p style="font-family: jakarta; font-size: 16px;">
                        <strong>If the button above doesn't work, please copy and paste the link below into your browser:
                        </strong><br>
                        <a href="${redirectURL}" style="color: #514ceb; word-break: break-all;">
                          ${redirectURL}
                        </a>
                      </p>

                      <p style="font-family: jakarta; font-size: 18px; background-color: #f3f3f8; border-radius: 5px; padding:10px">
                        🔒 <strong style="color: #181729">For your security:</strong><br>
                        Please change your password after your first login. You can do this in the User Profile section.
                      </p>

                      <p style="font-family: jakarta; font-size: 18px; text-align: center;">
                        If you need help, contact
                        <a href="mailto:support@assistly.care" style="color: #007bff; text-decoration: none;">support@assistly.care</a>.
                      </p>

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
      message: `Home Admin created for home - ${existingHome.homeName}, please check email for login credentials`,
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
