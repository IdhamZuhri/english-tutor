import { useEffect, useMemo, useState } from 'react';
import { fetchPastSessions, exportHistory } from '../services/api.js';
import './HistoryScreen.css';
import Icon from './Icon.jsx';

const timestamp = session => {
  const value = new Date(session.created_at).getTime();
  return Number.isFinite(value) ? value : 0;
};

export default function HistoryScreen({ onViewHistory }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');

  const loadSessions = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchPastSessions();
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('History load failed:', err);
      setError('Could not load your sessions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSessions(); }, []);

  const groups = useMemo(() => {
    const filtered = sessions
      .filter(session => (session.topic || '').toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => sort === 'newest' ? timestamp(b) - timestamp(a) : timestamp(a) - timestamp(b));
    const grouped = new Map();
    for (const session of filtered) {
      const date = new Date(session.created_at);
      const label = Number.isNaN(date.getTime()) ? 'Date unknown' : date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      if (!grouped.has(label)) grouped.set(label, []);
      grouped.get(label).push(session);
    }
    return [...grouped];
  }, [sessions, query, sort]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const data = await exportHistory();
      const blob = new Blob([data.markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SpeakWell_History_${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Export failed:', err);
      setError('Could not export your history. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="history-screen animate-in">
      <header className="history-header">
        <div>
          <p className="history-eyebrow">Your practice</p>
          <h1>Conversation history</h1>
          <p className="history-subtitle">Revisit what you practiced, one conversation at a time.</p>
        </div>
        <button className="btn btn-secondary history-export" onClick={handleExport} disabled={loading || exporting || sessions.length === 0}>
          {exporting ? 'Exporting…' : 'Export Markdown'}
        </button>
      </header>

      {!loading && !error && sessions.length > 0 && (
        <div className="history-toolbar">
          <div className="history-search">
            <label className="sr-only" htmlFor="history-search-input">Search sessions by topic</label>
            <Icon name="search" size={20} />
            <input id="history-search-input" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search topics" />
            {query && <button type="button" className="history-search-clear" onClick={() => setQuery('')} aria-label="Clear topic search"><Icon name="close" size={16} /></button>}
          </div>
          <label className="history-sort">
            <span>Sort</span>
            <select value={sort} onChange={event => setSort(event.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </div>
      )}

      <section className="history-content" aria-live="polite">
        {loading ? <div className="history-state glass-card"><div className="spinner" /><p>Loading your sessions…</p></div>
          : error ? <div className="history-state glass-card"><h2>History unavailable</h2><p>{error}</p><button className="btn btn-secondary" onClick={loadSessions}>Try again</button></div>
          : sessions.length === 0 ? <div className="history-state glass-card"><div className="history-empty-icon"><Icon name="history" size={40} /></div><h2>Your story starts here</h2><p>Your conversations will appear here after your first practice session.</p></div>
          : groups.length === 0 ? <div className="history-state glass-card"><h2>No matching sessions</h2><p>Try another topic or clear your search.</p><button className="btn btn-secondary" onClick={() => setQuery('')}>Clear search</button></div>
          : <>
              <p className="history-count">{groups.reduce((count, [, items]) => count + items.length, 0)} of {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}</p>
              {groups.map(([month, items]) => (
                <div className="history-group" key={month}>
                  <h2>{month}</h2>
                  <div className="history-list">
                    {items.map(session => {
                      const date = new Date(session.created_at);
                      const validDate = !Number.isNaN(date.getTime());
                      return <button type="button" className="history-row glass-card" key={session.id} onClick={() => onViewHistory(session.id)} aria-label={`View ${session.topic || 'Untitled session'} session${validDate ? ` from ${date.toLocaleDateString()}` : ''}`}>
                        <span className="history-row-icon"><Icon name="chat" size={21} /></span>
                        <span className="history-row-main"><strong>{session.topic || 'Untitled session'}</strong><small>{validDate ? date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Date unknown'}</small></span>
                        <span className="history-row-action" aria-hidden="true">View conversation <span>→</span></span>
                      </button>;
                    })}
                  </div>
                </div>
              ))}
            </>}
      </section>
    </div>
  );
}
