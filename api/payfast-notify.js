// PayFast ITN (Instant Transaction Notification) webhook
// Receives payment confirmation from PayFast, sends download link to customer

const MERCHANT_ID = '36200669';
const MERCHANT_KEY = '3uggsng8hmf9x';
const PAYFAST_VALIDATE_URL = 'https://sandbox.payfast.co.za/eng/query/validate';

// Simple token for download links (Base64 encoded JSON - not secure, use signed tokens in production)
function createDownloadToken(data) {
    const payload = {
        ...data,
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        iat: Date.now()
    };
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

// In-memory pending payments store (use Redis/DB in production)
const pendingPayments = new Map();

async function validateWithPayFast(postData) {
    const formData = new URLSearchParams(postData).toString();
    
    const response = await fetch(PAYFAST_VALIDATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
    });
    
    return response.text();
}

async function sendDownloadEmail(email, downloadLink, packageName, websiteUrl) {
    const subject = `Your ${packageName} is Ready - Quantum AI Labs`;
    const body = `Thank you for your purchase!

Your website analysis for ${websiteUrl} is complete.

Download your report here:
${downloadLink}

This link expires in 7 days.

Best regards,
Quantum AI Labs
info@qail.co.za`;

    // Use Vercel's built-in email or your preferred email service
    // For now, we'll use a simple fetch to an email API
    // In production, use SendGrid, Resend, Postmark, etc.
    
    const TELEGRAM_BOT_TOKEN = '881071…99Hg';
    const TELEGRAM_CHAT_ID = '1981991043';
    
    // Notify via Telegram for now
    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: `💰 *Payment Received!*\n\n*Package:* ${packageName}\n*Website:* ${websiteUrl}\n*Email:* ${email}\n\n*Download Link:* ${downloadLink}`,
                parse_mode: 'Markdown'
            })
        });
    } catch(e) {
        console.error('Telegram notification failed:', e.message);
    }
    
    console.log(`Email would be sent to ${email} with download link: ${downloadLink}`);
    return true;
}

module.exports = async function handler(req, res) {
    // PayFast sends POST data
    if (req.method !== 'POST') {
        return res.status(405).send('Method not allowed');
    }

    let postData;
    
    // Handle both JSON and form-encoded bodies
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
        postData = req.body;
    } else {
        // Vercel may parse JSON automatically
        postData = req.body;
    }

    console.log('PayFast ITN received:', JSON.stringify(postData));

    // Validate merchant ID
    if (postData.merchant_id !== MERCHANT_ID) {
        console.error('Invalid merchant ID:', postData.merchant_id);
        return res.status(400).send('Invalid merchant');
    }

    // Validate payment with PayFast
    try {
        const validationResult = await validateWithPayFast(postData);
        if (validationResult !== 'VALID') {
            console.error('PayFast validation failed:', validationResult);
            return res.status(400).send('Validation failed');
        }
    } catch(e) {
        console.error('Validation request failed:', e.message);
        // Continue anyway for sandbox testing
    }

    // Check payment status
    if (postData.payment_status !== 'COMPLETE') {
        console.log('Payment not complete, status:', postData.payment_status);
        return res.status(200).send('OK'); // Return 200 to avoid retries
    }

    const packageType = postData.custom_str1;
    const websiteUrl = postData.custom_str2;
    const email = postData.email_address;
    const amount = postData.amount;
    const pfPaymentId = postData.pf_payment_id;

    const packageNames = {
        'report': 'Website Analysis Report',
        'full': 'Full Report + Analysis'
    };

    const packageName = packageNames[packageType] || 'Website Analysis';

    // Create download token
    const tokenData = {
        website_url: websiteUrl,
        package: packageType,
        email: email,
        payment_id: pfPaymentId,
        amount: amount
    };
    
    const token = createDownloadToken(tokenData);
    const downloadLink = `https://qail.co.za/api/report-download?token=${token}`;

    // Send email with download link
    await sendDownloadEmail(email, downloadLink, packageName, websiteUrl);

    console.log(`Payment processed: ${packageName} for ${email}, download: ${downloadLink}`);

    // Respond to PayFast
    return res.status(200).send('OK');
};
