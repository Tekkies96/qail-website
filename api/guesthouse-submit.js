const https = require('https');

module.exports = async (req, res) => {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GH_TOKEN = process.env.GH_TOKEN;
  const REPO_OWNER = 'Tekkies96';
  const REPO_NAME = 'qail-website';

  if (!GH_TOKEN) {
    return res.status(500).json({ error: 'Server misconfiguration: GH_TOKEN not set' });
  }

  try {
    const data = req.body;

    // Generate reference
    const timestamp = Date.now().toString(36).toUpperCase();
    const ref = `GHA-${timestamp}`;
    const submittedAt = new Date().toISOString();

    // Build GitHub Issue body
    const facilities = Array.isArray(data.facilities)
      ? data.facilities.join(', ')
      : (data.facilities || 'None specified');

    const issueBody = [
      '## GuesthouseAI — New Lead Submission',
      '',
      `**Reference:** ${ref}`,
      `**Submitted:** ${submittedAt}`,
      `**Status:** 🆕 New`,
      '',
      '---',
      '',
      '## Property Details',
      '',
      `| Field | Value |`,
      `|-------|-------|`,
      `| Property Name | ${data.property_name || '—'} |`,
      `| Location | ${data.location || '—'} |`,
      `| Address | ${data.address || '—'} |`,
      `| Number of Rooms | ${data.num_rooms || '—'} |`,
      `| Price Range | ${data.price_range || '—'} |`,
      '',
      '## Facilities',
      '',
      facilities,
      '',
      '---',
      '',
      '## Contact Details',
      '',
      `| Field | Value |`,
      `|-------|-------|`,
      `| Name | ${data.contact_name || '—'} |`,
      `| Email | ${data.contact_email || '—'} |`,
      `| Phone | ${data.contact_phone || '—'} |`,
      `| Current Website | ${data.website_url || '—'} |`,
      `| Domain Interest | ${data.domain_interest || '—'} |`,
      '',
      '---',
      '',
      '## Photos & Notes',
      '',
      `**Photo Links:** ${data.photo_links || 'None'} `,
      '',
      `**Additional Notes:** ${data.notes || 'None'} `,
      '',
      '---',
      '',
      `*Submitted via GuesthouseAI intake form on qail.co.za*`,
    ].join('\n');

    const issueTitle = `Lead: ${data.property_name || 'Unknown Property'} — ${data.location || ''} [${ref}]`;

    // Create GitHub Issue via API
    const issueData = JSON.stringify({
      title: issueTitle,
      body: issueBody,
      labels: ['guesthouse-lead', 'new-submission'],
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

    return res.status(200).json({
      success: true,
      reference: ref,
      message: 'Submission received! We will be in touch within 48 hours.',
      issue_url: issue.html_url,
      issue_number: issue.number,
    });

  } catch (error) {
    console.error('Submit error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
