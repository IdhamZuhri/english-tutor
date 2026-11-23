import { useId, useState } from 'react';
import { GUIDE_LEVELS, SPEECH_FRAMEWORKS, getFramework, suggestFramework } from '../speechFrameworks.js';

/** Structure guide for an impromptu topic: pick a framework, then view it light or detailed. */
export default function StructureGuide({ topic, frameworkId, guideLevel, onFrameworkChange, onGuideLevelChange }) {
  const [picking, setPicking] = useState(false);
  const listId = useId();
  const framework = getFramework(frameworkId);
  const suggestedId = suggestFramework(topic);
  const detailed = guideLevel === 'detailed';

  return <section className={`structure-guide is-${guideLevel}`} aria-label="Structure guide">
    <header className="structure-guide-head">
      <small>STRUCTURE GUIDE</small>
      <div className="structure-guide-level" role="group" aria-label="Guide detail">
        {GUIDE_LEVELS.map(level => <button type="button" key={level.id} title={level.description} className={guideLevel === level.id ? 'selected' : ''} aria-pressed={guideLevel === level.id} onClick={() => onGuideLevelChange(level.id)}>{level.label}</button>)}
      </div>
    </header>

    <button type="button" className="structure-guide-current" aria-expanded={picking} aria-controls={listId} onClick={() => setPicking(open => !open)}>
      <span>
        <strong>{framework.name}{framework.id === suggestedId && <em className="structure-guide-badge">Suggested</em>}</strong>
        <small>Best for {framework.bestFor.toLowerCase()}</small>
      </span>
      <span className="structure-guide-change">{picking ? 'Close' : 'Change'} <span aria-hidden="true" className={picking ? 'is-open' : ''}>▾</span></span>
    </button>

    {picking && <div id={listId} className="structure-guide-options" role="radiogroup" aria-label="Choose a structure">
      {SPEECH_FRAMEWORKS.map(option => <button type="button" role="radio" key={option.id} aria-checked={option.id === framework.id} className={option.id === framework.id ? 'selected' : ''} onClick={() => { onFrameworkChange(option.id); setPicking(false); }}>
        <span className="structure-guide-radio" aria-hidden="true" />
        <span>
          <strong>{option.name}{option.id === suggestedId && <em className="structure-guide-badge">Suggested</em>}</strong>
          <small>{option.bestFor}</small>
          <small className="structure-guide-flow">{option.steps.map(step => step.label).join(' → ')}</small>
        </span>
      </button>)}
    </div>}

    <ol className="structure-guide-steps">
      {framework.steps.map((step, index) => <li key={index}>
        <span className="structure-guide-num" aria-hidden="true">{index + 1}</span>
        <div>
          <p><strong>{step.label}</strong><span>{step.hint}</span></p>
          {detailed && <ul className="structure-guide-starters" aria-label={`Sentence starters for ${step.label}`}>{step.starters.map(starter => <li key={starter}>{starter}</li>)}</ul>}
        </div>
      </li>)}
    </ol>

    {detailed && <p className="structure-guide-source"><span aria-hidden="true">ⓘ</span> {framework.source}</p>}
  </section>;
}
