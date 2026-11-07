import { useState } from 'react';
import Icon from './Icon.jsx';
import { SECTIONS } from '../navigation.js';

/**
 * Sidebar — five sections.
 * Desktop: collapsible side rail. Phones (≤ 800px): a fixed bottom tab bar,
 * so every section stays one tap away instead of behind a menu.
 */
export default function Sidebar({ activeSection, onNavigate, sessionActive = false }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('speakwell-sidebar-collapsed') === 'true'; }
    catch { return false; }
  });
  const toggleCollapsed = () => {
    setCollapsed(current => {
      const next = !current;
      try { localStorage.setItem('speakwell-sidebar-collapsed', String(next)); } catch { /* Storage may be unavailable. */ }
      return next;
    });
  };

  return (
    <nav className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''} ${sessionActive ? 'sidebar--session' : ''}`} aria-label="Main navigation">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon"><Icon name="mic" size={18} /></span>
          <span className="sidebar-logo-text">SpeakWell</span>
        </div>
        <button type="button" className="sidebar-toggle" onClick={toggleCollapsed} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={!collapsed} title={collapsed ? 'Expand navigation' : 'Collapse navigation'}>
          <Icon name="arrowLeft" size={17} />
        </button>
      </div>
      <div className="sidebar-menu">
        {SECTIONS.map(section => {
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              className={`sidebar-btn ${isActive ? 'active' : ''}`}
              onClick={() => onNavigate(section.id)}
              aria-current={isActive ? 'page' : undefined}
              title={collapsed ? section.label : undefined}
            >
              <span className="sidebar-icon"><Icon name={section.icon} size={20} /></span>
              <span className="sidebar-copy"><span className="sidebar-label">{section.label}</span><small>{section.subtitle}</small></span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
