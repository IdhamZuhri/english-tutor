import { useEffect, useState } from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { analyzeSession, fetchSessionDetails } from '../services/api.js';
import ChatBubble from './ChatBubble.jsx';

const SCORE_META = {
  grammar:      { label: 'Grammar',            icon: '📝', color: '#8b5cf6' },
  fluency:      { label: 'Fluency',             icon: '🗣️',  color: '#38bdf8' },
  vocabulary:   { label: 'Vocabulary',          icon: '📚', color: '#34d399' },
  pronunciation:{ label: 'Pronunciation*',      icon: '🎵', color: '#fb923c' },
};

function ScoreCard({ metaKey, score, justification }) {
  const meta = SCORE_META[metaKey];
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="score-card glass-card animate-in">
      <div className="score-card-top">
        <span className="score-icon">{meta.icon}</span>
        <div className="score-info">
          <span className="score-label">{meta.label}</span>
          <span className="score-value" style={{ color: meta.color }}>{score}<span className="score-unit">/100</span></span>
        </div>
      </div>
      <div className="score-bar-track">
        <div
          className="score-bar-fill"
          style={{
            width: animated ? `${score}%` : '0%',
            background: `linear-gradient(90deg, ${meta.color}99, ${meta.color})`,
          }}
        />
      </div>
      {justification && (
        <p className="score-just">{justification}</p>
      )}
    </div>
  );
}

function CustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    return (
      <div className="radar-tooltip">
        <span className="radar-tooltip-label">{payload[0].payload.subject}</span>
        <span className="radar-tooltip-score">{payload[0].value}/100</span>
      </div>
    );
  }
  return null;
}

