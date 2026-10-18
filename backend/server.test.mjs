import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('local server serves the app and persists a conversation', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'speakwell-test-'));
  const dataFile = path.join(tempDir, 'sessions.json');
  process.env.SPEAKWELL_DATA_FILE = dataFile;
  process.env.OPENAI_API_KEY = 'test-key';
  const { server } = await import('./server.mjs');
  const realFetch = globalThis.fetch;
  const completionPrompts = [];
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith('http://127.0.0.1:')) return realFetch(url, options);
    if (String(url).endsWith('/audio/transcriptions')) return Response.json({ text: 'I go to school yesterday.' });
    const request = JSON.parse(options.body);
    completionPrompts.push(request.messages);
    if (request.response_format) {
      const isSpeech = request.messages[0]?.content?.includes('public speaking coach');
      return Response.json({ choices: [{ message: { content: JSON.stringify(isSpeech
        ? { headline: 'A clear first rehearsal.', strengths: ['Your opening introduces the topic.'], nextStep: 'Add one concrete example.', openingSuggestion: 'Let me tell you why this matters.' }
        : { has_corrections: true, corrected_sentence: 'I went to school yesterday.', corrections: [{ original: 'go', corrected: 'went', explanation: 'Past tense' }] }) } }] });
    }
    return Response.json({ choices: [{ message: { content: 'What did you learn there?' } }] });
  };
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const page = await realFetch(base);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /SpeakWell/);

    const health = await (await realFetch(`${base}/api/health`)).json();
    assert.equal(health.ready, true);

    const opening = await (await realFetch(`${base}/api/opening?topic=Travel&persona=chill`)).json();
    assert.equal(opening.session_id, 1);
    assert.match(completionPrompts[0][0].content, /relaxed, easygoing friend/);

    const form = new FormData();
    form.append('audio', new Blob([Buffer.alloc(9000)], { type: 'audio/webm' }), 'audio.webm');
    form.append('session_id', String(opening.session_id));
    form.append('history', JSON.stringify([]));
    form.append('topic', 'Travel');
    const chat = await (await realFetch(`${base}/api/chat`, { method: 'POST', body: form })).json();
    assert.equal(chat.transcript, 'I go to school yesterday.');
    assert.equal(chat.corrections.corrected_sentence, 'I went to school yesterday.');
    assert.ok(completionPrompts.some(messages => messages[0]?.role === 'system' && /relaxed, easygoing friend/.test(messages[0].content) && messages.some(message => message.content === chat.transcript)));

    const practice = await (await realFetch(`${base}/api/practice`)).json();
    assert.equal(practice.turnCount, 1);
    assert.equal(practice.areas.find(area => area.category === 'Grammar').count, 1);
    assert.equal(practice.exercises[0].corrected, 'went');
    const attempt = await realFetch(`${base}/api/practice/attempts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: opening.session_id, category: 'Grammar', correct: true }),
    });
    assert.equal(attempt.status, 201);
    assert.equal((await (await realFetch(`${base}/api/practice`)).json()).attempts.length, 1);

    const invalidSpeech = await realFetch(`${base}/api/speeches`, { method: 'POST', body: new FormData() });
    assert.equal(invalidSpeech.status, 400);
    const speechForm = new FormData();
    speechForm.append('audio', new Blob([Buffer.alloc(9000)], { type: 'audio/webm' }), 'speech.webm');
    speechForm.append('title', 'My first presentation');
    speechForm.append('format', 'Presentation');
    speechForm.append('outline', 'Opening\nMain point\nClosing');
    speechForm.append('durationSecs', '60');
    const speechResponse = await realFetch(`${base}/api/speeches`, { method: 'POST', body: speechForm });
    assert.equal(speechResponse.status, 201);
    const speech = await speechResponse.json();
    assert.equal(speech.feedback.pace, 5);
    assert.equal(speech.feedback.nextStep, 'Add one concrete example.');
    assert.equal((await (await realFetch(`${base}/api/speeches`)).json())[0].title, 'My first presentation');
    assert.equal((await (await realFetch(`${base}/api/speeches/${speech.id}`)).json()).transcript, 'I go to school yesterday.');

    const sessions = await (await realFetch(`${base}/api/sessions`)).json();
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].persona, 'chill');
    const detail = await (await realFetch(`${base}/api/sessions/1`)).json();
    assert.equal(detail.history.length, 3);
    assert.equal(detail.persona, 'chill');
    const exported = await (await realFetch(`${base}/api/export-history`)).json();
    assert.match(exported.markdown, /I go to school yesterday/);
    const saved = JSON.parse(await readFile(dataFile, 'utf8'));
    assert.equal(saved.sessions[0].history.length, 3);
    assert.equal(saved.practiceAttempts.length, 1);
    assert.equal(saved.speeches.length, 1);
  } finally {
    globalThis.fetch = realFetch;
    await new Promise(resolve => server.close(resolve));
  }
});
