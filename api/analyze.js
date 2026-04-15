// Vercel serverless function for website analysis
module.exports = async function handler(req, res) {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({ error: 'URL required' });
    }
    
    try {
        // Clean the URL
        let cleanUrl = url.toLowerCase();
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            cleanUrl = 'https://' + cleanUrl;
        }
        
        // Use fetch to get the website
        const response = await fetch(cleanUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            redirect: 'follow'
        });
        
        const html = await response.text();
        
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        return res.status(200).json({ html, url: cleanUrl });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

module.exports.options = async function(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).send('');
};
