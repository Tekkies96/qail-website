// Vercel serverless function for website analysis
const fs = require('fs');
const path = require('path');

const TELEGRAM_BOT_TOKEN = '8810717882:AAHQRFrAsbjHjTXuSplUouUlR-ARLqm99Hg';
const TELEGRAM_CHAT_ID = '1981991043';
const LOG_FILE = process.env.VERCEL ? '/tmp/analyzed-urls.json' : '/Users/tekkies/.openclaw/workspace/qail-website/logs/analyzed-urls.json';

async function sendTelegram(cleanUrl, success, errorMsg) {
    const msg = success
        ? `🌐 *QAIL Analysis*\n\n*URL:* ${cleanUrl}\n*Status:* ✅ Analyzed`
        : `🌐 *QAIL Analysis*\n\n*URL:* ${cleanUrl}\n*Status:* ❌ ${errorMsg}`;

    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: msg,
                parse_mode: 'Markdown'
            })
        });
    } catch(e) {
        console.error('Telegram send failed:', e.message);
    }
}

function loadLogs() {
    try {
        if (fs.existsSync(LOG_FILE)) {
            return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
        }
    } catch(e) {}
    return [];
}

function saveLogs(logs) {
    try {
        const dir = path.dirname(LOG_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
    } catch(e) {
        console.error('Log save failed:', e.message);
    }
}

function logUrl(url, success, errorMsg, status) {
    try {
        const logs = loadLogs();
        logs.unshift({
            url,
            success,
            error: errorMsg || null,
            statusCode: status || null,
            timestamp: new Date().toISOString()
        });
        saveLogs(logs.slice(0, 1000));
    } catch(e) {
        console.error('Log write failed:', e.message);
    }
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).send('');
    }

    // Logs/status endpoint
    if (req.url.includes('/logs') || req.url.includes('/status')) {
        try {
            const logs = loadLogs();
            return res.status(200).json({ logs: logs.slice(0, 200), total: logs.length });
        } catch(e) {
            return res.status(200).json({ logs: [], error: e.message });
        }
    }

    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL required' });
    }

    let cleanUrl = url.toLowerCase().trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl;
    }
    cleanUrl = cleanUrl.replace(/\/$/, '');

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(cleanUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
            redirect: 'follow',
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const html = await response.text();

        if (process.env.VERCEL) {
            logUrl(cleanUrl, true, null, response.status);
            sendTelegram(cleanUrl, true, null);
        }

        return res.status(200).json({
            html,
            url: cleanUrl,
            status: response.status,
            ok: response.ok
        });
    } catch (error) {
        let fetchError = error.message;
        if (error.name === 'AbortError') {
            fetchError = 'Request timed out after 10 seconds';
        }
        if (process.env.VERCEL) {
            logUrl(cleanUrl, false, fetchError, null);
            sendTelegram(cleanUrl, false, fetchError);
        }
        return res.status(500).json({
            error: fetchError,
            code: error.code,
            name: error.name
        });
    }
};
