import { useEffect, useRef, useState } from 'react';
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

const CORRECTIONS_PREVIEW = 5;

function Pair({ from, to, plain = false }) {
  return <span className="speech-pair">
    <span className={plain ? 'speech-plain' : 'speech-wrong'}><span className="sr-only">{plain ? 'Instead of: ' : 'You said: '}</span>{from}</span>
    {to && <><span className="speech-arrow" aria-hidden="true">→</span><span className="speech-right"><span className="sr-only">Better: </span>{to}</span></>}
  </span>;
}

function Meter({ level }) {
  const value = levelIndex[level] || 2;
  return <span className={`speech-meter level-${value}`} aria-hidden="true">{[1, 2, 3, 4].map(n => <span key={n} className={n <= value ? 'on' : ''} />)}</span>;
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
  // Older reviews stored a short model answer instead of a full polished transcript.
  const polished = fb.polishedTranscript || fb.modelAnswer || '';

  const tabs = [
    { id: 'feedback', label: 'Feedback' },
    grammar && { id: 'grammar', label: 'Grammar', badge: corrections.length },
    (criteria.length || vocabulary.length || fillers.length) && { id: 'skills', label: 'Skills & words' },
    { id: 'transcript', label: 'Transcript' },
  ].filter(Boolean);
  const [tab, setTab] = useState('feedback');
  const [highlight, setHighlight] = useState('');
  const [category, setCategory] = useState('All');
  const [showAll, setShowAll] = useState(false);
  const [view, setView] = useState(polished ? 'compare' : 'original');
  const tabRefs = useRef({});
  const tabBarRef = useRef(null);

  const openTab = (id, focus = false) => {
    setTab(id);
    if (focus) tabRefs.current[id]?.focus();
    requestAnimationFrame(() => {
      const bar = tabBarRef.current;
      if (bar && bar.getBoundingClientRect().top < 0) bar.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  };
  const onTabKey = event => {
    const index = tabs.findIndex(item => item.id === tab);
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    openTab(tabs[(next + tabs.length) % tabs.length].id, true);
  };
  const openSkill = name => {
    setHighlight(name);
    openTab('skills');
    requestAnimationFrame(() => document.getElementById(`skill-${name.replace(/\W+/g, '-')}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  };
  useEffect(() => {
    if (!highlight) return undefined;
    const timeout = setTimeout(() => setHighlight(''), 2200);
    return () => clearTimeout(timeout);
  }, [highlight]);

  const categories = ['All', ...new Set(corrections.map(item => item.category))];
  const filtered = category === 'All' ? corrections : corrections.filter(item => item.category === category);
  const visible = showAll ? filtered : filtered.slice(0, CORRECTIONS_PREVIEW);

  const transcriptPanel = which => {
    if (which === 'polished') return <article className="speech-transcript-panel speech-transcript-panel--polished">
      <div className="speech-transcript-head"><strong><Icon name="spark" size={16} /> Polished version</strong></div>
      <p>{polished}</p>
      <small className="speech-report-note">{fb.polishedTranscript ? 'Your ideas in the same order, with fillers removed, grammar fixed, sharper words and smoother links. Read it aloud once.' : 'A shorter model answer based on your ideas.'}</small>
    </article>;
    if (which === 'corrected') return <article className="speech-transcript-panel">
      <div className="speech-transcript-head"><strong>Grammar corrected</strong></div>
      <p>{grammar?.correctedTranscript || result.transcript}</p>
      <small className="speech-report-note">Only the grammar mistakes are fixed; your wording stays the same.</small>
    </article>;
    return <article className="speech-transcript-panel">
      <div className="speech-transcript-head"><strong>What you said</strong></div>
      <p>{highlightMistakes(result.transcript, corrections)}</p>
      <small className="speech-report-note">{corrections.length ? 'Exactly as transcribed. Highlighted parts have a correction; hover to see it.' : 'Exactly as transcribed from your recording.'}</small>
    </article>;
  };
  const views = [polished && ['compare', 'Compare'], ['original', 'What you said'], grammar && ['corrected', 'Corrected'], polished && ['polished', 'Polished']].filter(Boolean);

  return <>
    <div className="speech-result-hero glass-card">
      <span className="speech-eyebrow">YOUR SPEAKING REVIEW</span>
      <h2>{fb.headline}</h2>
      <p className="speech-result-meta">{result.title} · {result.format} · {formatTime(result.durationSecs)}</p>
      {fb.overview && <p className="speech-overview">{fb.overview}</p>}
      <div className={`speech-summary ${criteria.length ? '' : 'is-single'}`}>
        <div className="speech-stats">
          <div><strong>{fb.wordCount}</strong><span>words</span></div>
          <div><strong>{fb.pace}</strong><span>words / min</span></div>
          <div><strong>{fb.fillerCount}</strong><span>filler words</span></div>
          {grammar && <button type="button" onClick={() => openTab('grammar')}><strong>{corrections.length}</strong><span>grammar fixes →</span></button>}
          {fb.avgSentenceLength !== undefined && <div><strong>{fb.avgSentenceLength}</strong><span>words / sentence</span></div>}
          <small>{fb.pace ? paceNote(fb.pace) : ''} Counts are estimates from the transcript.</small>
        </div>
        {criteria.length > 0 && <div className="speech-snapshot">
          <span className="speech-snapshot-title">SKILL SNAPSHOT</span>
          {criteria.map(item => <button type="button" key={item.name} className={`speech-snapshot-row level-${levelIndex[item.level] || 2}`} onClick={() => openSkill(item.name)} aria-label={`${item.name}: ${item.level}. Show details`}>
            <span>{item.name}</span><Meter level={item.level} /><em>{item.level}</em>
          </button>)}
        </div>}
      </div>
    </div>

    <div className="speech-focus glass-card">
      <span className="speech-focus-icon" aria-hidden="true"><Icon name="target" size={20} /></span>
      <div>
        <span className="speech-eyebrow">ONE THING TO TRY NEXT</span>
        <h3>{fb.nextStep}</h3>
        {fb.openingSuggestion && <p><strong>Try this opening:</strong> “{fb.openingSuggestion}”</p>}
      </div>
    </div>

    <div className="speech-tabs" role="tablist" aria-label="Review details" ref={tabBarRef} onKeyDown={onTabKey}>
      {tabs.map(item => <button key={item.id} type="button" role="tab" id={`speech-tab-${item.id}`} aria-controls={`speech-panel-${item.id}`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} ref={node => { tabRefs.current[item.id] = node; }} className={tab === item.id ? 'is-active' : ''} onClick={() => openTab(item.id)}>
        {item.label}{item.badge !== undefined && <span className="speech-tab-badge">{item.badge}</span>}
      </button>)}
    </div>

    <div className="speech-tab-panel" role="tabpanel" id={`speech-panel-${tab}`} aria-labelledby={`speech-tab-${tab}`} key={tab}>
      {tab === 'feedback' && <>
        <div className="speech-feedback-grid">
          <div className="glass-card">
            <span className="speech-eyebrow">WHAT WORKED</span>
            {strengths.length ? strengths.map((strength, index) => <p key={index}><Icon name="check" size={17} />{strength}</p>) : <p>You completed a full rehearsal and gave yourself something to build on.</p>}
          </div>
          {improvements.length > 0 && <div className="glass-card speech-improve">
            <span className="speech-eyebrow">TO IMPROVE</span>
            {improvements.map((item, index) => <p key={index}><Icon name="target" size={17} />{item}</p>)}
          </div>}
        </div>
        {fb.structure && <section className="speech-report-section glass-card" aria-label="Structure">
          <span className="speech-eyebrow">STRUCTURE</span>
          <div className="speech-structure">
            {[['Opening', fb.structure.opening], ['Body', fb.structure.body], ['Closing', fb.structure.closing]].filter(([, value]) => value).map(([label, value], index) => <div key={label}><small><span>{index + 1}</span>{label}</small><p>{value}</p></div>)}
          </div>
        </section>}
      </>}

      {tab === 'grammar' && grammar && <>
        {grammar.summary && <p className="speech-panel-lead">{grammar.summary}</p>}
        {patterns.length > 0 && <section className="speech-report-section glass-card" aria-labelledby="speech-patterns-title">
          <span className="speech-eyebrow">FIX THESE FIRST</span>
          <h3 id="speech-patterns-title">Repeated mistakes</h3>
          <p className="speech-report-lead">Fixing one pattern removes several mistakes at once.</p>
          <div className="speech-patterns">
            {patterns.map((pattern, index) => <article key={index} className="speech-pattern">
              <div className="speech-pattern-head"><strong>{pattern.name}</strong><span className="speech-count" aria-label={`${pattern.count} ${pattern.count === 1 ? 'time' : 'times'}`}>×{pattern.count}</span></div>
              {pattern.explanation && <p>{pattern.explanation}</p>}
              {pattern.examples.length > 0 && <ul>{pattern.examples.map((example, i) => <li key={i}><Pair from={example.original} to={example.corrected} /></li>)}</ul>}
              {pattern.tip && <p className="speech-pattern-tip"><Icon name="lightbulb" size={16} /> {pattern.tip}</p>}
            </article>)}
          </div>
        </section>}
        <section className="speech-report-section glass-card" aria-labelledby="speech-grammar-title">
          <span className="speech-eyebrow">ALL CORRECTIONS</span>
          <h3 id="speech-grammar-title">{corrections.length ? `${corrections.length} ${corrections.length === 1 ? 'correction' : 'corrections'}` : 'No clear grammar mistakes. Nice work!'}</h3>
          {categories.length > 2 && <div className="speech-format-row speech-filter" role="group" aria-label="Filter by mistake type">
            {categories.map(name => <button key={name} type="button" className={`speech-chip ${category === name ? 'selected' : ''}`} aria-pressed={category === name} onClick={() => { setCategory(name); setShowAll(false); }}>
              {name}{name !== 'All' && <span className="speech-chip-count">{corrections.filter(item => item.category === name).length}</span>}
            </button>)}
          </div>}
          {visible.length > 0 && <ol className="speech-corrections">
            {visible.map((item, index) => <li key={`${category}-${index}`}>
              <Pair from={item.original} to={item.corrected} />
              <p><span className="speech-tag">{item.category}</span>{item.explanation}</p>
            </li>)}
          </ol>}
          {filtered.length > CORRECTIONS_PREVIEW && <button type="button" className="speech-more" onClick={() => setShowAll(value => !value)} aria-expanded={showAll}>{showAll ? 'Show fewer' : `Show all ${filtered.length}`}</button>}
          {corrections.length > 0 && <button type="button" className="speech-more" onClick={() => { setView('original'); openTab('transcript'); }}>See them highlighted in your transcript →</button>}
        </section>
      </>}

      {tab === 'skills' && <>
        {criteria.length > 0 && <section className="speech-report-section glass-card" aria-labelledby="speech-criteria-title">
          <span className="speech-eyebrow">SPEAKING EVALUATION</span>
          <h3 id="speech-criteria-title">How you did on each skill</h3>
          <div className="speech-criteria">
            {criteria.map(item => <div key={item.name} id={`skill-${item.name.replace(/\W+/g, '-')}`} className={`speech-criterion level-${levelIndex[item.level] || 2} ${highlight === item.name ? 'is-highlighted' : ''}`}>
              <div className="speech-criterion-head"><strong>{item.name}</strong><Meter level={item.level} /><span className="speech-level">{item.level}</span></div>
              <p>{item.comment}</p>
            </div>)}
          </div>
          <small className="speech-report-note">Levels: Needs focus · Developing · Good · Strong. Based on your words only, not your voice or body language.</small>
        </section>}
        {(vocabulary.length > 0 || fillers.length > 0) && <div className={`speech-feedback-grid ${vocabulary.length && fillers.length ? '' : 'is-single'}`}>
          {vocabulary.length > 0 && <div className="glass-card">
            <span className="speech-eyebrow">VOCABULARY UPGRADES</span>
            <ul className="speech-vocab">{vocabulary.map((item, index) => <li key={index}>
              <Pair from={item.original} to={item.better} plain />
              {item.example && <small>“{item.example}”</small>}
            </li>)}</ul>
          </div>}
          {fillers.length > 0 && <div className="glass-card">
            <span className="speech-eyebrow">FILLER WORDS</span>
            <div className="speech-fillers">{fillers.map(item => <span key={item.word}>“{item.word}” <strong>×{item.count}</strong></span>)}</div>
            <small className="speech-report-note">Some (like “like” or “actually”) may be used correctly. Try a short silent pause instead of a filler.</small>
          </div>}
        </div>}
      </>}

      {tab === 'transcript' && <section className="speech-report-section glass-card" aria-label="Transcript">
        <div className="speech-transcript-toolbar">
          <div className="speech-segmented" role="group" aria-label="Transcript version">
            {views.map(([id, label]) => <button key={id} type="button" className={view === id ? 'is-active' : ''} aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}
          </div>
        </div>
        {view === 'compare'
          ? <div className="speech-transcripts">{transcriptPanel('original')}{transcriptPanel('polished')}</div>
          : <div className="speech-transcripts is-single">{transcriptPanel(view)}</div>}
      </section>}
    </div>
  </>;
}
