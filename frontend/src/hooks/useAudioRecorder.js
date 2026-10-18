import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * useAudioRecorder — MediaRecorder-based push-to-talk hook.
 *
 * Usage:
 *   const { isRecording, startRecording, stopRecording, micError } = useAudioRecorder();
 *   const blob = await stopRecording(); // returns Blob or null
 */
export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [micError, setMicError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const resolveRef = useRef(null);
  const startingRef = useRef(false);
  const releaseStream = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  };

  const startRecording = useCallback(async () => {
    if (startingRef.current || mediaRecorderRef.current?.state === 'recording') return false;
    startingRef.current = true;

    setMicError(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('Recording is unavailable in this browser. Use a current browser over HTTPS or localhost.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
      streamRef.current = stream;

      chunksRef.current = [];

      // Determine the best supported MIME type
      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ].find(m => MediaRecorder.isTypeSupported?.(m)) || '';

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        setIsRecording(false);
        const mimeUsed = mediaRecorder.mimeType || chunksRef.current[0]?.type || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeUsed });
        chunksRef.current = [];
        releaseStream();
        mediaRecorderRef.current = null;

        if (resolveRef.current) {
          resolveRef.current(blob);
          resolveRef.current = null;
        }
      };
      mediaRecorder.onerror = () => {
        setMicError('Recording was interrupted. Please try again.');
        releaseStream();
        mediaRecorderRef.current = null;
        setIsRecording(false);
        resolveRef.current?.(null);
        resolveRef.current = null;
      };

      mediaRecorder.start(500); // 500ms chunks is stable
      setIsRecording(true);
      return true;

    } catch (err) {
      releaseStream();
      const isPermission = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      setMicError(
        isPermission
          ? 'Microphone access was denied. Please allow mic permissions in your browser and refresh.'
          : `Could not access microphone: ${err.message}`
      );
      return false;
    } finally {
      startingRef.current = false;
    }
  }, []);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(null);
        return;
      }

      resolveRef.current = resolve;
      setIsRecording(false);
      
      try { mediaRecorderRef.current.stop(); }
      catch {
        releaseStream();
        mediaRecorderRef.current = null;
        resolveRef.current = null;
        resolve(null);
      }
    });
  }, []);

  useEffect(() => () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    releaseStream();
  }, []);

  return {
    isRecording,
    micError,
    startRecording,
    stopRecording,
  };
}
