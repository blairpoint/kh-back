import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'localhost',
  port: 25,
  secure: false,
  tls: {
    rejectUnauthorized: false
  }
});

export async function sendVerificationEmail(email, token) {
  const confirmUrl = `https://dev.kohartist.com/confirm-email?token=${token}`;
  
  const mailOptions = {
    from: '"Kohartist Portal" <noreply@dev.kohartist.com>',
    to: email,
    subject: 'Confirm your Kohartist Account',
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background-color: #07070a; color: #f1f1f4; border-radius: 16px; border: 1px solid #27272a; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="font-size: 24px; font-weight: bold; color: #ffffff; tracking-tight: -0.05em;">Kohartist</span>
          <span style="display: block; font-size: 10px; color: #f97316; font-family: monospace; letter-spacing: 0.1em; margin-top: 4px;">TIPPING PORTAL</span>
        </div>
        <h2 style="color: #ffffff; text-align: center; font-size: 20px; font-weight: 800; margin-bottom: 10px;">Verify Your Email Address</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #a1a1aa; text-align: center; margin-bottom: 30px;">
          Welcome to the direct artist payment network. Please click the button below to confirm your identity and configure your secure account password.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${confirmUrl}" style="background-color: #f97316; color: #ffffff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 13px; display: inline-block; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.25); text-transform: uppercase; letter-spacing: 0.05em;">
            Confirm Email & Set Password
          </a>
        </div>
        <p style="font-size: 11px; color: #71717a; text-align: center; line-height: 1.4;">
          This verification link is valid for 1 hour.<br/>If you did not request this, you can safely ignore this mail.
        </p>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
}

export async function sendStartupTestEmail() {
  const mailOptions = {
    from: '"Kohartist Portal" <noreply@dev.kohartist.com>',
    to: 'blair.robson@icloud.com',
    subject: `Kohartist Build Load Alert — ${new Date().toISOString()}`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background-color: #07070a; color: #f1f1f4; border-radius: 16px; border: 1px solid #27272a; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="font-size: 24px; font-weight: bold; color: #ffffff; tracking-tight: -0.05em;">Kohartist</span>
          <span style="display: block; font-size: 10px; color: #f97316; font-family: monospace; letter-spacing: 0.1em; margin-top: 4px;">TIPPING PORTAL</span>
        </div>
        <h2 style="color: #ffffff; text-align: center; font-size: 20px; font-weight: 800; margin-bottom: 10px;">Server Initialized</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #a1a1aa; text-align: center; margin-bottom: 30px;">
          This notification is sent automatically when the Kohartist backend server is loaded for the first time after a compilation build.
        </p>
        <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
          <p style="font-size: 13px; color: #a1a1aa; margin: 4px 0;"><strong>Status:</strong> Success ✓</p>
          <p style="font-size: 13px; color: #a1a1aa; margin: 4px 0;"><strong>Host:</strong> dev.kohartist.com</p>
          <p style="font-size: 13px; color: #a1a1aa; margin: 4px 0;"><strong>Timestamp:</strong> ${new Date().toUTCString()}</p>
        </div>
        <p style="font-size: 11px; color: #71717a; text-align: center; line-height: 1.4;">
          Kohartist FinTech Compliance Automated Monitor
        </p>
      </div>
    `
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log("Startup test email successfully sent to blair.robson@icloud.com");
  } catch (err) {
    console.error("Failed to send startup test email:", err);
  }
}
