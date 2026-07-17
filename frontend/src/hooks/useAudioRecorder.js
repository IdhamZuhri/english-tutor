import { useState, useRef, useCallback } from 'react';

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

  const startRecording = useCallback(async () => {
    setMicError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
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
      ].find(m => MediaRecorder.isTypeSupported(m)) || '';

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Stop all mic tracks to release the mic indicator
        stream.getTracks().forEach((track) => track.stop());

        const mimeUsed = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeUsed });
        chunksRef.current = [];

        if (resolveRef.current) {
          resolveRef.current(blob);
          resolveRef.current = null;
        }
      };

      mediaRecorder.start(100); // collect data every 100ms
      setIsRecording(true);
      return true;

    } catch (err) {
      const isPermission = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      setMicError(
        isPermission
          ? 'Microphone access was denied. Please allow mic permissions in your browser and refresh.'
          : `Could not access microphone: ${err.message}`
      );
      return false;
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
      
      try {
        // Force the recorder to emit the final chunk of data before stopping.
        // This prevents Safari/some browsers from truncating the last few words.
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.requestData();
        }
      } catch (e) {
        console.warn('requestData failed', e);
      }
      
      mediaRecorderRef.current.stop();
    });
  }, []);

  return {
    isRecording,
    micError,
    startRecording,
    stopRecording,
  };
}
