const prisma = require("../config/prisma");

// GET /instagram/accounts
exports.getAccounts = async (req, res) => {
  try {
    const accounts = await prisma.instagramAccount.findMany({
      where: { userId: req.user.id },
      select: {
        id: true,
        igUserId: true,
        pageId: true,
        isBotActive: true,
      },
    });
    res.json(accounts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /instagram/accounts/:id
exports.toggleBot = async (req, res) => {
  try {
    const { id } = req.params;
    const account = await prisma.instagramAccount.findUnique({ where: { id } });

    if (!account || account.userId !== req.user.id) {
      return res.status(404).json({ message: "Account not found" });
    }

    const updated = await prisma.instagramAccount.update({
      where: { id },
      data: { isBotActive: !account.isBotActive },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /instagram/rules
exports.getRules = async (req, res) => {
  try {
    // اگر کاربر چند حساب داره، الان فقط Rules حساب اول رو می‌فرستیم
    const account = await prisma.instagramAccount.findFirst({
      where: { userId: req.user.id },
    });

    if (!account) return res.status(404).json({ message: "No Instagram account connected" });

    const rules = await prisma.autoReplyRule.findMany({
      where: { accountId: account.id },
    });

    res.json(rules);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /instagram/rules
exports.addRule = async (req, res) => {
  try {
    const { keyword, replyText } = req.body;
    if (!keyword || !replyText) {
      return res.status(400).json({ message: "Keyword and replyText are required" });
    }

    const account = await prisma.instagramAccount.findFirst({
      where: { userId: req.user.id },
    });
    if (!account) return res.status(404).json({ message: "No Instagram account connected" });

    const rule = await prisma.autoReplyRule.create({
      data: {
        accountId: account.id,
        keyword,
        replyText,
      },
    });

    res.json(rule);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
