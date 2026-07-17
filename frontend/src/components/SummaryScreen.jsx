import { useEffect, useState } from 'react';
import { fetchSessionDetails } from '../services/api.js';
import ChatBubble from './ChatBubble.jsx';

export default function SummaryScreen({ history, sessionId, isHistoryView, topic, onRestart }) {
  const [loading, setLoading] = useState(isHistoryView);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isHistoryView) {
      const run = async () => {
        try {
          setLoading(true);
          const result = await fetchSessionDetails(sessionId);
          setData(result);
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
      run();
    }
  }, [sessionId, isHistoryView]);

  const activeHistory = isHistoryView ? data?.history : history;
  const activeTopic = isHistoryView ? data?.topic : topic;

  return (
    <div className="summary-screen">
      {/* Header */}
      <header className="summary-header">
        <div className="summary-title-wrap">
          <div className="summary-icon">🏆</div>
          <div>
            <h1 className="gradient-text">{isHistoryView ? "Session History" : "Session Complete"}</h1>
            <p className="summary-meta">
              Topic: <strong>{activeTopic}</strong>
            </p>
          </div>
        </div>
        <button id="new-session-btn" className="btn btn-primary" onClick={onRestart}>
          {isHistoryView ? "Back to Home" : "Start New Session"}
        </button>
      </header>

      {loading ? (
        <div className="summary-loading animate-in">
          <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
          <p>Loading session details...</p>
        </div>
      ) : error ? (
        <div className="summary-error glass-card animate-in">
          <span>⚠️</span>
          <p>Details unavailable: {error}</p>
          <button className="btn btn-secondary btn-sm" onClick={onRestart}>
            Start Over
          </button>
        </div>
      ) : (
        <div className="summary-body">
          {/* Transcript / Conversation History */}
          {(activeHistory || []).length > 0 ? (
            <div className="summary-transcript glass-card animate-in">
              <h3 className="scores-heading" style={{ marginBottom: '16px' }}>Conversation Transcript</h3>
              <div className="summary-transcript-messages">
                {activeHistory.map((msg, i) => (
                  <ChatBubble key={i} message={msg} />
                ))}
              </div>
            </div>
          ) : (
            <div className="summary-card glass-card animate-in">
              <p className="summary-text text-muted" style={{ textAlign: 'center' }}>No conversation history available.</p>
            </div>
          )}
        </div>
      )}

      <style>{`
        .summary-screen {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          gap: 32px;
          padding: 40px 24px 64px;
          max-width: 900px;
          margin: 0 auto;
          width: 100%;
          position: relative;
          z-index: 1;
        }

        /* Header */
        .summary-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }
        .summary-title-wrap {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .summary-icon {
          font-size: 3rem;
          filter: drop-shadow(0 0 16px rgba(251,191,36,0.4));
          animation: float 3s ease-in-out infinite;
        }
        @keyframes float {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        .summary-header h1 { font-size: 2rem; }
        .summary-meta {
          color: var(--text-secondary);
          font-size: 0.875rem;
          margin-top: 2px;
        }
        .summary-meta strong { color: var(--text-primary); }

        /* Loading & Error */
        .summary-loading, .summary-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          padding: 80px 0;
          color: var(--text-secondary);
        }
        .summary-error { padding: 40px; text-align: center; }
        .summary-error span { font-size: 2rem; }

        .summary-body {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .scores-heading {
          color: var(--text-primary);
          font-size: 1rem;
        }
        .summary-transcript {
          padding: 24px;
        }
        .summary-transcript-messages {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
      `}</style>
    </div>
  );
}
