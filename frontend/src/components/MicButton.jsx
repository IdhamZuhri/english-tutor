/**
 * MicButton — push-to-talk button with 4 visual states.
 *
 * idle       → ready to press, solid violet, mic icon
 * recording  → pulsing red ring, mic icon lit
 * processing → spinning ring, hourglass/spinner
 * speaking   → waveform animation, disabled
 */
export default function MicButton({ appState, onPress, onRelease }) {
  const isRecording  = appState === 'recording';
  const isProcessing = appState === 'processing';
  const isSpeaking   = appState === 'speaking';
  const isIdle       = appState === 'idle';
  const isDisabled   = !isIdle && !isRecording;

  const handleClick = () => {
    if (isRecording) {
      onRelease?.();
    } else if (isIdle) {
      onPress?.();
    }
  };

  return (
    <div className="mic-button-wrap">
      {/* Pulse rings (recording state) */}
      {isRecording && (
        <>
          <span className="pulse-ring pulse-ring-1" aria-hidden="true" />
          <span className="pulse-ring pulse-ring-2" aria-hidden="true" />
        </>
      )}

      <button
        id="mic-button"
        className={`mic-btn ${isRecording ? 'mic-btn--recording' : ''} ${isProcessing ? 'mic-btn--processing' : ''} ${isSpeaking ? 'mic-btn--speaking' : ''}`}
        onClick={handleClick}
        disabled={isDisabled}
        aria-label={
          isRecording  ? 'Stop recording' :
          isProcessing ? 'Processing...' :
          isSpeaking   ? 'Companion is speaking' :
          'Start recording'
        }
        title={
          isRecording  ? 'Click to stop' :
          isProcessing ? 'Processing your speech...' :
          isSpeaking   ? 'Companion is speaking' :
          'Tap to record'
        }
      >
        {isProcessing ? (
          <span className="mic-spinner" aria-hidden="true" />
        ) : isSpeaking ? (
          <span className="mic-waveform" aria-hidden="true">
            <span /><span /><span /><span /><span />
          </span>
        ) : (
          <svg className="mic-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
            <path
              d="M5 10a7 7 0 0 0 14 0"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            />
            <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="9" y1="21" x2="15" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </button>

      <style>{`
        .mic-button-wrap {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 80px;
          height: 80px;
        }

        .mic-btn {
          position: relative;
          z-index: 2;
          width: 72px;
          height: 72px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          background: var(--accent);
          box-shadow: 0 0 0 6px var(--accent-dim);
          color: white;
        }
        .mic-btn:hover:not(:disabled) {
          transform: scale(1.07);
          box-shadow: 0 0 0 8px var(--accent-dim);
        }
        .mic-btn:active:not(:disabled) {
          transform: scale(0.96);
        }
        .mic-btn:disabled {
          cursor: default;
          opacity: 1;
        }

        /* Recording state */
        .mic-btn--recording {
          background: #dc2626 !important;
          box-shadow: 0 6px 28px rgba(239,68,68,0.5) !important;
          animation: micPulse 1.5s ease-in-out infinite !important;
        }
        @keyframes micPulse {
          0%,100% { box-shadow: 0 6px 28px rgba(239,68,68,0.5); }
          50%      { box-shadow: 0 6px 40px rgba(239,68,68,0.75); }
        }

        /* Processing state */
        .mic-btn--processing {
          background: rgba(245,158,11,0.2) !important;
          border: 2px solid rgba(245,158,11,0.4) !important;
          cursor: wait !important;
        }

        /* Speaking state */
        .mic-btn--speaking {
          background: rgba(16,185,129,0.15) !important;
          border: 2px solid rgba(16,185,129,0.35) !important;
          color: #6ee7b7 !important;
        }

        /* Icons */
        .mic-icon {
          width: 26px;
          height: 26px;
          color: white;
        }

        /* Spinner (processing) */
        .mic-spinner {
          width: 26px;
          height: 26px;
          border: 2.5px solid rgba(245,158,11,0.3);
          border-top-color: #fcd34d;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Waveform (speaking) */
        .mic-waveform {
          display: flex;
          align-items: center;
          gap: 3px;
          height: 22px;
          color: #6ee7b7;
        }
        .mic-waveform span {
          display: block;
          width: 3px;
          border-radius: 2px;
          background: currentColor;
          animation: wave 1.2s ease-in-out infinite;
        }
        .mic-waveform span:nth-child(1) { height: 8px;  animation-delay: 0.0s; }
        .mic-waveform span:nth-child(2) { height: 14px; animation-delay: 0.1s; }
        .mic-waveform span:nth-child(3) { height: 20px; animation-delay: 0.2s; }
        .mic-waveform span:nth-child(4) { height: 14px; animation-delay: 0.3s; }
        .mic-waveform span:nth-child(5) { height: 8px;  animation-delay: 0.4s; }
        @keyframes wave {
          0%,100% { transform: scaleY(0.5); opacity: 0.7; }
          50%      { transform: scaleY(1);   opacity: 1; }
        }

        /* Pulse rings */
        .pulse-ring {
          position: absolute;
          border-radius: 50%;
          border: 2px solid rgba(239,68,68,0.5);
          animation: pulseExpand 2s ease-out infinite;
        }
        .pulse-ring-1 { width: 72px; height: 72px; animation-delay: 0s; }
        .pulse-ring-2 { width: 72px; height: 72px; animation-delay: 0.75s; }
        @keyframes pulseExpand {
          0%   { transform: scale(1);   opacity: 0.7; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
