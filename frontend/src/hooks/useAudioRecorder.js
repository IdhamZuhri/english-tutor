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

  const startRecording = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.warn('Already recording, ignoring startRecording call');
      return true;
    }

    setMicError(null);

    try {
      let stream = streamRef.current;
      if (!stream || stream.active === false) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100,
          },
        });
        streamRef.current = stream;
      }

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
        // DO NOT stop the stream tracks here! Keep the mic warm.
        const mimeUsed = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeUsed });
        chunksRef.current = [];

        if (resolveRef.current) {
          resolveRef.current(blob);
          resolveRef.current = null;
        }
      };

      mediaRecorder.start(500); // 500ms chunks is stable
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
      
      mediaRecorderRef.current.stop();
    });
  }, []);

  useEffect(() => () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }, []);

  return {
    isRecording,
    micError,
    startRecording,
    stopRecording,
  };
}
