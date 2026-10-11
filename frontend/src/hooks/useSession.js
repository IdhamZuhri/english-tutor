import { useState, useRef, useCallback, useEffect } from 'react';
import { sendChatTurn, fetchOpeningMessage } from '../services/api.js';

/**
 * Session state machine states:
 *   'idle'       — ready to record
 *   'recording'  — mic is capturing audio
 *   'processing' — waiting for API response
 */

export function useSession({ topic, durationSecs, focus, onSessionEnd }) {
  const [appState, setAppState] = useState('idle');
  const [messages, setMessages] = useState([]);   // [{id, role, content, corrections}]
  const [timeLeft, setTimeLeft] = useState(durationSecs);
  const [toast, setToast] = useState(null);       // { text, type }
  const [isInitializing, setIsInitializing] = useState(true);
  const [prepTimeLeft, setPrepTimeLeft] = useState(0);

  const timerRef = useRef(null);
  const sessionEndedRef = useRef(false);
  const historyRef = useRef([]);  // [{role, content}] mirror for analyze API if needed
  const messagesRef = useRef([]); // holds full messages with corrections
  const sessionIdRef = useRef(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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
    messagesRef.current.push(msg);
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

    onSessionEnd(messagesRef.current, sessionIdRef.current);
  }, [onSessionEnd]);

  // Start the session countdown timer — pauses while recording or processing
  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      // Only count down when user is idle (not recording or waiting for API)
      setPrepTimeLeft((prevPrep) => (prevPrep > 0 ? prevPrep - 1 : 0));
      setAppState((currentState) => {
        if (currentState === 'idle') {
          setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
        }
        return currentState; // don't change appState
      });
    }, 1000);
  }, [endSession]);

  // Handle time out
  useEffect(() => {
    if (timeLeft === 0 && appState === 'idle') {
      if (timerRef.current) clearInterval(timerRef.current);
      setAppState('finished');
      setPrepTimeLeft(0);
      showToast("Time's up! Review your chat, then click End to see your summary.", 'info', 6000);
    }
  }, [timeLeft, appState, showToast]);

  // Initialize: fetch opening message (text only)
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setIsInitializing(true);
      try {
        const data = await fetchOpeningMessage(topic, focus);
        if (cancelled) return;
        
        sessionIdRef.current = data.session_id;

        addMessage('assistant', data.reply_text);
        setPrepTimeLeft(20);
        startTimer();
        setAppState('idle');
      } catch (err) {
        if (cancelled) return;
        console.error('Opening message error:', err);
        showToast('Could not reach the backend. Is it running?', 'error');
        addMessage('assistant', `Hey! I'm Alex — let's talk about ${topic}. What's on your mind?`);
        setPrepTimeLeft(20);
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
        const data = await sendChatTurn(audioBlob, historyRef.current, topic, sessionIdRef.current);

        if (data.error) {
          showToast(data.message || "I didn't catch that. Try again!", 'warning');
          setAppState('idle');
          return;
        }

        // Add user bubble with corrections
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const userMsg = {
          id,
          role: 'user',
          content: data.transcript,
          corrections: data.corrections,
        };
        
        setMessages((prev) => [...prev, userMsg]);
        messagesRef.current.push(userMsg);
        
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

        setPrepTimeLeft(20);
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
    prepTimeLeft,
    toast,
    isInitializing,
    processTurn,
    endSession,
  };
}
