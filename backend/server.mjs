import http from 'node:http';
import { readFile, mkdir, writeFile, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { practiceInsights } from './practice.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dist = path.join(root, 'frontend', 'dist');
const dataFile = process.env.SPEAKWELL_DATA_FILE || path.join(here, 'data', 'sessions.json');
const journalAudioDir = path.join(path.dirname(dataFile), 'journal-audio');
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
const model = process.env.OPENAI_MODEL?.trim() || 'gpt-6-luna';
const personaInstructions = {
  balanced: 'Be a natural, friendly conversation partner. Use clear everyday English and ask one relevant follow-up question.',
  chill: 'Be a relaxed, easygoing friend. Use natural conversational English, keep the tone low pressure, and ask casual follow-up questions without excessive slang.',
  coach: 'Be a patient, encouraging speaking coach. Give the learner time to explain, ask one manageable question at a time, and help them continue when they get stuck. Keep corrections out of spoken replies.',
  professional: 'Be a courteous professional conversation partner. Use clear workplace English and realistic work situations, with polished but accessible language.',
  challenger: 'Be a thoughtful discussion partner. Ask respectful follow-up questions that invite reasons, examples, and alternative viewpoints. Keep disagreement friendly and accessible.',
};
const validPersona = value => Object.hasOwn(personaInstructions, value) ? value : 'balanced';
let store;
try {
  store = JSON.parse(await readFile(dataFile, 'utf8'));
  if (!Array.isArray(store.sessions)) throw new Error('Invalid session store');
  if (!Array.isArray(store.practiceAttempts)) store.practiceAttempts = [];
  if (!Array.isArray(store.speeches)) store.speeches = [];
  if (!Array.isArray(store.journalEntries)) store.journalEntries = [];
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  store = { nextId: 1, sessions: [], practiceAttempts: [], speeches: [], journalEntries: [] };
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

const journalModes = ['guided', 'conversation', 'free'];
const journalMoods = ['great', 'good', 'okay', 'low', 'anxious'];
const audioTypes = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/wav': 'wav', 'audio/mpeg': 'mp3' };

function parseForm(req, bytes) {
  return new Request('http://localhost/', { method: 'POST', headers: { 'content-type': req.headers['content-type'] || '' }, body: bytes }).formData();
}

async function transcribe(audio) {
  const audioForm = new FormData();
  audioForm.append('file', audio, audio.name || 'journal.webm');
  audioForm.append('model', 'whisper-1');
  const transcription = await openai('audio/transcriptions', audioForm, true);
  return transcription.text?.trim() || '';
}

function journalDetail(entry) {
  return { ...entry, responses: entry.responses.map((response, index) => ({ prompt: response.prompt, transcript: response.transcript, source: response.audioFile ? 'spoken' : 'written', audioUrl: response.audioFile ? `/api/journal/${entry.id}/audio/${index}` : null })) };
}

async function api(req, res, pathname, searchParams) {
  if (pathname === '/api/health' && req.method === 'GET') {
    return json(res, 200, { status: 'ok', ready: Boolean(apiKey), missing_keys: apiKey ? [] : ['OPENAI_API_KEY'] });
  }
  if (pathname === '/api/journal' && req.method === 'GET') {
    return json(res, 200, store.journalEntries.slice().reverse().map(({ id, title, mood, mode, created_at, responses, grammar }) => ({ id, title, mood, mode, created_at, responseCount: responses.length, grammarChecked: Boolean(grammar) })));
  }
  if (pathname === '/api/journal/transcribe' && req.method === 'POST') {
    const form = await parseForm(req, await bodyBytes(req, 16_000_000));
    const audio = form.get('audio');
    if (!audio || typeof audio.arrayBuffer !== 'function' || audio.size < 8000 || audio.size > 15_000_000 || !audioTypes[String(audio.type || '').split(';')[0]]) return json(res, 400, { detail: 'Record at least a few seconds of supported audio to add a journal response.' });
    const transcript = await transcribe(audio);
    if (transcript.split(/\s+/).length < 2) return json(res, 422, { detail: 'We could not hear enough speech. Please try again.' });
    return json(res, 200, { transcript: transcript.slice(0, 6000) });
  }
  if (pathname === '/api/journal/follow-up' && req.method === 'POST') {
    let body;
    try { body = JSON.parse((await bodyBytes(req, 20_000)).toString('utf8')); }
    catch { return json(res, 400, { detail: 'Invalid journal conversation' }); }
    const responses = body.responses;
    if (!Array.isArray(responses) || responses.length < 1 || responses.length > 2 || responses.some(item => typeof item?.prompt !== 'string' || typeof item?.transcript !== 'string')) return json(res, 400, { detail: 'Invalid journal conversation' });
    const question = await complete([
      { role: 'system', content: 'You are a gentle journaling companion. Based on the reflections, ask one brief, open-ended follow-up question that helps the person reflect on their day. Do not give advice, diagnose, evaluate emotions, or correct grammar. Return only the question.' },
      { role: 'user', content: JSON.stringify(responses.map(item => ({ question: item.prompt.slice(0, 240), answer: item.transcript.slice(0, 2000) }))) },
    ]);
    return json(res, 200, { question: question.slice(0, 240) });
  }
  if (pathname === '/api/journal' && req.method === 'POST') {
    const form = await parseForm(req, await bodyBytes(req, 46_000_000));
    let draft;
    try { draft = JSON.parse(String(form.get('entry') || '')); }
    catch { return json(res, 400, { detail: 'Invalid journal entry' }); }
    const { title, mood, mode, responses } = draft || {};
    if (typeof title !== 'string' || !title.trim() || title.length > 120 || !journalMoods.includes(mood) || !journalModes.includes(mode) || !Array.isArray(responses) || responses.length < 1 || responses.length > 3 || (mode === 'free' && responses.length !== 1)) return json(res, 400, { detail: 'Complete the journal title, mood, and at least one reflection.' });
    const normalized = [];
    for (let index = 0; index < responses.length; index++) {
      const response = responses[index];
      const audio = form.get(`audio${index}`);
      const type = String(audio?.type || '').split(';')[0];
      if (typeof response?.prompt !== 'string' || !response.prompt.trim() || response.prompt.length > 240 || typeof response?.transcript !== 'string' || !response.transcript.trim() || response.transcript.length > 6000 || (audio && (typeof audio.arrayBuffer !== 'function' || audio.size < 8000 || audio.size > 15_000_000 || !audioTypes[type]))) return json(res, 400, { detail: 'Each reflection needs text and, if recorded, a valid audio clip.' });
      normalized.push({ prompt: response.prompt.trim(), transcript: response.transcript.trim(), audio, type });
    }
    const id = store.nextId;
    if (normalized.some(item => item.audio)) await mkdir(journalAudioDir, { recursive: true });
    const savedResponses = [];
    for (let index = 0; index < normalized.length; index++) {
      const item = normalized[index];
      let audioFile = null;
      if (item.audio) {
        audioFile = `${id}-${index}.${audioTypes[item.type]}`;
        await writeFile(path.join(journalAudioDir, audioFile), Buffer.from(await item.audio.arrayBuffer()));
      }
      savedResponses.push({ prompt: item.prompt, transcript: item.transcript, audioFile, audioType: item.audio ? item.type : null });
    }
    const entry = { id: store.nextId++, title: title.trim(), mood, mode, created_at: new Date().toISOString(), responses: savedResponses, grammar: null };
    store.journalEntries.push(entry);
    await save();
    return json(res, 201, journalDetail(entry));
  }
  const journalMatch = pathname.match(/^\/api\/journal\/(\d+)$/);
  if (journalMatch && req.method === 'GET') {
    const entry = store.journalEntries.find(item => item.id === Number(journalMatch[1]));
    return entry ? json(res, 200, journalDetail(entry)) : json(res, 404, { detail: 'Journal entry not found' });
  }
  const journalAudioMatch = pathname.match(/^\/api\/journal\/(\d+)\/audio\/(\d+)$/);
  if (journalAudioMatch && req.method === 'GET') {
    const entry = store.journalEntries.find(item => item.id === Number(journalAudioMatch[1]));
    const response = entry?.responses[Number(journalAudioMatch[2])];
    if (!response || !/^\d+-\d+\.(webm|ogg|m4a|wav|mp3)$/.test(response.audioFile)) return json(res, 404, { detail: 'Recording not found' });
    const audio = await readFile(path.join(journalAudioDir, response.audioFile));
    res.writeHead(200, { 'content-type': response.audioType, 'content-length': audio.length, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    return res.end(audio);
  }
  const journalGrammarMatch = pathname.match(/^\/api\/journal\/(\d+)\/grammar$/);
  if (journalGrammarMatch && req.method === 'POST') {
    const entry = store.journalEntries.find(item => item.id === Number(journalGrammarMatch[1]));
    if (!entry) return json(res, 404, { detail: 'Journal entry not found' });
    if (entry.grammar) return json(res, 200, journalDetail(entry));
    const raw = await complete([
      { role: 'system', content: 'You are a supportive English editor. Review journal responses only when requested. Return JSON with summary (one gentle sentence) and suggestions (array of objects with responseIndex, original, improved, explanation). Include up to six clear grammar or word-choice fixes. Preserve the writer\'s meaning, emotion, informal voice, and personal style. Do not rewrite the entire journal or assess pronunciation. If nothing needs correction, use an empty suggestions array.' },
      { role: 'user', content: JSON.stringify(entry.responses.map(({ prompt, transcript }, index) => ({ responseIndex: index, prompt, transcript }))) },
    ], true);
    entry.grammar = {
      summary: String(raw.summary || 'Here is a gentle review of your writing.').slice(0, 240),
      suggestions: (Array.isArray(raw.suggestions) ? raw.suggestions : []).filter(item => Number.isInteger(item?.responseIndex) && item.responseIndex >= 0 && item.responseIndex < entry.responses.length).slice(0, 6).map(item => ({ responseIndex: item.responseIndex, original: String(item.original || '').slice(0, 300), improved: String(item.improved || '').slice(0, 300), explanation: String(item.explanation || '').slice(0, 300) })),
    };
    await save();
    return json(res, 200, journalDetail(entry));
  }
  if (pathname === '/api/speeches' && req.method === 'GET') {
    return json(res, 200, store.speeches.slice().reverse().map(({ id, title, format, durationSecs, created_at, feedback }) => ({ id, title, format, durationSecs, created_at, headline: feedback.headline })));
  }
  if (pathname === '/api/speeches/topic' && req.method === 'POST') {
    let body;
    try { body = JSON.parse((await bodyBytes(req, 5000)).toString('utf8')); }
    catch { return json(res, 400, { detail: 'Invalid topic request' }); }
    const recentTopics = Array.isArray(body?.recentTopics) ? body.recentTopics.filter(value => typeof value === 'string').slice(-12).map(value => value.slice(0, 120)) : [];
    const themes = ['everyday life', 'travel and places', 'technology', 'community', 'learning', 'food and culture', 'work and goals', 'imagination'];
    const theme = themes.includes(body?.theme) ? body.theme : themes[Math.floor(Math.random() * themes.length)];
    const raw = await complete([
      { role: 'system', content: 'Create one fresh, accessible English speaking topic for a learner to talk about freely for 1 to 5 minutes. Make it specific enough to invite an opinion, reasons, and examples, but open enough for different answers. Return JSON with a single topic string (a short question, at most 120 characters). No instructions, answers, or sensitive personal questions.' },
      { role: 'user', content: JSON.stringify({ theme, avoid: recentTopics }) },
    ], true);
    const topic = String(raw.topic || '').trim().slice(0, 120);
    if (!topic) return json(res, 502, { detail: 'Could not generate a topic. Please try again.' });
    return json(res, 200, { topic });
  }
  if (pathname === '/api/speeches' && req.method === 'POST') {
    const bytes = await bodyBytes(req, 25_000_000);
    const form = await new Request('http://localhost/', { method: 'POST', headers: { 'content-type': req.headers['content-type'] || '' }, body: bytes }).formData();
    const audio = form.get('audio');
    const title = String(form.get('title') || '').trim().slice(0, 120);
    const format = String(form.get('format') || '').trim().slice(0, 40);
    const outline = String(form.get('outline') || '').trim().slice(0, 1200);
    const durationSecs = Number(form.get('durationSecs'));
    if (!title || !['Presentation', 'Storytelling', 'Persuasive pitch', 'Impromptu'].includes(format) || !Number.isFinite(durationSecs) || durationSecs < 5 || durationSecs > 900 || !audio || typeof audio.arrayBuffer !== 'function' || audio.size < 8000) {
      return json(res, 400, { detail: 'Record at least a few seconds and complete the speech details.' });
    }
    const audioForm = new FormData();
    audioForm.append('file', audio, audio.name || 'speech.webm');
    audioForm.append('model', 'whisper-1');
    const transcription = await openai('audio/transcriptions', audioForm, true);
    const transcript = transcription.text?.trim();
    if (!transcript || transcript.split(/\s+/).length < 5) return json(res, 422, { detail: 'We could not hear enough speech. Try recording again in a quieter place.' });
    const words = transcript.match(/\b[\w'-]+\b/g) || [];
    const fillerCount = (transcript.match(/\b(um|uh|erm|you know|like)\b/gi) || []).length;
    const pace = Math.round(words.length / (durationSecs / 60));
    const raw = await complete([
      { role: 'system', content: `You are a supportive public speaking coach. Assess only the supplied transcript, topic, and outline. ${format === 'Impromptu' ? 'This is an unprepared response to a random topic. Focus on whether the learner develops a clear idea with relevant reasons, details, or examples. Suggest one concrete way to elaborate further.' : 'Focus on the structure and clarity of the prepared speech.'} Return JSON with headline (one short encouraging sentence), strengths (array of 1-2 specific observations), nextStep (one concrete action for the next rehearsal), and openingSuggestion (one optional improved opening sentence). Do not claim to assess vocal delivery, eye contact, body language, confidence, or pronunciation. Avoid numeric scores.` },
      { role: 'user', content: JSON.stringify({ title, format, outline, transcript }) },
    ], true);
    const feedback = {
      headline: String(raw.headline || 'You completed a rehearsal.').slice(0, 240),
      strengths: (Array.isArray(raw.strengths) ? raw.strengths : []).slice(0, 2).map(value => String(value).slice(0, 300)),
      nextStep: String(raw.nextStep || 'Try one more rehearsal with a clear opening and close.').slice(0, 300),
      openingSuggestion: String(raw.openingSuggestion || '').slice(0, 300),
      wordCount: words.length, pace, fillerCount,
    };
    const speech = { id: store.nextId++, title, format, outline, durationSecs: Math.round(durationSecs), transcript, feedback, created_at: new Date().toISOString() };
    store.speeches.push(speech);
    await save();
    return json(res, 201, speech);
  }
  const speechMatch = pathname.match(/^\/api\/speeches\/(\d+)$/);
  if (speechMatch && req.method === 'GET') {
    const speech = store.speeches.find(item => item.id === Number(speechMatch[1]));
    return speech ? json(res, 200, speech) : json(res, 404, { detail: 'Rehearsal not found' });
  }
  if (pathname === '/api/opening' && req.method === 'GET') {
    const topic = (searchParams.get('topic') || 'Small Talk').slice(0, 80);
    const focus = ['Grammar', 'Sentence structure', 'Vocabulary'].includes(searchParams.get('focus')) ? searchParams.get('focus') : null;
    const persona = validPersona(searchParams.get('persona'));
    const reply = await complete([
      { role: 'system', content: `You are Alex, the learner's English speaking partner. ${personaInstructions[persona]} ${focus ? `Help the learner practice ${focus.toLowerCase()} through this conversation.` : ''} Keep the reply to one brief greeting and one engaging question. Do not lecture or give grammar corrections aloud.` },
      { role: 'user', content: `Start a conversation about ${topic}.` },
    ]);
    const session = { id: store.nextId++, topic, focus, persona, created_at: new Date().toISOString(), history: [{ role: 'assistant', content: reply }], summary: null, scores: null, filler_count: null, justifications: null };
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
      complete([{ role: 'system', content: `You are Alex, the learner's English speaking partner. ${personaInstructions[validPersona(session.persona)]} Discuss ${session.topic}. ${session.focus ? `Help the learner practice ${session.focus.toLowerCase()} through natural follow-up questions.` : ''} Reply in one or two short sentences and end with a question. Do not speak corrections aloud.` }, ...history, { role: 'user', content: transcript }]),
      complete([{ role: 'user', content: `Analyze this learner's spoken sentence, transcribed to text: ${JSON.stringify(transcript)}. Return JSON with has_corrections (boolean), corrected_sentence (string), and corrections (array of objects with original, corrected, explanation, category). Category must be Grammar, Sentence structure, or Vocabulary. Include only clear grammar, structure, or word-choice errors. Do not change informal style or personal word preference. Do not assess pronunciation or fluency from text.` }], true),
    ]);
    const corrections = {
      has_corrections: Boolean(rawCorrections.has_corrections),
      corrected_sentence: String(rawCorrections.corrected_sentence || transcript),
      corrections: Array.isArray(rawCorrections.corrections) ? rawCorrections.corrections.slice(0, 10) : [],
    };
    session.history.push({ role: 'user', content: transcript, corrections }, { role: 'assistant', content: reply });
    session.last_spoke_at = new Date().toISOString();
    await save();
    return json(res, 200, { transcript, corrections, reply_text: reply, reply_audio_b64: null, tts_fallback: false });
  }
  if (pathname === '/api/sessions' && req.method === 'GET') {
    return json(res, 200, store.sessions.slice().reverse().map(s => ({ id: s.id, topic: s.topic, persona: validPersona(s.persona), created_at: s.created_at, last_spoke_at: s.last_spoke_at || null, has_spoken: s.history?.some(message => message.role === 'user') || false, grammar_score: s.scores?.grammar ?? null, fluency_score: s.scores?.fluency ?? null, vocabulary_score: s.scores?.vocabulary ?? null, pronunciation_score: s.scores?.pronunciation ?? null })));
  }
  if (pathname === '/api/practice' && req.method === 'GET') {
    return json(res, 200, practiceInsights(store.sessions, store.practiceAttempts));
  }
  if (pathname === '/api/practice/attempts' && req.method === 'POST') {
    const attempt = JSON.parse((await bodyBytes(req, 10_000)).toString('utf8'));
    if (!Number.isInteger(attempt.sessionId) || !store.sessions.some(session => session.id === attempt.sessionId) ||
        !['Grammar', 'Sentence structure', 'Vocabulary'].includes(attempt.category) || typeof attempt.correct !== 'boolean') {
      return json(res, 400, { detail: 'Invalid practice attempt' });
    }
    store.practiceAttempts.push({ sessionId: attempt.sessionId, category: attempt.category, correct: attempt.correct, created_at: new Date().toISOString() });
    await save();
    return json(res, 201, { saved: true });
  }
  const sessionMatch = pathname.match(/^\/api\/sessions\/(\d+)$/);
  if (sessionMatch && req.method === 'GET') {
    const s = store.sessions.find(item => item.id === Number(sessionMatch[1]));
    if (!s) return json(res, 404, { detail: 'Session not found' });
    return json(res, 200, { summary: s.summary, topic: s.topic, persona: validPersona(s.persona), scores: s.scores, filler_count: s.filler_count, justifications: s.justifications, history: s.history });
  }
  if (pathname === '/api/export-history' && req.method === 'GET') {
    const lines = ['# SpeakWell - Conversation History', ''];
    for (const s of store.sessions.slice().reverse()) {
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
