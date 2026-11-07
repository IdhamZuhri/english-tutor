import { useMemo, useState } from 'react';
import { LESSON_CATEGORIES, LESSONS } from '../lessons.js';
import Icon from './Icon.jsx';
import './LessonsScreen.css';

const completedKey = 'speakwell-completed-lessons';
const readCompleted = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(completedKey) || '[]');
    return Array.isArray(stored) ? stored.filter(id => LESSONS.some(lesson => lesson.id === id)) : [];
  } catch { return []; }
};

export default function LessonsScreen() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedId, setSelectedId] = useState('nouns');
  const [completed, setCompleted] = useState(readCompleted);

  const visible = useMemo(() => LESSONS.filter(lesson =>
    (category === 'All' || lesson.category === category) &&
    `${lesson.title} ${lesson.summary} ${lesson.pattern} ${lesson.uses.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())
  ), [category, query]);
  const selected = visible.find(lesson => lesson.id === selectedId) || visible[0];
  const selectedPosition = visible.findIndex(lesson => lesson.id === selected?.id);

  const toggleCompleted = id => {
    setCompleted(current => {
      const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id];
      try { localStorage.setItem(completedKey, JSON.stringify(next)); } catch { /* Storage may be unavailable. */ }
      return next;
    });
  };

  return <div className="lessons-screen animate-in">
    <header className="lessons-header">
      <span className="lessons-eyebrow"><Icon name="book" size={16} /> ENGLISH NOTES</span>
      <h1>Learn a rule. Use it when you speak.</h1>
      <p>Browse practical grammar notes from the building blocks to complex sentences. Each lesson includes the form, when to use it, examples, a common mistake and a speaking task.</p>
      <div className="lessons-progress" aria-label={`${completed.length} of ${LESSONS.length} lessons studied`}>
        <span>{completed.length} of {LESSONS.length} studied</span>
        <div className="lessons-progress-track"><div style={{ width: `${completed.length / LESSONS.length * 100}%` }} /></div>
      </div>
    </header>

    <div className="lessons-controls">
      <label className="lessons-search">
        <Icon name="search" size={19} />
        <span className="sr-only">Search English lessons</span>
        <input type="search" placeholder="Search a topic or rule" value={query} onChange={event => setQuery(event.target.value)} />
      </label>
      <div className="lessons-filters" role="group" aria-label="Filter lessons by category">
        {['All', ...LESSON_CATEGORIES].map(item => <button type="button" key={item} className={`lessons-filter ${category === item ? 'active' : ''}`} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
    </div>

    {selected ? <div className="lessons-layout">
      <aside className="lessons-index glass-card" aria-label="Lesson list">
        <div className="lessons-index-header"><strong>{visible.length} {visible.length === 1 ? 'lesson' : 'lessons'}</strong><span>Choose a topic</span></div>
        <div className="lessons-index-list">
          {visible.map(lesson => <button type="button" key={lesson.id} className={`lessons-index-item ${selected.id === lesson.id ? 'active' : ''}`} onClick={() => setSelectedId(lesson.id)} aria-current={selected.id === lesson.id ? 'true' : undefined}>
            <span className="lessons-index-copy"><small>{lesson.category} · {lesson.level}</small><strong>{lesson.title}</strong></span>
            {completed.includes(lesson.id) && <Icon name="check" size={17} className="lessons-index-check" />}
          </button>)}
        </div>
      </aside>

      <article className="lesson-detail glass-card" key={selected.id}>
        <div className="lesson-meta"><span>{selected.category}</span><span>{selected.level}</span></div>
        <h2>{selected.title}</h2>
        <p className="lesson-summary">{selected.summary}</p>

        <section className="lesson-block"><h3>Form</h3><div className="lesson-pattern">{selected.pattern}</div></section>
        <section className="lesson-block"><h3>When to use it</h3><ul>{selected.uses.map(use => <li key={use}>{use}</li>)}</ul></section>
        <section className="lesson-block"><h3>Examples</h3><div className="lesson-examples">{selected.examples.map(example => <p key={example}>“{example}”</p>)}</div></section>
        <section className="lesson-block"><h3>Common mistake</h3><div className="lesson-correction"><p className="lesson-wrong"><span>Instead of</span>{selected.mistake[0]}</p><p className="lesson-right"><span>Say</span>{selected.mistake[1]}</p><p>{selected.mistake[2]}</p></div></section>
        <section className="lesson-speaking"><span><Icon name="mic" size={18} /> SPEAKING PRACTICE</span><p>{selected.practice}</p></section>

        <div className="lesson-actions"><button type="button" className={`btn ${completed.includes(selected.id) ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggleCompleted(selected.id)}><Icon name="check" size={17} />{completed.includes(selected.id) ? 'Studied — mark unread' : 'Mark as studied'}</button><div className="lesson-paging"><button type="button" className="btn btn-ghost btn-sm" disabled={selectedPosition <= 0} onClick={() => setSelectedId(visible[selectedPosition - 1].id)}>Previous</button><button type="button" className="btn btn-secondary btn-sm" disabled={selectedPosition >= visible.length - 1} onClick={() => setSelectedId(visible[selectedPosition + 1].id)}>Next lesson</button></div></div>
      </article>
    </div> : <div className="lessons-empty glass-card"><h2>No lessons found</h2><p>Try another topic or clear the filters.</p><button className="btn btn-secondary" onClick={() => { setQuery(''); setCategory('All'); }}>Show all lessons</button></div>}

    <footer className="lessons-sources">For deeper explanations and exercises, explore the <a href="https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference" target="_blank" rel="noopener noreferrer">British Council grammar reference</a> and <a href="https://dictionary.cambridge.org/grammar/british-grammar/" target="_blank" rel="noopener noreferrer">Cambridge English Grammar Today</a>. These notes are a practical guide to common patterns; usage can vary by context and dialect.</footer>
  </div>;
}
