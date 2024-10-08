import express from "express";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import dotenv from "dotenv";
import bodyParser from "body-parser"; // To handle raw body in webhooks
import cors from "cors"; // Ensure you've installed this and @types/cors
import sendOrderEmail from "./send-order-email"; // Import send-order-email module

dotenv.config();

// Initialize Firebase Admin SDK
// Define the service account object
const serviceAccount: admin.ServiceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID as string,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") as string,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL as string,
};
//const serviceAccount = require("../serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20",
});

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  "http://localhost:5173", // Local development environment
  "https://toastbakery.github.io", // GitHub Pages production environment
];

// Or a simpler version handling all CORS requests
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS", // Ensure OPTIONS method is included
    allowedHeaders: ["Content-Type"],
    credentials: true,
  })
);

// Stripe Webhook Handler
app.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }), // Only parse raw body for webhook
  async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    let event;

    try {
      // Verify webhook signature using STRIPE_WEBHOOK_SECRET
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET as string
      );
    } catch (err) {
      if (err instanceof Error) {
        console.error("Error processing webhook:", err.message);
      } else {
        console.error("Unknown error:", err);
      }
      return res.sendStatus(400);
    }

    const dataObject = event.data.object;

    // Ensure dataObject is a PaymentIntent
    if (dataObject && "id" in dataObject && typeof dataObject.id === "string") {
      const paymentId = dataObject.id;
      console.log("paymentId", paymentId);

      const eventType = event.type;
      let paymentConfirmed;

      if (eventType === "payment_intent.succeeded") {
        paymentConfirmed = true;
        console.log("eventType", eventType);
      } else if (eventType === "payment_intent.payment_failed") {
        paymentConfirmed = false;
      } else {
        return res.status(400).send({
          message: "Received unknown event type",
        });
      }

      try {
        // Find the corresponding payment record in Firestore
        const paymentRef = db
          .collection("payments")
          .where("payment_id", "==", paymentId);
        const paymentSnapshot = await paymentRef.get();
        console.log("Looking for payment with payment_id:", paymentId);
        if (paymentSnapshot.empty) {
          console.log("No payment found for payment_id:", paymentId);
          return res.status(404).send({
            message: "Payment not found",
          });
        }
        console.log("Payment found:", paymentSnapshot.docs[0].data());
        const paymentRecord = paymentSnapshot.docs[0];
        await paymentRecord.ref.update({ isConfirmed: paymentConfirmed });

        // Send order confirmation email
        const paymentData = paymentRecord.data();
        //console.log("paymentRecord:", paymentRecord);
        console.log("paymentData:", paymentData);
        await sendOrderEmail({ email: paymentData.user_email });

        return res.status(200).send({
          message: "Payment confirmed successfully",
        });
      } catch (error) {
        console.error("Error updating payment status:", error);
        return res.status(500).send({
          message: "Internal server error",
        });
      }
    } else {
      return res.status(400).send({
        message: "Invalid event data object",
      });
    }
  }
);

// Parse JSON bodies for non-webhook routes, this line should behind webhook to avoid parsing json for all the post
app.use(express.json());

// Route to create PaymentIntent
app.post("/create-payment-intent", async (req, res) => {
  const { email, amount, currency } = req.body;

  console.log("Received create-payment-intent request:", req.body);

  if (!email || !amount || !currency) {
    return res.status(400).send({ error: "Missing required parameters" });
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

    res.status(200).send({
      client_secret: paymentIntent.client_secret,
    });
  } catch (error) {
    res.status(500).send({ error: "Failed to create payment intent" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
