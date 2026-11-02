import { useState } from 'react';
import Icon from './Icon.jsx';
import './IdeaBoardScreen.css';

const STORAGE_KEY = 'speakwell-simple-ideas';
const starterItems = [
  { id: 'better-feedback', type: 'improvement', text: 'Make speaking feedback more specific and easier to act on.' },
  { id: 'more-topics', type: 'improvement', text: 'Add more conversation topics for everyday situations.' },
  { id: 'progress-view', type: 'idea', text: 'Show a simple progress view for the learner.' },
  { id: 'quick-practice', type: 'idea', text: 'Add a quick five-minute practice option.' },
];

function loadItems() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : starterItems;
  } catch {
    return starterItems;
  }
}

export default function IdeaBoardScreen() {
  const [items, setItems] = useState(loadItems);
  const [text, setText] = useState('');
  const [type, setType] = useState('improvement');

  const saveItems = nextItems => {
    setItems(nextItems);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems)); } catch { /* Storage may be unavailable. */ }
  };

  const addItem = event => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    saveItems([{ id: `idea-${Date.now()}`, type, text: value }, ...items]);
    setText('');
  };

  const removeItem = id => saveItems(items.filter(item => item.id !== id));
  const improvements = items.filter(item => item.type === 'improvement');
  const ideas = items.filter(item => item.type === 'idea');

  const renderList = list => list.length === 0
    ? <p className="idea-list-empty">Nothing added yet.</p>
    : <ul>{list.map(item => <li key={item.id}><span>{item.text}</span><button type="button" onClick={() => removeItem(item.id)} aria-label={`Remove ${item.text}`}><Icon name="close" size={16} /></button></li>)}</ul>;

  return <div className="idea-board-screen animate-in">
    <header className="idea-board-header">
      <span className="idea-board-eyebrow"><Icon name="lightbulb" size={17} /> DEVELOPER NOTES</span>
      <h1>Ideas & improvements</h1>
      <p>A simple place to keep track of what could make SpeakWell better.</p>
    </header>

    <form className="idea-add-form glass-card" onSubmit={addItem}>
      <input type="text" value={text} onChange={event => setText(event.target.value)} placeholder="Write an improvement or new idea..." aria-label="Idea or improvement" />
      <select value={type} onChange={event => setType(event.target.value)} aria-label="Note type">
        <option value="improvement">Fix / improvement</option>
        <option value="idea">New idea</option>
      </select>
      <button type="submit" className="btn btn-primary"><Icon name="plus" size={17} /> Add</button>
    </form>

    <section className="idea-simple-grid" aria-label="Ideas and improvements">
      <article className="idea-simple-card glass-card">
        <div className="idea-simple-heading"><span className="idea-simple-icon idea-simple-icon--improvement"><Icon name="check" size={18} /></span><div><h2>Fixes & improvements</h2><p>Things that can make the current app better.</p></div></div>
        {renderList(improvements)}
      </article>
      <article className="idea-simple-card glass-card">
        <div className="idea-simple-heading"><span className="idea-simple-icon idea-simple-icon--idea"><Icon name="lightbulb" size={18} /></span><div><h2>New ideas</h2><p>Features and possibilities to explore.</p></div></div>
        {renderList(ideas)}
      </article>
    </section>
  </div>;
}
