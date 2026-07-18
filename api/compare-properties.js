// API endpoint: POST /api/compare-properties
// Uses Pacman's Ollama (qwen2.5:14b) for free AI comparison
// No external API costs — runs on local infrastructure

const OLLAMA_URL = 'http://100.93.250.92:11434/api/generate';
const OLLAMA_MODEL = 'qwen2.5:14b';

export async function onRequest(context) {
    // Only allow POST
    if (context.request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const body = await context.request.json();
        const { properties } = body;

        if (!properties || !Array.isArray(properties) || properties.length < 2) {
            return new Response(JSON.stringify({ error: 'At least 2 properties required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Build the prompt for Ollama
        const propertiesList = properties.map((p, i) => `
Property ${i + 1}: ${p.name}
- Price: ${p.price} ZAR/night
- Rating: ${p.rating} stars
- Location: ${p.location}
- Sleeps: ${p.sleeps} guests
- Bedrooms: ${p.rooms}
- Facilities: ${p.facilities}
- Guest reviews: ${p.reviews}
        `).join('\n');

        const prompt = `You are a South African accommodation expert. Compare these ${properties.length} holiday rental properties in Ballito and recommend the best value option.

${propertiesList}

Respond in this exact JSON format (no other text):
{
  "winner": "property name",
  "winnerScore": "8.5/10",
  "verdict": "2-3 sentence explanation of why this is the best value",
  "comparison": {
    "price": "Which offers best price per person and why",
    "rating": "Which has better ratings and if it matters",
    "location": "Which has better location for beach/government",
    "facilities": "Which offers better facilities value",
    "reviews": "What guests highlight most"
  },
  "perProperty": {
    "PROPERTY NAME": { "pros": ["point 1", "point 2"], "cons": ["point 1"], "aiNote": "1 sentence AI observation" }
  }
}

Rules:
- Price per person = price / sleeps
- Value score factors in rating, price per person, and facilities
- Be specific about South African context (beach access, DSTV, braai, etc)
- Winner doesn't have to be the cheapest — explain real value
- Return ONLY valid JSON, no markdown code blocks`;

        // Call Pacman's Ollama
        const ollamaResponse = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.3,
                    num_predict: 1024
                }
            })
        });

        if (!ollamaResponse.ok) {
            throw new Error(`Ollama error: ${ollamaResponse.status}`);
        }

        const ollamaData = await ollamaResponse.json();
        const aiResponse = ollamaData.response || '';

        // Parse the JSON from AI response
        let analysis;
        try {
            // Try to extract JSON from the response
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysis = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            // Fallback: return raw response
            analysis = {
                winner: properties[0].name,
                verdict: aiResponse.substring(0, 500),
                error: 'Could not parse structured response'
            };
        }

        return new Response(JSON.stringify({
            success: true,
            analysis: analysis,
            model: OLLAMA_MODEL,
            source: 'pacman'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Compare properties error:', error);
        return new Response(JSON.stringify({
            error: 'Failed to analyze properties',
            details: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
