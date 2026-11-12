// utils/stripe.ts
import Stripe from 'stripe';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

let stripeClient: Stripe | undefined;

export async function getStripeSecretKeys() {
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION });

  const command = new GetSecretValueCommand({
    SecretId: `Stripe-${process.env.STAGE}`,
  });

  const response = await client.send(command);

  if (!response.SecretString) {
    throw new Error('Stripe API key not found in Secrets Manager');
  }

  const parsed = JSON.parse(response.SecretString);

  const webhookSecretKeySnapshot = parsed.webhookSecretKeySnapshot as string | undefined;
  const webhookSecretKeyThin = parsed.webhookSecretKeyThin as string | undefined;

  return {
    ...parsed,
    webhookSecretKeySnapshot,
    webhookSecretKeyThin,
    webhookSecretKeys: [webhookSecretKeySnapshot, webhookSecretKeyThin].filter(Boolean) as string[],
  };
}

export const getStripeClient = async () => {
  if (stripeClient) {
    return stripeClient;
  }

  const { secretKey } = await getStripeSecretKeys();

  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }

  stripeClient = new Stripe(secretKey, {
    typescript: true,
    maxNetworkRetries: 2,
  });

  return stripeClient;
};

type StripeOnboardingStatus =
  | 'NOT_STARTED'
  | 'RESTRICTED'
  | 'ACTIVE'
  | 'UNDER_REVIEW'
  | 'IN_PROGRESS';

export function mapStripeStatus(account?: Stripe.Account | null): StripeOnboardingStatus {
  if (!account) return 'NOT_STARTED';

  const currentlyDue = account.requirements?.currently_due ?? [];
  const pendingVerification = account.requirements?.pending_verification ?? [];
  const disabledReason = account.requirements?.disabled_reason ?? null;

  if (disabledReason) return 'RESTRICTED';

  if (
    !!account.details_submitted &&
    !!account.charges_enabled &&
    !!account.payouts_enabled &&
    currentlyDue.length === 0
  ) {
    return 'ACTIVE';
  }

  if (!!account.details_submitted && pendingVerification.length > 0) {
    return 'UNDER_REVIEW';
  }

  return 'IN_PROGRESS';
}
