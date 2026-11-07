import { useEffect, useState } from 'react';
import { fetchJournalEntries, fetchPastSessions, fetchSpeeches } from '../services/api.js';
import Icon from './Icon.jsx';
import { defaultWeeklyGoal, weeklyGoals, weeklySpeakingProgress } from '../weeklyQuest.js';
import { recommendNext } from '../homeRecommendation.js';
import './HomeScreen.css';

// Quick starts shown beside the quest; the one matching the recommendation is left out.
const QUICK_STARTS = [
  { id: 'conversation', target: 'conversation', icon: 'chat', tone: 'conversation', title: 'Conversation', detail: 'Talk through a topic with Alex.' },
  { id: 'surprise-topic', target: 'public-speaking', mode: 'impromptu', icon: 'podium', tone: 'speech', title: 'Surprise topic', detail: 'Spin the wheel and speak for 1–5 minutes.' },
  { id: 'journal', target: 'journal', icon: 'journal', tone: 'journal', title: 'Journal', detail: 'Write or speak a short reflection.' },
];
const RECENT_ICON = { Conversation: 'chat', 'Public speaking': 'podium', Journal: 'journal' };

export default function HomeScreen({ onNavigate, onViewHistory, onViewSpeech, onViewJournal }) {
  const [sessions, setSessions] = useState([]);
  const [speeches, setSpeeches] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [speakingLoaded, setSpeakingLoaded] = useState(false);
  const [weeklyGoal, setWeeklyGoal] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('speakwell-weekly-goal'));
      return weeklyGoals.includes(saved) ? saved : defaultWeeklyGoal;
    } catch { return defaultWeeklyGoal; }
  });

  useEffect(() => {
    let active = true;
    Promise.allSettled([fetchPastSessions(), fetchSpeeches(), fetchJournalEntries()]).then(([conversationResult, speechResult, journalResult]) => {
      if (!active) return;
      if (conversationResult.status === 'fulfilled' && Array.isArray(conversationResult.value)) setSessions(conversationResult.value);
      if (speechResult.status === 'fulfilled' && Array.isArray(speechResult.value)) setSpeeches(speechResult.value);
      if (journalResult.status === 'fulfilled' && Array.isArray(journalResult.value)) setJournalEntries(journalResult.value);
      setSpeakingLoaded(conversationResult.status === 'fulfilled' && speechResult.status === 'fulfilled');
      setLoaded(true);
    });
    return () => { active = false; };
  }, []);

  const progress = weeklySpeakingProgress(sessions, speeches, weeklyGoal);
  const changeWeeklyGoal = goal => {
    setWeeklyGoal(goal);
    try { localStorage.setItem('speakwell-weekly-goal', String(goal)); } catch { /* Storage may be unavailable. */ }
  };

  const next = recommendNext({ sessions, speeches, journalEntries, progress: speakingLoaded ? progress : null });
  const quickStarts = QUICK_STARTS.filter(item => item.id !== next.id && !(next.id === 'first-conversation' && item.id === 'conversation') && !(next.id === 'bonus-conversation' && item.id === 'conversation')).slice(0, 2);
  const go = item => onNavigate(item.target, item.mode);

  const recent = [
    ...sessions.map(item => ({ id: item.id, title: item.topic, type: 'Conversation', date: item.created_at, onClick: () => onViewHistory(item.id) })),
    ...speeches.map(item => ({ id: item.id, title: item.title, type: 'Public speaking', date: item.created_at, onClick: () => onViewSpeech(item.id) })),
    ...journalEntries.map(item => ({ id: item.id, title: item.title, type: 'Journal', date: item.created_at, onClick: () => onViewJournal(item.id) })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return <div className="home-screen animate-in">
    <header className="home-intro">
      <span className="home-eyebrow">Today · {today}</span>
      <h1>Ready for today’s practice?</h1>
    </header>

    <section className={`home-next ${loaded ? '' : 'is-loading'}`} aria-labelledby="home-next-heading" aria-busy={!loaded}>
      <div className="home-next-copy">
        <span className="home-next-label">Recommended next step</span>
        <h2 id="home-next-heading">{loaded ? next.title : 'Finding your next step…'}</h2>
        <p>{loaded ? next.detail : 'Checking this week’s practice.'}</p>
      </div>
      <button type="button" className="home-next-cta" onClick={() => go(next)} disabled={!loaded}>
        <Icon name={next.target === 'journal' ? 'journal' : 'mic'} size={18} /> {next.action}
      </button>
    </section>

    <div className="home-bento">
      <section className="home-tile home-quest" aria-labelledby="home-quest-heading">
        <div className="home-tile-top"><h2 id="home-quest-heading">Weekly speaking quest</h2><span className="home-quest-period">Resets Monday</span></div>
        <div className="home-quest-count">
          <strong aria-hidden="true">{speakingLoaded ? progress.count : '–'}<span>/{weeklyGoal}</span></strong>
          <p>{speakingLoaded ? progress.complete ? 'Goal reached. Nice work showing up for yourself.' : `${progress.remaining} to go. Conversations and reviewed speeches count.` : loaded ? 'Progress could not load. Try refreshing the page.' : 'Loading…'}</p>
        </div>
        {speakingLoaded && <div className="home-quest-track" role="progressbar" aria-label="Weekly speaking goal" aria-valuenow={Math.min(progress.count, weeklyGoal)} aria-valuemin="0" aria-valuemax={weeklyGoal} aria-valuetext={`${progress.count} of ${weeklyGoal} practices`}><span style={{ width: `${Math.min(100, progress.count / weeklyGoal * 100)}%` }} /></div>}
        <div className="home-quest-goals" role="group" aria-label="Weekly goal"><span>Goal</span>{weeklyGoals.map(goal => <button key={goal} type="button" className={weeklyGoal === goal ? 'selected' : ''} onClick={() => changeWeeklyGoal(goal)} aria-pressed={weeklyGoal === goal} aria-label={`${goal} ${goal === 1 ? 'practice' : 'practices'} per week`}>{goal}</button>)}</div>
      </section>

      {quickStarts.map(item => <button type="button" key={item.id} className={`home-tile home-quick home-quick--${item.tone}`} onClick={() => go(item)}>
        <span className="home-quick-icon"><Icon name={item.icon} size={20} /></span>
        <span className="home-quick-copy"><strong>{item.title}</strong><span>{item.detail}</span></span>
        <span className="home-quick-arrow" aria-hidden="true">→</span>
      </button>)}

      <section className="home-tile home-recent" aria-labelledby="home-recent-heading">
        <div className="home-tile-top"><h2 id="home-recent-heading">Pick up where you left off</h2>{recent.length > 0 && <button type="button" className="home-link" onClick={() => onNavigate('history')}>All history</button>}</div>
        {!loaded ? <p className="home-muted">Loading your activity…</p>
          : recent.length ? <ul className="home-recent-list">{recent.map(item => <li key={`${item.type}-${item.id}`}><button type="button" onClick={item.onClick}>
            <span className={`home-recent-icon home-recent-icon--${RECENT_ICON[item.type]}`}><Icon name={RECENT_ICON[item.type]} size={17} /></span>
            <span className="home-recent-copy"><strong>{item.title}</strong><small>{item.type} · {new Date(item.date).toLocaleDateString()}</small></span>
            <span aria-hidden="true">→</span>
          </button></li>)}</ul>
          : <p className="home-muted">Your conversations, rehearsals and journal entries will appear here.</p>}
      </section>
    </div>
  </div>;
}
