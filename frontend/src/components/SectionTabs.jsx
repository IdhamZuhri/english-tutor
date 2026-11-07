import Icon from './Icon.jsx';

/** Second-level tabs for a section that holds more than one screen (Speak, Progress, Library). */
export default function SectionTabs({ section, activeScreen, onSelect }) {
  if (!section || section.screens.length < 2) return null;
  return (
    <nav className="section-tabs" aria-label={`${section.label} sections`}>
      <div className="section-tabs-inner">
        {section.screens.map(screen => (
          <button
            key={screen.id}
            type="button"
            className={`section-tab ${activeScreen === screen.id ? 'active' : ''}`}
            aria-current={activeScreen === screen.id ? 'page' : undefined}
            onClick={() => onSelect(screen.id)}
          >
            {screen.icon && <Icon name={screen.icon} size={17} />}
            {screen.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
