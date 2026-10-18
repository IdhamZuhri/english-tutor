/**
 * API service layer — calls to the local Node backend.
 */

const BASE = '/api';

/** Check if the backend is running and API keys are configured. */
export async function healthCheck() {
  const res = await fetch(`${BASE}/health`);
  return res.json();
}

/** Fetch the companion's opening message for a new session. */
export async function fetchOpeningMessage(topic, focus = null, persona = 'balanced') {
  const params = new URLSearchParams({ topic, persona });
  if (focus) params.set('focus', focus);
  const res = await fetch(`${BASE}/opening?${params}`);
  if (!res.ok) throw new Error(`Opening message failed: ${res.status}`);
  return res.json();
  // Returns: { reply_text, reply_audio_b64, tts_fallback }
}

export async function fetchPracticeInsights() {
  const res = await fetch(`${BASE}/practice`);
  if (!res.ok) throw new Error(`Could not load practice insights: ${res.status}`);
  return res.json();
}

export async function savePracticeAttempt(attempt) {
  const res = await fetch(`${BASE}/practice/attempts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(attempt),
  });
  if (!res.ok) throw new Error(`Could not save practice result: ${res.status}`);
  return res.json();
}

export async function fetchSpeeches() {
  const res = await fetch(`${BASE}/speeches`);
  if (!res.ok) throw new Error('Could not load rehearsals.');
  return res.json();
}

export async function fetchSpeech(id) {
  const res = await fetch(`${BASE}/speeches/${id}`);
  if (!res.ok) throw new Error('Could not load this rehearsal.');
  return res.json();
}

export async function submitSpeech(audioBlob, details) {
  const form = new FormData();
  const ext = audioBlob.type.includes('mp4') ? 'm4a' : audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
  form.append('audio', audioBlob, `speech.${ext}`);
  Object.entries(details).forEach(([key, value]) => form.append(key, String(value)));
  const res = await fetch(`${BASE}/speeches`, { method: 'POST', body: form });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || 'Could not review your rehearsal. Please try again.');
  }
  return res.json();
}

/**
 * Send a recorded audio blob and get back transcript, corrections, reply, and TTS audio.
 * @param {Blob} audioBlob - recorded audio from MediaRecorder
 * @param {Array} history  - [{role, content}] conversation history
 * @param {string} topic   - current session topic
 * @param {number} sessionId - current session ID
 */
export async function sendChatTurn(audioBlob, history, topic, sessionId) {
  const formData = new FormData();
  let ext = 'webm';
  if (audioBlob.type.includes('mp4')) ext = 'm4a';
  else if (audioBlob.type.includes('ogg')) ext = 'ogg';
  else if (audioBlob.type.includes('wav')) ext = 'wav';
  else if (audioBlob.type.includes('mpeg')) ext = 'mp3';

  formData.append('audio', audioBlob, `audio.${ext}`);
  formData.append('history', JSON.stringify(history));
  formData.append('topic', topic);
  formData.append('session_id', sessionId);

  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Chat request failed: ${res.status}`);
  }

  return res.json();
  // Returns: { transcript, corrections, reply_text, reply_audio_b64, tts_fallback, error?, message? }
}


/**
 * Decode a base64 WAV string and return a playable Blob URL.
 */
export function decodeAudioB64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

/** Fetch past sessions for the homepage */
export async function fetchPastSessions() {
  const res = await fetch(`${BASE}/sessions`);
  if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.status}`);
  return res.json();
}

/** Fetch a specific session's details and history */
export async function fetchSessionDetails(sessionId) {
  const res = await fetch(`${BASE}/sessions/${sessionId}`);
  if (!res.ok) throw new Error(`Failed to fetch session details: ${res.status}`);
  return res.json();
}

/** Export history of last 10 sessions as markdown */
export async function exportHistory() {
  const res = await fetch(`${BASE}/export-history`);
  if (!res.ok) throw new Error(`Failed to export history: ${res.status}`);
  return res.json();
}
