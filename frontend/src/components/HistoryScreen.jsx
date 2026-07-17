import { useState, useEffect } from 'react';
import { fetchPastSessions } from '../services/api.js';

export default function HistoryScreen({ onViewHistory }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPastSessions()
      .then(data => {
        setSessions(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="history-screen">
      <header className="history-hero" style={{ marginBottom: '32px' }}>
        <h1 className="gradient-text">Past Sessions</h1>
        <p className="history-subtitle">
          Review your previous conversations and track your progress.
        </p>
      </header>

      <section className="history-section animate-in">
        {loading ? (
          <div className="flex justify-center" style={{ padding: '40px' }}>
            <div className="spinner"></div>
          </div>
        ) : sessions.length > 0 ? (
          <div className="recent-sessions-grid">
            {sessions.map(s => (
              <div 
                key={s.id} 
                className="recent-session-card glass-card glass-card-hover"
                onClick={() => onViewHistory(s.id)}
              >
                <div className="recent-topic">{s.topic}</div>
                <div className="recent-date">{new Date(s.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-sessions glass-card">
            <p>No past sessions yet. Start a conversation to see your history here!</p>
          </div>
        )}
      </section>

      <style>{`
        .history-screen {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 48px 24px 64px;
          position: relative;
          z-index: 1;
          max-width: 900px;
          margin: 0 auto;
          width: 100%;
        }

        .history-hero {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .history-hero h1 {
          font-size: 3rem;
          letter-spacing: -0.04em;
        }

        .history-subtitle {
          color: var(--text-secondary);
          font-size: 1.0625rem;
          line-height: 1.7;
        }

        .history-section {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .recent-sessions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 16px;
          width: 100%;
        }
        .recent-session-card {
          padding: 20px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .recent-topic {
          font-weight: 600;
          font-size: 1.1rem;
          color: var(--text-primary);
        }
        .recent-date {
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .empty-sessions {
          padding: 40px 24px;
          text-align: center;
          color: var(--text-muted);
          font-size: 1rem;
        }
      `}</style>
    </div>
  );
}
