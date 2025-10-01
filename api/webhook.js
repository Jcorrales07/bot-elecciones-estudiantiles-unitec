// api/webhook.js
const bot = require('../bot');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(200).send('ok'); // health/GET
    }
    const update = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    await bot.handleUpdate(update);
    return res.status(200).end();
  } catch (e) {
    console.error('Webhook error:', e);
    return res.status(500).end();
  }
};
