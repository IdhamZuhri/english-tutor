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
    { id: 'setup', label: 'Home', icon: 'home' },
    { id: 'history', label: 'History', icon: 'history' },
    { id: 'practice', label: 'My Practice', icon: 'target' },
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
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`sidebar-btn ${activeTab === tab.id || (activeTab === 'session' && tab.id === 'setup') || (activeTab === 'summary' && tab.id === 'history') ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            aria-label={collapsed ? tab.label : undefined}
            title={collapsed ? tab.label : undefined}
          >
            <span className="sidebar-icon"><Icon name={tab.icon} size={20} /></span>
            {!collapsed && <span className="sidebar-label">{tab.label}</span>}
          </button>
        ))}
      </div>
    </nav>
  );
}
