import { stripeOnboardingLinkPath } from "../utils/constants";
import { fetchStripeByEmail } from "./stripe";

export const fetchStripeOnboardingLink = async (payload: { email: string }) => {
  const { email } = payload;

  return fetchStripeByEmail({ path: stripeOnboardingLinkPath, email });
};
