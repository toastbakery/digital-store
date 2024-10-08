// api/firebase.ts
import * as admin from "firebase-admin"; // Import admin from firebase-admin
import dotenv from "dotenv";

dotenv.config();

// Initialize Firebase Admin SDK only once
const serviceAccount: admin.ServiceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID as string,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") as string,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL as string,
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

export { db, admin }; // Export admin if needed elsewhere
