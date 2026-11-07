import { useEffect, useRef } from 'react';

const BARS = 18;

/**
 * VoiceLevel — live microphone level meter.
 * Reads the recording stream with an AnalyserNode (entirely in the browser) and
 * draws bars straight to the DOM each frame, so React does not re-render 60×/s.
 * It is data, not decoration, so it keeps updating under reduced motion
 * (only the CSS easing between frames is removed).
 */
export default function VoiceLevel({ stream, active }) {
  const barsRef = useRef([]);

  useEffect(() => {
    const bars = barsRef.current;
    const reset = () => bars.forEach(bar => bar && (bar.style.transform = 'scaleY(.12)'));
    if (!stream || !active) { reset(); return undefined; }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return undefined;

    const context = new AudioCtx();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    // Voice energy sits mostly in the lower bins; spread those across the bars.
    const usable = Math.floor(data.length * 0.6);
    let frame;
    const draw = () => {
      analyser.getByteFrequencyData(data);
      for (let i = 0; i < BARS; i++) {
        const from = Math.floor((i / BARS) * usable);
        const to = Math.max(from + 1, Math.floor(((i + 1) / BARS) * usable));
        let sum = 0;
        for (let j = from; j < to; j++) sum += data[j];
        const level = Math.min(1, (sum / (to - from)) / 170);
        if (bars[i]) bars[i].style.transform = `scaleY(${Math.max(0.12, level)})`;
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(frame);
      source.disconnect();
      context.close().catch(() => {});
      reset();
    };
  }, [stream, active]);

  return (
    <div className={`voice-level ${active ? 'voice-level--active' : ''}`} aria-hidden="true">
      {Array.from({ length: BARS }, (_, i) => <span key={i} ref={el => { barsRef.current[i] = el; }} />)}
    </div>
  );
}
