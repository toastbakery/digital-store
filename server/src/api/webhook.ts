import { db, admin } from "./firebase";
import Stripe from "stripe";
import sendOrderEmail from "../send-order-email";
import { IncomingMessage, ServerResponse } from "http"; // Import these Node.js types

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20",
});

export const config = {
  api: {
    bodyParser: false, // Disable body parsing for Stripe Webhook
  },
};

// Helper function to get the raw body
const getRawBody = (req: IncomingMessage): Promise<Buffer> => {
  return new Promise<Buffer>((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(Buffer.from(data)));
    req.on("error", reject);
  });
};

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
) {
  const sig = req.headers["stripe-signature"] as string;

  try {
    const rawBody = await getRawBody(req);
    const event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );

    const dataObject = event.data.object;
    const eventType = event.type;

    if (eventType === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const paymentId = paymentIntent.id;

      const paymentRef = db
        .collection("payments")
        .where("payment_id", "==", paymentId);
      const paymentSnapshot = await paymentRef.get();

      if (paymentSnapshot.empty) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ message: "Payment not found" }));
      }

      const paymentRecord = paymentSnapshot.docs[0];
      await paymentRecord.ref.update({ isConfirmed: true });

      const paymentData = paymentRecord.data();
      await sendOrderEmail({ email: paymentData.user_email });

      res.statusCode = 200;
      res.end(JSON.stringify({ message: "Payment confirmed successfully" }));
    } else {
      res.statusCode = 400;
      res.end(JSON.stringify({ message: "Unknown event type" }));
    }
  } catch (err) {
    if (err instanceof Error) {
      // Now TypeScript knows 'err' is an Error and has a 'message' property
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Webhook error", details: err.message }));
    } else {
      // Handle cases where 'err' is not an instance of Error
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Unknown error occurred" }));
    }
  }
}
