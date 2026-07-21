const https = require('https');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, cellphone, subject, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '1981991043';

  const text = `📬 *Nuwe Kontak Insending*

*Naam:* ${name}
*Sel:* ${cellphone || 'N/A'}
*Email:* ${email}
*Onderwerp:* ${subject || 'N/A'}

*Boodskap:*
${message}`;

  if (TELEGRAM_BOT_TOKEN) {
    const body = JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: 'Markdown'
    });

    await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.telegram.org',
        path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      };

      const req2 = https.request(options, (res2) => {
        res2.on('data', () => {});
        res2.on('end', resolve);
      });
      req2.on('error', reject);
      req2.write(body);
      req2.end();
    });
  }

  return res.status(200).json({ success: true });
};
