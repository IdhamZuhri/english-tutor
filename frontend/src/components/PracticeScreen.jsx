import { useEffect, useState } from 'react';
import { fetchPracticeInsights, savePracticeAttempt } from '../services/api.js';
import Icon from './Icon.jsx';
import './PracticeScreen.css';

const resourceQueries = {
  Grammar: 'English grammar practice past tense articles speaking',
  'Sentence structure': 'English sentence structure speaking practice word order',
  Vocabulary: 'English vocabulary collocations speaking practice',
};

export default function PracticeScreen({ onStartSpeaking }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [saveError, setSaveError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try { setData(await fetchPracticeInsights()); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const activeArea = data?.areas.find(area => area.category === activeCategory) || data?.areas.find(area => area.count > 0);
  const exercises = data?.exercises.filter(exercise => exercise.category === activeArea?.category) || [];
  const question = exercises[questionIndex % exercises.length];
  const options = question ? question.correctOption === 0
    ? [question.corrected, question.original]
    : [question.original, question.corrected] : [];
  const attempts = data?.attempts.filter(item => item.category === activeArea?.category) || [];
  const correctAttempts = attempts.filter(item => item.correct).length;

  const chooseAnswer = async index => {
    if (answer !== null || !question) return;
    const correct = index === question.correctOption;
    setAnswer(index);
    setSaveError('');
    try {
      await savePracticeAttempt({ sessionId: question.sessionId, category: question.category, correct });
      setData(current => ({ ...current, attempts: [...current.attempts, { category: question.category, correct }] }));
    } catch {
      setSaveError('Your answer could not be saved. Please check the connection.');
    }
  };

  return <div className="practice-screen animate-in">
    <header className="practice-header">
      <div className="practice-kicker"><Icon name="target" size={16} /> PERSONALIZED PRACTICE</div>
      <h1>Improve what matters most</h1>
      <p>Your practice plan grows from the sentences you actually spoke. Each correction becomes a chance to try again.</p>
    </header>

    {loading ? <div className="practice-state glass-card"><span className="spinner" />Analyzing saved conversations…</div>
      : error ? <div className="practice-state glass-card"><p>{error}</p><button className="btn btn-secondary" onClick={load}>Try again</button></div>
      : <>
        <div className="practice-overview">
          <div className="practice-stat glass-card"><strong>{data.sessionCount}</strong><span>conversations reviewed</span></div>
          <div className="practice-stat glass-card"><strong>{data.turnCount}</strong><span>spoken responses</span></div>
          <div className="practice-stat glass-card"><strong>{data.issueCount}</strong><span>learning opportunities</span></div>
        </div>

        {data.turnCount === 0 ? <div className="practice-state glass-card">
          <Icon name="mic" size={36} />
          <h2>Your practice plan starts with a conversation</h2>
          <p>Complete a speaking session first. Your saved sentences will shape the exercises here.</p>
          <button className="btn btn-primary" onClick={() => onStartSpeaking({ topic: 'Daily Life', focus: null })}>Start speaking</button>
        </div> : data.issueCount === 0 ? <div className="practice-state glass-card">
          <Icon name="check" size={36} />
          <h2>No clear corrections yet</h2>
          <p>Keep practicing. When your conversations reveal a recurring issue, focused exercises will appear here.</p>
          <button className="btn btn-primary" onClick={() => onStartSpeaking({ topic: 'Daily Life', focus: null })}>Keep speaking</button>
        </div> : <>
          <section className="practice-section">
            <div className="practice-section-heading"><div><span className="practice-eyebrow">YOUR PATTERNS</span><h2>Areas to work on</h2></div><span className="practice-evidence">{data.confidence === 'early' ? 'Early observations — more conversations will improve this plan' : 'Based on your saved conversations'}</span></div>
            <div className="practice-areas">
              {data.areas.filter(area => area.count > 0).map(area => <button key={area.category} className={`practice-area glass-card ${activeArea?.category === area.category ? 'selected' : ''}`} onClick={() => { setActiveCategory(area.category); setQuestionIndex(0); setAnswer(null); }}>
                <span className="practice-area-icon"><Icon name={area.category === 'Vocabulary' ? 'chat' : area.category === 'Grammar' ? 'edit' : 'chart'} size={22} /></span>
                <span><strong>{area.category}</strong><small>{area.count} {area.count === 1 ? 'correction' : 'corrections'} found</small></span>
                <span className="practice-area-arrow">→</span>
              </button>)}
            </div>
          </section>

          <section className="practice-section practice-workspace">
            <div className="practice-section-heading"><div><span className="practice-eyebrow">FOCUSED WORK</span><h2>{activeArea?.category}</h2></div><span className="practice-evidence">{attempts.length ? `${correctAttempts} of ${attempts.length} quiz answers correct` : 'Ready for your first exercise'}</span></div>
            <div className="practice-grid">
              <div className="practice-panel glass-card">
                <div className="practice-panel-top"><span className="practice-panel-label">QUICK QUIZ</span><span>{exercises.length ? `${(questionIndex % exercises.length) + 1} / ${exercises.length}` : ''}</span></div>
                <h3>Which phrasing is better?</h3>
                <p className="practice-context">From your conversation: “{question?.sentence}”</p>
                <div className="practice-options">{options.map((option, index) => <button key={`${index}-${option}`} className={`practice-option ${answer !== null ? index === question.correctOption ? 'correct' : index === answer ? 'incorrect' : '' : ''}`} onClick={() => chooseAnswer(index)} disabled={answer !== null}>{option}</button>)}</div>
                {answer !== null && <div className="practice-feedback" role="status"><strong>{answer === question.correctOption ? 'That’s right.' : 'Good try. Use this phrasing:'}</strong> {question.corrected}{question.explanation ? ` — ${question.explanation}` : ''}</div>}
                {saveError && <p className="practice-save-error" role="alert">{saveError}</p>}
                {answer !== null && <button className="btn btn-secondary practice-next" onClick={() => { setQuestionIndex(index => index + 1); setAnswer(null); }}>Next question</button>}
              </div>
              <div className="practice-panel practice-speaking glass-card">
                <span className="practice-panel-label">SPEAKING PRACTICE</span>
                <div className="practice-speaking-icon"><Icon name="mic" size={28} /></div>
                <h3>Put it into conversation</h3>
                <p>Talk with Alex about {question?.topic || 'daily life'} while practicing {activeArea?.category.toLowerCase()}. New responses are saved and added to your plan.</p>
                <button className="btn btn-primary" onClick={() => onStartSpeaking({ topic: question?.topic || 'Daily Life', focus: activeArea?.category })}>Start focused session</button>
              </div>
            </div>
          </section>

          <section className="practice-section practice-resource glass-card">
            <div><span className="practice-eyebrow">EXTRA PRACTICE</span><h2>Watch a lesson on {activeArea?.category.toLowerCase()}</h2><p>Find a lesson, then return to the speaking exercise to use what you learned.</p></div>
            <a className="btn btn-secondary" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(resourceQueries[activeArea?.category])}`} target="_blank" rel="noopener noreferrer">Find lessons on YouTube ↗</a>
          </section>
          <p className="practice-note">Insights use text transcripts and saved corrections. Audio pronunciation and fluency are not measured here.</p>
        </>}
      </>}
  </div>;
}
