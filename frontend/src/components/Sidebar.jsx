import React from 'react';

export default function Sidebar({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'setup', label: 'Home', icon: '🏠' },
    { id: 'history', label: 'History', icon: '📜' },
  ];

  return (
    <nav className="sidebar glass-card">
      <div className="sidebar-logo">
        <span className="sidebar-logo-icon">🎙️</span>
        <span className="sidebar-logo-text gradient-text">SpeakWell</span>
      </div>
      <div className="sidebar-menu">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`sidebar-btn ${activeTab === tab.id || (activeTab === 'session' && tab.id === 'setup') || (activeTab === 'summary' && tab.id === 'history') ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="sidebar-icon">{tab.icon}</span>
            <span className="sidebar-label">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
