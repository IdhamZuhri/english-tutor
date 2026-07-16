import { useEffect, useRef, useState } from 'react';
import { useAudioRecorder } from '../hooks/useAudioRecorder.js';
import { useSession } from '../hooks/useSession.js';
import ChatBubble from './ChatBubble.jsx';
import MicButton from './MicButton.jsx';
import SessionTimer from './SessionTimer.jsx';

export default function ChatScreen({ topic, durationSecs, onSessionEnd }) {
  const { isRecording, micError, startRecording, stopRecording } = useAudioRecorder();
  const chatBottomRef = useRef(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const {
    appState,
    messages,
    timeLeft,
    toast,
    isInitializing,
    processTurn,
    endSession,
  } = useSession({ topic, durationSecs, onSessionEnd });

  // Auto-scroll to latest message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── BUG FIX: merge recording state from useAudioRecorder with session appState ──
  // appState (from useSession) never reaches 'recording' — that's tracked by
  // useAudioRecorder's isRecording. Without this merge, the mic button always
  // sees 'idle' and every click fires onPress (start), never onRelease (stop).
  const effectiveState = isInitializing
    ? 'processing'
    : isRecording
    ? 'recording'
    : appState;

  const handleMicPress = async () => {
    const success = await startRecording();
    if (!success) return;
  };

  const handleMicRelease = async () => {
    const blob = await stopRecording();
    if (!blob || blob.size < 100) {
      // blob too small = silence; don't bother sending
      return;
    }
    await processTurn(blob);
  };

  const STATE_LABELS = {
    idle:       'Tap mic to speak',
    recording:  'Recording — tap again to stop',
    processing: 'Thinking...',
    speaking:   'Alex is speaking',
  };

  return (
    <div className="chat-screen">
      {/* Header bar */}
      <header className="chat-header">
        <div className="chat-header-left">
          <span className="chat-logo">🎙️</span>
          <div className="chat-meta">
            <span className="chat-title">SpeakWell</span>
            <span className="chat-topic">{topic}</span>
          </div>
        </div>

        <div className="chat-header-right">
          <div className={`status-badge ${effectiveState}`}>
            <span className="status-dot" />
            {isInitializing ? 'Connecting...' : STATE_LABELS[effectiveState]}
          </div>
          <SessionTimer timeLeft={timeLeft} totalSecs={durationSecs} />
          <button
            id="end-session-btn"
            className="btn btn-danger btn-sm"
            onClick={() => setShowEndConfirm(true)}
          >
            End
          </button>
        </div>
      </header>

      {/* Chat messages */}
      <main className="chat-messages" id="chat-messages-list">
        {isInitializing && (
          <div className="chat-initializing animate-in">
            <span className="spinner" />
            <span>Alex is warming up...</span>
          </div>
        )}

        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}

        {/* Processing indicator (AI "thinking" bubble) */}
        {appState === 'processing' && (
          <div className="bubble-wrap bubble-wrap--ai animate-in">
            <div className="bubble-avatar">A</div>
            <div className="bubble bubble--ai bubble--thinking">
              <span className="dot-pulse"><span/><span/><span/></span>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </main>

      {/* Mic permission error */}
      {micError && (
        <div className="mic-error-banner" role="alert">
          <span>🎙️</span>
          <span>{micError}</span>
        </div>
      )}

      {/* Footer toolbar */}
      <footer className="chat-footer">
        <div className="chat-footer-inner">
          <p className="chat-hint">
            {effectiveState === 'processing' && !isRecording
              ? isInitializing ? 'Alex is getting ready...' : 'Processing your speech...'
              : effectiveState === 'recording'
              ? 'Tap mic again when done speaking'
              : effectiveState === 'speaking'
              ? 'Alex is speaking — mic will re-enable when done'
              : 'Tap the mic and speak naturally'}
          </p>
          <MicButton
            appState={effectiveState}
            onPress={handleMicPress}
            onRelease={handleMicRelease}
          />
        </div>
      </footer>

      {/* Toast notification */}
      {toast && (
        <div className={`toast ${toast.type}`} role="status">
          {toast.text}
        </div>
      )}

      {/* End session confirmation */}
      {showEndConfirm && (
        <div className="modal-overlay" onClick={() => setShowEndConfirm(false)}>
          <div className="modal-box glass-card" onClick={e => e.stopPropagation()}>
            <h3>End this session?</h3>
            <p>You'll see your performance summary. Your conversation won't be saved.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowEndConfirm(false)}>
                Keep going
              </button>
              <button className="btn btn-danger" onClick={endSession}>
                End & see results
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .chat-screen {
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
          position: relative;
          z-index: 1;
        }

        /* Header */
        .chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 20px;
          background: rgba(8, 10, 26, 0.85);
          border-bottom: 1px solid var(--border-subtle);
          backdrop-filter: blur(16px);
          gap: 12px;
          flex-shrink: 0;
          flex-wrap: wrap;
        }
        .chat-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .chat-logo { font-size: 1.5rem; }
        .chat-meta {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .chat-title {
          font-weight: 700;
          font-size: 1rem;
          color: var(--text-primary);
        }
        .chat-topic {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }
        .chat-header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        /* Messages */
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 24px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          scroll-behavior: smooth;
          max-width: 820px;
          margin: 0 auto;
          width: 100%;
        }
        .chat-initializing {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text-secondary);
          font-size: 0.875rem;
          align-self: flex-start;
          padding: 12px 0;
        }

        /* Thinking bubble */
        .bubble--thinking {
          padding: 14px 18px !important;
        }
        .dot-pulse {
          display: flex;
          align-items: center;
          gap: 5px;
          height: 18px;
        }
        .dot-pulse span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--text-secondary);
          animation: dotBounce 1.2s ease-in-out infinite;
        }
        .dot-pulse span:nth-child(1) { animation-delay: 0s; }
        .dot-pulse span:nth-child(2) { animation-delay: 0.2s; }
        .dot-pulse span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dotBounce {
          0%,80%,100% { transform: translateY(0); opacity: 0.5; }
          40%          { transform: translateY(-8px); opacity: 1; }
        }

        /* Mic error */
        .mic-error-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(239,68,68,0.12);
          border-top: 1px solid rgba(239,68,68,0.25);
          padding: 10px 20px;
          color: #fca5a5;
          font-size: 0.875rem;
          flex-shrink: 0;
        }

        /* Footer */
        .chat-footer {
          background: rgba(8, 10, 26, 0.9);
          border-top: 1px solid var(--border-subtle);
          padding: 16px 24px 24px;
          flex-shrink: 0;
          backdrop-filter: blur(16px);
        }
        .chat-footer-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          max-width: 500px;
          margin: 0 auto;
        }
        .chat-hint {
          font-size: 0.8125rem;
          color: var(--text-muted);
          text-align: center;
          line-height: 1.4;
          min-height: 1.4em;
          transition: color 0.3s ease;
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(4,5,15,0.75);
          backdrop-filter: blur(8px);
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: fadeIn 0.2s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .modal-box {
          padding: 28px;
          max-width: 380px;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 14px;
          animation: fadeSlideUp 0.25s ease both;
        }
        .modal-box h3 { font-size: 1.125rem; }
        .modal-box p  { color: var(--text-secondary); font-size: 0.9rem; }
        .modal-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 4px;
        }
      `}</style>
    </div>
  );
}
