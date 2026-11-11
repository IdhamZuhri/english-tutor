import { Fragment, useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import './SpeechReview.css';

export const REVIEW_STEPS = [
  { id: 'upload', label: 'Uploading your recording', pending: 'Sending your audio securely to the coach' },
  { id: 'transcribe', label: 'Transcribing your speech in English', pending: 'Turning your voice into text, exactly as spoken' },
  { id: 'delivery', label: 'Measuring pace and filler words', pending: 'Counting words per minute, fillers and sentence length' },
  { id: 'grammar', label: 'Checking grammar and repeated mistakes', pending: 'Finding errors and the patterns behind them' },
  { id: 'evaluate', label: 'Evaluating your speaking', pending: 'Task response, organisation, fluency, vocabulary and accuracy' },
  { id: 'report', label: 'Building your feedback report', pending: 'Bringing everything together' },
];

export const initialReviewSteps = () => Object.fromEntries(REVIEW_STEPS.map(step => [step.id, { status: 'pending', detail: '' }]));

const formatTime = seconds => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

export function ReviewProgress({ steps, transcript, startedAt }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);
  const done = REVIEW_STEPS.filter(step => steps[step.id]?.status === 'done').length;
  const current = REVIEW_STEPS.find(step => steps[step.id]?.status === 'active');
  return <section className="speech-processing glass-card" aria-labelledby="speech-processing-title">
    <div className="speech-processing-head">
      <span className="speech-eyebrow"><span className="speech-processing-pulse" aria-hidden="true" /> AI COACH AT WORK</span>
      <span className="speech-processing-clock">{formatTime(Math.max(0, Math.floor((now - startedAt) / 1000)))}</span>
    </div>
    <h2 id="speech-processing-title">Reviewing your speech</h2>
    <p className="speech-processing-now" aria-live="polite">{current ? `${current.label}…` : done === REVIEW_STEPS.length ? 'Done! Opening your report.' : 'Getting started…'}</p>
    <div className="speech-processing-bar" role="progressbar" aria-label="Review progress" aria-valuemin={0} aria-valuemax={REVIEW_STEPS.length} aria-valuenow={done}>
      <span style={{ width: `${Math.max(4, done / REVIEW_STEPS.length * 100)}%` }} />
    </div>
    <ol className="speech-processing-steps">
      {REVIEW_STEPS.map((step, index) => {
        const state = steps[step.id] || { status: 'pending' };
        return <li key={step.id} className={`speech-processing-step is-${state.status}`}>
          <span className="speech-processing-icon" aria-hidden="true">{state.status === 'done' ? <Icon name="check" size={14} /> : state.status === 'active' ? <span className="speech-processing-spinner" /> : index + 1}</span>
          <span className="speech-processing-copy">
            <strong>{step.label}<span className="sr-only"> ({state.status === 'done' ? 'complete' : state.status === 'active' ? 'in progress' : 'waiting'})</span></strong>
            <small>{state.detail || step.pending}</small>
          </span>
        </li>;
      })}
    </ol>
    {transcript && <div className="speech-processing-transcript">
      <small>WHAT THE COACH HEARD</small>
      <p>{transcript}</p>
    </div>}
  </section>;
}

const levelIndex = { 'Needs focus': 1, Developing: 2, Good: 3, Strong: 4 };
const paceNote = pace => pace < 100 ? 'Slower than typical — fine for clarity, but try linking ideas more smoothly.' : pace > 170 ? 'Quite fast — add short pauses so listeners can follow.' : 'A comfortable, natural speaking pace.';

// Marks each corrected excerpt inside the original transcript, in order.
function highlightMistakes(transcript, corrections) {
  const parts = [];
  let cursor = 0;
  corrections.forEach((correction, index) => {
    const at = transcript.toLowerCase().indexOf(correction.original.toLowerCase(), cursor);
    if (at < 0) return;
    if (at > cursor) parts.push(transcript.slice(cursor, at));
    parts.push(<mark key={index} title={`${correction.corrected} — ${correction.explanation}`}>{transcript.slice(at, at + correction.original.length)}</mark>);
    cursor = at + correction.original.length;
  });
  parts.push(transcript.slice(cursor));
  return parts;
}

