// routes/authInstagram.js
const router = require("express").Router();

router.get("/facebook/connect", async (req, res) => {
  const token = req.query.token;

  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.APP_ID}&redirect_uri=${process.env.REDIRECT_URI}&scope=instagram_basic,instagram_manage_messages,pages_show_list,pages_read_engagement&state=${decoded.id}`;

    res.redirect(url);
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
});

module.exports = router;
