import { useEffect, useRef, useState } from 'react';
import './AudioPlayer.css';

const BAR_COUNT = 64;
const SPEEDS = [1, 1.25, 0.75];
const formatTime = value => {
  const seconds = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
};

// Browser-recorded WebM files have no duration in their header, so the native <audio> UI reports
// a wrong/infinite length and its progress bar jumps around. Decoding the recording gives the real
// duration (and a waveform); the recorded length from the timer is used until that finishes.
async function analyse(src) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  const bytes = await (await fetch(src)).arrayBuffer();
  const context = new AudioCtx();
  try {
    const buffer = await context.decodeAudioData(bytes);
    const data = buffer.getChannelData(0);
    const size = Math.floor(data.length / BAR_COUNT) || 1;
    const peaks = Array.from({ length: BAR_COUNT }, (_, bar) => {
      let sum = 0;
      for (let i = bar * size; i < Math.min(data.length, (bar + 1) * size); i++) sum += data[i] * data[i];
      return Math.sqrt(sum / size);
    });
    const max = Math.max(...peaks) || 1;
    return { duration: buffer.duration, peaks: peaks.map(peak => Math.max(0.08, peak / max)) };
  } finally {
    context.close?.();
  }
}

export default function AudioPlayer({ src, knownDuration = 0, label = 'Recording' }) {
  const audioRef = useRef(null);
  const frameRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(knownDuration);
  const [peaks, setPeaks] = useState(null);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setPeaks(null);
    setCurrent(0);
    setPlaying(false);
    setDuration(knownDuration);
    analyse(src).then(result => {
      if (cancelled || !result) return;
      setPeaks(result.peaks);
      if (Number.isFinite(result.duration) && result.duration > 0) setDuration(result.duration);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [src, knownDuration]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  const tick = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrent(audio.currentTime);
    if (!audio.paused) frameRef.current = requestAnimationFrame(tick);
  };

  const onMetadata = () => {
    const native = audioRef.current?.duration;
    if (Number.isFinite(native) && native > 0) setDuration(value => value && Math.abs(value - native) < 0.5 ? value : Math.max(value, native));
  };

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      if (duration && audio.currentTime >= duration - 0.05) audio.currentTime = 0;
      try { await audio.play(); } catch { /* playback blocked or interrupted */ }
    } else audio.pause();
  };

  const seek = seconds => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const next = Math.min(Math.max(0, seconds), duration);
    audio.currentTime = next;
    setCurrent(next);
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const shown = Math.min(current, duration || current);
  const progress = duration ? Math.min(1, shown / duration) : 0;
  const bars = peaks || Array.from({ length: BAR_COUNT }, (_, i) => 0.25 + 0.2 * Math.abs(Math.sin(i * 1.7)) + 0.15 * Math.abs(Math.sin(i * 0.45)));

  return <div className={`audio-player ${playing ? 'is-playing' : ''}`}>
    <audio
      ref={audioRef}
      src={src}
      preload="metadata"
      onLoadedMetadata={onMetadata}
      onDurationChange={onMetadata}
      onPlay={() => { setPlaying(true); cancelAnimationFrame(frameRef.current); frameRef.current = requestAnimationFrame(tick); }}
      onPause={() => { setPlaying(false); tick(); }}
      onEnded={() => { setPlaying(false); setCurrent(duration); }}
      onSeeked={tick}
    />
    <button type="button" className="audio-player-toggle" onClick={toggle} aria-label={`${playing ? 'Pause' : 'Play'} ${label.toLowerCase()}`}>
      {playing
        ? <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>
        : <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg>}
    </button>
    <div className="audio-player-body">
      <div className="audio-player-wave" style={{ '--progress': `${progress * 100}%` }}>
        <div className="audio-player-bars" aria-hidden="true">
          {bars.map((height, index) => <span key={index} className={(index + 0.5) / bars.length <= progress ? 'played' : ''} style={{ height: `${Math.round(height * 100)}%` }} />)}
        </div>
        <input
          type="range"
          className="audio-player-range"
          min="0"
          max={duration || 0}
          step="0.01"
          value={shown}
          disabled={!duration}
          onChange={event => seek(Number(event.target.value))}
          aria-label={`Seek ${label.toLowerCase()}`}
          aria-valuetext={`${formatTime(shown)} of ${formatTime(duration)}`}
        />
      </div>
      <div className="audio-player-meta">
        <span className="audio-player-time"><strong>{formatTime(shown)}</strong> / {formatTime(duration)}</span>
        <span className="audio-player-tools">
          <button type="button" onClick={() => seek(shown - 5)} disabled={!duration} aria-label="Back 5 seconds">−5s</button>
          <button type="button" onClick={cycleSpeed} aria-label={`Playback speed ${speed}x`}>{speed}×</button>
        </span>
      </div>
    </div>
  </div>;
}
