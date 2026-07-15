// Report Download - validates token and serves report
// Token contains: website_url, package, email, payment_id, amount

const TELEGRAM_BOT_TOKEN = '881071…99Hg';
const TELEGRAM_CHAT_ID = '1981991043';

function validateToken(token) {
    try {
        const payload = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
        
        // Check expiration (7 days)
        if (Date.now() > payload.exp) {
            return { valid: false, error: 'Download link has expired' };
        }
        
        return { valid: true, data: payload };
    } catch(e) {
        return { valid: false, error: 'Invalid download token' };
    }
}

async function generateReportPDF(data) {
    // Generate a simple text/HTML report
    // In production, generate a proper PDF here
    const { website_url, package, email, amount } = data;
    
    const reportHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Website Analysis Report - ${website_url}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; }
        h1 { color: #2563eb; }
        .section { margin: 30px 0; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; }
        .score { font-size: 48px; font-weight: bold; color: #2563eb; }
        .meta { color: #6b7280; font-size: 14px; }
    </style>
</head>
<body>
    <h1>🌐 Website Analysis Report</h1>
    <p class="meta">Generated: ${new Date().toLocaleDateString('en-ZA')}</p>
    <p class="meta">Package: ${package === 'full' ? 'Full Report + Analysis' : 'Website Analysis Report'}</p>
    <p class="meta">Website: ${website_url}</p>
    <p class="meta">Email: ${email}</p>
    
    <div class="section">
        <h2>📊 Analysis Summary</h2>
        <p>Your website has been analyzed. This is a placeholder report.</p>
        <p class="score">--</p>
        <p>For the full analysis, please contact Quantum AI Labs at info@qail.co.za</p>
    </div>
    
    <div class="section">
        <h2>Next Steps</h2>
        <ul>
            <li>Review this preliminary analysis</li>
            <li>Contact us for the complete detailed report</li>
            <li>Implement recommended improvements</li>
        </ul>
    </div>
    
    <footer>
        <p>Powered by <a href="https://qail.co.za">Quantum AI Labs</a></p>
    </footer>
</body>
</html>`;
    
    return reportHtml;
}

module.exports = async function handler(req, res) {
    // Extract token from query
    const url = new URL(req.url, 'https://qail.co.za');
    const token = url.searchParams.get('token');
    
    if (!token) {
        return res.status(400).send('<h1>Missing download token</h1>');
    }
    
    // Validate token
    const validation = validateToken(token);
    if (!validation.valid) {
        return res.status(403).send(`<h1>Error</h1><p>${validation.error}</p>`);
    }
    
    const data = validation.data;
    
    // Generate report
    const reportHtml = await generateReportPDF(data);
    
    // Send report as HTML (could be PDF with proper PDF generation library)
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="website-analysis-${data.website_url.replace(/[^a-z0-9]/gi, '-')}.html"`);
    
    return res.status(200).send(reportHtml);
};
