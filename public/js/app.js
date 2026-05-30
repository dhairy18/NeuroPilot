/* ============================================
   NEUROPILOT — APP LOGIC
   
   This file controls the app's BEHAVIOR (what happens when
   the user types, clicks buttons, etc.)
   
   THE APP HAS 3 STATES:
   
   1. IDLE         → Waiting for user to type a task and click "Let's go"
   2. ACTIVATING   → Brief 0.8s flash when user clicks (dopamine reward)
   3. FOCUSING     → Calm mode while user works on their task
   
   State flow:  IDLE  →  ACTIVATING (0.8s)  →  FOCUSING  →  (end session)  →  IDLE
   
   HOW IT WORKS:
   We add/remove CSS classes on elements to switch their animations.
   The actual visual changes are defined in style.css.
   This file just controls WHEN those classes get added/removed.
   ============================================ */


/* ==========================================================
   STEP 1: Find all the HTML elements we need to interact with.
   
   document.getElementById('some-id') finds the HTML element
   with that id and saves a reference to it.
   
   Think of it like saving someone's phone number in your contacts —
   you look them up once, then use the saved contact forever.
   ========================================================== */
const taskInput        = document.getElementById('task-input');       // The text box where user types their task
const startButton      = document.getElementById('start-btn');        // The "Let's go" button
const orbWrapper       = document.getElementById('orb-wrapper');      // The container holding all orb layers
const statusLabel      = document.getElementById('status-label');     // Text above the orb ("Ready when you are")
const inputArea        = document.getElementById('input-area');       // The container with input + button
const appTitle         = document.getElementById('app-title');        // The "NeuroPilot" heading
const appSubtitle      = document.getElementById('app-subtitle');     // The "Your AI focus companion" text

/* --- Speech Bubble elements (new in Phase 2) --- */
const speechBubble     = document.getElementById('speech-bubble');    // The entire bubble container
const typingIndicator  = document.getElementById('typing-indicator'); // The three bouncing dots
const speechBubbleText = document.getElementById('speech-bubble-text'); // Where Claude's response text goes

/*
  Global reference to the currently playing audio.
  We keep this so we can stop it when the user ends a session early.
  If no audio is playing, this is null.
*/
let currentAudio = null;


/* ==========================================================
   STEP 2: Enable the button only when the user has typed something.
   
   addEventListener('input', ...) means:
   "Every time the user types or deletes a character, run this function."
   
   We check if there's any real text (not just spaces).
   If yes → enable the button. If no → disable it.
   ========================================================== */
taskInput.addEventListener('input', () => {
  // .value       = whatever text is currently in the input box
  // .trim()      = remove spaces from the start and end (so "   " counts as empty)
  // .length > 0  = is there at least 1 real character?
  const userHasTypedSomething = taskInput.value.trim().length > 0;

  // .disabled = true  means the button is grayed out and unclickable
  // .disabled = false means the button is active and clickable
  // The ! means "opposite" — so if userHasTypedSomething is true, disabled becomes false
  startButton.disabled = !userHasTypedSomething;
});


/* ==========================================================
   STEP 2b: Allow pressing Enter to start a session.
   
   addEventListener('keydown', ...) means:
   "Every time the user presses a key, run this function."
   
   We check if the key is 'Enter' and the button is active.
   If yes → simulate clicking the button.
   
   WHY? It's natural UX — users expect Enter to submit.
   For ADHD, reducing steps (type → Enter vs type → move mouse → click)
   reduces friction and makes starting easier.
   ========================================================== */
taskInput.addEventListener('keydown', (event) => {
  // event.key tells us WHICH key was pressed
  // We only care about 'Enter' — ignore everything else
  if (event.key === 'Enter' && !startButton.disabled) {
    event.preventDefault();  // Prevent any default Enter behavior (like form submission)
    startButton.click();     // Simulate clicking the "Let's go" button
  }
});


/* ==========================================================
   STEP 3: Handle the "Let's go" button click.
   
   This triggers the state change:  IDLE → ACTIVATING → FOCUSING
   AND asks Claude for an encouraging response (via the speech bubble).
   ========================================================== */
