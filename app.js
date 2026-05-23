/* ============================================
   NEUROPILOT — APP LOGIC (Step 2)
   Handles the state transitions:
     IDLE  →  ACTIVATION FLASH  →  FOCUS MODE
   and back again when the user ends a session.
   ============================================ */

// ---- Grab all the elements we need ----
const taskInput   = document.getElementById('task-input');
const startBtn    = document.getElementById('start-btn');
const orbWrapper  = document.getElementById('orb-wrapper');
const statusLabel = document.getElementById('status-label');
const inputArea   = document.getElementById('input-area');
const appTitle    = document.getElementById('app-title');

// ---- Enable button only when there's text ----
taskInput.addEventListener('input', () => {
  const hasText = taskInput.value.trim().length > 0;
  startBtn.disabled = !hasText;
});

// ---- Start a focus session ----
startBtn.addEventListener('click', () => {
  const task = taskInput.value.trim();
  if (!task) return;

  console.log('🚀 Focus session started!');
  console.log('📝 Task:', task);

  // ---- PHASE 1: Activation flash (0.8 seconds) ----
  // This brief bright pulse gives a satisfying "I did something!" feeling.
  // Important for ADHD — starting a task is the hardest part,
  // so we reward the act of clicking with a visual "yes!"
  orbWrapper.classList.add('activating');

  // ---- PHASE 2: After flash ends → enter calm focus mode ----
  setTimeout(() => {
    // Remove the one-time flash
    orbWrapper.classList.remove('activating');

    // Add the calm focus state
    orbWrapper.classList.add('focusing');
    statusLabel.classList.add('focusing');

    // Update the status label
    statusLabel.textContent = 'Focusing';

    // Hide the input area (it slides down and fades out)
    inputArea.classList.add('hidden');

    // Hide the subtitle
    const subtitle = document.querySelector('.app-subtitle');
    if (subtitle) subtitle.style.display = 'none';

    // Create a task display element below the title
    const taskDisplay = document.createElement('p');
    taskDisplay.className = 'task-display';
    taskDisplay.id = 'task-display';
    taskDisplay.innerHTML = '<span class="task-name">' + escapeHtml(task) + '</span>';
    appTitle.insertAdjacentElement('afterend', taskDisplay);

    // Create an "End Session" button
    const endBtn = document.createElement('button');
    endBtn.className = 'end-btn';
    endBtn.id = 'end-btn';
    endBtn.textContent = 'End session';
    taskDisplay.insertAdjacentElement('afterend', endBtn);

    // When "End Session" is clicked → reset everything back to idle
    endBtn.addEventListener('click', endSession);

  }, 800); // 800ms = matches the activation flash duration
});

// ---- End a focus session (reset to idle) ----
function endSession() {
  console.log('⏹ Session ended.');

  // Remove focus classes
  orbWrapper.classList.remove('focusing');
  statusLabel.classList.remove('focusing');

  // Reset the status label
  statusLabel.textContent = 'Ready when you are';

  // Remove the task display and end button
  const taskDisplay = document.getElementById('task-display');
  const endBtn = document.getElementById('end-btn');
  if (taskDisplay) taskDisplay.remove();
  if (endBtn) endBtn.remove();

  // Show the subtitle again
  const subtitle = document.querySelector('.app-subtitle');
  if (subtitle) subtitle.style.display = '';

  // Show the input area again (remove the hidden class)
  inputArea.classList.remove('hidden');
  // Reset the input area's opacity/transform (the fadeInUp animation already played)
  inputArea.style.opacity = '1';
  inputArea.style.transform = 'translateY(0)';

  // Re-enable the input and button
  taskInput.disabled = false;
  taskInput.value = '';
  startBtn.disabled = true;
  startBtn.textContent = "Let's go";

  // Put cursor back in the input so they can type again
  taskInput.focus();
}

// ---- Utility: prevent HTML injection from user input ----
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
