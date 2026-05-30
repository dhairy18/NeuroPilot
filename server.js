/* ============================================
   NEUROPILOT — LOCAL DEVELOPMENT SERVER
   
   This is a TEMPORARY server for testing on your computer.
   It does THREE things:
   1. Serves your HTML/CSS/JS files from the public/ folder
   2. Routes /api/chat requests to your chat handler (Gemini AI)
   3. Routes /api/voice requests to your voice handler (ElevenLabs TTS)
   
   This file is NOT needed for production — Vercel handles this.
   We only use it because Vercel's dev server requires login.
   
   TO RUN: node server.js
   THEN VISIT: http://localhost:3000
   ============================================ */

/*
  Load environment variables from .env file.
  Without this, process.env.GEMINI_API_KEY would be undefined.
*/
require('dotenv').config();

/*
  "http" and "fs" and "path" are built-in Node.js modules (no install needed).
  - http → creates a web server
  - fs   → reads files from disk
  - path → handles file paths safely across Windows/Mac/Linux
*/
const http = require('http');
const fs = require('fs');
const path = require('path');

// Import our API handlers (the same ones Vercel will use)
const chatHandler = require('./api/chat.js');
const voiceHandler = require('./api/voice.js');
const startSessionHandler = require('./api/start-session.js');

const PORT = 3000;

// Static files are now served from the public/ folder
const PUBLIC_DIR = path.join(__dirname, 'public');


/*
  MIME types: tell the browser what type of file it's receiving.
  Without this, the browser wouldn't know if it's receiving HTML, CSS, or JS
  and might not render/execute it correctly.
*/
const MIME_TYPES = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.mp3':  'audio/mpeg',
};


/*
  Helper: parse JSON body from a POST request.
  
  HTTP sends data in chunks (pieces). We collect all chunks,
  join them together, then parse the full JSON string.
  Returns a Promise so we can use await.
*/
function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({});
      }
    });
  });
}


/*
  Helper: create a mock Vercel response object.
  
  Our api/ handlers expect Vercel's res.status(200).json({...}) format.
  Since we're not using Vercel locally, we create a fake version.
  
  The 'binaryMode' option enables sending raw binary data (like MP3 audio)
  instead of JSON text.
*/
function createMockResponse(res, binaryMode = false) {
  return {
    statusCode: 200,
    headers: {},
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    setHeader: function(name, value) {
      this.headers[name] = value;
    },
    json: function(data) {
      res.writeHead(this.statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        ...this.headers,
      });
      res.end(JSON.stringify(data));
    },
    // For sending raw binary data (like audio files)
    send: function(data) {
      res.writeHead(this.statusCode, {
        'Access-Control-Allow-Origin': '*',
        ...this.headers,
      });
      res.end(data);
    },
    end: function(data) {
      res.writeHead(this.statusCode, {
        'Access-Control-Allow-Origin': '*',
        ...this.headers,
      });
      res.end(data);
    }
  };
}


/*
  Create the HTTP server.
  This function runs every time someone visits a URL on our server.
*/
const server = http.createServer(async (req, res) => {
  console.log(`${req.method} ${req.url}`);

  // --- Handle CORS preflight requests ---
  // Browsers send an OPTIONS request before POST to check if it's allowed
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // --- API Route: /api/start-session (Gemini + Deepgram combined — text + voice in ONE trip) ---
  if (req.url === '/api/start-session' && req.method === 'POST') {
    req.body = await parseJsonBody(req);
    const mockRes = createMockResponse(res);
    startSessionHandler(req, mockRes);
    return;
  }

  // --- API Route: /api/chat (Gemini AI text response — kept for backward compatibility) ---
  if (req.url === '/api/chat' && req.method === 'POST') {
    req.body = await parseJsonBody(req);
    const mockRes = createMockResponse(res);
    chatHandler(req, mockRes);
    return;
  }

  // --- API Route: /api/voice (ElevenLabs text-to-speech) ---
  if (req.url === '/api/voice' && req.method === 'POST') {
    req.body = await parseJsonBody(req);
    const mockRes = createMockResponse(res, true);
    voiceHandler(req, mockRes);
    return;
  }

  // --- Serve static files from public/ folder ---
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(PUBLIC_DIR, filePath);

  // Get the file extension to determine the MIME type
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  // Try to read and serve the file
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (err) {
    // File not found → 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 — File not found');
  }
});


server.listen(PORT, () => {
  console.log('');
  console.log('🧠 NeuroPilot dev server running!');
  console.log(`🌐 Open in browser: http://localhost:${PORT}`);
  console.log('');
  console.log('Press Ctrl+C to stop the server.');
  console.log('');
});
