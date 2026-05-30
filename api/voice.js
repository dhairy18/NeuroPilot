/* ============================================
   NEUROPILOT — VOICE API ENDPOINT (Deepgram Text-to-Speech)
   
   FILE: api/voice.js
   URL:  /api/voice
   
   WHAT THIS FILE DOES:
   Converts text into spoken audio using Deepgram's Aura TTS API.
   
   THE FLOW:
   1. Browser sends: { "text": "You've got this!" }
   2. This function calls Deepgram with that text
   3. Deepgram returns raw MP3 audio bytes
   4. We forward those bytes to the browser
   5. Browser plays the audio
   
   WHY DEEPGRAM?
   - $200 free credits (enough for months of use for 2-3 users)
   - Natural, human-like voices (not robotic)
   - Fast response time (low latency = user hears voice quickly)
   - Simple REST API (just one HTTP call)
   
   WHY A MIDDLEMAN?
   Same reason as chat.js — the API key stays on the server,
   the browser never sees it.
   ============================================ */


/*
  VOICE CONFIGURATION
  
  model: "aura-2-thalia-en" — a warm, friendly English female voice.
  Deepgram's Aura-2 voices are designed for conversational AI,
  making them perfect for encouraging ADHD-friendly messages.
  
  speed: 0.92 — slightly slower than normal.
  For ADHD users, a calm pace helps with processing and feels
  more like a friend talking, not a news anchor rushing.
  
  Other voice options you can try:
  - "aura-2-thalia-en"   → warm female (default)
  - "aura-2-andromeda-en" → clear female  
  - "aura-2-atlas-en"    → friendly male
  - "aura-2-orion-en"    → deep male
*/
const VOICE_MODEL = 'aura-2-thalia-en';
const SPEECH_SPEED = 0.92;


/*
  THE MAIN HANDLER — runs every time someone hits /api/voice
*/
module.exports = async function handler(req, res) {

  // --- Only allow POST requests ---
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests are allowed' });
  }

  // --- Extract the text to speak ---
  const textToSpeak = req.body?.text;

  if (!textToSpeak) {
    return res.status(400).json({ error: 'Missing "text" in request body' });
  }

  /*
    Strip emojis from the text before sending to TTS.
    
    WHY? TTS engines sometimes try to read emojis aloud
    (e.g., "rocket" for 🚀) which sounds weird.
    The emojis are still visible in the text bubble — we only
    remove them from the spoken version.
    
    HOW? This regex matches all emoji Unicode ranges and replaces
    them with nothing. Then .trim() removes leftover spaces.
  */
  const textWithoutEmojis = textToSpeak
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')   // Emoticons (😀-🙏)
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')   // Symbols & pictographs (🌀-🗿)
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')   // Transport & map (🚀-🛿)
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')   // Flags (🇦-🇿)
    .replace(/[\u{2600}-\u{26FF}]/gu, '')     // Misc symbols (☀-⛿)
    .replace(/[\u{2700}-\u{27BF}]/gu, '')     // Dingbats (✀-➿)
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')     // Variation selectors
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')   // Supplemental symbols (🤀-🧿)
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')   // Chess symbols
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')   // Symbols extended-A
    .replace(/[\u{200D}]/gu, '')              // Zero-width joiner
    .replace(/\s+/g, ' ')                      // Collapse multiple spaces into one
    .trim();

  console.log('🔊 Voice request:', textWithoutEmojis.substring(0, 50) + '...');

  // --- Check for API key ---
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    console.error('❌ DEEPGRAM_API_KEY is not set!');
    return res.status(500).json({ error: 'Voice API key not configured' });
  }

  // --- Call Deepgram TTS API ---
  try {
    /*
      Deepgram's TTS endpoint:
      https://api.deepgram.com/v1/speak?model=VOICE_NAME&speed=SPEED
      
      - method: POST
      - body: { "text": "..." }
      - auth: "Token YOUR_API_KEY" in the Authorization header
      - response: raw MP3 audio bytes
      
      Much simpler than ElevenLabs! Just one URL with query parameters.
    */
    const deepgramUrl = `https://api.deepgram.com/v1/speak?model=${VOICE_MODEL}&speed=${SPEECH_SPEED}`;

    const deepgramResponse = await fetch(deepgramUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: textWithoutEmojis }),
    });

    // --- Check if Deepgram returned an error ---
    if (!deepgramResponse.ok) {
      const errorText = await deepgramResponse.text();
      console.error('❌ Deepgram error:', deepgramResponse.status, errorText);
      return res.status(502).json({
        error: 'Voice service returned an error',
        detail: deepgramResponse.status
      });
    }

    /*
      Convert the response to a Buffer (raw bytes).
      Deepgram returns raw MP3 audio data, not JSON.
    */
    const audioArrayBuffer = await deepgramResponse.arrayBuffer();
    const audioBuffer = Buffer.from(audioArrayBuffer);

    console.log('✅ Voice generated:', audioBuffer.length, 'bytes');

    // --- Send the audio back to the browser ---
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    return res.status(200).send(audioBuffer);

  } catch (error) {
    console.error('❌ Voice API error:', error.message);
    return res.status(500).json({
      error: 'Failed to generate voice',
      fallback: true
    });
  }
};
