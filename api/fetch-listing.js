const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');

const TEMP_DIR = '/tmp/listing-screenshots';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function callVisionAI(screenshotPath) {
    return new Promise((resolve, reject) => {
        const imageData = fs.readFileSync(screenshotPath);
        const base64Image = imageData.toString('base64');
        
        const payload = {
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Extract property details from this screenshot. Return ONLY valid JSON with this structure:
{
  "propertyName": "string",
  "propertyType": "string (guesthouse/selfcatering/holidayhome/apartment/villa)",
  "location": "string (town/city)",
  "province": "string",
  "address": "string",
  "roomDetails": "string (room types with prices)",
  "checkin": "string (time)",
  "checkout": "string (time)",
  "facilities": ["array of facilities"],
  "description": "string",
  "attractions": "string",
  "hostName": "string"
}
If information is not visible, use null. Be precise and only return valid JSON.`
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/png;base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 2000
        };
        
        const data = JSON.stringify(payload);
        
        const options = {
            hostname: 'api.openai.com',
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            }
        };
        
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    const content = response.choices?.[0]?.message?.content || '{}';
                    // Extract JSON from response
                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        resolve(JSON.parse(jsonMatch[0]));
                    } else {
                        resolve({});
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
        
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function fetchAndAnalyze(url) {
    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
    
    const timestamp = Date.now();
    const screenshotPath = `${TEMP_DIR}/listing-${timestamp}.png`;
    
    const browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
        viewport: { width: 1400, height: 1000 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    try {
        console.log(`Opening: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await sleep(3000);
        
        // Dismiss cookie banner
        try {
            const btn = page.locator('button:has-text("Accept")').first();
            if (await btn.isVisible({ timeout: 2000 })) {
                await btn.click();
                await sleep(1000);
            }
        } catch (e) {}
        
        // Scroll to load all content
        for (let s = 1; s <= 6; s++) {
            await page.evaluate((pos) => window.scrollTo(0, pos), s * 1000);
            await sleep(2000);
        }
        
        // Take screenshot
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Screenshot saved: ${screenshotPath}`);
        
        // Analyze with Vision AI
        console.log('Analyzing with Vision AI...');
        const propertyData = await callVisionAI(screenshotPath);
        
        return {
            success: true,
            data: propertyData
        };
        
    } catch (error) {
        console.error(`Error: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    } finally {
        await browser.close();
    }
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Only allow Airbnb, Lekkeslaap, Booking.com
        const allowedDomains = ['airbnb.com', 'airbnb.co.uk', 'lekkeslaap.co.za', 'booking.com'];
        const hasAllowedDomain = allowedDomains.some(d => url.includes(d));
        
        if (!hasAllowedDomain) {
            return res.status(400).json({ 
                success: false, 
                error: 'Only Airbnb, Lekkeslaap, and Booking.com URLs are supported' 
            });
        }

        const result = await fetchAndAnalyze(url);
        
        if (!result.success) {
            return res.status(500).json({ 
                success: false, 
                error: result.error 
            });
        }

        return res.status(200).json({
            success: true,
            data: result.data
        });

    } catch (error) {
        console.error('Fetch listing error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
