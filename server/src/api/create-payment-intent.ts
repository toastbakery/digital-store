import { db, admin } from "./firebase"; // Import Firestore instance
import Stripe from "stripe";
import { IncomingMessage, ServerResponse } from "http"; // Use standard Node.js types
import dotenv from "dotenv";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20",
});

export default async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method === "POST") {
    let body = "";

    // Collect data from the request
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      const { email, amount, currency } = JSON.parse(body);

      console.log("Received create-payment-intent request:", {
        email,
        amount,
        currency,
      });

      if (!email || !amount || !currency) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({ error: "Missing required parameters" })
        );
      }

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency,
          receipt_email: email,
        });

        // Save payment record to Firestore
        const paymentId = paymentIntent.id;
        await db.collection("payments").add({
          user_email: email,
          payment_id: paymentId,
          isConfirmed: false, // Initially not confirmed
          amount,
          currency,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            client_secret: paymentIntent.client_secret,
          })
        );
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to create payment intent" }));
      }
    });
  } else {
    res.setHeader("Allow", ["POST"]);
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: `Method ${req.method} Not Allowed` }));
  }
};
