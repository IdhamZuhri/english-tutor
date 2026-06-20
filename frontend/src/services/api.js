/**
 * API service layer — all calls to the FastAPI backend.
 * The Vite proxy forwards /api/* to http://localhost:8000.
 */

const BASE = '/api';

/** Check if the backend is running and API keys are configured. */
export async function healthCheck() {
  const res = await fetch(`${BASE}/health`);
  return res.json();
}

/** Fetch the companion's opening message for a new session. */
export async function fetchOpeningMessage(topic) {
  const res = await fetch(`${BASE}/opening?topic=${encodeURIComponent(topic)}`);
  if (!res.ok) throw new Error(`Opening message failed: ${res.status}`);
  return res.json();
  // Returns: { reply_text, reply_audio_b64, tts_fallback }
}

/**
 * Send a recorded audio blob and get back transcript, corrections, reply, and TTS audio.
 * @param {Blob} audioBlob - recorded audio from MediaRecorder
 * @param {Array} history  - [{role, content}] conversation history
 * @param {string} topic   - current session topic
 */
export async function sendChatTurn(audioBlob, history, topic) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'audio.webm');
  formData.append('history', JSON.stringify(history));
  formData.append('topic', topic);

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
 * Send full session history for end-of-session scoring analysis.
 * @param {Array} history - [{role, content}] full conversation
 */
export async function analyzeSession(history) {
  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Analysis failed: ${res.status}`);
  }

  return res.json();
  // Returns: { summary, scores, filler_count, justifications }
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
