const router = require("express").Router();
const webhook = require("../controllers/webhookController");

router.get("/", webhook.verifyWebhook);
router.post("/", webhook.handleWebhook);

module.exports = router;
