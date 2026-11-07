import { useEffect, useRef, useState } from 'react';
import { useAudioRecorder } from '../hooks/useAudioRecorder.js';
import { useSession } from '../hooks/useSession.js';
import ChatBubble from './ChatBubble.jsx';
import MicButton from './MicButton.jsx';
import SessionTimer from './SessionTimer.jsx';
import VoiceLevel from './VoiceLevel.jsx';
import Icon from './Icon.jsx';
import { PERSONAS } from '../personas.js';
import { formatClock, talkShare } from '../speakingStats.js';
import './ChatScreen.css';

const LONG_TURN_SECS = 45;
const STATUS = {
  idle:       { label: 'Your turn', icon: 'mic' },
  recording:  { label: 'Listening', icon: 'mic' },
  processing: { label: 'Thinking', icon: 'spark' },
  speaking:   { label: 'Alex is speaking', icon: 'chat' },
  finished:   { label: 'Time is up', icon: 'check' },
};
const isTypingTarget = el => el && (el.closest('input, textarea, select, button, a, [contenteditable="true"]'));

export default function ChatScreen({ topic, durationSecs, focus, persona, onSessionEnd, onExit }) {
  const { isRecording, micError, stream, startRecording, stopRecording } = useAudioRecorder();
  const chatBottomRef = useRef(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [turnSecs, setTurnSecs] = useState(0);
  const turnStartRef = useRef(0);
  const spaceHeldRef = useRef(false);

  const {
    appState, messages, timeLeft, prepTimeLeft, toast, isInitializing,
    processTurn, setRecording, endSession,
  } = useSession({ topic, durationSecs, focus, persona, onSessionEnd });

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    if (!isRecording && appState === 'recording') setRecording(false);
  }, [isRecording, appState, setRecording]);
  // If the recorder stops on its own (e.g. an error), allow a fresh start.
  useEffect(() => { if (!isRecording) recordingRef.current = false; }, [isRecording]);

  // Turn timer: counts up while the mic is recording.
  useEffect(() => {
    if (!isRecording) return undefined;
    const tick = setInterval(() => setTurnSecs(Math.floor((Date.now() - turnStartRef.current) / 1000)), 250);
    return () => clearInterval(tick);
  }, [isRecording]);

  // useSession never reports 'recording' itself; the recorder does. Merge the two.
  const effectiveState = isInitializing ? 'processing' : isRecording ? 'recording' : appState;
  const status = STATUS[effectiveState] || STATUS.idle;
  const share = talkShare(messages);

  // A ref (not isRecording state) so a quick Space tap that ends before the mic
  // finishes starting still stops the recording.
  const recordingRef = useRef(false);
  const handleMicPress = async ({ viaSpace = false } = {}) => {
    if (effectiveState !== 'idle' || recordingRef.current) return;
    const success = await startRecording();
    if (!success) return;
    recordingRef.current = true;
    turnStartRef.current = Date.now();
    setTurnSecs(0);
    setRecording(true);
    if (viaSpace && !spaceHeldRef.current) handleMicRelease();
  };

  const handleMicRelease = async () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    const speakingSecs = Math.max(1, Math.round((Date.now() - turnStartRef.current) / 1000));
    setRecording(false);
    const blob = await stopRecording();
    if (!blob || blob.size < 100) return; // too small = silence; don't send
    await processTurn(blob, { speakingSecs });
  };

  // Hold Space to talk (ignored while typing or when a button has focus,
  // where Space already activates the focused control).
  const pressRef = useRef(handleMicPress);
  const releaseRef = useRef(handleMicRelease);
  pressRef.current = handleMicPress;
  releaseRef.current = handleMicRelease;
  useEffect(() => {
    const down = event => {
      if (event.code !== 'Space' || event.repeat || showEndConfirm || isTypingTarget(event.target)) return;
      event.preventDefault();
      spaceHeldRef.current = true;
      pressRef.current({ viaSpace: true });
    };
    const up = event => {
      if (event.code !== 'Space' || !spaceHeldRef.current) return;
      event.preventDefault();
      spaceHeldRef.current = false;
      releaseRef.current();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [showEndConfirm]);

  // End-session dialog: Escape closes it; focus returns to the End button.
  const endButtonRef = useRef(null);
  const closeEndConfirm = () => { setShowEndConfirm(false); endButtonRef.current?.focus(); };
  useEffect(() => {
    if (!showEndConfirm) return undefined;
    const onKey = event => { if (event.key === 'Escape') closeEndConfirm(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showEndConfirm]);

  const hint = effectiveState === 'finished'
    ? 'Time is up. Review your chat, then choose End.'
    : effectiveState === 'processing'
    ? isInitializing ? 'Alex is getting ready…' : 'Turning your speech into text…'
    : effectiveState === 'recording'
    ? turnSecs >= LONG_TURN_SECS ? 'Great flow. Finish your thought, then tap the mic so Alex can reply.' : 'Listening. Tap the mic or release Space when you finish.'
    : prepTimeLeft > 0
    ? `Take ${prepTimeLeft}s to think, then tap the mic or hold Space`
    : 'Tap the mic or hold Space to speak';

  return (
    <div className="chat-screen">
      <header className="chat-header">
        <div className="chat-header-left">
          <span className="chat-logo"><Icon name="chat" size={20} /></span>
          <div className="chat-meta">
            <span className="chat-title">{topic}</span>
            <span className="chat-topic">{PERSONAS.find(option => option.id === persona)?.label || 'Balanced'} partner{focus ? ` · Focus: ${focus}` : ''}</span>
          </div>
        </div>

        <div className="chat-header-right">
          {share.total > 0 && (
            <div className="talk-share" title="Share of words spoken in this conversation">
              <span className="talk-share-label"><b>You {share.you}%</b> · Alex {share.partner}%</span>
              <span className="talk-share-track" aria-hidden="true"><span style={{ width: `${share.you}%` }} /></span>
              <span className="sr-only">You have spoken {share.you} percent of the words so far.</span>
            </div>
          )}
          <div className={`status-badge ${effectiveState}`}>
            <Icon name={status.icon} size={13} />
            {isInitializing ? 'Connecting' : status.label}
          </div>
          <SessionTimer timeLeft={timeLeft} totalSecs={durationSecs} />
          <button id="end-session-btn" ref={endButtonRef} type="button" className="btn btn-danger btn-sm" onClick={() => setShowEndConfirm(true)} aria-haspopup="dialog">
            End
          </button>
        </div>
      </header>

      <main className="chat-messages" id="chat-messages-list">
        {isInitializing && (
          <div className="chat-initializing animate-in">
            <span className="spinner" />
            <span>Alex is warming up…</span>
          </div>
        )}

        {messages.map(msg => <ChatBubble key={msg.id} message={msg} />)}

        {appState === 'processing' && (
          <div className="bubble-wrap bubble-wrap--ai animate-in">
            <div className="bubble-avatar" aria-hidden="true">A</div>
            <div className="bubble bubble--ai bubble--thinking" role="status" aria-label="Alex is thinking">
              <span className="dot-pulse"><span /><span /><span /></span>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </main>

      {micError && (
        <div className="mic-error-banner" role="alert">
          <Icon name="alert" size={18} />
          <span>{micError}</span>
        </div>
      )}

      <footer className="chat-footer">
        <div className={`chat-footer-inner ${isRecording ? 'is-recording' : ''}`}>
          <div className="chat-live" aria-hidden={!isRecording}>
            <VoiceLevel stream={stream} active={isRecording} />
            <span className={`chat-turn-timer ${turnSecs >= LONG_TURN_SECS ? 'is-long' : ''}`}>{isRecording ? formatClock(turnSecs) : '0:00'}</span>
          </div>
          <MicButton appState={effectiveState} onPress={() => handleMicPress()} onRelease={handleMicRelease} />
          <p className="chat-hint" aria-live="polite">{hint}</p>
          <p className="chat-shortcut" aria-hidden="true"><kbd>Space</kbd> hold to talk</p>
        </div>
      </footer>

      {toast && <div className={`toast ${toast.type}`} role="status">{toast.text}</div>}

      {showEndConfirm && (
        <div className="modal-overlay" onClick={closeEndConfirm}>
          <div className="modal-box glass-card" role="dialog" aria-modal="true" aria-labelledby="end-session-title" aria-describedby="end-session-desc" onClick={e => e.stopPropagation()}>
            <h3 id="end-session-title">End this session?</h3>
            <p id="end-session-desc">You'll see your conversation summary. Any spoken replies are already saved and count toward your weekly goal.</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={closeEndConfirm} autoFocus>Keep going</button>
              <button type="button" className="btn btn-ghost modal-leave" onClick={onExit}>Leave without summary</button>
              <button type="button" className="btn btn-danger" onClick={endSession}>End & see results</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
