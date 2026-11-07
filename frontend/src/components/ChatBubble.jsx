import { useState } from 'react';
import Icon from './Icon.jsx';

/**
 * ChatBubble — displays a user or assistant message.
 *
 * User bubbles: right-aligned, violet gradient, with optional corrections panel.
 * AI bubbles: left-aligned, glass style, with typing/speaking state.
 */
export default function ChatBubble({ message }) {
  const { role, content, corrections } = message;
  const isUser = role === 'user';
  const [showCorrections, setShowCorrections] = useState(true);

  const hasCorrections = corrections?.has_corrections && corrections?.corrections?.length > 0;

  return (
    <div className={`bubble-wrap ${isUser ? 'bubble-wrap--user' : 'bubble-wrap--ai'}`}>
      {/* Avatar (AI only) */}
      {!isUser && (
        <div className="bubble-avatar" aria-hidden="true">A</div>
      )}

      <div className="bubble-content-col">
        {/* Message bubble */}
        <div className={`bubble ${isUser ? 'bubble--user' : 'bubble--ai'}`}>
          <p className="bubble-text">{content}</p>
        </div>

        {/* Correction panel — user bubbles only */}
        {isUser && hasCorrections && (
          <div className="correction-panel animate-in">
            <button
              type="button"
              className="correction-toggle"
              onClick={() => setShowCorrections(v => !v)}
              aria-expanded={showCorrections}
            >
              <span className="correction-icon"><Icon name="edit" size={15} /></span>
              <span>{corrections.corrections.length} correction{corrections.corrections.length > 1 ? 's' : ''}</span>
              <span className="correction-chevron" aria-hidden="true">{showCorrections ? '▴' : '▾'}</span>
            </button>

            {showCorrections && (
              <div className="correction-body animate-in">
                <p className="correction-full">
                  <span className="correction-label">Corrected: </span>
                  {corrections.corrected_sentence}
                </p>
                <div className="correction-items">
                  {corrections.corrections.map((c, i) => (
                    <div key={i} className="correction-item">
                      <span className="correction-original">{c.original}</span>
                      <span className="correction-arrow">→</span>
                      <span className="correction-fixed">{c.corrected}</span>
                      {c.explanation && (
                        <span className="correction-note"> — {c.explanation}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* "No corrections" subtle note */}
        {isUser && corrections && !hasCorrections && (
          <p className="no-corrections animate-in"><Icon name="check" size={14} /> No corrections</p>
        )}
      </div>
    </div>
  );
}

// ── Scoped styles (injected once at module load) ──────────────────────────────
const BUBBLE_STYLES = `
  .bubble-wrap {
    display: flex;
    gap: 10px;
    align-items: flex-end;
    max-width: 80%;
    animation: fadeSlideUp 0.35s ease both;
  }
  .bubble-wrap--user { align-self: flex-end; flex-direction: row-reverse; }
  .bubble-wrap--ai   { align-self: flex-start; }
  .bubble-avatar {
    width: 34px; height: 34px; min-width: 34px;
    border-radius: 50%;
    background: linear-gradient(135deg, #7c3aed, #5b21b6);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.875rem; font-weight: 700; color: white;
    box-shadow: 0 0 12px rgba(124,58,237,0.3);
    margin-bottom: 4px;
  }
  .bubble-content-col { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .bubble { border-radius: var(--radius-xl); padding: 12px 16px; max-width: 100%; word-break: break-word; }
  .bubble--user { background: var(--bubble-user-bg); border-bottom-right-radius: var(--radius-sm); box-shadow: 0 4px 20px rgba(124,58,237,0.3); }
  .bubble--ai   { background: var(--bubble-ai-bg); border: 1px solid var(--bubble-ai-border); border-bottom-left-radius: var(--radius-sm); backdrop-filter: blur(8px); }
  .bubble-text  { font-size: 0.9375rem; line-height: 1.6; color: var(--text-primary); }
  .correction-panel { background: rgba(124,58,237,0.08); border: 1px solid rgba(124,58,237,0.2); border-radius: var(--radius-md); overflow: hidden; font-size: 0.8125rem; }
  .correction-toggle { display: flex; align-items: center; gap: 6px; width: 100%; background: none; border: none; color: var(--accent-light); font-size: 0.8125rem; font-family: var(--font-sans); font-weight: 500; padding: 8px 12px; cursor: pointer; text-align: left; transition: background var(--transition-fast); }
  .correction-toggle:hover { background: rgba(124,58,237,0.1); }
  .correction-icon    { display: inline-flex; align-items: center; }
  .correction-chevron { margin-left: auto; font-size: 0.625rem; opacity: 0.7; }
  .correction-body  { padding: 8px 12px 10px; display: flex; flex-direction: column; gap: 8px; border-top: 1px solid rgba(124,58,237,0.15); }
  .correction-full  { color: var(--text-secondary); font-size: 0.8125rem; line-height: 1.5; }
  .correction-label { color: var(--text-muted); font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; margin-right: 4px; }
  .correction-items { display: flex; flex-direction: column; gap: 4px; }
  .correction-item  { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
  .correction-original { color: #fca5a5; text-decoration: line-through; text-decoration-color: rgba(239,68,68,0.6); font-size: 0.8125rem; }
  .correction-arrow { color: var(--text-muted); font-size: 0.75rem; }
  .correction-fixed { color: #6ee7b7; font-weight: 600; font-size: 0.8125rem; }
  .correction-note  { color: var(--text-muted); font-size: 0.75rem; font-style: italic; }
  .no-corrections   { display: inline-flex; align-items: center; gap: 4px; color: var(--color-success); font-size: 0.75rem; padding-left: 4px; opacity: 0.75; }
`;

if (typeof document !== 'undefined' && !document.head.querySelector('[data-sw-bubble]')) {
  const el = document.createElement('style');
  el.setAttribute('data-sw-bubble', '');
  el.textContent = BUBBLE_STYLES;
  document.head.appendChild(el);
}
