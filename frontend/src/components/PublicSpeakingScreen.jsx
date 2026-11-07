import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import TopicWheel, { SPIN_MS, WHEEL_THEMES } from './TopicWheel.jsx';
import { useAudioRecorder } from '../hooks/useAudioRecorder.js';
import { fetchSpeech, fetchSpeeches, fetchSurpriseTopic, submitSpeech } from '../services/api.js';
import './PublicSpeakingScreen.css';

const challenges = [
  { title: 'Introduce an idea that matters to you', format: 'Presentation', hint: 'Explain the idea, why it matters, and one takeaway.', icon: 'spark' },
  { title: 'Tell a story about a turning point', format: 'Storytelling', hint: 'Set the scene, describe what changed, and share what you learned.', icon: 'book' },
  { title: 'Convince us to try something new', format: 'Persuasive pitch', hint: 'Name the problem, make your case, and end with a clear ask.', icon: 'target' },
];
const formatTips = {
  Presentation: ['Open with a question or surprising fact.', 'Make one clear point and support it with an example.', 'Close with the idea you want people to remember.'],
  Storytelling: ['Set the scene: who, where, and when?', 'Describe the moment something changed.', 'Share what the story means to you now.'],
  'Persuasive pitch': ['Start with a problem your audience recognizes.', 'Offer your idea and one reason to believe it.', 'Finish with a specific action people can take.'],
};
const formatTime = seconds => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