startButton.addEventListener('click', () => {
  // Get the task text, removing extra spaces from edges
  const taskText = taskInput.value.trim();

  // Safety check: if somehow there's no text, stop here and do nothing.
  // The "return" keyword exits the function immediately.
  if (!taskText) return;

  // Log to the browser console (F12 → Console tab) — useful for debugging
  console.log('🚀 Focus session started!');
  console.log('📝 Task:', taskText);


  /* ---- PHASE 1: ACTIVATION FLASH (lasts 0.8 seconds) ---- */
  /*
    classList.add('activating') is like pinning a badge on the element.
    CSS has rules that say "when this element has the 'activating' class,
    play the flash animation." So just adding the class triggers the visuals.
    
    WHY a flash? ADHD brains struggle with "task initiation" — starting
    a task is genuinely harder than doing it. So we reward the act of
    clicking with a visual celebration: "YES! You started!"
  */
  orbWrapper.classList.add('activating');


  /* ---- PHASE 2: CALM FOCUS MODE (after flash finishes) ---- */
  /*
    setTimeout(function, delay) means:
    "Wait this many milliseconds, then run the function."
    
    We wait 800ms because the activation flash animation is 0.8 seconds long.
    After it finishes → we switch to the calm focus state.
  */
  const FLASH_DURATION_MS = 800;  // Named constant — clearer than a magic number

  setTimeout(() => {

    // --- Switch CSS classes: activating → focusing ---
    orbWrapper.classList.remove('activating');   // Remove the flash badge
    orbWrapper.classList.add('focusing');        // Pin the calm-mode badge
    statusLabel.classList.add('focusing');       // Make the label blue too

    // --- Update the status label text ---
    statusLabel.textContent = 'Focusing on : '+taskText;

    // --- Hide the input area (it slides down and fades out via CSS) ---
    inputArea.classList.add('hidden');

    // --- Hide the subtitle ---
    if (appSubtitle) appSubtitle.style.display = 'none';

    // --- Create a text element showing the user's task ---
    /*
      document.createElement('p') creates a NEW <p> tag that doesn't exist
      in the HTML file. We build it in JavaScript and then insert it into
      the page. Like building a LEGO brick and snapping it on.
    */
    const taskDisplay = document.createElement('p');
    taskDisplay.className = 'task-display';   // CSS will style it
    taskDisplay.id = 'task-display';          // So we can find and delete it later

    /*
      We use makeSafeForHtml() here to make the user's text SAFE.
      Without it, if someone typed <img src=x onerror="alert('hacked')">,
      the browser would actually run that code. makeSafeForHtml converts
      < and > into harmless text characters. See the function below for details.
    */
    taskDisplay.innerHTML = '<span class="task-name">' + makeSafeForHtml(taskText) + '</span>';

    /*
      insertAdjacentElement('afterend', element) places the new element
      right AFTER the target element in the page.
      So taskDisplay appears right below the title.
    */
    appTitle.insertAdjacentElement('afterend', taskDisplay);

    // --- Create an "End Session" button ---
    const endSessionButton = document.createElement('button');
    endSessionButton.className = 'end-btn';
    endSessionButton.id = 'end-session-btn';
    endSessionButton.textContent = 'End session';

    // Place it right after the task display
    taskDisplay.insertAdjacentElement('afterend', endSessionButton);

    // When the "End Session" button is clicked → go back to idle
    endSessionButton.addEventListener('click', endFocusSession);


    /* ---- PHASE 3: ASK CLAUDE FOR ENCOURAGEMENT (new in Phase 2) ---- */
    /*
      Show the speech bubble with typing dots, then get a response.
      For now we use a FAKE response to test the UI.
      In Step 2c we'll replace this with a real Claude API call.
    */
    showEncouragingResponse(taskText);

  }, FLASH_DURATION_MS);
});


/* ==========================================================
   STEP 4: Speech Bubble — Show Claude's Encouraging Response
   
   This function:
   1. Shows the speech bubble with typing dots ("Claude is thinking...")
   2. Asks Claude for an encouraging response (or uses a fake one for now)
   3. Hides the typing dots and shows the real text
   4. Auto-dismisses the bubble after a few seconds
   
   WHY A SPEECH BUBBLE?
   For ADHD users, getting an encouraging "you got this!" message
   at the start of a task provides:
   - External validation (someone believes in you)
   - Task anchoring (repeating back what you're doing makes it real)
   - Emotional regulation (positive tone counters anxiety)
   ========================================================== */