export default function SummaryScreen({ history, sessionId, isHistoryView, topic, durationSecs, onRestart }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const usedSecs = durationSecs; // Could compute actual elapsed in future
  const mins = Math.floor(usedSecs / 60);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        if (isHistoryView) {
          const result = await fetchSessionDetails(sessionId);
          setData(result);
        } else {
          const result = await analyzeSession(history, sessionId);
          setData(result);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [history, sessionId, isHistoryView]);

  const radarData = data
    ? Object.entries(SCORE_META).map(([key, meta]) => ({
        subject: meta.label.replace('*', ''),
        score: data.scores[key] ?? 0,
        fullMark: 100,
      }))
    : [];

  return (
    <div className="summary-screen">
      {/* Header */}
      <header className="summary-header">
        <div className="summary-title-wrap">
          <div className="summary-icon">🏆</div>
          <div>
            <h1 className="gradient-text">{isHistoryView ? "Session History" : "Session Complete"}</h1>
            <p className="summary-meta">
              Topic: <strong>{data?.topic || topic}</strong>
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
          <p>Analyzing your performance...</p>
          <p className="text-sm text-muted">This takes a few seconds</p>
        </div>
      ) : error ? (
        <div className="summary-error glass-card animate-in">
          <span>⚠️</span>
          <p>Analysis unavailable: {error}</p>
          <button className="btn btn-secondary btn-sm" onClick={onRestart}>
            Start Over
          </button>
        </div>
      ) : data ? (
        <div className="summary-body">
          {/* Overall summary */}
          <div className="summary-card glass-card animate-in">
            <h3>Session Summary</h3>
            <p className="summary-text">{data.summary}</p>
          </div>

          {/* Chart + Filler row */}
          <div className="summary-chart-row">
            {/* Radar Chart */}
            <div className="summary-chart-wrap glass-card animate-in">
              <h3 className="chart-title">Performance Overview</h3>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData} margin={{ top: 20, right: 50, bottom: 20, left: 50 }}>
                  <PolarGrid
                    stroke="rgba(255,255,255,0.08)"
                    gridType="polygon"
                  />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: '#94a3b8', fontSize: 13, fontFamily: 'Inter' }}
                  />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="#7c3aed"
                    fillOpacity={0.25}
                    dot={{ r: 4, fill: '#a78bfa', strokeWidth: 0 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
              <p className="chart-note">* Pronunciation estimated from transcript patterns</p>
            </div>

            {/* Filler words stat */}
            <div className="summary-filler-wrap">
              <div className="filler-card glass-card animate-in">
                <span className="filler-icon">💭</span>
                <span className="filler-count">{data.filler_count}</span>
                <span className="filler-label">Filler words<br/>detected</span>
              </div>
              <div className="filler-note glass-card animate-in">
                <p className="text-sm text-secondary" style={{ lineHeight: 1.6 }}>
                  {data.justifications?.filler_words || 'Filler words like "um", "uh", "like" can slow down your speech flow.'}
                </p>
              </div>
            </div>
          </div>

          {/* Score cards */}
          <h3 className="scores-heading">Detailed Scores</h3>
          <div className="score-cards-grid">
            {Object.keys(SCORE_META).map((key) => (
              <ScoreCard
                key={key}
                metaKey={key}
                score={data.scores[key] ?? 0}
                justification={data.justifications?.[key]}
              />
            ))}
          </div>

          {/* Transcript / Conversation History */}
          {((isHistoryView ? data.history : history) || []).length > 0 && (
            <>
              <h3 className="scores-heading" style={{ marginTop: '16px' }}>Conversation Transcript</h3>
              <div className="summary-transcript glass-card animate-in">
                <div className="summary-transcript-messages">
                  {(isHistoryView ? data.history : history).map((msg, i) => (
                    <ChatBubble key={i} message={msg} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}

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

        /* Loading */
        .summary-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          padding: 80px 0;
          color: var(--text-secondary);
        }

        /* Error */
        .summary-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 40px;
          text-align: center;
          color: var(--text-secondary);
        }
        .summary-error span { font-size: 2rem; }

        .summary-body {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* Summary card */
        .summary-card {
          padding: 24px;
        }
        .summary-card h3 {
          color: var(--text-secondary);
          font-size: 0.8125rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 10px;
        }
        .summary-text {
          color: var(--text-primary);
          line-height: 1.75;
          font-size: 1rem;
        }

        /* Chart row */
        .summary-chart-row {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 620px) {
          .summary-chart-row { grid-template-columns: 1fr; }
        }

        .summary-chart-wrap {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .chart-title {
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
        }
        .chart-note {
          font-size: 0.75rem;
          color: var(--text-muted);
          text-align: center;
          margin-top: 4px;
        }

        .radar-tooltip {
          background: rgba(12, 14, 34, 0.95);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          padding: 8px 14px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .radar-tooltip-label { font-size: 0.75rem; color: var(--text-secondary); }
        .radar-tooltip-score { font-weight: 700; color: var(--accent-light); font-size: 1rem; }

        /* Filler */
        .summary-filler-wrap {
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-width: 160px;
        }
        .filler-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 24px 20px;
          gap: 6px;
          text-align: center;
        }
        .filler-icon { font-size: 2rem; }
        .filler-count {
          font-size: 2.5rem;
          font-weight: 800;
          color: var(--accent-light);
          line-height: 1;
        }
        .filler-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
          text-align: center;
          line-height: 1.4;
        }
        .filler-note { padding: 14px; }

        /* Score cards */
        .scores-heading {
          color: var(--text-primary);
          font-size: 1rem;
          margin-bottom: -8px;
        }
        .score-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
        }
        .score-card {
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          animation-delay: calc(var(--i, 0) * 0.08s);
        }
        .score-card-top {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .score-icon { font-size: 1.5rem; }
        .score-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .score-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
        }
        .score-value {
          font-size: 1.5rem;
          font-weight: 800;
          line-height: 1;
        }
        .score-unit {
          font-size: 0.8rem;
          font-weight: 400;
          color: var(--text-muted);
          margin-left: 2px;
        }
        .score-bar-track {
          height: 5px;
          background: var(--border-subtle);
          border-radius: var(--radius-full);
          overflow: hidden;
        }
        .score-bar-fill {
          height: 100%;
          border-radius: var(--radius-full);
          transition: width 1.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .score-just {
          font-size: 0.8rem;
          color: var(--text-secondary);
          line-height: 1.5;
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
