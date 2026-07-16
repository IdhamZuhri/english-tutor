import { useState, useRef, useCallback, useEffect } from 'react';
import { sendChatTurn, fetchOpeningMessage } from '../services/api.js';

/**
 * Session state machine states:
 *   'idle'       — ready to record
 *   'recording'  — mic is capturing audio
 *   'processing' — waiting for API response
 */

export function useSession({ topic, durationSecs, onSessionEnd }) {
  const [appState, setAppState] = useState('idle');
  const [messages, setMessages] = useState([]);   // [{id, role, content, corrections}]
  const [timeLeft, setTimeLeft] = useState(durationSecs);
  const [toast, setToast] = useState(null);       // { text, type }
  const [isInitializing, setIsInitializing] = useState(true);

  const timerRef = useRef(null);
  const sessionEndedRef = useRef(false);
  const historyRef = useRef([]);  // [{role, content}] mirror of messages for API calls

  // Show a non-blocking toast notification
  const showToast = useCallback((text, type = 'info', durationMs = 4000) => {
    setToast({ text, type });
    setTimeout(() => setToast(null), durationMs);
  }, []);

  // Add a message to the chat and history
  const addMessage = useCallback((role, content, extras = {}) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const msg = { id, role, content, ...extras };

    setMessages((prev) => [...prev, msg]);
    historyRef.current = [
      ...historyRef.current,
      { role: role === 'assistant' ? 'assistant' : 'user', content },
    ];
    return id;
  }, []);

  // End the session
  const endSession = useCallback(() => {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;

    if (timerRef.current) clearInterval(timerRef.current);

    onSessionEnd(historyRef.current);
  }, [onSessionEnd]);

  // Start the session countdown timer — pauses while recording or processing
  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      // Only count down when user is idle (not recording or waiting for API)
      setAppState((currentState) => {
        if (currentState === 'idle') {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              clearInterval(timerRef.current);
              endSession();
              return 0;
            }
            return prev - 1;
          });
        }
        return currentState; // don't change appState
      });
    }, 1000);
  }, [endSession]);

  // Initialize: fetch opening message (text only)
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setIsInitializing(true);
      try {
        const data = await fetchOpeningMessage(topic);
        if (cancelled) return;

        addMessage('assistant', data.reply_text);
        startTimer();
        setAppState('idle');
      } catch (err) {
        if (cancelled) return;
        console.error('Opening message error:', err);
        showToast('Could not reach the backend. Is it running?', 'error');
        addMessage('assistant', `Hey! I'm Alex — let's talk about ${topic}. What's on your mind?`);
        startTimer();
        setAppState('idle');
      } finally {
        if (!cancelled) setIsInitializing(false);
      }
    };

    init();
    return () => { cancelled = true; };
  }, []); // run once on mount

  // Process a turn: audioBlob → API → reply text
  const processTurn = useCallback(
    async (audioBlob) => {
      if (sessionEndedRef.current) return;
      setAppState('processing');

      try {
        const data = await sendChatTurn(audioBlob, historyRef.current, topic);

        if (data.error) {
          showToast(data.message || "I didn't catch that. Try again!", 'warning');
          setAppState('idle');
          return;
        }

        // Add user bubble with corrections
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setMessages((prev) => [
          ...prev,
          {
            id,
            role: 'user',
            content: data.transcript,
            corrections: data.corrections,
          },
        ]);
        historyRef.current = [
          ...historyRef.current,
          { role: 'user', content: data.transcript },
        ];

        // Add companion reply (text only)
        addMessage('assistant', data.reply_text);
        historyRef.current = [
          ...historyRef.current,
          { role: 'assistant', content: data.reply_text },
        ];

        setAppState('idle');

      } catch (err) {
        console.error('Chat turn error:', err);
        showToast(`Something went wrong: ${err.message}`, 'error');
        setAppState('idle');
      }
    },
    [topic, addMessage, showToast]
  );

  return {
    appState,
    messages,
    timeLeft,
    toast,
    isInitializing,
    processTurn,
    endSession,
  };
}
