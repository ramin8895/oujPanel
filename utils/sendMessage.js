const axios = require("axios");

module.exports = async (igUserId, senderId, text, token) => {
  await axios.post(
    `https://graph.facebook.com/v19.0/${igUserId}/messages`,
    {
      recipient: { id: senderId },
      message: { text }
    },
    {
      params: { access_token: token }
    }
  );
};
