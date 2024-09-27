import ProductCard from "../components/ProductCard";
import PRODUCT from "../productInfo";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { StripeElementsOptions } from "@stripe/stripe-js";
import { CheckoutForm } from "../components/CheckoutForm";

const options: StripeElementsOptions = {
  mode: "payment",
  amount: 1099,
  currency: "usd",
  // Fully customizable with appearance API.
  appearance: {
    /*...*/
  },
};

const Checkout = () => {
  const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PK);
  //console.log("Stripe Publishable Key:", import.meta.env.VITE_STRIPE_PK);
  return (
    <div className="flex container mt-8">
      <ProductCard {...PRODUCT} />
      <Elements stripe={stripePromise} options={options}>
        <CheckoutForm />
      </Elements>
    </div>
  );
};

export default Checkout;
