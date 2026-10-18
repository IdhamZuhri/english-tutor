import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { useAudioRecorder } from '../hooks/useAudioRecorder.js';
import { fetchJournalEntries, fetchJournalEntry, fetchJournalFollowUp, reviewJournalGrammar, saveJournalEntry, transcribeJournalAudio } from '../services/api.js';
import './JournalScreen.css';

const moods = [
  { id: 'great', emoji: '😄', label: 'Great' },
  { id: 'good', emoji: '🙂', label: 'Good' },
  { id: 'okay', emoji: '😐', label: 'Okay' },
  { id: 'low', emoji: '😔', label: 'Low' },
  { id: 'anxious', emoji: '😟', label: 'Anxious' },
];
const guidedPrompts = [
  'How are you feeling today, and what might be behind it?',
  'What moment from today stands out to you?',
  'What would you like to remember or carry into tomorrow?',
];
const modeOptions = [
  { id: 'guided', icon: 'spark', title: 'Guided reflection', detail: 'Three thoughtful questions, one answer at a time.', length: 'Write or speak' },
  { id: 'conversation', icon: 'chat', title: 'Journal conversation', detail: 'A gentle follow-up question responds to what you share.', length: 'Write or speak' },
  { id: 'free', icon: 'edit', title: 'Free journal', detail: 'Write or record whatever is on your mind.', length: 'No prompts to follow' },
];
const dateLabel = value => new Date(value).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const moodFor = id => moods.find(item => item.id === id) || moods[2];

