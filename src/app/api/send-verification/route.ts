// app/api/send-verification/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function POST(req: NextRequest) {
  try {
    if (!resend) {
      return NextResponse.json(
        { error: "Email service not configured (missing RESEND_API_KEY)" },
        { status: 503 }
      );
    }

    const { email, username, token, verificationUrl } = await req.json();

    if (!email || !username || !token) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create email HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 500px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 8px; }
            .header { color: #000; font-size: 24px; font-weight: bold; margin-bottom: 20px; }
            .button { display: inline-block; background: #000; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { color: #666; font-size: 12px; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 20px; }
            .warning { color: #666; font-size: 13px; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">Welcome to ResearchBridge! 🔬</div>
            <p>Hi <strong>${username}</strong>,</p>
            <p>Thanks for signing up! Please verify your email address to activate your account.</p>
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
            <p>Or copy and paste this link:</p>
            <p><code>${verificationUrl}</code></p>
            <div class="warning">
              <p><strong>⚠️ Security Note:</strong> This link expires in 24 hours. If you didn't create this account, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>ResearchBridge Team</p>
              <p>Finding research opportunities made simple.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email via Resend
    const result = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: email,
      subject: `Verify your ResearchBridge account - ${username}`,
      html: emailHtml,
    });

    if (result.error) {
      console.error("Resend error:", result.error);
      return NextResponse.json(
        { error: "Failed to send verification email" },
        { status: 500 }
      );
    }

    console.log(`✅ Verification email sent to ${email}`);
    return NextResponse.json({ success: true, message: "Verification email sent", id: result.data?.id });
  } catch (error: any) {
    console.error("Email sending error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send email" },
      { status: 500 }
    );
  }
}
