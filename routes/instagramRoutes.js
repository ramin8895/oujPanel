const router = require("express").Router();
const authMiddleware = require("../middlewares/authMiddleware");
const instagramController = require("../controllers/instagramController");

router.use(authMiddleware);

// حساب‌های اینستاگرام کاربر
router.get("/accounts", instagramController.getAccounts);

// فعال/غیرفعال کردن ربات
router.patch("/accounts/:id", instagramController.toggleBot);

// قوانین پاسخ خودکار
router.get("/rules", instagramController.getRules);
router.post("/rules", instagramController.addRule);

module.exports = router;
