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

export async function fetchSurpriseTopic(recentTopics = [], theme) {
  const res = await fetch(`${BASE}/speeches/topic`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recentTopics, theme }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Could not spin a topic. Please try again.');
  return data.topic;
}

export async function fetchSpeech(id) {
  const res = await fetch(`${BASE}/speeches/${id}`);
  if (!res.ok) throw new Error('Could not load this rehearsal.');
  return res.json();
}

export async function submitSpeech(audioBlob, details, onEvent) {
  const form = new FormData();
  const ext = audioBlob.type.includes('mp4') ? 'm4a' : audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
  form.append('audio', audioBlob, `speech.${ext}`);
  Object.entries(details).forEach(([key, value]) => form.append(key, String(value)));
  const fallback = 'Could not review your rehearsal. Please try again.';
  // Ask for a streamed review so each step the AI takes can be shown while it works.
  const res = await fetch(`${BASE}/speeches?stream=1`, { method: 'POST', body: form });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || fallback);
  }
  if (!res.headers.get('content-type')?.includes('ndjson') || !res.body) return res.json();
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let speech = null;
  const handle = line => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === 'error') throw new Error(event.detail || fallback);
    if (event.type === 'result') speech = event.speech;
    else onEvent?.(event);
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split('\n');
    buffer = lines.pop();
    lines.forEach(handle);
  }
  handle(buffer);
  if (!speech) throw new Error(fallback);
  return speech;
}

async function journalJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Journal request failed (${res.status})`);
  return data;
}

export async function fetchJournalEntries() {
  return journalJson(await fetch(`${BASE}/journal`));
}

export async function fetchJournalEntry(id) {
  return journalJson(await fetch(`${BASE}/journal/${id}`));
}

export async function transcribeJournalAudio(audioBlob) {
  const form = new FormData();
  const ext = audioBlob.type.includes('mp4') ? 'm4a' : audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
  form.append('audio', audioBlob, `journal.${ext}`);
  return journalJson(await fetch(`${BASE}/journal/transcribe`, { method: 'POST', body: form }));
}

export async function fetchJournalFollowUp(responses) {
  return journalJson(await fetch(`${BASE}/journal/follow-up`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ responses }),
  }));
}

export async function saveJournalEntry(entry, audioBlobs) {
  const form = new FormData();
  form.append('entry', JSON.stringify(entry));
  audioBlobs.forEach((blob, index) => {
    if (!blob) return;
    const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
    form.append(`audio${index}`, blob, `journal-${index}.${ext}`);
  });
  return journalJson(await fetch(`${BASE}/journal`, { method: 'POST', body: form }));
}

export async function reviewJournalGrammar(id) {
  return journalJson(await fetch(`${BASE}/journal/${id}/grammar`, { method: 'POST' }));
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
