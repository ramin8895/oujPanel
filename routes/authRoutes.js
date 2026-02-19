const router = require("express").Router();
const auth = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const { default: axios } = require("axios");
const { SocksProxyAgent } = require("socks-proxy-agent");

const proxyUrl = "socks5://127.0.0.1:10808";

const agent = new SocksProxyAgent(proxyUrl);

router.post("/register", auth.register);
router.post("/login", auth.login);
router.get("/facebook/callback", auth.facebookCallback);
router.get("/facebook/connect", async (req, res) => {
  const token = req.query.token;

  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ۱. تعریف دقیق اسکوپ‌ها - صفحات برای دیده شدن در me/accounts به این موارد نیاز دارند
    const scopes = [
      "public_profile",
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_metadata",
      "instagram_basic",
      "instagram_manage_messages",
      "business_management",
    ].join(",");

    // ۲. استفاده از ورژن ۲۴ که فیس‌بوک برای اپلیکیشن شما اجباری کرده است
    const facebookLoginUrl = `https://www.facebook.com/v24.0/dialog/oauth?client_id=${
      process.env.APP_ID
    }&redirect_uri=${encodeURIComponent(
      process.env.REDIRECT_URI,
    )}&scope=${scopes}&state=${decoded.id}&response_type=code`;

    console.log("Redirecting to Facebook with Scopes:", scopes);

    res.redirect(facebookLoginUrl);
  } catch (err) {
    console.error("JWT or Redirect Error:", err.message);
    res.status(401).json({ message: "Invalid token: " + err.message });
  }
});

// ۱. مسیر تایید وب‌هوک (GET)
// فیس‌بوک یک کد تصادفی می‌فرستد و شما باید آن را برگردانید
router.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = "UYnH5+p2qQMsPvIm9S5yZ1BZc5rtN1COd0iXK1zxYMA=";

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("--- Webhook Verification Attempt ---");
  console.log("Mode:", mode);
  console.log("Token:", token);

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ WEBHOOK_VERIFIED");
    return res.status(200).send(challenge);
  } else {
    console.error("❌ WEBHOOK_VERIFICATION_FAILED");
    return res.sendStatus(403);
  }
});
router.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object === "instagram") {
    body.entry.forEach(async (entry) => {
      const webhook_event = entry.messaging[0];
      console.log("📩 پیام جدید دریافت شد:", webhook_event);

      const senderId = webhook_event.sender.id; 
      const messageText = webhook_event.message?.text; 

      if (messageText) {
        console.log(`متن پیام: ${messageText} از طرف: ${senderId}`);
        
       
      }
    });

    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});
module.exports = router;
