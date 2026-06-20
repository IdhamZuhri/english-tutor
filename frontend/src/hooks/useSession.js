import { useState, useRef, useCallback, useEffect } from 'react';
import { sendChatTurn, fetchOpeningMessage, decodeAudioB64 } from '../services/api.js';

/**
 * Session state machine states:
 *   'idle'       — ready to record
 *   'recording'  — mic is capturing audio
 *   'processing' — waiting for API response
 *   'speaking'   — playing companion audio
 */

export function useSession({ topic, durationSecs, onSessionEnd }) {
  const [appState, setAppState] = useState('idle');
  const [messages, setMessages] = useState([]);   // [{id, role, content, corrections}]
  const [timeLeft, setTimeLeft] = useState(durationSecs);
  const [toast, setToast] = useState(null);       // { text, type }
  const [isInitializing, setIsInitializing] = useState(true);

  const audioRef = useRef(null);
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

  // Play base64 WAV audio; on end → set state to idle
  const playAudio = useCallback((b64wav, onEnd) => {
    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const url = decodeAudioB64(b64wav);
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      audioRef.current = null;
      if (onEnd) onEnd();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      audioRef.current = null;
      if (onEnd) onEnd();
    };

    setAppState('speaking');
    audio.play().catch((err) => {
      console.warn('Audio playback failed:', err);
      if (onEnd) onEnd();
    });
  }, []);

  // Browser TTS fallback
  const speakWithBrowser = useCallback((text, onEnd) => {
    if (!window.speechSynthesis) {
      if (onEnd) onEnd();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.92;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    // Prefer a natural English voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) =>
        v.lang.startsWith('en') &&
        (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Neural'))
    );
    if (preferred) utterance.voice = preferred;
    utterance.onend = () => { if (onEnd) onEnd(); };
    utterance.onerror = () => { if (onEnd) onEnd(); };
    setAppState('speaking');
    window.speechSynthesis.speak(utterance);
  }, []);

  // Deliver a companion message (text + audio)
  const deliverCompanionMessage = useCallback(
    (replyText, replyAudioB64, ttsfall) => {
      addMessage('assistant', replyText);

      const afterAudio = () => {
        if (!sessionEndedRef.current) setAppState('idle');
      };

      if (replyAudioB64) {
        playAudio(replyAudioB64, afterAudio);
      } else if (ttsfall) {
        speakWithBrowser(replyText, afterAudio);
      } else {
        afterAudio();
      }
    },
    [addMessage, playAudio, speakWithBrowser]
  );

  // End the session
  const endSession = useCallback(() => {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;

    if (timerRef.current) clearInterval(timerRef.current);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (window.speechSynthesis) window.speechSynthesis.cancel();

    onSessionEnd(historyRef.current);
  }, [onSessionEnd]);

  // Start the session countdown timer
  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          endSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [endSession]);

  // Initialize: fetch opening message
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setIsInitializing(true);
      try {
        const data = await fetchOpeningMessage(topic);
        if (cancelled) return;

        addMessage('assistant', data.reply_text);
        startTimer();

        if (data.reply_audio_b64) {
          playAudio(data.reply_audio_b64, () => {
            if (!cancelled) setAppState('idle');
          });
        } else {
          speakWithBrowser(data.reply_text, () => {
            if (!cancelled) setAppState('idle');
          });
        }
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

  // Process a turn: audioBlob → API → reply + audio
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

        // Deliver companion reply
        deliverCompanionMessage(data.reply_text, data.reply_audio_b64, data.tts_fallback);
        historyRef.current = [
          ...historyRef.current,
          { role: 'assistant', content: data.reply_text },
        ];

      } catch (err) {
        console.error('Chat turn error:', err);
        showToast(`Something went wrong: ${err.message}`, 'error');
        setAppState('idle');
      }
    },
    [topic, deliverCompanionMessage, showToast]
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
