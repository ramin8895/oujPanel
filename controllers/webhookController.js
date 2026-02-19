const prisma = require("../config/prisma");
const sendMessage = require("../utils/sendMessage");

exports.verifyWebhook = (req, res) => {
  if (req.query["hub.verify_token"] === process.env.VERIFY_TOKEN) {
    return res.send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
};

exports.handleWebhook = async (req, res) => {
  const body = req.body;

  if (body.object === "instagram") {
    for (const entry of body.entry) {
      for (const event of entry.messaging) {

        if (!event.message) continue;

        const senderId = event.sender.id;
        const messageText = event.message.text;

        const account = await prisma.instagramAccount.findUnique({
          where: { igUserId: entry.id }
        });

        if (!account || !account.isBotActive) continue;

        const rules = await prisma.autoReplyRule.findMany({
          where: { accountId: account.id }
        });

        let reply = "پیام شما دریافت شد 🙌";

        for (const rule of rules) {
          if (messageText.includes(rule.keyword)) {
            reply = rule.replyText;
            break;
          }
        }

        await sendMessage(account.igUserId, senderId, reply, account.pageAccessToken);

        await prisma.conversation.create({
          data: {
            accountId: account.id,
            senderId,
            message: messageText,
            botReply: reply
          }
        });
      }
    }
  }

  res.status(200).send("EVENT_RECEIVED");
};
