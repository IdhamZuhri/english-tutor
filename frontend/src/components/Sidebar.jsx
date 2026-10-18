import { useState } from 'react';
import Icon from './Icon.jsx';

export default function Sidebar({ activeTab, onTabChange }) {
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
  const tabs = [
    { id: 'home', label: 'Home', subtitle: 'Your starting point', icon: 'home' },
    { id: 'conversation', label: 'Conversation', subtitle: 'Everyday fluency', icon: 'chat' },
    { id: 'public-speaking', label: 'Public Speaking', subtitle: 'Speak with purpose', icon: 'podium' },
    { id: 'journal', label: 'Daily Journal', subtitle: 'Write or speak', icon: 'journal' },
    { id: 'practice', label: 'My Practice', icon: 'target' },
    { id: 'channels', label: 'Channels', icon: 'play' },
    { id: 'lessons', label: 'English Notes', icon: 'book' },
    { id: 'history', label: 'History', icon: 'history' },
  ];

  return (
    <nav className={`sidebar glass-card ${collapsed ? 'sidebar--collapsed' : ''}`} aria-label="Main navigation">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon"><Icon name="mic" size={26} /></span>
          {!collapsed && <span className="sidebar-logo-text gradient-text">SpeakWell</span>}
        </div>
        <button type="button" className="sidebar-toggle" onClick={toggleCollapsed} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={!collapsed} title={collapsed ? 'Expand navigation' : 'Collapse navigation'}>
          <Icon name="arrowLeft" size={19} />
        </button>
      </div>
      <div className="sidebar-menu">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id || (activeTab === 'summary' && tab.id === 'history');
          return (
          <button
            key={tab.id}
            type="button"
            className={`sidebar-btn sidebar-btn--${tab.id} ${isActive ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            aria-label={collapsed ? tab.label : undefined}
            aria-current={isActive ? 'page' : undefined}
            title={collapsed ? tab.label : undefined}
          >
            <span className="sidebar-icon"><Icon name={tab.icon} size={20} /></span>
            {!collapsed && <span className="sidebar-copy"><span className="sidebar-label">{tab.label}</span>{tab.subtitle && <small>{tab.subtitle}</small>}</span>}
          </button>
          );
        })}
      </div>
    </nav>
  );
}
