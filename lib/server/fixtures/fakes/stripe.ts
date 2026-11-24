import { json, type Fake } from "../fake";
import stripeCheckoutSessions from "../stripe-checkout-sessions.json";
import stripePaymentIntents from "../stripe-payment-intents.json";

// Stripe's API: the donations the wall of thanks is made from.

export const stripeFake: Fake = ({ hostname, pathname }) => {
  if (hostname === "api.stripe.com" && pathname === "/v1/checkout/sessions") {
    // Completed checkouts: donors who said yes, one who said no, one who gave
    // twice, and one from before the wall of thanks question was asked.
    return json(stripeCheckoutSessions);
  }
  if (hostname === "api.stripe.com" && pathname === "/v1/payment_intents") {
    // Payments: monthly ones for donors who said yes and one who said no, a
    // failed one, and a ticket, which isn't a gift.
    return json(stripePaymentIntents);
  }
  return undefined;
};
