import { useEffect, useRef } from 'react';

/** Session countdown timer display. */
export default function SessionTimer({ timeLeft, totalSecs }) {
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const pct  = totalSecs > 0 ? (timeLeft / totalSecs) * 100 : 100;

  const isLow     = timeLeft <= 60;
  const isCritical= timeLeft <= 30;

  return (
    <div className={`session-timer ${isLow ? 'timer--low' : ''} ${isCritical ? 'timer--critical' : ''}`}>
      <div className="timer-ring-wrap">
        <svg className="timer-ring" viewBox="0 0 44 44" aria-hidden="true">
          <circle cx="22" cy="22" r="18" className="ring-track" />
          <circle
            cx="22" cy="22" r="18"
            className="ring-fill"
            style={{
              strokeDasharray: `${2 * Math.PI * 18}`,
              strokeDashoffset: `${2 * Math.PI * 18 * (1 - pct / 100)}`,
              stroke: isCritical ? 'var(--color-error)' : isLow ? 'var(--color-warning)' : 'var(--accent-light)',
            }}
          />
        </svg>
        <span className="timer-display" aria-live="polite" aria-label={`${mins} minutes ${secs} seconds remaining`}>
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </span>
      </div>

      <style>{`
        .session-timer {
          display: flex;
          align-items: center;
        }
        .timer-ring-wrap {
          position: relative;
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .timer-ring {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          transform: rotate(-90deg);
        }
        .ring-track {
          fill: none;
          stroke: rgba(255,255,255,0.08);
          stroke-width: 2.5;
        }
        .ring-fill {
          fill: none;
          stroke-width: 2.5;
          stroke-linecap: round;
          transition: stroke-dashoffset 1s linear, stroke 0.5s ease;
        }
        .timer-display {
          font-size: 0.8125rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          color: var(--text-secondary);
          letter-spacing: 0.05em;
          position: relative;
          z-index: 1;
        }
        .timer--low .timer-display     { color: var(--color-warning); }
        .timer--critical .timer-display{ color: var(--color-error); }
        .timer--critical .timer-ring-wrap {
          animation: timerShake 0.5s ease-in-out infinite;
        }
        @keyframes timerShake {
          0%,100% { transform: translateX(0); }
          25%      { transform: translateX(-1px); }
          75%      { transform: translateX(1px); }
        }
      `}</style>
    </div>
  );
}
