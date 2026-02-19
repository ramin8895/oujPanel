const router = require("express").Router();
const auth = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const { default: axios } = require("axios");
const { SocksProxyAgent } = require("socks-proxy-agent");

// تنظیمات پراکسی برای عبور از فیلترینگ
const proxyUrl = "socks5://127.0.0.1:10808";
const agent = new SocksProxyAgent(proxyUrl);

// --- متدهای مربوط به احراز هویت ---
router.post("/register", auth.register);
router.post("/login", auth.login);
router.get("/facebook/callback", auth.facebookCallback);

router.get("/facebook/connect", async (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const scopes = [
      "public_profile",
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_metadata",
      "instagram_basic",
      "instagram_manage_messages",
      "business_management",
    ].join(",");

    const facebookLoginUrl = `https://www.facebook.com/v24.0/dialog/oauth?client_id=${
      process.env.APP_ID
    }&redirect_uri=${encodeURIComponent(
      process.env.REDIRECT_URI
    )}&scope=${scopes}&state=${decoded.id}&response_type=code`;

    console.log("Redirecting to Facebook with Scopes:", scopes);
    res.redirect(facebookLoginUrl);
  } catch (err) {
    console.error("JWT or Redirect Error:", err.message);
    res.status(401).json({ message: "Invalid token: " + err.message });
  }
});

// --- بخش Webhook (تاییدیه متا) ---
router.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = "UYnH5+p2qQMsPvIm9S5yZ1BZc5rtN1COd0iXK1zxYMA=";

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ WEBHOOK_VERIFIED");
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// --- بخش Webhook (دریافت پیام) ---
router.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body && body.object === "instagram") {
    if (body.entry && Array.isArray(body.entry)) {
      // استفاده از for...of برای مدیریت درست await
      for (const entry of body.entry) {
        if (entry.messaging && entry.messaging[0]) {
          await handleEvent(entry.messaging[0]);
        } 
        else if (entry.changes && entry.changes[0] && entry.changes[0].value) {
          await handleEvent(entry.changes[0].value);
        }
      }
    }
    return res.status(200).send("EVENT_RECEIVED");
  } else {
    return res.sendStatus(404);
  }
});

// --- توابع کمکی پردازش و ارسال ---

async function handleEvent(event) {
  const senderId = event.sender?.id;
  const messageText = event.message?.text;

  if (messageText && senderId) {
    console.log(`📩 پیام دریافت شد: "${messageText}" از طرف: ${senderId}`);
    
    // تست پاسخ خودکار
    const replyText = `سلام! پیام شما را دریافت کردم: ${messageText}`;
    await sendInstagramMessage(senderId, replyText);
  } else {
    console.log("⚠️ رویداد دریافت شد اما حاوی متن پیام نبود.");
  }
}

async function sendInstagramMessage(senderId, text) {
  // توکن صفحه را از .env می‌خواند
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN; 
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;

  const payload = {
    recipient: { id: senderId },
    message: { text: text }
  };

  try {
    const response = await axios.post(url, payload, {
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 10000 // ۱۰ ثانیه تایم‌اوت
    });
    console.log(`✅ پاسخ ارسال شد به: ${senderId}`);
    return response.data;
  } catch (error) {
    console.error("❌ خطا در ارسال پیام به اینستاگرام:", error.response?.data || error.message);
  }
}

module.exports = router;