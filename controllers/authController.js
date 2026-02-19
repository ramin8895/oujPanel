const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const { SocksProxyAgent } = require('socks-proxy-agent');

const proxyUrl = 'socks5://127.0.0.1:10808';
const agent = new SocksProxyAgent(proxyUrl);
exports.register = async (req, res) => {
  const { name, email, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { name, email, password: hashed },
  });

  res.json(user);
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(400).json({ message: "User not found" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ message: "Wrong password" });

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
};


exports.facebookCallback = async (req, res) => {
  const { code, state } = req.query;
  const userId = state;

  if (!code) {
    return res.status(400).json({ message: "کد تایید از فیس‌بوک دریافت نشد." });
  }

  try {
    // ۱. تبادل کد با User Access Token (یکپارچه با v24.0)
    const tokenRes = await axios.get(
      "https://graph.facebook.com/v24.0/oauth/access_token",
      {
        params: {
          client_id: process.env.APP_ID,
          client_secret: process.env.APP_SECRET,
          redirect_uri: process.env.REDIRECT_URI,
          code,
        },
        httpsAgent: agent,
        timeout: 30000
      }
    );

    const userAccessToken = tokenRes.data.access_token;
    console.log("--- User Access Token Received ---");

    // ۲. دیباگ توکن برای اطمینان از صحت App ID
    const debugToken = await axios.get(`https://graph.facebook.com/v24.0/debug_token`, {
        params: {
            input_token: userAccessToken,
            access_token: `${process.env.APP_ID}|${process.env.APP_SECRET}`
        },
        httpsAgent: agent,
    });
    console.log("Token Scopes granted:", debugToken.data.data.scopes);

    // ۳. دریافت لیست پیج‌ها (اصلاح فیلدها)
    const pagesRes = await axios.get(
      "https://graph.facebook.com/v24.0/me/accounts",
      {
        params: {
          fields: "id,name,access_token,instagram_business_account{id,username,name}",
          access_token: userAccessToken,
        },
        httpsAgent: agent,
      }
    );

    console.log("Pages API Response:", JSON.stringify(pagesRes.data, null, 2));
    const pages = pagesRes.data.data;

    if (!pages || pages.length === 0) {
      return res.status(404).json({ 
        message: "هیچ پیج فیس‌بوکی پیدا نشد.",
        raw_data: pagesRes.data 
      });
    }

    // ۴. پیدا کردن پیجی که اینستاگرام به آن وصل است
    const pageWithIg = pages.find(p => p.instagram_business_account);
    
    if (!pageWithIg) {
        return res.status(400).json({
            message: "پیج پیدا شد اما اکانت اینستاگرام بیزنس به آن متصل نیست.",
            hint: "در تنظیمات پیج فیس‌بوک، از بخش Linked Accounts اینستاگرام را وصل کنید.",
            pages_found: pages.map(p => p.name)
        });
    }

    const igUserId = pageWithIg.instagram_business_account.id;
    console.log(`Success! Connecting to IG: ${pageWithIg.instagram_business_account.username}`);

    // ۵. ذخیره در دیتابیس با Prisma
    await prisma.instagramAccount.upsert({
      where: { igUserId: igUserId },
      update: {
        pageAccessToken: pageWithIg.access_token,
        userId: userId,
      },
      create: {
        userId: userId,
        igUserId: igUserId,
        pageId: pageWithIg.id,
        pageAccessToken: pageWithIg.access_token,
        isBotActive: false,
      },
    });

    console.log("Account successfully saved in DB.");
    res.redirect("http://localhost:5173/dashboard");

  } catch (error) {
    console.error("--- Facebook Auth Error ---");
    const errorData = error.response?.data || error.message;
    console.error(errorData);

    res.status(500).json({
      message: "عملیات احراز هویت با خطا مواجه شد.",
      error: error.response?.data?.error?.message || error.message,
    });
  }
};