export function SpeechReport({ result }) {
  const fb = result.feedback;
  const grammar = fb.grammar || null;
  const corrections = grammar?.corrections || [];
  const patterns = grammar?.patterns || [];
  const criteria = fb.criteria || [];
  const strengths = fb.strengths || [];
  const improvements = fb.improvements || [];
  const vocabulary = fb.vocabulary || [];
  const fillers = fb.fillerBreakdown || [];
  const [transcriptView, setTranscriptView] = useState('original');
  // Older reviews stored a short model answer instead of a full polished transcript.
  const polished = fb.polishedTranscript || fb.modelAnswer || '';

  return <>
    <div className="speech-result-hero glass-card">
      <span className="speech-eyebrow">YOUR SPEAKING REVIEW</span>
      <h2>{fb.headline}</h2>
      <p>{result.title} · {result.format} · {formatTime(result.durationSecs)}</p>
      {fb.overview && <p className="speech-overview">{fb.overview}</p>}
      <div className="speech-metrics">
        <div><strong>{fb.wordCount}</strong><span>words spoken</span></div>
        <div><strong>{fb.pace}</strong><span>words / min</span></div>
        <div><strong>{fb.fillerCount}</strong><span>possible filler words</span></div>
        {grammar && <div><strong>{corrections.length}</strong><span>grammar fixes</span></div>}
        {fb.avgSentenceLength !== undefined && <div><strong>{fb.avgSentenceLength}</strong><span>words / sentence</span></div>}
      </div>
      <small>{fb.pace ? `${paceNote(fb.pace)} ` : ''}Pace and filler counts are estimates from the transcript.</small>
    </div>

    {criteria.length > 0 && <section className="speech-report-section glass-card" aria-labelledby="speech-criteria-title">
      <span className="speech-eyebrow">SPEAKING EVALUATION</span>
      <h3 id="speech-criteria-title">How you did on each skill</h3>
      <div className="speech-criteria">
        {criteria.map(item => <div key={item.name} className={`speech-criterion level-${levelIndex[item.level] || 2}`}>
          <div className="speech-criterion-head"><strong>{item.name}</strong><span className="speech-level">{item.level}</span></div>
          <div className="speech-meter" aria-hidden="true">{[1, 2, 3, 4].map(n => <span key={n} className={n <= (levelIndex[item.level] || 2) ? 'on' : ''} />)}</div>
          <p>{item.comment}</p>
        </div>)}
      </div>
      <small className="speech-report-note">Levels: Needs focus · Developing · Good · Strong. Based on your words only, not your voice or body language.</small>
    </section>}

    <div className="speech-feedback-grid">
      <div className="glass-card">
        <span className="speech-eyebrow">WHAT WORKED</span>
        {strengths.length ? strengths.map((strength, index) => <p key={index}><Icon name="check" size={17} />{strength}</p>) : <p>You completed a full rehearsal and gave yourself something to build on.</p>}
      </div>
      {improvements.length > 0 ? <div className="glass-card speech-improve">
        <span className="speech-eyebrow">TO IMPROVE</span>
        {improvements.map((item, index) => <p key={index}><Icon name="target" size={17} />{item}</p>)}
      </div> : <div className="glass-card speech-next">
        <span className="speech-eyebrow">ONE THING TO TRY NEXT</span>
        <h3>{fb.nextStep}</h3>
        {fb.openingSuggestion && <p><strong>Opening idea:</strong> “{fb.openingSuggestion}”</p>}
      </div>}
    </div>

    {grammar && <section className="speech-report-section glass-card" aria-labelledby="speech-grammar-title">
      <span className="speech-eyebrow">GRAMMAR CORRECTIONS</span>
      <h3 id="speech-grammar-title">{corrections.length ? `${corrections.length} ${corrections.length === 1 ? 'thing' : 'things'} to fix` : 'No clear grammar mistakes'}</h3>
      {grammar.summary && <p className="speech-report-lead">{grammar.summary}</p>}
      {corrections.length > 0 && <ol className="speech-corrections">
        {corrections.map((item, index) => <li key={index}>
          <div className="speech-correction-pair">
            <span className="speech-wrong"><span className="sr-only">You said: </span>{item.original}</span>
            <span className="speech-arrow" aria-hidden="true">→</span>
            <span className="speech-right"><span className="sr-only">Better: </span>{item.corrected}</span>
          </div>
          <p><span className="speech-tag">{item.category}</span>{item.explanation}</p>
        </li>)}
      </ol>}
    </section>}

    {patterns.length > 0 && <section className="speech-report-section glass-card" aria-labelledby="speech-patterns-title">
      <span className="speech-eyebrow">COMMON &amp; REPEATED MISTAKES</span>
      <h3 id="speech-patterns-title">Patterns to watch</h3>
      <p className="speech-report-lead">Fixing a pattern removes many mistakes at once. Focus on these first.</p>
      <div className="speech-patterns">
        {patterns.map((pattern, index) => <article key={index} className="speech-pattern">
          <div className="speech-pattern-head"><strong>{pattern.name}</strong><span className="speech-count" aria-label={`${pattern.count} ${pattern.count === 1 ? 'time' : 'times'}`}>×{pattern.count}</span></div>
          {pattern.explanation && <p>{pattern.explanation}</p>}
          {pattern.examples.length > 0 && <ul>{pattern.examples.map((example, i) => <li key={i}><span className="speech-wrong">{example.original}</span>{example.corrected && <><span className="speech-arrow" aria-hidden="true">→</span><span className="speech-right">{example.corrected}</span></>}</li>)}</ul>}
          {pattern.tip && <p className="speech-pattern-tip"><Icon name="lightbulb" size={16} /> {pattern.tip}</p>}
        </article>)}
      </div>
    </section>}

    {(vocabulary.length > 0 || fillers.length > 0) && <div className="speech-feedback-grid">
      {vocabulary.length > 0 && <div className="glass-card">
        <span className="speech-eyebrow">VOCABULARY UPGRADES</span>
        <ul className="speech-vocab">{vocabulary.map((item, index) => <li key={index}>
          <div><span className="speech-plain">{item.original}</span><span className="speech-arrow" aria-hidden="true">→</span><span className="speech-right">{item.better}</span></div>
          {item.example && <small>“{item.example}”</small>}
        </li>)}</ul>
      </div>}
      {fillers.length > 0 && <div className="glass-card">
        <span className="speech-eyebrow">FILLER WORDS</span>
        <div className="speech-fillers">{fillers.map(item => <span key={item.word}>“{item.word}” <strong>×{item.count}</strong></span>)}</div>
        <small className="speech-report-note">Some of these (like “like” or “actually”) may be used correctly. Try replacing a filler with a short, silent pause.</small>
      </div>}
    </div>}

    {fb.structure && <section className="speech-report-section glass-card" aria-labelledby="speech-structure-title">
      <span className="speech-eyebrow">STRUCTURE</span>
      <h3 id="speech-structure-title">Opening, body and closing</h3>
      <div className="speech-structure">
        {[['Opening', fb.structure.opening], ['Body', fb.structure.body], ['Closing', fb.structure.closing]].filter(([, value]) => value).map(([label, value]) => <div key={label}><small>{label}</small><p>{value}</p></div>)}
      </div>
    </section>}

    {improvements.length > 0 && <div className="glass-card speech-next speech-next--wide">
      <span className="speech-eyebrow">ONE THING TO TRY NEXT</span>
      <h3>{fb.nextStep}</h3>
      {fb.openingSuggestion && <p><strong>Opening idea:</strong> “{fb.openingSuggestion}”</p>}
    </div>}

    <section className="speech-report-section glass-card" aria-labelledby="speech-transcripts-title">
      <span className="speech-eyebrow">YOUR SPEECH, BEFORE AND AFTER</span>
      <h3 id="speech-transcripts-title">Full transcript and polished version</h3>
      <p className="speech-report-lead">Compare what you said with a polished version of the same speech. Then read the polished version aloud once to feel the difference.</p>
      <div className={`speech-transcripts ${polished ? '' : 'is-single'}`}>
        <article className="speech-transcript-panel">
          <div className="speech-transcript-head">
            <strong>{transcriptView === 'corrected' ? 'Grammar corrected' : 'What you said'}</strong>
            {grammar && <div className="speech-format-row" role="group" aria-label="Transcript version">
              <button type="button" className={`speech-chip ${transcriptView === 'original' ? 'selected' : ''}`} aria-pressed={transcriptView === 'original'} onClick={() => setTranscriptView('original')}>Original</button>
              <button type="button" className={`speech-chip ${transcriptView === 'corrected' ? 'selected' : ''}`} aria-pressed={transcriptView === 'corrected'} onClick={() => setTranscriptView('corrected')}>Corrected</button>
            </div>}
          </div>
          <p>{transcriptView === 'corrected' && grammar ? grammar.correctedTranscript : <Fragment>{highlightMistakes(result.transcript, corrections)}</Fragment>}</p>
          <small className="speech-report-note">{transcriptView === 'corrected' ? 'Only the grammar mistakes are fixed; your wording stays the same.' : corrections.length > 0 ? 'Exactly as transcribed. Highlighted parts have a grammar correction; hover to see the fix.' : 'Exactly as transcribed from your recording.'}</small>
        </article>
        {polished && <article className="speech-transcript-panel speech-transcript-panel--polished">
          <div className="speech-transcript-head"><strong><Icon name="spark" size={16} /> Polished version</strong></div>
          <p>{polished}</p>
          <small className="speech-report-note">{fb.polishedTranscript ? 'Your ideas in the same order, with fillers removed, grammar fixed, sharper vocabulary and smoother linking words.' : 'A shorter model answer based on your ideas.'}</small>
        </article>}
      </div>
    </section>
  </>;
}
