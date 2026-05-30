/* ============================================
   NEUROPILOT — CHAT API ENDPOINT (Vercel Serverless Function)
   
   FILE: api/chat.js
   URL:  /api/chat  (Vercel automatically maps the api/ folder to routes)
   
   WHAT THIS FILE DOES:
   This is the "middleman" between the user's browser and Google's Gemini AI.
   
   The flow:
   1. Browser sends a POST request with the user's task text
   2. This function receives it on the SERVER (not in the browser)
   3. It calls Google Gemini with a special system prompt for ADHD encouragement
   4. It sends Gemini's response back to the browser
   
   WHY A MIDDLEMAN?
   - The API key is stored in .env on the server — the browser NEVER sees it
   - If we put the key in the browser's JavaScript, anyone could steal it
   - Gemini's API doesn't allow direct browser calls anyway (CORS)
   
   HOW VERCEL USES THIS:
   Any .js file inside the api/ folder automatically becomes an API endpoint.
   api/chat.js → accessible at https://your-app.vercel.app/api/chat
   No server setup needed — Vercel handles everything.
   ============================================ */


/*
  Import the Google Generative AI SDK.
  
  "require" is how Node.js (server-side JavaScript) loads external libraries.
  This is different from browser JavaScript which uses <script> tags.
  We installed this library earlier with: npm install @google/generative-ai
*/
const { GoogleGenerativeAI } = require('@google/generative-ai');


/*
  THE SYSTEM PROMPT — Instructions for Gemini on HOW to respond.
  
  This is like giving a new employee their job description:
  "You are a focus companion. Be warm. Be brief. Be ADHD-aware."
  
  Gemini reads this BEFORE every conversation so it knows its role.
  The user never sees this prompt — it's behind the scenes.
  
  WHY THESE SPECIFIC INSTRUCTIONS?
  - "2-3 sentences max" → ADHD users get overwhelmed by long text
  - "Acknowledge the specific task" → makes it feel personal, not generic
  - "Never say 'just focus'" → toxic positivity doesn't help ADHD
  - "Use one emoji" → visual anchors help ADHD users process text
  - "Warm, like a supportive friend" → external validation helps regulate emotions
*/
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
  THE MAIN HANDLER — This function runs every time someone hits /api/chat

  In Vercel, every serverless function exports a default function that receives:
  - req (request)  → data coming FROM the browser (the task text)
  - res (response) → data going BACK TO the browser (Gemini's response)
  
  Think of it like a waiter:
  - req = the customer's order
  - res = the food you bring back
*/
module.exports = async function handler(req, res) {

  /*
    STEP 1: Only allow POST requests.
    
    HTTP has different "methods" (types of requests):
    - GET  = "give me data" (like loading a webpage)
    - POST = "here's data, do something with it" (like submitting a form)
    
    We only want POST because the browser is SENDING us the task text.
    If someone tries a GET (like typing /api/chat in the browser address bar),
    we reject it with a 405 "Method Not Allowed" error.
  */
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests are allowed' });
  }


  /*
    STEP 2: Extract the task text from the request body.
    
    The browser sends JSON like: { "task": "Studying calculus" }
    req.body is that JSON object, parsed automatically by Vercel.
  */
  const taskText = req.body?.task;
  // 
  // ☝️ WHAT IS "?."?
  // It's called "optional chaining." It means:
  // "If req.body exists, get .task from it. If req.body is undefined, return undefined."
  // Without it, if req.body was undefined, you'd get:
  //   "Cannot read property 'task' of undefined" → CRASH!
  // With it, you just get undefined → no crash.
  //

  if (!taskText) {
    return res.status(400).json({ error: 'Missing "task" in request body' });
    // 400 = "Bad Request" — the browser sent incomplete data
  }

  console.log('📝 Task received:', taskText);


  /*
    STEP 3: Initialize the Gemini AI client.
    
    process.env.GEMINI_API_KEY reads the API key from the .env file.
    "process.env" is Node.js's way of accessing environment variables —
    secret values that live on the server, not in the code.
  */
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY is not set in environment variables!');
    return res.status(500).json({ error: 'Server configuration error — API key not found' });
    // 500 = "Internal Server Error" — something is wrong on OUR side
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  /*
    Get the Gemini model.
    "gemini-2.5-flash-lite" is Google's lightest, fastest model — 
    perfect for short encouraging messages (we don't need anything heavier).
    It has its own free-tier quota separate from the 2.0 models.
  */
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    systemInstruction: SYSTEM_PROMPT,
  });


  /*
    STEP 4: Send the user's task to Gemini and get a response.
    
    We wrap this in try/catch because network calls can fail:
    - Gemini might be down
    - The API key might be invalid
    - The user might have hit rate limits
    
    If anything fails, we return a friendly error instead of crashing.
  */
  try {
    const result = await model.generateContent(
      `The user is about to start working on: "${taskText}". Give them a short, warm encouragement.`
    );

    /*
      Extract the text from Gemini's response.
      The response object has a nested structure:
        result.response.text() → the actual text string
    */
    const geminiResponseText = result.response.text();

    console.log('✅ Gemini responded:', geminiResponseText);

    // Send the response back to the browser as JSON
    return res.status(200).json({ message: geminiResponseText });
    // 200 = "OK" — everything worked!

  } catch (error) {
    console.error('❌ Gemini API error:', error.message);

    // Send a user-friendly error (don't expose internal details)
    return res.status(500).json({
      error: 'Failed to get response from AI',
      fallback: true
    });
  }
};