async function showEncouragingResponse(taskText) {
  /*
    STEP 4a: Show the bubble with typing dots
    
    We make the bubble visible and show the bouncing dots.
    The text is empty for now — dots indicate "thinking."
  */
  speechBubble.style.display = '';             // Make the bubble visible (remove display:none)
  speechBubble.classList.remove('dismissing');  // Remove any leftover dismiss animation
  
  // Reset: show typing dots, clear any old text
  typingIndicator.classList.remove('hidden');
  speechBubbleText.textContent = '';

  // Force the browser to re-trigger the entrance animation
  // (Without this, if you start a new session, the animation won't replay)
  speechBubble.style.animation = 'none';
  speechBubble.offsetHeight;  // This line forces the browser to "flush" the style change
  speechBubble.style.animation = '';  // Re-enable animation → it plays from the start

  console.log('💬 Asking for encouragement + voice...');


  /*
    STEP 4b: Call the COMBINED endpoint — get text + voice in ONE request
    
    OLD WAY (2 separate round trips — 2-3 second gap):
      Trip 1: Browser → Server → Gemini → Server → Browser  (get text)
      Trip 2: Browser → Server → Deepgram → Server → Browser (get audio)
    
    NEW WAY (1 round trip — both arrive together):
      Browser → Server → [Gemini THEN Deepgram] → Server → Browser
      The server does BOTH calls and sends back:
      { message: "You got this!", audioBase64: "SUQzBAA..." }
    
    This means the text and audio arrive at the EXACT same moment.
    No gap. No delay. Text appears and voice starts simultaneously.
  */
  let responseText;
  let audioBase64 = null;
  
  try {
    const response = await fetch('/api/start-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: taskText })
    });

    if (!response.ok) {
      throw new Error('Server responded with status ' + response.status);
    }

    const data = await response.json();
    responseText = data.message;       // The encouraging text
    audioBase64 = data.audioBase64;    // MP3 audio as base64 string (or null)

  } catch (error) {
    console.error('❌ Session API error:', error);
    responseText = getFallbackEncouragement(taskText);
  }


  /*
    STEP 4c: Show text AND play voice at the EXACT same time
    
    Both arrived in the same response, so we can start both NOW.
    No waiting for a second network request.
  */
  typingIndicator.classList.add('hidden');                // Hide the bouncing dots
  speechBubbleText.textContent = responseText;           // Show text immediately
  console.log('💬 Says:', responseText);

  // Play audio if it was included in the response
  let audioDuration = 0;
  if (audioBase64) {
    audioDuration = await playBase64Audio(audioBase64);
  }

  /*
    STEP 4d: Auto-dismiss the bubble after audio finishes
    
    If audio played → dismiss 1 second after audio ends
    If no audio    → keep text visible for 8 seconds
  */
  const TEXT_ONLY_DISPLAY_MS = 8000;
  const AFTER_AUDIO_BUFFER_MS = 1000;
  const dismissDelay = audioDuration > 0
    ? AFTER_AUDIO_BUFFER_MS
    : TEXT_ONLY_DISPLAY_MS;

  setTimeout(() => {
    dismissSpeechBubble();
  }, dismissDelay);
}


/* ==========================================================
   STEP 4e: Ask Gemini for Encouragement (THE REAL API CALL!)
   
   This function sends the user's task to our backend server,
   which forwards it to Google Gemini AI.
   
   THE FLOW:
   Browser (this file) → /api/chat (server.js) → Gemini AI → response back
   
   fetch() is how JavaScript makes HTTP requests from the browser.
   Think of it like making a phone call:
   1. Dial the number (the URL)
   2. Tell them what you need (the task text in the body)
   3. Wait for their answer (await the response)
   4. Hang up and use the answer (return the message)
   ========================================================== */
