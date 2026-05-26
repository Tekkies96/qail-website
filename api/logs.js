// Vercel serverless function for logs
const fs = require('fs');
const path = require('path');

const LOG_FILE = process.env.VERCEL ? '/tmp/analyzed-urls.json' : path.join(__dirname, 'logs', 'analyzed-urls.json');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).send('');
    }

    try {
        const logs = fs.existsSync(LOG_FILE)
            ? JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'))
            : [];
        return res.status(200).json({ logs: logs.slice(0, 200), total: logs.length });
    } catch(e) {
        return res.status(200).json({ logs: [], error: e.message });
    }
};
