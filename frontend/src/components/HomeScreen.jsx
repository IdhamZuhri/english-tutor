import { useEffect, useState } from 'react';
import { fetchJournalEntries, fetchPastSessions, fetchSpeeches } from '../services/api.js';
import Icon from './Icon.jsx';
import { defaultWeeklyGoal, weeklyGoals, weeklySpeakingProgress } from '../weeklyQuest.js';
import './HomeScreen.css';

const explore = [
  { id: 'practice', title: 'My Practice', description: 'Choose your next step across conversation, public speaking, and journaling.', icon: 'target', action: 'Keep growing' },
  { id: 'channels', title: 'Channels', description: 'Find videos and listening ideas for a fresh spark.', icon: 'play', action: 'Explore channels' },
  { id: 'lessons', title: 'English Notes', description: 'Refresh a useful English concept before you speak.', icon: 'book', action: 'Browse notes' },
  { id: 'history', title: 'History', description: 'Find every conversation, rehearsal, and journal entry in one place.', icon: 'history', action: 'View history' },
];

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

  const recent = [
    ...sessions.map(item => ({ id: item.id, title: item.topic, type: 'Conversation', date: item.created_at, icon: 'chat', onClick: () => onViewHistory(item.id) })),
    ...speeches.map(item => ({ id: item.id, title: item.title, type: 'Public speaking', date: item.created_at, icon: 'podium', onClick: () => onViewSpeech(item.id) })),
    ...journalEntries.map(item => ({ id: item.id, title: item.title, type: 'Daily journal', date: item.created_at, icon: 'journal', onClick: () => onViewJournal(item.id) })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);

  return <div className="home-screen animate-in">
    <header className="home-intro">
      <span className="home-eyebrow"><Icon name="spark" size={17} /> YOUR SPEAKING SPACE</span>
      <h1>What would you like to practice today?</h1>
      <p>Build confidence through conversation, prepare for the stage, reflect on your day, or take one small step with a lesson.</p>
    </header>

    <section className="home-quest glass-card" aria-labelledby="home-quest-heading">
      <div className="home-quest-top"><span className="home-eyebrow"><Icon name="award" size={17} /> WEEKLY SPEAKING QUEST</span><span className="home-quest-period">Resets every Monday</span></div>
      <div className="home-quest-main"><div><h2 id="home-quest-heading">{speakingLoaded && progress.complete ? 'You reached your speaking goal!' : 'Make room for your voice this week'}</h2><p>{speakingLoaded ? progress.complete ? 'You showed up for yourself. Keep speaking whenever you like.' : `${progress.remaining} ${progress.remaining === 1 ? 'practice' : 'practices'} to go. Each conversation or reviewed speech moves you forward.` : loaded ? 'Could not load speaking progress. Try refreshing the page.' : 'Loading your speaking progress…'}</p></div><strong className="home-quest-count" aria-label={speakingLoaded ? `${progress.count} of ${weeklyGoal} speaking practices this week` : undefined}>{speakingLoaded ? `${progress.count}/${weeklyGoal}` : '—'}</strong></div>
      {speakingLoaded && <div className="home-quest-track" role="progressbar" aria-label="Weekly speaking goal" aria-valuenow={Math.min(progress.count, weeklyGoal)} aria-valuemin="0" aria-valuemax={weeklyGoal}><span style={{ width: `${Math.min(100, progress.count / weeklyGoal * 100)}%` }} /></div>}
      <div className="home-quest-footer"><div className="home-quest-goals"><span>Weekly goal</span>{weeklyGoals.map(goal => <button key={goal} type="button" className={weeklyGoal === goal ? 'selected' : ''} onClick={() => changeWeeklyGoal(goal)} aria-pressed={weeklyGoal === goal}>{goal}</button>)}</div><div className="home-quest-actions"><button type="button" onClick={() => onNavigate('conversation')}>Start a conversation</button><button type="button" onClick={() => onNavigate('public-speaking', 'impromptu')}>Try a surprise topic <span aria-hidden="true">→</span></button></div></div>
    </section>

    <section className="home-feature-section" aria-labelledby="home-start-heading">
      <div className="home-section-heading"><span>START HERE</span><h2 id="home-start-heading">Choose your way to speak</h2></div>
      <div className="home-feature-grid">
        <button type="button" className="home-feature home-feature--conversation glass-card" onClick={() => onNavigate('conversation')}>
          <span className="home-feature-top"><span className="home-feature-icon"><Icon name="chat" size={27} /></span><span className="home-feature-tag">Everyday fluency</span></span>
          <span className="home-feature-copy"><strong>Have a conversation</strong><span>Choose a topic, meet your AI speaking partner, and let the words flow.</span></span>
          <span className="home-feature-action">Start a conversation <span aria-hidden="true">→</span></span>
        </button>
        <button type="button" className="home-feature home-feature--speech glass-card" onClick={() => onNavigate('public-speaking')}>
          <span className="home-feature-top"><span className="home-feature-icon"><Icon name="podium" size={27} /></span><span className="home-feature-tag">Speak with purpose</span></span>
          <span className="home-feature-copy"><strong>Practice public speaking</strong><span>Shape a message, rehearse out loud, and get a clear next step.</span></span>
          <span className="home-feature-action">Enter the studio <span aria-hidden="true">→</span></span>
        </button>
        <button type="button" className="home-feature home-feature--journal glass-card" onClick={() => onNavigate('journal')}>
          <span className="home-feature-top"><span className="home-feature-icon"><Icon name="journal" size={27} /></span><span className="home-feature-tag">A moment for you</span></span>
          <span className="home-feature-copy"><strong>Keep a daily journal</strong><span>Write or speak about your day, then return to your reflections.</span></span>
          <span className="home-feature-action">Open your journal <span aria-hidden="true">→</span></span>
        </button>
      </div>
    </section>

    <section className="home-explore" aria-labelledby="home-explore-heading">
      <div className="home-section-heading"><span>KEEP GROWING</span><h2 id="home-explore-heading">More ways to learn</h2></div>
      <div className="home-explore-grid">{explore.map(item => <button type="button" key={item.id} className="home-explore-card glass-card" onClick={() => onNavigate(item.id)}><span className="home-explore-icon"><Icon name={item.icon} size={21} /></span><strong>{item.title}</strong><span>{item.description}</span><small>{item.action} <span aria-hidden="true">→</span></small></button>)}</div>
    </section>

    {loaded && <section className="home-progress" aria-labelledby="home-progress-heading">
      <div className="home-section-heading"><span>YOUR JOURNEY</span><h2 id="home-progress-heading">Every attempt counts</h2></div>
      <div className="home-progress-panel glass-card">
        <div className="home-stats"><div><strong>{sessions.length}</strong><span>{sessions.length === 1 ? 'conversation' : 'conversations'}</span></div><div><strong>{speeches.length}</strong><span>{speeches.length === 1 ? 'rehearsal' : 'rehearsals'}</span></div><div><strong>{journalEntries.length}</strong><span>{journalEntries.length === 1 ? 'journal entry' : 'journal entries'}</span></div></div>
        <div className="home-recent"><h3>Pick up where you left off</h3>{recent.length ? <div className="home-recent-list">{recent.map(item => <button type="button" key={`${item.type}-${item.id}`} onClick={item.onClick}><span className="home-recent-icon"><Icon name={item.icon} size={18} /></span><span><strong>{item.title}</strong><small>{item.type} · {new Date(item.date).toLocaleDateString()}</small></span><span aria-hidden="true">→</span></button>)}</div> : <p>Your first conversation, rehearsal, or journal entry will appear here. Start with whatever feels right today.</p>}</div>
      </div>
    </section>}
  </div>;
}
