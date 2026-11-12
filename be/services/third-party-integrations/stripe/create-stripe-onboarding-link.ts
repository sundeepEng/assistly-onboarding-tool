import { UsersDAL } from '../../../dal/users.dal';
import { getFrontendUrl } from '../../../utils/get-frontend-url';
import { FormatResponse } from '../../../utils/response-formatter';
import { getStripeClient } from '../../../utils/stripe';
import { updateUserHandler } from '../../update-user';

const usersDAL: UsersDAL = new UsersDAL();

export const createStripeOnboardingLinkHandler = async (requestPayload: any) => {
  const FRONTEND_URL = getFrontendUrl();
  const stripe = await getStripeClient();

  try {
    // How query params arrive depends on your router/APIGW integration.
    // Support a few common shapes:
    const emailRaw = requestPayload?.email ?? '';

    const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : '';

    if (!email)
      return FormatResponse(400, {
        message: 'Create Stripe Onboarding Link Failed',
        error: 'Email is required',
      });

    console.info(`Creating Stripe onboarding link for email: ${email}`);

    const existingUser = await usersDAL.getUserByEmail(email);

    console.info(`Existing user: ${JSON.stringify(existingUser)}`);

    const user = existingUser?.[0];

    if (Object.keys(user).length === 0)
      return FormatResponse(404, {
        message: 'Create Stripe Onboarding Link Failed',
        error: 'User not found',
      });

    let stripeAccountId = user?.stripeAccountId;

    // Safety: if somehow missing, create it here
    if (!stripeAccountId) {
      const account = await stripe.accounts.create(
        {
          type: 'express',
          country: 'US',
          email,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: 'individual',
          metadata: {
            userId: user.userId,
            role: user.role,
            environment: process.env.STAGE!,
          },
        },
        { idempotencyKey: `stripe-account-${user.userId}` }
      );

      stripeAccountId = account.id;

      const updatedUser: any = {
        ...user,
        stripeAccountId: stripeAccountId,
      };

      await updateUserHandler(user.userId, updatedUser);
    }

    // IMPORTANT: refresh_url and return_url should be FRONTEND pages
    const refreshUrl = `${FRONTEND_URL}/stripe/refresh?email=${encodeURIComponent(email)}`;
    const returnUrl = `${FRONTEND_URL}/stripe/return?email=${encodeURIComponent(email)}`;

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return FormatResponse(201, {
      message: 'Stripe Onboarding Link Created Successfully',
      url: accountLink.url,
    });
  } catch (err) {
    console.error('getStripeOnboardingLinkHandler error:', err);
    return FormatResponse(500, {
      message: 'Failed to generate onboarding link',
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
