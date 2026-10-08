import http from 'node:http';
import { readFile, mkdir, writeFile, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dist = path.join(root, 'frontend', 'dist');
const dataFile = process.env.SPEAKWELL_DATA_FILE || path.join(here, 'data', 'sessions.json');
const port = Number(process.env.PORT || 8000);

async function loadEnv() {
  try {
    const lines = (await readFile(path.join(here, '.env'), 'utf8')).split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

await loadEnv();
const apiKey = process.env.OPENAI_API_KEY?.trim();
const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
let store;
try {
  store = JSON.parse(await readFile(dataFile, 'utf8'));
  if (!Array.isArray(store.sessions)) throw new Error('Invalid session store');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  store = { nextId: 1, sessions: [] };
}

let saveChain = Promise.resolve();
function save() {
  const snapshot = JSON.stringify(store, null, 2);
  saveChain = saveChain.then(async () => {
    await mkdir(path.dirname(dataFile), { recursive: true });
    const temp = `${dataFile}.tmp`;
    await writeFile(temp, snapshot);
    await rename(temp, dataFile);
  });
  return saveChain;
}

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store' });
  res.end(body);
}

async function bodyBytes(req, limit = 15_000_000) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > limit) {
      const error = new Error('Request is too large');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function openai(endpoint, payload, multipart = false) {
  if (!apiKey || apiKey.includes('your_openai_api_key_here')) {
    const error = new Error('Set OPENAI_API_KEY in backend/.env, then restart the app.');
    error.status = 503;
    throw error;
  }
  const response = await fetch(`https://api.openai.com/v1/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, ...(multipart ? {} : { 'Content-Type': 'application/json' }) },
    body: multipart ? payload : JSON.stringify(payload),
    signal: AbortSignal.timeout(60000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || `OpenAI request failed (${response.status})`);
    error.status = 502;
    throw error;
  }
  return result;
}

async function complete(messages, jsonMode = false) {
  const result = await openai('chat/completions', {
    model,
    messages,
    ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
  });
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned an empty reply');
  return jsonMode ? JSON.parse(content) : content.trim();
}

function safeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.filter(m => ['user', 'assistant'].includes(m?.role) && typeof m.content === 'string')
    .slice(-30).map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));
}

async function api(req, res, pathname, searchParams) {
  if (pathname === '/api/health' && req.method === 'GET') {
    return json(res, 200, { status: 'ok', ready: Boolean(apiKey), missing_keys: apiKey ? [] : ['OPENAI_API_KEY'] });
  }
  if (pathname === '/api/opening' && req.method === 'GET') {
    const topic = (searchParams.get('topic') || 'Small Talk').slice(0, 80);
    const reply = await complete([{ role: 'user', content: `You are Alex, a warm English conversation partner. Start a natural conversation about ${topic}. Write one brief greeting and one engaging question. Maximum two sentences.` }]);
    const session = { id: store.nextId++, topic, created_at: new Date().toISOString(), history: [{ role: 'assistant', content: reply }], summary: null, scores: null, filler_count: null, justifications: null };
    store.sessions.push(session);
    await save();
    return json(res, 200, { session_id: session.id, reply_text: reply, reply_audio_b64: null, tts_fallback: false });
  }
  if (pathname === '/api/chat' && req.method === 'POST') {
    const bytes = await bodyBytes(req);
    const form = await new Request('http://localhost/', { method: 'POST', headers: { 'content-type': req.headers['content-type'] || '' }, body: bytes }).formData();
    const audio = form.get('audio');
    const session = store.sessions.find(s => s.id === Number(form.get('session_id')));
    if (!session) return json(res, 404, { detail: 'Session not found' });
    if (!audio || typeof audio.arrayBuffer !== 'function' || audio.size < 8000) return json(res, 200, { error: 'silent', message: "I didn't catch that. Please try again." });
    const audioForm = new FormData();
    audioForm.append('file', audio, audio.name || 'audio.webm');
    audioForm.append('model', 'whisper-1');
    const transcription = await openai('audio/transcriptions', audioForm, true);
    const transcript = transcription.text?.trim();
    if (!transcript || transcript.split(/\s+/).length < 2) return json(res, 200, { error: 'empty', message: "I didn't catch that. Please try again." });
    const history = safeMessages(session.history);
    const [reply, rawCorrections] = await Promise.all([
      complete([{ role: 'system', content: `You are Alex, a warm English conversation partner. Discuss ${session.topic}. Reply naturally in one or two short sentences and end with a question. Never speak grammar corrections aloud.` }, ...history, { role: 'user', content: transcript }]),
      complete([{ role: 'user', content: `Analyze this learner sentence for clear grammar errors: ${JSON.stringify(transcript)}. Return JSON with has_corrections (boolean), corrected_sentence (string), and corrections (array of objects with original, corrected, explanation). Do not change informal style or word preference.` }], true),
    ]);
    const corrections = {
      has_corrections: Boolean(rawCorrections.has_corrections),
      corrected_sentence: String(rawCorrections.corrected_sentence || transcript),
      corrections: Array.isArray(rawCorrections.corrections) ? rawCorrections.corrections.slice(0, 10) : [],
    };
    session.history.push({ role: 'user', content: transcript, corrections }, { role: 'assistant', content: reply });
    await save();
    return json(res, 200, { transcript, corrections, reply_text: reply, reply_audio_b64: null, tts_fallback: false });
  }
  if (pathname === '/api/sessions' && req.method === 'GET') {
    return json(res, 200, store.sessions.slice(-10).reverse().map(s => ({ id: s.id, topic: s.topic, created_at: s.created_at, grammar_score: s.scores?.grammar ?? null, fluency_score: s.scores?.fluency ?? null, vocabulary_score: s.scores?.vocabulary ?? null, pronunciation_score: s.scores?.pronunciation ?? null })));
  }
  const sessionMatch = pathname.match(/^\/api\/sessions\/(\d+)$/);
  if (sessionMatch && req.method === 'GET') {
    const s = store.sessions.find(item => item.id === Number(sessionMatch[1]));
    if (!s) return json(res, 404, { detail: 'Session not found' });
    return json(res, 200, { summary: s.summary, topic: s.topic, scores: s.scores, filler_count: s.filler_count, justifications: s.justifications, history: s.history });
  }
  if (pathname === '/api/export-history' && req.method === 'GET') {
    const lines = ['# SpeakWell - Conversation History', ''];
    for (const s of store.sessions.slice(-10).reverse()) {
      lines.push(`## ${s.topic}`, `**Date:** ${s.created_at}`, '');
      for (const m of s.history) lines.push(`**${m.role === 'user' ? 'You' : 'Alex'}:** ${m.content}`, '');
      lines.push('---', '');
    }
    return json(res, 200, { markdown: lines.join('\n') });
  }
  return json(res, 404, { detail: 'Not found' });
}

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
async function staticFile(res, pathname) {
  const target = path.resolve(dist, `.${decodeURIComponent(pathname)}`);
  if (target !== dist && !target.startsWith(dist + path.sep)) return json(res, 404, { detail: 'Not found' });
  let file = target;
  try {
    if (!(await stat(file)).isFile()) file = path.join(dist, 'index.html');
  } catch {
    file = path.join(dist, 'index.html');
  }
  try {
    const content = await readFile(file);
    res.writeHead(200, { 'content-type': `${mime[path.extname(file)] || 'application/octet-stream'}; charset=utf-8` });
    res.end(content);
  } catch {
    json(res, 503, { detail: 'Frontend is not built. Run npm run build first.' });
  }
}

export const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) await api(req, res, url.pathname, url.searchParams);
    else if (req.method === 'GET') await staticFile(res, url.pathname);
    else json(res, 405, { detail: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    json(res, error.status || 500, { detail: error.message || 'Internal server error' });
  }
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.listen(port, '127.0.0.1', () => console.log(`SpeakWell running at http://localhost:${port}`));
}
