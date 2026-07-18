const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const https = require('https');

const PORT = 5051;
const TEMP_DIR = '/tmp/listing-screenshots';

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
        const apiKey = process.env.OPENAI_API_KEY;
        
        const options = {
            hostname: 'api.openai.com',
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            }
        };
        
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    const content = response.choices?.[0]?.message?.content || '{}';
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
        console.log('Property data:', JSON.stringify(propertyData));
        
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

// HTTP server
const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }
    
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
        try {
            const { url } = JSON.parse(body);
            
            if (!url) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'URL is required' }));
                return;
            }
            
            const allowedDomains = ['airbnb.com', 'airbnb.co.uk', 'lekkeslaap.co.za', 'booking.com'];
            const hasAllowedDomain = allowedDomains.some(d => url.includes(d));
            
            if (!hasAllowedDomain) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: false, 
                    error: 'Only Airbnb, Lekkeslaap, and Booking.com URLs are supported' 
                }));
                return;
            }
            
            const result = await fetchAndAnalyze(url);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            
        } catch (error) {
            console.error('Server error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Fetch listing server running on port ${PORT}`);
});