export default function PublicSpeakingScreen({ initialSpeechId = null, initialMode = 'prepared', onBackToHistory = null }) {
  const [step, setStep] = useState('prepare');
  const [format, setFormat] = useState(initialMode === 'impromptu' ? 'Impromptu' : 'Presentation');
  const [mode, setMode] = useState(initialMode);
  const [spinning, setSpinning] = useState(false);
  const [wheelIndex, setWheelIndex] = useState(null);
  const [seenTopics, setSeenTopics] = useState([]);
  const [title, setTitle] = useState('');
  const [outline, setOutline] = useState(['', '', '']);
  const [target, setTarget] = useState(2);
  const [elapsed, setElapsed] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [showCues, setShowCues] = useState(true);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [result, setResult] = useState(null);
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const recordingRef = useRef(false);
  const topicRequestRef = useRef(0);
  const { isRecording, micError, startRecording, stopRecording } = useAudioRecorder();

  useEffect(() => {
    fetchSpeeches().then(setRecent).catch(() => {});
  }, []);
  useEffect(() => {
    if (!initialSpeechId) return;
    fetchSpeech(initialSpeechId).then(speech => { setResult(speech); setMode(speech.format === 'Impromptu' ? 'impromptu' : 'prepared'); setTitle(speech.title); setFormat(speech.format); setStep('result'); }).catch(err => setError(err.message));
  }, [initialSpeechId]);
  useEffect(() => {
    if (!isRecording) return undefined;
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 250);
    return () => clearInterval(interval);
  }, [isRecording, startedAt]);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  const chooseChallenge = challenge => {
    setTitle(challenge.title);
    setFormat(challenge.format);
    setOutline(['', '', '']);
  };
  const chooseMode = next => {
    topicRequestRef.current++;
    setSpinning(false);
    setMode(next);
    setTitle('');
    setFormat(next === 'impromptu' ? 'Impromptu' : 'Presentation');
    setOutline(['', '', '']);
  };
  const spinTopic = async index => {
    const request = ++topicRequestRef.current;
    setSpinning(true);
    setWheelIndex(null);
    setError('');
    try {
      const [topic] = await Promise.all([
        fetchSurpriseTopic(seenTopics, WHEEL_THEMES[index].theme),
        new Promise(resolve => setTimeout(resolve, SPIN_MS + 150)),
      ]);
      if (request !== topicRequestRef.current) return;
      setTitle(topic);
      setWheelIndex(index);
      setSeenTopics(current => [...current.slice(-11), topic]);
    } catch (err) { if (request === topicRequestRef.current) setError(err.message); }
    finally { if (request === topicRequestRef.current) setSpinning(false); }
  };
  const updateOutline = (index, value) => setOutline(current => current.map((item, i) => i === index ? value : item));
  const begin = async () => {
    if (recordingRef.current) return;
    setError('');
    setAudioBlob(null);
    setAudioUrl('');
    setElapsed(0);
    const started = await startRecording();
    if (started) {
      recordingRef.current = true;
      setStartedAt(Date.now());
      setStep('rehearse');
    }
  };
  const finish = async () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    const duration = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
    setElapsed(duration);
    const blob = await stopRecording();
    if (!blob || blob.size < 8000 || duration < 5) {
      setError('Record at least a few seconds so there is enough to review.');
      setStep('prepare');
      return;
    }
    setAudioBlob(blob);
    setAudioUrl(URL.createObjectURL(blob));
    setStep('review');
  };
  useEffect(() => {
    if (mode !== 'impromptu' || step !== 'rehearse') return undefined;
    const timeout = setTimeout(finish, Math.max(0, startedAt + target * 60_000 - Date.now()));
    return () => clearTimeout(timeout);
  }, [mode, step, startedAt, target]);
  const getFeedback = async () => {
    if (!audioBlob || busy) return;
    setBusy(true);
    setError('');
    try {
      const speech = await submitSpeech(audioBlob, { title: title.trim(), format, outline: outline.filter(Boolean).join('\n'), durationSecs: elapsed });
      setResult(speech);
      setStep('result');
      fetchSpeeches().then(setRecent).catch(() => {});
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const openRecent = async id => {
    setBusy(true);
    setError('');
    try { const speech = await fetchSpeech(id); setResult(speech); setMode(speech.format === 'Impromptu' ? 'impromptu' : 'prepared'); setTitle(speech.title); setFormat(speech.format); setStep('result'); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const reset = () => {
    setResult(null);
    setAudioBlob(null);
    setAudioUrl('');
    setError('');
    if (mode === 'impromptu') setTitle('');
    setStep('prepare');
  };

  return <div className="speech-screen animate-in">
    <header className="speech-header">
      <span className="speech-eyebrow"><Icon name="podium" size={17} /> PUBLIC SPEAKING STUDIO</span>
      <h1>Find your voice, one rehearsal at a time.</h1>
      <p>Pick a prompt, shape your message, and practice out loud. Your next step will be clear.</p>
    </header>

    <ol className="speech-steps" aria-label="Rehearsal steps">
      {['Prepare', 'Rehearse', 'Reflect'].map((label, index) => { const current = Math.min(2, ['prepare', 'rehearse', 'review', 'result'].indexOf(step)); return <li key={label} className={`speech-step ${current >= index ? 'speech-step--active' : ''}`} aria-current={current === index ? 'step' : undefined}><span aria-hidden="true">{index + 1}</span>{label}</li>; })}
    </ol>

    {(error || micError) && <div className="speech-error" role="alert">{error || micError}</div>}

    {step === 'prepare' && <>
      <div className="speech-mode-switch" role="group" aria-label="Speaking practice mode">
        <button type="button" className={`speech-chip ${mode === 'prepared' ? 'selected' : ''}`} aria-pressed={mode === 'prepared'} onClick={() => chooseMode('prepared')}>Prepared speech</button>
        <button type="button" className={`speech-chip ${mode === 'impromptu' ? 'selected' : ''}`} aria-pressed={mode === 'impromptu'} onClick={() => chooseMode('impromptu')}>Surprise topic</button>
      </div>
      {mode === 'impromptu' && <section className="speech-section speech-surprise glass-card"><span className="speech-eyebrow">SPIN A TOPIC</span><h2>Speak on the spot</h2><p>Get a random AI topic, then speak freely until the timer ends. Try to explain your point with reasons and an example.</p><TopicWheel spinning={spinning} activeIndex={wheelIndex} onSpin={spinTopic} disabled={spinning} hasTopic={!!title} /><p className="topic-wheel-status" aria-live="polite">{spinning ? 'The wheel is choosing a theme…' : title ? 'Not feeling it? Spin again for a new theme.' : ''}</p>{title && <div className="speech-surprise-topic" aria-live="polite"><small>{wheelIndex !== null ? `${WHEEL_THEMES[wheelIndex].emoji} ${WHEEL_THEMES[wheelIndex].label.toUpperCase()} · YOUR TOPIC` : 'YOUR TOPIC'}</small><strong>{title}</strong></div>}</section>}
      {mode === 'prepared' && <>
      <section className="speech-section">
        <div className="speech-section-title"><span>01 / YOUR STAGE</span><h2>What will you speak about?</h2><p>Start with a challenge or write your own topic.</p></div>
        <div className="speech-challenges">{challenges.map(challenge => <button type="button" key={challenge.title} className={`speech-challenge glass-card ${title === challenge.title ? 'selected' : ''}`} aria-pressed={title === challenge.title} onClick={() => chooseChallenge(challenge)}><span className="speech-challenge-icon"><Icon name={challenge.icon} size={24} /></span><strong>{challenge.title}</strong><small>{challenge.hint}</small><span className="speech-challenge-format">{challenge.format}</span></button>)}</div>
        <label className="speech-field">
          <span className="speech-field-heading"><span><Icon name="edit" size={16} /> Your own topic</span><small>{title.length}/120</small></span>
          <input value={title} maxLength={120} onChange={event => setTitle(event.target.value)} placeholder="e.g. Why everyone should learn to cook" />
          <span className="speech-field-help">A short, specific title makes your rehearsal easier to focus.</span>
        </label>
      </section>
      <section className="speech-section speech-plan glass-card">
        <div className="speech-section-title"><span>02 / THE SHAPE</span><h2>Build a simple outline</h2><p>Three short cues are enough. You can see them while you speak.</p></div>
        <div className="speech-format-row" role="group" aria-label="Speech format">{Object.keys(formatTips).map(option => <button type="button" key={option} className={`speech-chip ${format === option ? 'selected' : ''}`} aria-pressed={format === option} onClick={() => setFormat(option)}>{option}</button>)}</div>
        <div className="speech-outline">{['Opening', 'Main point', 'Closing'].map((label, index) => <label key={label} className="speech-outline-card"><span className="speech-outline-number">{index + 1}</span><span className="speech-outline-copy"><strong>{label}</strong><small>{formatTips[format][index]}</small></span><span className="speech-outline-entry"><textarea rows="2" value={outline[index]} maxLength={180} onChange={event => updateOutline(index, event.target.value)} placeholder={index === 0 ? 'How will you begin?' : index === 1 ? 'What matters most?' : 'What should people remember?'} /><small>{outline[index].length}/180</small></span></label>)}</div>
      </section>
      </>}
      <div className="speech-launch glass-card"><div><strong>Ready to take the stage?</strong><p>{mode === 'impromptu' ? 'Choose how long to speak. Recording ends when the time runs out, or you can finish early.' : 'Choose a goal. The timer helps you pace yourself; you can stop whenever you like.'}</p><div className="speech-format-row" role="group" aria-label="Speaking time">{[1, 2, 3, 5].map(minutes => <button type="button" key={minutes} className={`speech-chip ${target === minutes ? 'selected' : ''}`} aria-pressed={target === minutes} aria-label={`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`} onClick={() => setTarget(minutes)}>{minutes} min</button>)}</div></div><button type="button" className="btn btn-primary btn-lg" disabled={!title.trim() || spinning} onClick={begin}><Icon name="mic" size={18} /> {mode === 'impromptu' ? 'Start speaking' : 'Start rehearsal'}</button></div>
      {recent.length > 0 && <section className="speech-recent"><div className="speech-section-title"><span>YOUR MOMENTUM</span><h2>Past rehearsals</h2></div><div className="speech-recent-list">{recent.slice(0, 4).map(item => <button type="button" className="speech-recent-row glass-card" key={item.id} onClick={() => openRecent(item.id)} disabled={busy}><span className="speech-recent-icon"><Icon name="podium" size={20} /></span><span><strong>{item.title}</strong><small>{item.format} · {new Date(item.created_at).toLocaleDateString()}</small></span><span aria-hidden="true">→</span></button>)}</div></section>}
    </>}

    {step === 'rehearse' && <section className="speech-stage glass-card"><span className="speech-live"><span /> RECORDING</span><h2>{title}</h2><p>{mode === 'impromptu' ? `Surprise topic · ${target} ${target === 1 ? 'minute' : 'minutes'} to speak` : `${format} · Aim for ${target} ${target === 1 ? 'minute' : 'minutes'}`}</p><div className="speech-timer" aria-live="off">{formatTime(mode === 'impromptu' ? Math.max(0, target * 60 - elapsed) : elapsed)}</div><div className="speech-timebar"><span style={{ width: `${Math.min(100, elapsed / (target * 60) * 100)}%` }} /></div><p className="speech-timehint">{mode === 'impromptu' ? 'Keep going with a reason, example, or another angle. Recording stops when time is up.' : elapsed >= target * 60 ? 'You reached your goal. Finish whenever you are ready.' : 'Take your time. Pause between ideas.'}</p>{mode === 'prepared' && <><button type="button" className="speech-cue-toggle" onClick={() => setShowCues(value => !value)} aria-expanded={showCues}>{showCues ? 'Hide' : 'Show'} cue cards</button>{showCues && <div className="speech-cues">{['Opening', 'Main point', 'Closing'].map((label, index) => <div key={label}><small>{label}</small><strong>{outline[index] || formatTips[format][index]}</strong></div>)}</div>}</>}<button type="button" className="btn btn-primary btn-lg" onClick={finish}><Icon name="check" size={18} /> {mode === 'impromptu' ? 'Finish early' : 'Finish rehearsal'}</button></section>}

    {step === 'review' && <section className="speech-review glass-card"><span className="speech-eyebrow">REHEARSAL COMPLETE</span><h2>You showed up and spoke.</h2><p>Listen back if you like, then get feedback on your words and structure.</p><div className="speech-review-meta"><span><Icon name="history" size={17} /> {formatTime(elapsed)} spoken</span><span><Icon name="mic" size={17} /> {title}</span></div>{audioUrl && <audio controls src={audioUrl} aria-label="Play your rehearsal recording" />}<div className="speech-actions"><button type="button" className="btn btn-secondary" onClick={reset}>Start over</button><button type="button" className="btn btn-primary" disabled={busy} onClick={getFeedback}>{busy ? 'Reviewing your speech…' : 'Get my feedback'}</button></div><small>Your recording stays in this browser until you leave this screen. Only the transcript and feedback are saved.</small></section>}

    {step === 'result' && result && onBackToHistory && <button type="button" className="speech-history-back" onClick={onBackToHistory}>← Back to History</button>}
    {step === 'result' && result && <p className="speech-quest-credit"><Icon name="award" size={17} /> This reviewed speech counts toward your weekly speaking quest.</p>}
    {step === 'result' && result && <section className="speech-result"><div className="speech-result-hero glass-card"><span className="speech-eyebrow">YOUR REHEARSAL REVIEW</span><h2>{result.feedback.headline}</h2><p>{result.title} · {result.format} · {formatTime(result.durationSecs)}</p><div className="speech-metrics"><div><strong>{result.feedback.wordCount}</strong><span>words spoken</span></div><div><strong>{result.feedback.pace}</strong><span>words / min</span></div><div><strong>{result.feedback.fillerCount}</strong><span>possible filler words</span></div></div><small>Pace and filler counts are estimates from the transcript.</small></div><div className="speech-feedback-grid"><div className="glass-card"><span className="speech-eyebrow">WHAT WORKED</span>{result.feedback.strengths.length ? result.feedback.strengths.map((strength, index) => <p key={index}><Icon name="check" size={17} />{strength}</p>) : <p>You completed a full rehearsal and gave yourself something to build on.</p>}</div><div className="glass-card speech-next"><span className="speech-eyebrow">ONE THING TO TRY NEXT</span><h3>{result.feedback.nextStep}</h3>{result.feedback.openingSuggestion && <p><strong>Opening idea:</strong> “{result.feedback.openingSuggestion}”</p>}</div></div><details className="speech-transcript glass-card"><summary>Read your transcript</summary><p>{result.transcript}</p></details><div className="speech-actions"><button type="button" className="btn btn-secondary" onClick={reset}>Choose a new topic</button><button type="button" className="btn btn-primary" onClick={begin}><Icon name="mic" size={17} /> Rehearse again</button></div></section>}
  </div>;
}
