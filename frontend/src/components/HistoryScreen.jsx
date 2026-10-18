import { useEffect, useMemo, useState } from 'react';
import { exportHistory, fetchJournalEntries, fetchPastSessions, fetchSpeeches } from '../services/api.js';
import Icon from './Icon.jsx';
import { PERSONAS } from '../personas.js';
import './HistoryScreen.css';

const moods = { great: '😄', good: '🙂', okay: '😐', low: '😔', anxious: '😟' };
const filters = [
  { id: 'all', label: 'All activity', icon: 'history' },
  { id: 'conversation', label: 'Conversations', icon: 'chat' },
  { id: 'speech', label: 'Public speaking', icon: 'podium' },
  { id: 'journal', label: 'Journal', icon: 'journal' },
];
const dateValue = item => {
  const value = new Date(item.created_at).getTime();
  return Number.isFinite(value) ? value : 0;
};
const dateLabel = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unknown' : date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};
const monthLabel = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unknown' : date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

export default function HistoryScreen({ onViewHistory, onViewSpeech, onViewJournal, onNavigate }) {
  const [sessions, setSessions] = useState([]);
  const [speeches, setSpeeches] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failedSources, setFailedSources] = useState([]);
  const [actionError, setActionError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [filter, setFilter] = useState(() => {
    try { const saved = sessionStorage.getItem('speakwell-history-filter'); return filters.some(item => item.id === saved) ? saved : 'all'; }
    catch { return 'all'; }
  });
  const [query, setQuery] = useState(() => {
    try { return sessionStorage.getItem('speakwell-history-query') || ''; }
    catch { return ''; }
  });
  const [sort, setSort] = useState(() => {
    try { return sessionStorage.getItem('speakwell-history-sort') === 'oldest' ? 'oldest' : 'newest'; }
    catch { return 'newest'; }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem('speakwell-history-filter', filter);
      sessionStorage.setItem('speakwell-history-query', query);
      sessionStorage.setItem('speakwell-history-sort', sort);
    } catch { /* Storage may be unavailable. */ }
  }, [filter, query, sort]);

  const loadActivity = async () => {
    setLoading(true);
    setFailedSources([]);
    const results = await Promise.allSettled([fetchPastSessions(), fetchSpeeches(), fetchJournalEntries()]);
    const failed = [];
    if (results[0].status === 'fulfilled' && Array.isArray(results[0].value)) setSessions(results[0].value);
    else { setSessions([]); failed.push('conversations'); }
    if (results[1].status === 'fulfilled' && Array.isArray(results[1].value)) setSpeeches(results[1].value);
    else { setSpeeches([]); failed.push('public speaking'); }
    if (results[2].status === 'fulfilled' && Array.isArray(results[2].value)) setJournalEntries(results[2].value);
    else { setJournalEntries([]); failed.push('journal'); }
    setFailedSources(failed);
    setLoading(false);
  };
  useEffect(() => { loadActivity(); }, []);

  const items = useMemo(() => [
    ...sessions.map(session => ({
      id: session.id, kind: 'conversation', type: 'Conversation', icon: 'chat',
      title: session.topic || 'Untitled conversation', created_at: session.created_at,
      meta: `${PERSONAS.find(persona => persona.id === session.persona)?.label || 'Balanced'} partner`,
      onOpen: () => onViewHistory(session.id),
    })),
    ...speeches.map(speech => ({
      id: speech.id, kind: 'speech', type: 'Public speaking', icon: 'podium',
      title: speech.title || 'Untitled rehearsal', created_at: speech.created_at,
      meta: `${speech.format || 'Rehearsal'} · ${Math.max(1, Math.round((speech.durationSecs || 0) / 60))} min`,
      onOpen: () => onViewSpeech(speech.id),
    })),
    ...journalEntries.map(entry => ({
      id: entry.id, kind: 'journal', type: 'Journal', icon: 'journal',
      title: entry.title || 'Untitled entry', created_at: entry.created_at,
      meta: `${moods[entry.mood] || '📝'} ${entry.mood || 'Reflection'} · ${entry.responseCount} ${entry.responseCount === 1 ? 'reflection' : 'reflections'}`,
      onOpen: () => onViewJournal(entry.id),
    })),
  ], [sessions, speeches, journalEntries, onViewHistory, onViewSpeech, onViewJournal]);

  const visible = useMemo(() => items
    .filter(item => filter === 'all' || item.kind === filter)
    .filter(item => `${item.title} ${item.type} ${item.meta}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => sort === 'newest' ? dateValue(b) - dateValue(a) : dateValue(a) - dateValue(b)), [items, filter, query, sort]);
  const groups = useMemo(() => {
    const result = new Map();
    visible.forEach(item => {
      const month = monthLabel(item.created_at);
      if (!result.has(month)) result.set(month, []);
      result.get(month).push(item);
    });
    return [...result];
  }, [visible]);
  const unavailableFilter = filter !== 'all' && failedSources.includes({ conversation: 'conversations', speech: 'public speaking', journal: 'journal' }[filter]);

  const handleExport = async () => {
    setActionError('');
    setExporting(true);
    try {
      const data = await exportHistory();
      const url = URL.createObjectURL(new Blob([data.markdown], { type: 'text/markdown' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `SpeakWell_Conversations_${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setActionError('Could not export conversations. Please try again.'); }
    finally { setExporting(false); }
  };

  return <div className="history-screen animate-in">
    <header className="history-header"><div><span className="history-eyebrow"><Icon name="history" size={17} /> YOUR JOURNEY</span><h1>All your practice, in one place.</h1><p className="history-subtitle">Find a conversation, revisit a rehearsal, or open a journal entry whenever you need it.</p></div></header>

    {!loading && failedSources.length > 0 && <div className="history-notice" role="status"><span>{failedSources.length === 3 ? 'Activity could not be loaded.' : `Some ${failedSources.join(', ')} activity could not be loaded.`}</span><button type="button" onClick={loadActivity}>Try again</button></div>}
    {actionError && <div className="history-notice" role="alert">{actionError}</div>}

    {!loading && failedSources.length < 3 && <>
      <div className="history-filters" role="group" aria-label="Filter activity type">{filters.map(option => { const count = option.id === 'all' ? items.length : items.filter(item => item.kind === option.id).length; return <button type="button" key={option.id} className={`history-filter ${filter === option.id ? 'selected' : ''}`} aria-pressed={filter === option.id} onClick={() => { setFilter(option.id); setQuery(''); }}><Icon name={option.icon} size={18} /><span>{option.label}</span><small>{count}</small></button>; })}</div>
      <div className="history-toolbar"><div className="history-search"><label className="sr-only" htmlFor="history-search-input">Search activity</label><Icon name="search" size={20} /><input id="history-search-input" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search titles or activity types" />{query && <button type="button" className="history-search-clear" onClick={() => setQuery('')} aria-label="Clear search"><Icon name="close" size={16} /></button>}</div><label className="history-sort"><span>Sort</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label></div>
      {filter === 'conversation' && sessions.length > 0 && <div className="history-export-row"><button type="button" className="btn btn-secondary btn-sm" onClick={handleExport} disabled={exporting}>{exporting ? 'Exporting…' : 'Export conversations'}</button></div>}
    </>}

    <section className="history-content" aria-live="polite">
      {loading ? <div className="history-state glass-card"><span className="spinner" /><p>Loading your activity…</p></div>
        : failedSources.length === 3 ? <div className="history-state glass-card"><Icon name="alert" size={32} /><h2>History is unavailable</h2><p>Please check the local server and try again.</p><button type="button" className="btn btn-secondary" onClick={loadActivity}>Try again</button></div>
        : items.length === 0 && failedSources.length > 0 ? <div className="history-state glass-card"><Icon name="alert" size={32} /><h2>Some activity is unavailable</h2><p>We could not confirm whether your history is empty. Try loading it again.</p><button type="button" className="btn btn-secondary" onClick={loadActivity}>Try again</button></div>
        : items.length === 0 ? <div className="history-state glass-card"><Icon name="history" size={36} /><h2>Your story starts here</h2><p>Conversations, rehearsals, and journal entries will appear here as you create them.</p><div className="history-empty-actions"><button type="button" className="btn btn-primary" onClick={() => onNavigate('conversation')}>Start a conversation</button><button type="button" className="btn btn-secondary" onClick={() => onNavigate('journal')}>Open journal</button></div></div>
        : unavailableFilter ? <div className="history-state glass-card"><Icon name="alert" size={32} /><h2>This activity is unavailable</h2><p>We could not load this section. Try again, or choose another activity.</p><button type="button" className="btn btn-secondary" onClick={loadActivity}>Try again</button></div>
        : visible.length === 0 ? <div className="history-state glass-card"><Icon name={filters.find(option => option.id === filter)?.icon || 'search'} size={32} /><h2>No matching activity</h2><p>{query ? 'Try a different search or clear your filters.' : 'No activity in this section yet. You can explore another type.'}</p><button type="button" className="btn btn-secondary" onClick={() => { setFilter('all'); setQuery(''); }}>Show all activity</button></div>
        : <><p className="history-count">Showing {visible.length} of {items.length} {items.length === 1 ? 'activity' : 'activities'}</p>{groups.map(([month, monthItems]) => <div className="history-group" key={month}><h2>{month}</h2><div className="history-list">{monthItems.map(item => <button type="button" className={`history-row history-row--${item.kind} glass-card`} key={`${item.kind}-${item.id}`} onClick={item.onOpen} aria-label={`Open ${item.type.toLowerCase()}: ${item.title}, ${dateLabel(item.created_at)}`}><span className="history-row-icon"><Icon name={item.icon} size={22} /></span><span className="history-row-main"><span className="history-row-type">{item.type}</span><strong>{item.title}</strong><small>{dateLabel(item.created_at)} · {item.meta}</small></span><span className="history-row-action" aria-hidden="true">Open <span>→</span></span></button>)}</div></div>)}</>}
    </section>
  </div>;
}
