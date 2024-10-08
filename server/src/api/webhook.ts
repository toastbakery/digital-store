import { db, admin } from "./firebase";
import Stripe from "stripe";
import sendOrderEmail from "../send-order-email";
import { IncomingMessage, ServerResponse } from "http"; // Import these Node.js types
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

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
  // Ensure we only accept POST requests from Stripe
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.writeHead(405, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({ error: `Method ${req.method} Not Allowed` })
    );
  }

  const sig = req.headers["stripe-signature"] as string;

  try {
    const rawBody = await getRawBody(req);

    // Verify the Stripe event
    const event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );

    const dataObject = event.data.object;
    const eventType = event.type;

    if (eventType === "payment_intent.succeeded") {
      const paymentIntent = dataObject as Stripe.PaymentIntent;
      const paymentId = paymentIntent.id;

      // Retrieve payment from Firestore by payment ID
      const paymentRef = db
        .collection("payments")
        .where("payment_id", "==", paymentId);
      const paymentSnapshot = await paymentRef.get();

      if (paymentSnapshot.empty) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ message: "Payment not found" }));
      }

      const paymentRecord = paymentSnapshot.docs[0];

      // Update the payment record to confirm the payment
      await paymentRecord.ref.update({ isConfirmed: true });

      const paymentData = paymentRecord.data();

      // Send order confirmation email
      await sendOrderEmail({ email: paymentData.user_email });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Payment confirmed successfully" }));
    } else {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Unknown event type" }));
    }
  } catch (err) {
    if (err instanceof Error) {
      console.error("Error handling Stripe webhook:", err.message);

      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Webhook error", details: err.message }));
    } else {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unknown error occurred" }));
    }
  }
}
