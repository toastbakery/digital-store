// CheckoutForm.tsx
import React, { useState } from "react";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import PRODUCT from "../productInfo";

export const CheckoutForm = () => {
  const stripe = useStripe();
  const elements = useElements();

  const [errorMessage, setErrorMessage] = useState<string | undefined>("");
  const [emailInput, setEmailInput] = useState<string>("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (elements == null || stripe == null) {
      return;
    }

    // Trigger form validation and wallet collection
    const { error: submitError } = await elements.submit();
    if (submitError) {
      // Show error to your customer
      setErrorMessage(submitError.message);
      return;
    }

    // Continue to confirm the payment only if no errors occurred in the submit step
    try {
      // Create the PaymentIntent and obtain clientSecret from your server endpoint
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/create-payment-intent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currency: "usd",
            email: emailInput,
            amount: PRODUCT.price * 100,
            paymentMethodType: "card",
          }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create payment intent.");
      }

      const { client_secret: clientSecret } = await res.json();

      const { error } = await stripe.confirmPayment({
        // `elements` instance that was used to create the Payment Element
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/success`,
        },
      });

      if (error) {
        // This point will only be reached if there is an immediate error when
        // confirming the payment. Show error to your customer (for example, payment
        // details incomplete)
        setErrorMessage(error.message);
      } else {
        // Your customer will be redirected to your `return_url`.
      }
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("An error occurred while processing the payment.");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="px-4">
      <div className="mb-3">
        <label htmlFor="email-input">Email</label>
        <div>
          <input
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            type="email"
            id="email-input"
            placeholder="johndoe@gmail.com"
            className="p-3 w-full bg-[#fff] rounded-[5px] border border-[#e6e6e6] box-shadow-custom "
            required
          />
        </div>
      </div>
      <PaymentElement />
      <div className="flex justify-center">
        <button
          type="submit"
          disabled={!stripe || !elements}
          className="bg-indigo-500 text-white hover:bg-indigo-600 font-bold rounded shadow-[0.25rem_0.25rem_0px_0px_rgba(0,0,0,1)] focus:outline-none border-gray-900 hover:border-gray-900 border-2 mt-3"
        >
          Pay
        </button>
      </div>
      {/* Show error message to your customers */}
      {errorMessage && <div className="mt-2 text-red-500">{errorMessage}</div>}
    </form>
  );
};
