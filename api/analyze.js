// Vercel serverless function for website analysis
module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).send('');
    }

    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL required' });
    }

    let cleanUrl = url.toLowerCase().trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl;
    }

    // Strip trailing slash
    cleanUrl = cleanUrl.replace(/\/$/, '');

    let html = '';
    let fetchError = null;

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

        html = await response.text();

        return res.status(200).json({
            html,
            url: cleanUrl,
            status: response.status,
            ok: response.ok
        });
    } catch (error) {
        fetchError = error.message;
        if (error.name === 'AbortError') {
            fetchError = 'Request timed out after 10 seconds';
        }
        return res.status(500).json({
            error: fetchError,
            code: error.code,
            name: error.name
        });
    }
};