export default function JournalScreen({ initialEntryId = null, onBackToHistory = null }) {
  const [page, setPage] = useState('home');
  const [entries, setEntries] = useState([]);
  const [detail, setDetail] = useState(null);
  const [mode, setMode] = useState('guided');
  const [mood, setMood] = useState('');
  const [title, setTitle] = useState('Today’s reflection');
  const [prompt, setPrompt] = useState(guidedPrompts[0]);
  const [responses, setResponses] = useState([]);
  const [inputMethod, setInputMethod] = useState('write');
  const [draftText, setDraftText] = useState('');
  const [pendingBlob, setPendingBlob] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recordSeconds, setRecordSeconds] = useState(0);
  const startedAt = useRef(0);
  const audioUrls = useRef([]);
  const { isRecording, micError, startRecording, stopRecording } = useAudioRecorder();

  const loadEntries = () => fetchJournalEntries().then(setEntries).catch(() => setError('Could not load your journal right now.'));
  useEffect(() => { loadEntries(); }, []);
  useEffect(() => {
    if (!initialEntryId) return;
    fetchJournalEntry(initialEntryId).then(entry => { setDetail(entry); setPage('detail'); }).catch(err => setError(err.message));
  }, [initialEntryId]);
  useEffect(() => {
    if (!isRecording) return undefined;
    const timer = setInterval(() => setRecordSeconds(Math.floor((Date.now() - startedAt.current) / 1000)), 300);
    return () => clearInterval(timer);
  }, [isRecording]);
  useEffect(() => () => { audioUrls.current.forEach(url => URL.revokeObjectURL(url)); }, []);

  const begin = selectedMode => {
    audioUrls.current.forEach(url => URL.revokeObjectURL(url));
    audioUrls.current = [];
    setMode(selectedMode);
    setMood('');
    setTitle('Today’s reflection');
    setPrompt(selectedMode === 'free' ? 'Your reflection' : selectedMode === 'guided' ? guidedPrompts[0] : 'How has your day been so far?');
    setResponses([]);
    setInputMethod('write');
    setDraftText('');
    setPendingBlob(null);
    setError('');
    setPage('compose');
  };
  const start = async () => {
    setError('');
    setPendingBlob(null);
    setRecordSeconds(0);
    if (await startRecording()) startedAt.current = Date.now();
  };
  const transcribe = async blob => {
    setBusy(true);
    setError('');
    try {
      const { transcript } = await transcribeJournalAudio(blob);
      const audioUrl = URL.createObjectURL(blob);
      audioUrls.current.push(audioUrl);
      setResponses(current => [...current, { prompt, transcript, audioBlob: blob, audioUrl, source: 'spoken' }]);
      setPendingBlob(null);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const stop = async () => {
    const duration = Math.floor((Date.now() - startedAt.current) / 1000);
    const blob = await stopRecording();
    if (!blob || blob.size < 8000 || duration < 3) {
      setError('Please speak for a few seconds so we can capture your reflection.');
      return;
    }
    setPendingBlob(blob);
    await transcribe(blob);
  };
  const editLatest = value => setResponses(current => current.map((item, index) => index === current.length - 1 ? { ...item, transcript: value } : item));
  const addWritten = () => {
    if (!draftText.trim()) return;
    setResponses(current => [...current, { prompt, transcript: draftText.trim(), audioBlob: null, audioUrl: null, source: 'written' }]);
    setDraftText('');
    setError('');
  };
  const chooseMethod = method => {
    setInputMethod(method);
    setPendingBlob(null);
    setError('');
  };
  const nextPrompt = async () => {
    if (responses.length >= 3) return;
    setError('');
    if (mode === 'guided') { setPrompt(guidedPrompts[responses.length]); return; }
    setBusy(true);
    try {
      const { question } = await fetchJournalFollowUp(responses.map(({ prompt: question, transcript }) => ({ prompt: question, transcript })));
      setPrompt(question.trim() === prompt ? 'What else feels important about that moment?' : question);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!mood) { setError('Choose the mood that feels closest to today.'); return; }
    if (!title.trim()) { setError('Give this entry a short title.'); return; }
    if (!responses.length || responses.some(item => !item.transcript.trim())) { setError('Add a reflection before saving.'); return; }
    setBusy(true);
    setError('');
    try {
      const entry = await saveJournalEntry({ title: title.trim(), mood, mode, responses: responses.map(({ prompt: question, transcript }) => ({ prompt: question, transcript })) }, responses.map(item => item.audioBlob));
      setDetail(entry);
      setPage('detail');
      loadEntries();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const open = async id => {
    setBusy(true);
    setError('');
    try { setDetail(await fetchJournalEntry(id)); setPage('detail'); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const checkGrammar = async () => {
    if (!detail || busy) return;
    setBusy(true);
    setError('');
    try { setDetail(await reviewJournalGrammar(detail.id)); loadEntries(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const latest = responses.at(-1);
  const awaitingAnswer = !latest || latest.prompt !== prompt;
  const canContinue = mode !== 'free' && responses.length < 3;

  return <div className="journal-screen animate-in">
    <header className="journal-header"><span className="journal-eyebrow"><Icon name="journal" size={17} /> DAILY JOURNAL</span><h1>A little space to hear yourself.</h1><p>Write or speak through your day, keep the moments that matter, and return when you need to.</p></header>
    {(error || micError) && <div className="journal-error" role="alert">{error || micError}</div>}

    {page === 'home' && <>
      <p className="journal-privacy-note">Writing is saved locally. If you speak, audio is sent to OpenAI for transcription. Follow-up questions and grammar review send entry text only when you use them.</p>
      <section className="journal-start"><div className="journal-section-heading"><span>NEW ENTRY</span><h2>How would you like to reflect?</h2><p>There’s no right way to journal. Choose what feels easy today.</p></div><div className="journal-modes">{modeOptions.map(option => <button type="button" key={option.id} className={`journal-mode journal-mode--${option.id} glass-card`} onClick={() => begin(option.id)}><span className="journal-mode-icon"><Icon name={option.icon} size={24} /></span><strong>{option.title}</strong><span>{option.detail}</span><small>{option.length}</small><span className="journal-mode-arrow" aria-hidden="true">→</span></button>)}</div></section>
      <section className="journal-library"><div className="journal-section-heading"><span>YOUR JOURNAL</span><h2>Past reflections</h2></div>{entries.length ? <div className="journal-entry-list">{entries.map(entry => <button type="button" key={entry.id} className="journal-entry-row glass-card" disabled={busy} onClick={() => open(entry.id)}><span className="journal-entry-mood" aria-hidden="true">{moodFor(entry.mood).emoji}</span><span><strong>{entry.title}</strong><small>{dateLabel(entry.created_at)} · {moodFor(entry.mood).label} · {entry.responseCount} {entry.responseCount === 1 ? 'reflection' : 'reflections'}</small></span><span aria-hidden="true">→</span></button>)}</div> : <div className="journal-empty glass-card"><Icon name="journal" size={27} /><strong>Your journal starts here</strong><p>When you save a reflection, it will be organized here by date.</p></div>}</section>
    </>}

    {page === 'compose' && <div className="journal-compose"><div className="journal-compose-top"><button type="button" className="journal-back" disabled={isRecording || busy} onClick={() => setPage('home')}>← All entries</button><span>{dateLabel(new Date())}</span></div><div className="journal-template glass-card"><div className="journal-template-title"><span className="journal-eyebrow">TODAY’S ENTRY</span><h2>{modeOptions.find(item => item.id === mode)?.title}</h2></div>
      <label className="journal-title-field">
        <span className="journal-title-heading"><span className="journal-title-icon"><Icon name="edit" size={17} /></span><span>Give this entry a name</span><small>{title.length}/120</small></span>
        <input value={title} maxLength={120} onChange={event => setTitle(event.target.value)} placeholder="A title for today" />
        <span className="journal-title-help">A few words are enough. You can find this entry by its title later.</span>
      </label>
      <div className="journal-mood"><strong>How are you feeling?</strong><div className="journal-mood-options">{moods.map(item => <button type="button" key={item.id} className={mood === item.id ? 'selected' : ''} onClick={() => setMood(item.id)} aria-pressed={mood === item.id}><span aria-hidden="true">{item.emoji}</span>{item.label}</button>)}</div></div></div>
      <div className="journal-progress">{mode === 'free' ? 'OPEN REFLECTION' : `${Math.min(responses.length + (awaitingAnswer ? 1 : 0), 3)} OF 3 POSSIBLE REFLECTIONS`}</div>
      {responses.slice(0, awaitingAnswer ? responses.length : -1).map((item, index) => <div key={index} className="journal-past-answer glass-card"><small>REFLECTION {index + 1}</small><strong>{item.prompt}</strong><p>{item.transcript}</p></div>)}
      <section className="journal-record-card glass-card">
        <span className="journal-record-kicker">{mode === 'free' ? 'YOUR SPACE' : 'YOUR NEXT QUESTION'}</span>
        <h2>{prompt}</h2>
        {mode === 'free' && <p>There’s no prompt to follow. Start wherever you like.</p>}
        {awaitingAnswer ? <>
          <div className="journal-method-toggle" role="group" aria-label="How to add this reflection">
            <button type="button" className={inputMethod === 'write' ? 'selected' : ''} aria-pressed={inputMethod === 'write'} disabled={isRecording || busy} onClick={() => chooseMethod('write')}><Icon name="edit" size={17} /> Write</button>
            <button type="button" className={inputMethod === 'speak' ? 'selected' : ''} aria-pressed={inputMethod === 'speak'} disabled={isRecording || busy} onClick={() => chooseMethod('speak')}><Icon name="mic" size={17} /> Speak</button>
          </div>
          {inputMethod === 'write' ? <div className="journal-write-box"><label htmlFor="journal-write-answer">Your reflection</label><textarea id="journal-write-answer" rows="7" maxLength={6000} value={draftText} onChange={event => setDraftText(event.target.value)} placeholder={mode === 'free' ? 'What is on your mind today?' : 'Write whatever comes to mind…'} /><div><small>{draftText.length}/6000</small><button type="button" className="btn btn-primary" disabled={!draftText.trim()} onClick={addWritten}>Add reflection</button></div></div>
            : <div className="journal-recorder">{isRecording && <div className="journal-recording-status"><span /> Recording · {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, '0')}</div>}{busy ? <div className="journal-processing"><span className="spinner" /> Turning your words into text…</div> : isRecording ? <button type="button" className="btn btn-primary btn-lg" onClick={stop}>Finish this answer</button> : <button type="button" className="btn btn-primary btn-lg" onClick={start}><Icon name="mic" size={18} /> Start recording</button>}{pendingBlob && !busy && <button type="button" className="btn btn-secondary" onClick={() => transcribe(pendingBlob)}>Retry transcription</button>}</div>}
        </> : <div className="journal-answer-review"><span className="journal-answer-check"><Icon name="check" size={16} /> {latest.source === 'written' ? 'Written reflection added' : 'Recording captured'}</span>{latest.audioUrl && <audio controls src={latest.audioUrl} aria-label="Play your latest journal recording" />}<label>{latest.source === 'written' ? 'Your writing' : 'Transcript'} <small>{latest.source === 'written' ? 'You can keep editing this before saving.' : 'Correct any words the recorder missed.'}</small><textarea rows="4" maxLength={6000} value={latest.transcript} onChange={event => editLatest(event.target.value)} /></label><div className="journal-answer-actions">{latest.source === 'spoken' && <button type="button" className="btn btn-secondary" onClick={() => { setResponses(current => current.slice(0, -1)); setError(''); }}>Record this answer again</button>}{canContinue && <button type="button" className="btn btn-secondary" disabled={busy} onClick={nextPrompt}>{busy ? 'Finding a question…' : 'Next question →'}</button>}</div></div>}
      </section>
      {responses.length > 0 && <div className="journal-savebar"><div><strong>Ready to keep this reflection?</strong><span>{!mood ? 'Choose your mood above, then save your entry.' : 'You can save now or answer another question.'}</span></div><button type="button" className="btn btn-primary" disabled={busy || isRecording || !mood || !title.trim()} onClick={save}>{busy ? 'Saving…' : 'Save journal entry'}</button></div>}
    </div>}

    {page === 'detail' && detail && <div className="journal-detail">
      <button type="button" className="journal-back" onClick={onBackToHistory || (() => { setPage('home'); setError(''); })}>{onBackToHistory ? '← Back to History' : '← All entries'}</button>
      <div className="journal-detail-head glass-card"><span className="journal-eyebrow">{dateLabel(detail.created_at)}</span><h2>{detail.title}</h2><div className="journal-detail-meta"><span>{moodFor(detail.mood).emoji} {moodFor(detail.mood).label}</span><span>{modeOptions.find(item => item.id === detail.mode)?.title}</span><span>{detail.responses.length} {detail.responses.length === 1 ? 'reflection' : 'reflections'}</span></div></div>
      <div className="journal-detail-responses">{detail.responses.map((item, index) => <section className="journal-detail-response glass-card" key={index}><span>REFLECTION {index + 1} · {item.source === 'written' ? 'WRITTEN' : 'SPOKEN'}</span><h3>{item.prompt}</h3><p>{item.transcript}</p>{item.audioUrl && <audio controls preload="none" src={item.audioUrl} aria-label={`Play recording for reflection ${index + 1}`} />}</section>)}</div>
      <section className="journal-grammar glass-card"><div><span className="journal-eyebrow">OPTIONAL LANGUAGE REVIEW</span><h2>Check my grammar</h2><p>Your reflection is yours first. Review the language only when you feel ready.</p></div>{!detail.grammar ? <button type="button" className="btn btn-secondary" disabled={busy} onClick={checkGrammar}>{busy ? 'Checking…' : 'Check grammar'}</button> : <div className="journal-grammar-result"><p>{detail.grammar.summary}</p>{detail.grammar.suggestions.length ? detail.grammar.suggestions.map((suggestion, index) => <div key={index} className="journal-suggestion"><small>REFLECTION {suggestion.responseIndex + 1}</small><p><del>{suggestion.original}</del><span aria-hidden="true">→</span><strong>{suggestion.improved}</strong></p><span>{suggestion.explanation}</span></div>) : <div className="journal-no-corrections"><Icon name="check" size={18} /> No clear grammar corrections found.</div>}</div>}</section>
    </div>}
  </div>;
}