async function askClaudeForEncouragement(taskText) {
  /*
    fetch('/api/chat', { ... }) makes an HTTP POST request to our server.
    
    - '/api/chat'                    → the URL (our serverless function)
    - method: 'POST'                 → we're SENDING data, not just requesting
    - headers: Content-Type: json    → tells the server "I'm sending JSON"
    - body: JSON.stringify({...})    → the actual data (task text) as a JSON string
    
    WHY JSON.stringify?
    fetch() can only send text, not JavaScript objects.
    JSON.stringify converts { task: "math" } into the string '{"task":"math"}'
    The server then parses it back into an object.
  */
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: taskText })
  });

  /*
    Check if the response was successful.
    
    response.ok is true if the HTTP status is 200-299 (success).
    If the server returned an error (400, 500, etc.), response.ok is false.
    
    We throw an Error so the try/catch in showEncouragingResponse() 
    can catch it and show the fallback message instead.
  */
  if (!response.ok) {
    throw new Error('Server responded with status ' + response.status);
  }

  /*
    Parse the JSON response.
    
    The server sends back: { "message": "You've got this!..." }
    response.json() converts that string back into a JavaScript object.
    Then we grab .message from it.
  */
  const data = await response.json();
  return data.message;
}


/* ==========================================================
   STEP 4f: Play Base64 Audio (decode + play)
   
   The combined /api/start-session endpoint returns audio as a
   Base64 string (text representation of MP3 bytes).
   
   This function:
   1. Decodes the base64 string back into raw bytes
   2. Creates an audio Blob from those bytes
   3. Plays the audio
   4. Returns the duration (for auto-dismissing the bubble)
   
   WHAT IS BASE64?
   Binary data (like an MP3 file) is just 1s and 0s. But JSON can
   only carry text. Base64 converts those bytes into safe text
   characters (A-Z, a-z, 0-9, +, /).
   
   Think of it like converting a photo into a really long text code,
   sending the code in a message, and the receiver converts it back
   into the photo. Same data, different format for transport.
   ========================================================== */
async function playBase64Audio(base64String) {
  try {
    console.log('🔊 Playing audio from response...');

    /*
      STEP 1: Convert base64 string → raw bytes
      
      atob() = "ASCII to Binary" — decodes base64 text into a binary string.
      Then we convert each character's code into a byte array (Uint8Array).
    */
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    /*
      STEP 2: Create a Blob from the bytes
      
      A Blob is the browser's way of holding raw file data in memory.
      We tell it the type is 'audio/mpeg' (MP3 format).
    */
    const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });

    /*
      STEP 3: Create a temporary URL and play the audio
      
      URL.createObjectURL creates a fake URL pointing to the blob
      in memory, which the Audio element can load and play.
    */
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    currentAudio = audio;  // Save reference so we can stop it on "End session"

    // Show the speaking animation on the orb
    orbWrapper.classList.add('speaking');

    /*
      STEP 4: Return a Promise that resolves when audio finishes
      The duration tells us when to dismiss the speech bubble.
    */
    return new Promise((resolve) => {
      audio.addEventListener('ended', () => {
        orbWrapper.classList.remove('speaking');
        currentAudio = null;
        URL.revokeObjectURL(audioUrl);  // Free memory
        console.log('🔊 Voice playback finished');
        resolve(audio.duration);
      });

      audio.addEventListener('error', () => {
        orbWrapper.classList.remove('speaking');
        currentAudio = null;
        URL.revokeObjectURL(audioUrl);
        console.warn('⚠️ Audio playback error');
        resolve(0);
      });

      audio.play().catch((err) => {
        console.warn('⚠️ Autoplay blocked:', err.message);
        orbWrapper.classList.remove('speaking');
        currentAudio = null;
        resolve(0);
      });
    });

  } catch (error) {
    console.warn('⚠️ Audio decode failed:', error.message);
    return 0;
  }
}

/* ==========================================================
   STEP 4g: Fallback Encouragement
   
   If the Claude API fails (network error, rate limit, etc.),
   we don't want the user to see an ugly error message.
   Instead, we show a kind, generic encouragement.
   
   WHY? For ADHD users, encountering an error at the moment
   they've gathered the willpower to start is devastating.
   A warm fallback keeps the momentum going.
   ========================================================== */
function getFallbackEncouragement(taskText) {
  const fallbackMessages = [
    "You're already doing great by showing up! Let's focus together 💪",
    "I'm right here with you. One step at a time — you've got this!",
    "The hardest part was starting, and you just did that! Let's go 🚀",
    "Your future self will thank you for this. Let's make it count!",
  ];

  // Pick a random message from the array
  const randomIndex = Math.floor(Math.random() * fallbackMessages.length);
  return fallbackMessages[randomIndex];
}


/* ==========================================================
   STEP 4g: Dismiss the Speech Bubble
   
   Adds a "dismissing" class that triggers a fade-out animation,
   then hides the bubble completely after the animation finishes.
   ========================================================== */
