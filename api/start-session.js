/* ============================================
   NEUROPILOT — COMBINED SESSION ENDPOINT
   
   FILE: api/start-session.js
   URL:  /api/start-session
   
   WHAT THIS FILE DOES:
   Combines the chat + voice calls into ONE request so the browser
   gets text AND audio at the same time — no delay between them.
   
   OLD WAY (2 round trips — caused 2-3 second delay):
     Browser → Server → Gemini → Server → Browser     (trip 1)
     Browser → Server → Deepgram → Server → Browser   (trip 2)
   
   NEW WAY (1 round trip — text + voice arrive together):
     Browser → Server → [Gemini then Deepgram] → Server → Browser
   
   The server calls Gemini, gets the text, immediately calls Deepgram
   with that text, gets the audio, and sends BOTH back in one response.
   
   The response is JSON with:
   {
     "message": "You've got this! ...",
     "audioBase64": "SUQzBAAAAAAAI1RTU0UAAAA..."  (MP3 encoded as text)
   }
   
   WHY BASE64?
   JSON can only hold text, not raw audio bytes. Base64 converts
   binary data (like an MP3 file) into a text string that JSON can carry.
   Think of it like writing binary 1s and 0s as letters — bulkier, but
   it fits in a text envelope. The browser decodes it back to audio.
   ============================================ */

const { GoogleGenerativeAI } = require('@google/generative-ai');


/* ---- Voice Configuration ---- */
const VOICE_MODEL = 'aura-2-thalia-en';   // Warm, friendly female voice
const SPEECH_SPEED = 0.92;                // Slightly slow = calming for ADHD


/* ---- System Prompt (same as chat.js) ---- */
const SYSTEM_PROMPT = `You are NeuroPilot, a warm and encouraging AI focus companion designed specifically for people with ADHD.

Your job is to give a SHORT, encouraging response when the user tells you what they're working on.

RULES:
- Keep it to 2-3 sentences MAX. Brevity is kindness for ADHD brains.
- Acknowledge their SPECIFIC task (don't be generic).
- Celebrate the act of STARTING — that's the hardest part for ADHD.
- Be warm and genuine, like a supportive friend, not a motivational poster.
- Use exactly ONE emoji at the end.
- NEVER say "just focus" or "just do it" — that's not how ADHD works.
- NEVER give productivity tips or advice unless asked.
- NEVER use more than 3 sentences.

EXAMPLE:
User: "Studying for my biology exam"
You: "Biology exam prep — your future self is going to love you for this! I'll be right here keeping you company while you crush those chapters 🧬"`;


/*
  Strip emojis from text before sending to voice API.
  Emojis look great in text bubbles but sound terrible when spoken aloud.
*/
function stripEmojis(text) {
  return text
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')   // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')   // Symbols & pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')   // Transport & map
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')   // Flags
    .replace(/[\u{2600}-\u{26FF}]/gu, '')     // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')     // Dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')     // Variation selectors
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')   // Supplemental symbols
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')   // Chess symbols
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')   // Symbols extended-A
    .replace(/[\u{200D}]/gu, '')              // Zero-width joiner
    .replace(/\s+/g, ' ')
    .trim();
}


/*
  THE MAIN HANDLER — Gemini + Deepgram in ONE request
*/
module.exports = async function handler(req, res) {

  // --- Only allow POST ---
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests are allowed' });
  }

  // --- Get the task text ---
  const taskText = req.body?.task;
  if (!taskText) {
    return res.status(400).json({ error: 'Missing "task" in request body' });
  }

  console.log('📝 Session start — task:', taskText);

  // --- Check API keys ---
  const geminiKey = process.env.GEMINI_API_KEY;
  const deepgramKey = process.env.DEEPGRAM_API_KEY;

  if (!geminiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured' });
  }


  /* ========================================
     PHASE 1: Get encouragement text from Gemini
     ======================================== */
  let encouragementText;

  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      systemInstruction: SYSTEM_PROMPT,
    });

    const result = await model.generateContent(
      `The user is about to start working on: "${taskText}". Give them a short, warm encouragement.`
    );

    encouragementText = result.response.text();
    console.log('✅ Gemini says:', encouragementText);

  } catch (error) {
    console.error('❌ Gemini error:', error.message);
    // Use fallback — don't let Gemini failure block the whole session
    encouragementText = "You're already doing great by showing up! Let's focus together 💪";
  }


  /* ========================================
     PHASE 2: Convert text to speech via Deepgram
     (only if we have a Deepgram key)
     ======================================== */
  let audioBase64 = null;   // null = no audio available

  if (deepgramKey) {
    try {
      const cleanText = stripEmojis(encouragementText);
      console.log('🔊 Generating voice for:', cleanText.substring(0, 50) + '...');

      const deepgramUrl = `https://api.deepgram.com/v1/speak?model=${VOICE_MODEL}&speed=${SPEECH_SPEED}`;

      const deepgramResponse = await fetch(deepgramUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${deepgramKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: cleanText }),
      });

      if (deepgramResponse.ok) {
        /*
          Convert audio bytes to Base64 string.
          
          Base64 is a way to represent binary data (raw bytes) as
          regular text characters. Like writing sheet music instead
          of playing it — same information, different format.
          
          The browser will decode this back into audio bytes.
        */
        const audioArrayBuffer = await deepgramResponse.arrayBuffer();
        const audioBuffer = Buffer.from(audioArrayBuffer);
        audioBase64 = audioBuffer.toString('base64');
        console.log('✅ Voice generated:', audioBuffer.length, 'bytes →', audioBase64.length, 'chars base64');
      } else {
        console.warn('⚠️ Deepgram error:', deepgramResponse.status);
      }

    } catch (error) {
      console.warn('⚠️ Voice generation failed:', error.message);
      // No audio = text-only experience (still works fine)
    }
  } else {
    console.log('ℹ️ No Deepgram key — text-only mode');
  }


  /* ========================================
     PHASE 3: Send BOTH text + audio back to browser
     ======================================== */
  return res.status(200).json({
    message: encouragementText,       // The text to show in the bubble
    audioBase64: audioBase64,          // The MP3 audio as base64 (or null)
  });
};
