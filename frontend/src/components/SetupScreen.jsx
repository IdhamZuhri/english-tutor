import { useState } from 'react';
import Icon from './Icon.jsx';
import { PERSONAS } from '../personas.js';

const TOPICS = [
  { id: 'travel',       label: 'Travel',           icon: 'plane',  desc: 'Trips, destinations, adventures' },
  { id: 'job',          label: 'Job Interview',     icon: 'briefcase',  desc: 'Career, skills, work experience' },
  { id: 'daily',        label: 'Daily Life',        icon: 'sun',  desc: 'Routines, habits, lifestyle' },
  { id: 'hobbies',      label: 'Hobbies',           icon: 'palette',  desc: 'Passions, interests, pastimes' },
  { id: 'food',         label: 'Food & Dining',     icon: 'dining',  desc: 'Cuisine, restaurants, recipes' },
  { id: 'technology',   label: 'Technology',        icon: 'laptop',  desc: 'Gadgets, AI, the digital world' },
  { id: 'smalltalk',    label: 'Small Talk',        icon: 'chat',  desc: 'Weather, news, casual chat' },
  { id: 'business',     label: 'Business English',  icon: 'chart',  desc: 'Meetings, presentations, networking' },
];

export default function SetupScreen({ onStart, persona, onPersonaChange }) {
  const [selectedTopic, setSelectedTopic]   = useState(null);
  const [customTopic, setCustomTopic]       = useState('');
  const [duration, setDuration]             = useState(5);
  const [useCustom, setUseCustom]           = useState(false);

  const activeTopic = useCustom
    ? (customTopic.trim() || null)
    : (selectedTopic ? TOPICS.find(t => t.id === selectedTopic)?.label : null);

  const canStart = !!activeTopic;

  const handleStart = () => {
    if (!canStart) return;
    onStart({ topic: activeTopic, durationSecs: duration * 60 });
  };

  return (
    <div className="setup-screen">
      {/* Hero */}
      <header className="setup-hero">
        <div className="setup-logo"><Icon name="mic" size={48} /></div>
        <h1 className="gradient-text">Conversation practice</h1>
        <p className="setup-subtitle">
          Pick a topic and talk it through with your speaking partner.<br />
          A few minutes of real conversation can make a difference.
        </p>
      </header>

      {/* Topic Selection */}
      <section className="setup-section">
        <div className="setup-section-header">
          <h3>Choose a Topic</h3>
          <button
            id="toggle-custom-topic"
            type="button"
            className={`btn btn-ghost btn-sm ${useCustom ? 'active-toggle' : ''}`}
            onClick={() => { setUseCustom(v => !v); setSelectedTopic(null); }}
          >
            <Icon name={useCustom ? 'arrowLeft' : 'edit'} size={16} />
            {useCustom ? 'Browse topics' : 'Custom topic'}
          </button>
        </div>

        {useCustom ? (
          <div className="custom-topic-wrap animate-in">
            <label htmlFor="custom-topic-input" className="sr-only">Your own conversation topic</label>
            <input
              id="custom-topic-input"
              type="text"
              placeholder="e.g. Moving to a new city, My favorite movies, Climate change..."
              value={customTopic}
              onChange={e => setCustomTopic(e.target.value)}
              maxLength={80}
              autoFocus
            />
            {customTopic.trim() && (
              <p className="custom-topic-preview">
                You'll practice: <strong>"{customTopic.trim()}"</strong>
              </p>
            )}
          </div>
        ) : (
          <div className="topic-grid animate-in" role="group" aria-label="Conversation topics">
            {TOPICS.map(topic => (
              <button
                key={topic.id}
                id={`topic-${topic.id}`}
                type="button"
                aria-pressed={selectedTopic === topic.id}
                className={`topic-card glass-card glass-card-hover ${selectedTopic === topic.id ? 'topic-card--selected' : ''}`}
                onClick={() => setSelectedTopic(topic.id)}
              >
                <span className="topic-icon"><Icon name={topic.icon} size={25} /></span>
                <span className="topic-label">{topic.label}</span>
                <span className="topic-desc">{topic.desc}</span>
                {selectedTopic === topic.id && (
                  <span className="topic-check"><Icon name="check" size={16} /></span>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="setup-section" aria-labelledby="persona-heading">
        <div className="setup-section-header">
          <h3 id="persona-heading">Choose Your Speaking Partner</h3>
        </div>
        <p className="persona-intro">Pick the conversation style that helps you practice best.</p>
        <div className="persona-grid" role="group" aria-label="Speaking partner style">
          {PERSONAS.map(option => (
            <button
              key={option.id}
              type="button"
              className={`persona-card glass-card ${persona === option.id ? 'persona-card--selected' : ''}`}
              onClick={() => onPersonaChange(option.id)}
              aria-pressed={persona === option.id}
            >
              <span className="persona-card-icon"><Icon name={option.icon} size={21} /></span>
              <span className="persona-card-copy"><strong>{option.label}</strong><small>{option.description}</small></span>
              {persona === option.id && <Icon name="check" size={17} className="persona-card-check" />}
            </button>
          ))}
        </div>
      </section>

      {/* Duration */}
      <section className="setup-section">
        <div className="setup-section-header">
          <h3 id="duration-heading">Session Duration</h3>
          <span className="duration-badge" aria-hidden="true">{duration} min</span>
        </div>
        <div className="duration-slider-wrap">
          <input
            id="duration-slider"
            type="range"
            min={1}
            max={15}
            step={1}
            value={duration}
            onChange={e => setDuration(Number(e.target.value))}
            aria-labelledby="duration-heading"
            aria-valuetext={`${duration} ${duration === 1 ? 'minute' : 'minutes'}`}
          />
          <div className="duration-ticks" role="group" aria-label="Duration presets">
            {[1, 3, 5, 10, 15].map(v => (
              <button
                key={v}
                type="button"
                aria-pressed={duration === v}
                aria-label={`${v} ${v === 1 ? 'minute' : 'minutes'}`}
                className={`tick-btn ${duration === v ? 'tick-btn--active' : ''}`}
                onClick={() => setDuration(v)}
              >
                {v}m
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Start Button */}
      <div className="setup-cta">
        {!canStart && (
          <p className="setup-hint" id="setup-hint">
            {useCustom ? 'Type a topic to get started' : 'Select a topic to get started'}
          </p>
        )}
        <button
          id="start-session-btn"
          className="btn btn-primary btn-lg start-btn"
          type="button"
          disabled={!canStart}
          aria-describedby={canStart ? undefined : 'setup-hint'}
          onClick={handleStart}
        >
          <span className="btn-icon"><Icon name="mic" size={20} /></span>
          Start Conversation
        </button>
      </div>

      <style>{`
        .setup-screen {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 48px 24px 64px;
          gap: 40px;
          position: relative;
          z-index: 1;
          max-width: 760px;
          margin: 0 auto;
          width: 100%;
        }

        /* Hero */
        .setup-hero {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .setup-logo {
          color: var(--accent-light);
          filter: drop-shadow(0 0 24px rgba(124,58,237,0.5));
          animation: float 3s ease-in-out infinite;
        }
        @keyframes float {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }
        .setup-hero h1 {
          font-size: 3rem;
          letter-spacing: -0.04em;
        }
        .setup-subtitle {
          color: var(--text-secondary);
          font-size: 1.0625rem;
          line-height: 1.7;
        }

        /* Sections */
        .setup-section {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .setup-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .setup-section-header h3 {
          color: var(--text-primary);
        }

        .active-toggle {
          background: var(--accent-dim) !important;
          color: var(--accent-light) !important;
          border-color: var(--accent-border) !important;
        }

        /* Topic Grid */
        .topic-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 12px;
        }
        .topic-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
          padding: 16px;
          cursor: pointer;
          border: 1px solid var(--border-subtle);
          position: relative;
          text-align: left;
          background: var(--bg-card);
          border-radius: var(--radius-lg);
          transition: all var(--transition-base);
        }
        .topic-card:hover {
          background: var(--bg-card-hover);
          border-color: var(--border-default);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
        .topic-card--selected {
          background: var(--accent-dim) !important;
          border-color: var(--accent-border) !important;
          box-shadow: 0 0 20px var(--accent-glow) !important;
        }
        .topic-icon {
          color: var(--accent-light);
          display: inline-flex;
          align-items: center;
          margin-bottom: 3px;
        }
        .topic-label {
          font-weight: 600;
          font-size: 0.9375rem;
          color: var(--text-primary);
        }
        .topic-desc {
          font-size: 0.75rem;
          color: var(--text-secondary);
          line-height: 1.4;
        }
        .topic-check {
          position: absolute;
          top: 10px;
          right: 12px;
          color: var(--accent-light);
          font-size: 0.875rem;
          font-weight: 700;
        }

        /* Custom Topic */
        .persona-intro { color: var(--text-secondary); font-size: 0.875rem; margin-top: -8px; }
        .persona-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .persona-card { display: flex; align-items: center; gap: 12px; min-width: 0; padding: 15px; text-align: left; color: var(--text-primary); font: inherit; cursor: pointer; border-radius: var(--radius-lg); transition: background var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast); }
        .persona-card:hover { background: var(--bg-card-hover); border-color: var(--border-default); transform: translateY(-1px); }
        .persona-card--selected { background: var(--accent-dim) !important; border-color: var(--accent-border) !important; }
        .persona-card-icon { flex: none; width: 40px; height: 40px; display: grid; place-items: center; border-radius: 11px; color: var(--accent-light); background: var(--accent-dim); }
        .persona-card-copy { min-width: 0; display: grid; gap: 2px; }
        .persona-card-copy strong { font-size: 0.9rem; font-weight: 600; }
        .persona-card-copy small { color: var(--text-secondary); font-size: 0.75rem; line-height: 1.4; }
        .persona-card-check { flex: none; margin-left: auto; color: var(--accent-light); }
        .persona-card:focus-visible { outline: 2px solid var(--accent-light); outline-offset: 3px; }
        @media (max-width: 560px) { .persona-grid { grid-template-columns: 1fr; } }
        .custom-topic-wrap {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .custom-topic-preview {
          color: var(--text-secondary);
          font-size: 0.875rem;
          padding-left: 4px;
        }
        .custom-topic-preview strong {
          color: var(--accent-light);
        }

        /* Duration */
        .duration-badge {
          background: var(--accent-dim);
          color: var(--accent-light);
          border: 1px solid var(--accent-border);
          border-radius: var(--radius-full);
          padding: 2px 12px;
          font-size: 0.875rem;
          font-weight: 600;
        }
        .duration-slider-wrap {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .duration-ticks {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .tick-btn {
          background: var(--bg-card);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-full);
          color: var(--text-secondary);
          min-height: 32px;
          padding: 4px 14px;
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition-fast);
          font-family: var(--font-sans);
        }
        .tick-btn:hover { background: var(--bg-card-hover); color: var(--text-primary); }
        .tick-btn--active {
          background: var(--accent-dim) !important;
          border-color: var(--accent-border) !important;
          color: var(--accent-light) !important;
        }

        /* CTA */
        .setup-cta {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .setup-hint {
          color: var(--text-muted);
          font-size: 0.875rem;
        }
        .start-btn {
          padding: 16px 48px;
          font-size: 1.0625rem;
          border-radius: var(--radius-full);
          box-shadow: 0 8px 32px rgba(124,58,237,0.4), 0 0 64px rgba(124,58,237,0.1);
        }
        .start-btn:not(:disabled):hover {
          box-shadow: 0 12px 40px rgba(124,58,237,0.55), 0 0 80px rgba(124,58,237,0.15);
        }
        .btn-icon { display: inline-flex; align-items: center; }
        @media (max-width: 800px) {
          .setup-screen { min-height: calc(100dvh - 60px); padding: 30px 18px 60px; gap: 28px; }
          .setup-hero h1 { font-size: clamp(2rem, 8vw, 3rem); }
          .setup-subtitle { font-size: .95rem; }
        }
        @media (max-width: 390px) {
          .topic-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .setup-section-header { align-items: flex-start; gap: 8px; }
        }
      `}</style>
    </div>
  );
}
