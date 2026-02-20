const router = require("express").Router();
const auth = require("../controllers/authController");
const jwt = require("jsonwebtoken");
const axios = require("axios"); // اصلاح نحوه Import اکسوس

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

// --- بخش Webhook (تاییدیه متا - GET) ---
router.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = "UYnH5+p2qQMsPvIm9S5yZ1BZc5rtN1COd0iXK1zxYMA=";

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ WEBHOOK_VERIFIED");
    return res.status(200).send(challenge);
  } else {
    console.error("❌ WEBHOOK_VERIFICATION_FAILED");
    return res.sendStatus(403);
  }
});

// --- بخش Webhook (دریافت پیام - POST) ---
// router.post("/webhook", async (req, res) => {
//   const body = req.body;

//   // لاگ برای اطمینان از رسیدن درخواست
//   console.log("📩 درخواست جدید در Webhook دریافت شد");

//   if (body && body.object === "instagram") {
//     if (body.entry && Array.isArray(body.entry)) {
//       for (const entry of body.entry) {
//         // ۱. بررسی پیام‌های مستقیم (Messaging)
//         if (entry.messaging && entry.messaging[0]) {
//           await handleEvent(entry.messaging[0]);
//         } 
//         // ۲. بررسی تغییرات (Changes - مخصوص تست‌های پنل متا)
//         else if (entry.changes && entry.changes[0] && entry.changes[0].value) {
//           await handleEvent(entry.changes[0].value);
//         }
//       }
//     }
//     return res.status(200).send("EVENT_RECEIVED");
//   } else {
//     console.log("⚠️ آبجکت دریافت شده اینستاگرام نیست یا بدنه خالی است.");
//     return res.sendStatus(404);
//   }
// });
router.post("/webhook", async (req, res) => {
  const body = req.body;

  console.log("📩 درخواست جدید در Webhook دریافت شد");

  if (body.object !== "instagram") {
    return res.sendStatus(404);
  }

  for (const entry of body.entry || []) {

    // ✅ حالت 1: messaging
    if (entry.messaging) {
      for (const event of entry.messaging) {
        await handleMessagingEvent(event);
      }
    }

    // ✅ حالت 2: changes (پیام‌های واقعی)
    if (entry.changes) {
      for (const change of entry.changes) {
        const value = change.value;

        if (value.messages) {
          for (const msg of value.messages) {
            await handleChangeMessage(msg);
          }
        }
      }
    }
  }

  res.status(200).send("EVENT_RECEIVED");
});
// --- توابع کمکی پردازش و ارسال ---

// async function handleEvent(event) {
//   const senderId = event.sender?.id;
//   const messageText = event.message?.text;

//   if (messageText && senderId) {
//     console.log(`📩 پردازش پیام: "${messageText}" از طرف: ${senderId}`);
    
//     // متن پاسخ خودکار
//     const replyText = `سلام! پیام شما را دریافت کردم: ${messageText}`;
    
//     // ارسال پاسخ
//     await sendInstagramMessage(senderId, replyText);
//   } else {
//     console.log("⚠️ رویداد دریافت شد اما فاقد متن یا آیدی فرستنده بود.");
//   }
// }


async function handleMessagingEvent(event) {
  if (event.message?.is_echo) return;

  const senderId = event.sender?.id;
  const text = event.message?.text;

  if (!senderId || !text) return;

  console.log("📩 messaging:", text);

  await sendInstagramMessage(senderId, text);
}
async function handleChangeMessage(msg) {
  const senderId = msg.from?.id;
  const text = msg.text?.body;

  if (!senderId || !text) {
    console.log("⛔ پیام change بدون متن");
    return;
  }

  console.log(`📩 پیام واقعی IG: ${text}`);

  await sendInstagramMessage(senderId, `پاسخ: ${text}`);
}

async function sendInstagramMessage(senderId, text) {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN; 
  const url = `https://graph.facebook.com/v24.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;

  const payload = {
    recipient: { id: senderId },
    message: { text: text }
  };

  try {
    const response = await axios.post(url, payload, { timeout: 10000 });
    console.log(`✅ پاسخ با موفقیت ارسال شد به: ${senderId}`);
    return response.data;
  } catch (error) {
    console.error("❌ خطا در ارسال پیام به اینستاگرام:", error.response?.data || error.message);
  }
}

module.exports = router;