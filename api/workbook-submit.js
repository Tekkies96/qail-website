const https = require('https');
const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GH_TOKEN = process.env.GH_TOKEN;
  const REPO_OWNER = 'Tekkies96';
  const REPO_NAME = 'qail-website';

  try {
    const data = req.body;

    // Generate reference
    const timestamp = Date.now().toString(36).toUpperCase();
    const ref = `WB-${timestamp}`;
    const submittedAt = new Date().toISOString();

    // Format facilities
    const facilities = Array.isArray(data.facilities)
      ? data.facilities.join(', ')
      : (data.facilities || 'None specified');

    // Build GitHub Issue body
    const issueBody = [
      '## GuesthouseAI — New Workbook Submission',
      '',
      `**Reference:** ${ref}`,
      `**Submitted:** ${submittedAt}`,
      `**Status:** 🆕 New`,
      '',
      '---',
      '',
      '## Property Basics',
      '',
      `| Field | Value |`,
      `|-------|-------|`,
      `| Property Name | ${data.propertyName || '—'} |`,
      `| Type | ${data.propertyType || '—'} |`,
      `| Number of Rooms | ${data.roomCount || '—'} |`,
      `| Town | ${data.town || '—'} |`,
      `| Province | ${data.province || '—'} |`,
      `| Address | ${data.address || '—'} |`,
      '',
      '---',
      '',
      '## Rooms & Pricing',
      '',
      `| Field | Value |`,
      `|-------|-------|`,
      `| Room Details | ${data.roomDetails || '—'} |`,
      `| Check-in | ${data.checkin || '—'} |`,
      `| Check-out | ${data.checkout || '—'} |`,
      `| Minimum Nights | ${data.minNights || '—'} |`,
      '',
      '---',
      '',
      '## Facilities',
      '',
      facilities,
      '',
      data.otherFacilities ? `\n**Other:** ${data.otherFacilities}` : '',
      '',
      '---',
      '',
      '## Contact Details',
      '',
      `| Field | Value |`,
      `|-------|-------|`,
      `| WhatsApp | ${data.whatsapp || '—'} |`,
      `| Phone | ${data.phone || '—'} |`,
      `| Email | ${data.email || '—'} |`,
      `| Existing Website | ${data.website || '—'} |`,
      '',
      '---',
      '',
      '## Social Media',
      '',
      `| Field | Value |`,
      `|-------|-------|`,
      `| Facebook | ${data.facebook || '—'} |`,
      `| Instagram | ${data.instagram || '—'} |`,
      `| Other | ${data.otherSocial || '—'} |`,
      '',
      '---',
      '',
      '## Policies',
      '',
      `| Field | Value |`,
      `|-------|-------|`,
      `| Cancellation | ${data.cancellation || '—'} |`,
      `| Pet Policy | ${data.petPolicy || '—'} |`,
      `| Smoking Policy | ${data.smokingPolicy || '—'} |`,
      `| House Rules | ${data.houseRules || '—'} |`,
      '',
      '---',
      '',
      '## About Property',
      '',
      `**Description:**\n${data.description || '—'}`,
      '',
      `**Nearby Attractions:**\n${data.attractions || '—'}`,
      '',
      `**Unique Selling Point:**\n${data.uniqueSelling || '—'}`,
      '',
      '---',
      '',
      `*Submitted via GuesthouseAI Property Workbook on qail.co.za*`,
    ].join('\n');

    const issueTitle = `Workbook: ${data.propertyName || 'Unknown'} — ${data.town || ''} [${ref}]`;

    // Create GitHub Issue via API
    const issueData = JSON.stringify({
      title: issueTitle,
      body: issueBody,
      labels: ['workbook-submission', 'new-submission'],
    });

    const issueOptions = {
      hostname: 'api.github.com',
      path: `/repos/${REPO_OWNER}/${REPO_NAME}/issues`,
      method: 'POST',
      headers: {
        'Authorization': `token ${GH_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'GuesthouseAI-API',
        'Accept': 'application/vnd.github.v3+json',
      },
    };

    const issueResponse = await new Promise((resolve, reject) => {
      const req = https.request(issueOptions, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('error', reject);
      req.write(issueData);
      req.end();
    });

    if (issueResponse.status !== 201) {
      console.error('GitHub API error:', issueResponse.body);
      return res.status(500).json({ error: 'Failed to create issue', details: issueResponse.body });
    }

    const issue = JSON.parse(issueResponse.body);

    // Also save to local JSON file for backup
    const submissionsDir = path.join(__dirname, '..', 'submissions');
    if (!fs.existsSync(submissionsDir)) {
      fs.mkdirSync(submissionsDir, { recursive: true });
    }
    
    const submissionFile = path.join(submissionsDir, `${ref}.json`);
    fs.writeFileSync(submissionFile, JSON.stringify({
      ref,
      submittedAt,
      data,
      issue_url: issue.html_url,
      issue_number: issue.number
    }, null, 2));

    return res.status(200).json({
      success: true,
      reference: ref,
      message: 'Submission received! We will build your website within 48 hours.',
      issue_url: issue.html_url,
    });

  } catch (error) {
    console.error('Workbook submit error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
