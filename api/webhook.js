// api/webhook.js
const bot = require('../bot');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(200).send('ok');
    await bot.handleUpdate(req.body);   // procesa update de Telegram
    return res.status(200).end();
  } catch (e) {
    console.error(e);
    return res.status(500).end();
  }
};
