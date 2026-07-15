// PayFast Checkout - creates payment redirect
// Called from services.html when user clicks "Buy Now"

const MERCHANT_ID = '36200669';
const MERCHANT_KEY = '3uggsng8hmf9x';
const PAYFAST_URL = 'https://sandbox.payfast.co.za/eng/process'; // Use live: https://www.payfast.co.za/eng/process
const RETURN_URL = 'https://qail.co.za/payment-success.html';
const CANCEL_URL = 'https://qail.co.za/services.html';
const NOTIFY_URL = 'https://qail.co.za/api/payfast-notify';

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let { website_url, email, name, package_type } = req.body;

    if (!website_url || !email || !package_type) {
        return res.status(400).json({ error: 'Missing required fields: website_url, email, package_type' });
    }

    // Normalize URL - add https:// if missing
    website_url = website_url.trim().toLowerCase();
    if (!website_url.startsWith('http://') && !website_url.startsWith('https://')) {
        website_url = 'https://' + website_url;
    }

    // Determine amount based on package
    const packages = {
        'report': { name: 'Website Analysis Report', amount: '500.00' },
        'full': { name: 'Full Report + Analysis', amount: '1000.00' }
    };

    const pkg = packages[package_type];
    if (!pkg) {
        return res.status(400).json({ error: 'Invalid package type' });
    }

    // Build PayFast payment URL
    const params = new URLSearchParams({
        'merchant_id': MERCHANT_ID,
        'merchant_key': MERCHANT_KEY,
        'amount': pkg.amount,
        'item_name': pkg.name,
        'name_first': name || 'Customer',
        'email_address': email,
        'return_url': RETURN_URL,
        'cancel_url': CANCEL_URL,
        'notify_url': NOTIFY_URL,
        'custom_str1': package_type,      // package type
        'custom_str2': website_url,       // client's website URL
    });

    const checkoutUrl = `${PAYFAST_URL}?${params.toString()}`;

    return res.status(200).json({ checkout_url: checkoutUrl });
};
