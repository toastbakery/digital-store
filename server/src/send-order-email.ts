import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

type Params = {
  email: string;
};

const resend = new Resend(process.env.RESEND_API_KEY as string);
const fromEmail = process.env.FROM_EMAIL as string;

export default async function sendOrderEmail(params: Params) {
  try {
    const data = await resend.emails.send({
      from: fromEmail,
      to: params.email,
      subject: "Your Order",
      html: '<div>Thank you for your order! Click <a href="https://your-link.com">here</a> to access it.</div>',
    });
    console.log("Email sent:", data);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}
