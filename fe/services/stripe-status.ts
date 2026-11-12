import { stripeStatusPath } from "../utils/constants";
import { fetchStripeByEmail } from "./stripe";

export const fetchStripeStatus = async (payload: { email: string }) => {
  const { email } = payload;

  return fetchStripeByEmail({ path: stripeStatusPath, email });
};
