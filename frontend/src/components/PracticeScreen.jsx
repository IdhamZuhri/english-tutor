import { useEffect, useState } from 'react';
import { fetchJournalEntries, fetchPracticeInsights, fetchSpeech, fetchSpeeches, savePracticeAttempt } from '../services/api.js';
import Icon from './Icon.jsx';
import './PracticeScreen.css';

const resourceQueries = {
  Grammar: 'English grammar practice past tense articles speaking',
  'Sentence structure': 'English sentence structure speaking practice word order',
  Vocabulary: 'English vocabulary collocations speaking practice',
};
const latest = items => [...items].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
const dateLabel = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Recently';

export default function PracticeScreen({ onStartSpeaking, onNavigate, onViewSpeech }) {
  const [insights, setInsights] = useState(null);
  const [speeches, setSpeeches] = useState(null);
  const [journals, setJournals] = useState(null);
  const [speechDetail, setSpeechDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [saveError, setSaveError] = useState('');

  const load = async () => {
    setLoading(true);
    const results = await Promise.allSettled([fetchPracticeInsights(), fetchSpeeches(), fetchJournalEntries()]);
    setInsights(results[0].status === 'fulfilled' ? results[0].value : null);
    const speechList = results[1].status === 'fulfilled' && Array.isArray(results[1].value) ? results[1].value : null;
    setSpeeches(speechList);
    setJournals(results[2].status === 'fulfilled' && Array.isArray(results[2].value) ? results[2].value : null);
    setSpeechDetail(null);
    if (speechList?.length) {
      try { setSpeechDetail(await fetchSpeech(latest(speechList).id)); }
      catch { /* The activity list remains usable. */ }
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const areas = insights?.areas?.filter(area => area.count > 0 && insights.exercises?.some(item => item.category === area.category)) || [];
  const activeArea = areas.find(area => area.category === activeCategory) || areas[0];
  const exercises = insights?.exercises?.filter(item => item.category === activeArea?.category) || [];
  const question = exercises.length ? exercises[questionIndex % exercises.length] : null;
  const options = question ? question.correctOption === 0 ? [question.corrected, question.original] : [question.original, question.corrected] : [];
  const attempts = insights?.attempts?.filter(item => item.category === activeArea?.category) || [];
  const newestJournal = journals?.length ? latest(journals) : null;
  const newestSpeech = speeches?.length ? latest(speeches) : null;

  const chooseAnswer = async index => {
    if (answer !== null || !question) return;
    const correct = index === question.correctOption;
    setAnswer(index);
    setSaveError('');
    try {
      await savePracticeAttempt({ sessionId: question.sessionId, category: question.category, correct });
      setInsights(current => ({ ...current, attempts: [...current.attempts, { category: question.category, correct }] }));
    } catch { setSaveError('Your answer could not be saved. Please check the connection.'); }
  };

  return <div className="practice-screen animate-in">
    <header className="practice-header">
      <span className="practice-kicker"><Icon name="target" size={16} /> YOUR GROWTH SPACE</span>
      <h1>Keep your momentum going.</h1>
      <p>Pick a small next step for conversation, public speaking, or journaling. Your conversation corrections become quick exercises below.</p>
    </header>
    {loading ? <div className="practice-state glass-card"><span className="spinner" /><p>Putting your practice together…</p></div> : <>
      {(!insights || !speeches || !journals) && <div className="practice-notice" role="status">Some practice activity could not be loaded. You can still use the available paths. <button type="button" onClick={load}>Try again</button></div>}
      <section className="practice-section practice-path-section" aria-labelledby="practice-path-heading">
        <div className="practice-section-heading"><div><span className="practice-eyebrow">CHOOSE YOUR NEXT STEP</span><h2 id="practice-path-heading">Three ways to grow</h2></div><span className="practice-evidence">Start anywhere. Each path works on a different skill.</span></div>
        <div className="practice-paths">
          <article className="practice-path practice-path--conversation glass-card">
            <span className="practice-path-icon"><Icon name="chat" size={23} /></span><span className="practice-path-type">EVERYDAY FLUENCY</span><h3>Conversation</h3>
            <p>{insights ? areas.length ? `You have ${insights.issueCount} saved ${insights.issueCount === 1 ? 'correction' : 'corrections'} to revisit. Try one in a fresh conversation.` : insights.turnCount ? 'You have spoken already. Keep the conversation going to find new things to work on.' : 'Start with a topic from daily life and let your first conversation shape your practice.' : 'Talk through a familiar topic and build fluency one response at a time.'}</p>
            <span className="practice-path-meta">{insights ? `${insights.sessionCount} ${insights.sessionCount === 1 ? 'conversation' : 'conversations'} reviewed` : 'Activity unavailable'}</span>
            <button type="button" className="practice-path-action" onClick={() => areas.length ? document.getElementById('practice-drills')?.scrollIntoView({ behavior: 'smooth' }) : onNavigate('conversation')}>{areas.length ? 'Review my corrections' : 'Start a conversation'} <span aria-hidden="true">→</span></button>
          </article>
          <article className="practice-path practice-path--speech glass-card">
            <span className="practice-path-icon"><Icon name="podium" size={23} /></span><span className="practice-path-type">SPEAK WITH PURPOSE</span><h3>Public speaking</h3>
            <p>{speechDetail?.feedback?.nextStep ? `Your next rehearsal: ${speechDetail.feedback.nextStep}` : newestSpeech ? 'Revisit your last rehearsal and use its feedback for another take.' : 'Give a short talk with a clear opening, one main point, and a closing thought.'}</p>
            <span className="practice-path-meta">{speeches ? `${speeches.length} ${speeches.length === 1 ? 'rehearsal' : 'rehearsals'} saved${newestSpeech ? ` · Last on ${dateLabel(newestSpeech.created_at)}` : ''}` : 'Activity unavailable'}</span>
            <button type="button" className="practice-path-action" onClick={() => newestSpeech ? onViewSpeech(newestSpeech.id) : onNavigate('public-speaking')}>{newestSpeech ? 'Open last rehearsal' : 'Enter the studio'} <span aria-hidden="true">→</span></button>
            {newestSpeech && <button type="button" className="practice-path-secondary" onClick={() => onNavigate('public-speaking')}>Start a new rehearsal</button>}
          </article>
          <article className="practice-path practice-path--journal glass-card">
            <span className="practice-path-icon"><Icon name="journal" size={23} /></span><span className="practice-path-type">REFLECT & EXPRESS</span><h3>Daily journal</h3>
            <p>{newestJournal ? `Your last entry was “${newestJournal.title}”. Take a moment to write or speak about what has changed since then.` : 'Write or speak a short reflection. Choose a mood, then use a prompt or follow your own thoughts.'}</p>
            <span className="practice-path-meta">{journals ? `${journals.length} ${journals.length === 1 ? 'entry' : 'entries'} saved${newestJournal ? ` · Last on ${dateLabel(newestJournal.created_at)}` : ''}` : 'Activity unavailable'}</span>
            <button type="button" className="practice-path-action" onClick={() => onNavigate('journal')}>Open my journal <span aria-hidden="true">→</span></button>
          </article>
        </div>
      </section>
      <section id="practice-drills" className="practice-section practice-drills" aria-labelledby="practice-drills-heading">
        <div className="practice-section-heading"><div><span className="practice-eyebrow">FROM YOUR CONVERSATIONS</span><h2 id="practice-drills-heading">Practice your corrections</h2></div>{insights && <span className="practice-evidence">{insights.turnCount} spoken {insights.turnCount === 1 ? 'response' : 'responses'} reviewed</span>}</div>
        {!insights ? <div className="practice-inline-state glass-card"><p>Conversation insights are unavailable right now.</p><button type="button" className="btn btn-secondary" onClick={load}>Try again</button></div>
          : !areas.length ? <div className="practice-inline-state glass-card"><span className="practice-inline-icon"><Icon name={insights.turnCount ? 'check' : 'mic'} size={23} /></span><div><h3>{insights.turnCount ? 'No corrections to review yet' : 'Your first conversation starts the plan'}</h3><p>{insights.turnCount ? 'Keep speaking. When a sentence can be improved, a quick exercise will appear here.' : 'Complete a conversation and your saved responses will help build focused exercises.'}</p></div><button type="button" className="btn btn-primary" onClick={() => onNavigate('conversation')}>{insights.turnCount ? 'Keep speaking' : 'Start a conversation'}</button></div>
          : <>
            <div className="practice-areas" role="group" aria-label="Correction category">{areas.map(area => <button type="button" key={area.category} className={`practice-area glass-card ${activeArea?.category === area.category ? 'selected' : ''}`} aria-pressed={activeArea?.category === area.category} onClick={() => { setActiveCategory(area.category); setQuestionIndex(0); setAnswer(null); }}><span className="practice-area-icon"><Icon name={area.category === 'Vocabulary' ? 'chat' : area.category === 'Grammar' ? 'edit' : 'chart'} size={22} /></span><span><strong>{area.category}</strong><small>{area.count} {area.count === 1 ? 'correction' : 'corrections'} found</small></span><span className="practice-area-arrow" aria-hidden="true">→</span></button>)}</div>
            <div className="practice-section-heading practice-work-heading"><div><span className="practice-eyebrow">FOCUSED WORK</span><h2>{activeArea?.category}</h2></div><span className="practice-evidence">{attempts.length ? `${attempts.filter(item => item.correct).length} of ${attempts.length} quiz answers correct` : 'Ready for your first exercise'}</span></div>
            <div className="practice-grid">
              <div className="practice-panel glass-card"><div className="practice-panel-top"><span className="practice-panel-label">QUICK QUIZ</span><span>{exercises.length ? `${(questionIndex % exercises.length) + 1} / ${exercises.length}` : ''}</span></div><h3>Which phrasing is better?</h3><p className="practice-context">From your conversation: “{question?.sentence}”</p><div className="practice-options">{options.map((option, index) => <button type="button" key={`${index}-${option}`} className={`practice-option ${answer !== null ? index === question.correctOption ? 'correct' : index === answer ? 'incorrect' : '' : ''}`} onClick={() => chooseAnswer(index)} disabled={answer !== null}>{option}</button>)}</div>{answer !== null && <div className="practice-feedback" role="status"><strong>{answer === question.correctOption ? 'That’s right.' : 'Good try. Use this phrasing:'}</strong> {question.corrected}{question.explanation ? ` — ${question.explanation}` : ''}</div>}{saveError && <p className="practice-save-error" role="alert">{saveError}</p>}{answer !== null && <button type="button" className="btn btn-secondary practice-next" onClick={() => { setQuestionIndex(index => index + 1); setAnswer(null); }}>Next question</button>}</div>
              <div className="practice-panel practice-speaking glass-card"><span className="practice-panel-label">PUT IT INTO PRACTICE</span><div className="practice-speaking-icon"><Icon name="mic" size={28} /></div><h3>Try it in conversation</h3><p>Talk with Alex about {question?.topic || 'daily life'} while practicing {activeArea?.category.toLowerCase()}. Your new responses will add to this plan.</p><button type="button" className="btn btn-primary" onClick={() => onStartSpeaking({ topic: question?.topic || 'Daily Life', focus: activeArea?.category })}>Start focused session</button></div>
            </div>
            <div className="practice-resource glass-card"><div><span className="practice-eyebrow">EXTRA PRACTICE</span><h2>Watch a lesson on {activeArea?.category.toLowerCase()}</h2><p>Find a lesson, then use what you learned in a speaking session.</p></div><a className="btn btn-secondary" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(resourceQueries[activeArea?.category] || activeArea?.category)}`} target="_blank" rel="noopener noreferrer">Find lessons on YouTube ↗</a></div>
            <p className="practice-note">Conversation insights use text transcripts and saved corrections. Audio pronunciation and fluency are not measured here.</p>
          </>}
      </section>
      <section className="practice-section" aria-labelledby="practice-tools-heading">
        <div className="practice-section-heading"><div><span className="practice-eyebrow">WHEN YOU NEED A LITTLE SUPPORT</span><h2 id="practice-tools-heading">Explore and look back</h2></div></div>
        <div className="practice-tools">
          <button type="button" className="practice-tool glass-card" onClick={() => onNavigate('lessons')}><Icon name="book" size={22} /><span><strong>English Notes</strong><small>Refresh a useful concept</small></span><span aria-hidden="true">→</span></button>
          <button type="button" className="practice-tool glass-card" onClick={() => onNavigate('channels')}><Icon name="play" size={22} /><span><strong>Channels</strong><small>Find something worth watching</small></span><span aria-hidden="true">→</span></button>
          <button type="button" className="practice-tool glass-card" onClick={() => onNavigate('history')}><Icon name="history" size={22} /><span><strong>Your History</strong><small>Return to any saved activity</small></span><span aria-hidden="true">→</span></button>
        </div>
      </section>
    </>}
  </div>;
}