function dismissSpeechBubble() {
  // Only dismiss if the bubble is currently visible
  if (speechBubble.style.display === 'none') return;

  // Add the dismissing class → triggers the fadeOut animation in CSS
  speechBubble.classList.add('dismissing');

  // After the animation finishes (0.3s), hide the bubble completely
  setTimeout(() => {
    speechBubble.style.display = 'none';
    speechBubble.classList.remove('dismissing');
    speechBubbleText.textContent = '';
    typingIndicator.classList.remove('hidden');
  }, 300);  // 300ms matches the bubbleFadeOut animation duration
}


/* ==========================================================
   STEP 5: End a focus session (reset everything back to IDLE state).
   
   This function undoes everything that startButton's click handler did.
   Each line is the reverse of a corresponding line above.
   ========================================================== */
function endFocusSession() {
  console.log('⏹ Session ended.');

  // --- Stop any currently playing Deepgram audio ---
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  orbWrapper.classList.remove('speaking');

  // --- Remove focus mode CSS classes ---
  orbWrapper.classList.remove('focusing');     // Orb goes back to energetic idle
  statusLabel.classList.remove('focusing');    // Label goes back to gray

  // --- Reset the status label text ---
  statusLabel.textContent = 'Ready when you are';

  // --- Delete the elements we created dynamically ---
  // (They don't exist in index.html — we made them in JavaScript)
  const taskDisplay = document.getElementById('task-display');
  const endSessionButton = document.getElementById('end-session-btn');
  if (taskDisplay) taskDisplay.remove();        // Delete from the page entirely
  if (endSessionButton) endSessionButton.remove();

  // --- Hide the speech bubble (new in Phase 2) ---
  dismissSpeechBubble();

  // --- Show the subtitle again ---
  if (appSubtitle) appSubtitle.style.display = '';  // '' = reset to default (visible)

  // --- Show the input area again ---
  inputArea.classList.remove('hidden');

  // The input area's fadeInUp animation already played on page load.
  // If we don't manually set opacity, it might still be at opacity: 0
  // from the slideDownFade animation. So we force it visible:
  inputArea.style.opacity = '1';
  inputArea.style.transform = 'translateY(0)';

  // --- Re-enable the input and button ---
  taskInput.disabled = false;       // User can type again
  taskInput.value = '';             // Clear whatever they typed before
  startButton.disabled = true;     // Button starts disabled again (no text yet)
  startButton.textContent = "Let's go";  // Reset button text (in case we changed it)

  // --- Put the cursor back in the input ---
  // Small UX touch: saves the user one click. For ADHD, reducing friction
  // between "I want to do something" and "I'm doing it" is critical.
  taskInput.focus();
}


/* ==========================================================
   STEP 6: Security Utility — Make User Input Safe for HTML
   
   WHAT THIS DOES:
   When we put user-typed text into innerHTML, the browser treats
   it as HTML code. So if a user types:
     <img src=x onerror="alert('hacked')">
   The browser would CREATE an image tag and RUN that JavaScript!
   
   This function converts dangerous characters into harmless text:
     <  becomes  &lt;    (the browser shows "<" but doesn't treat it as HTML)
     >  becomes  &gt;
     &  becomes  &amp;
     "  becomes  &quot;
   
   HOW IT WORKS (the trick):
   1. Create a temporary invisible <div> (never added to the page)
   2. Set its .textContent — this ALWAYS treats input as plain text,
      automatically escaping any HTML characters
   3. Read back its .innerHTML — which now contains the escaped version
   
   EXAMPLE:
     Input:  <script>alert('hacked')</script>
     Output: &lt;script&gt;alert('hacked')&lt;/script&gt;
     Shows on screen as: <script>alert('hacked')</script>  (harmless text)
   
   WHY "makeSafeForHtml" instead of "escapeHtml"?
   Because "escape HTML" is jargon that a beginner wouldn't understand.
   "Make safe for HTML" says exactly what it does.
   ========================================================== */
function makeSafeForHtml(unsafeText) {
  const temporaryDiv = document.createElement('div');
  temporaryDiv.textContent = unsafeText;       // Browser auto-escapes dangerous characters
  return temporaryDiv.innerHTML;               // Return the safe, escaped version
}
