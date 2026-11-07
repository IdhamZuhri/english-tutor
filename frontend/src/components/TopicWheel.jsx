import { useEffect, useRef, useState } from 'react';

export const WHEEL_THEMES = [
  { theme: 'everyday life', label: 'Everyday life', emoji: '☕', color: '#8b5cf6' },
  { theme: 'travel and places', label: 'Travel', emoji: '✈️', color: '#38bdf8' },
  { theme: 'technology', label: 'Technology', emoji: '💡', color: '#ec4899' },
  { theme: 'community', label: 'Community', emoji: '🤝', color: '#f59e0b' },
  { theme: 'learning', label: 'Learning', emoji: '📚', color: '#10b981' },
  { theme: 'food and culture', label: 'Food & culture', emoji: '🍜', color: '#ef4444' },
  { theme: 'work and goals', label: 'Work & goals', emoji: '🎯', color: '#6366f1' },
  { theme: 'imagination', label: 'Imagination', emoji: '🚀', color: '#14b8a6' },
];

export const SPIN_MS = 4000;
const SIZE = 320;
const C = SIZE / 2;
const R = 150;
const N = WHEEL_THEMES.length;
const STEP = 360 / N;
const LIGHTS = 24;
const IDLE_DEG_PER_MS = 0.006;
const FLICK_DEG_PER_MS = 0.25;
const norm = angle => ((angle % 360) + 360) % 360;
const point = (angle, radius) => {
  const rad = (angle - 90) * Math.PI / 180;
  return [C + radius * Math.cos(rad), C + radius * Math.sin(rad)];
};
const segmentAt = rotation => Math.floor(norm(-rotation) / STEP) % N;
const easeOut = t => 1 - Math.pow(1 - t, 4);
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function TopicWheel({ spinning, activeIndex, onSpin, disabled, hasTopic }) {
  const discRef = useRef(null);
  const pointerRef = useRef(null);
  const stageRef = useRef(null);
  const rotationRef = useRef(0);
  const segmentRef = useRef(0);
  const animRef = useRef(null);
  const dragRef = useRef(null);
  const stateRef = useRef({ spinning, activeIndex, disabled });
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [burst, setBurst] = useState(0);
  stateRef.current = { spinning, activeIndex, disabled };

  const apply = rotation => {
    rotationRef.current = rotation;
    if (discRef.current) discRef.current.style.transform = `rotate(${rotation}deg)`;
    const segment = segmentAt(rotation);
    if (segment !== segmentRef.current) {
      segmentRef.current = segment;
      pointerRef.current?.animate?.([{ transform: 'translateX(-50%) rotate(0deg)' }, { transform: 'translateX(-50%) rotate(-22deg)' }, { transform: 'translateX(-50%) rotate(0deg)' }], { duration: 140, easing: 'ease-out' });
    }
  };

  // Gentle idle drift invites a spin; it stops while a winning theme is shown.
  useEffect(() => {
    let frame;
    let last = performance.now();
    const loop = now => {
      const { spinning: busy, activeIndex: winner } = stateRef.current;
      if (!animRef.current && !dragRef.current && !busy && winner === null && !reducedMotion()) apply(rotationRef.current + (now - last) * IDLE_DEG_PER_MS);
      last = now;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(frame); if (animRef.current) cancelAnimationFrame(animRef.current.frame); };
  }, []);

  useEffect(() => { if (activeIndex !== null && !spinning) setBurst(value => value + 1); }, [activeIndex, spinning]);

  const spinTo = (index, direction = 1, energy = 1) => {
    const start = rotationRef.current;
    const jitter = (Math.random() - 0.5) * STEP * 0.6;
    const wanted = norm(-(index * STEP + STEP / 2 + jitter));
    const turns = 360 * Math.round(4 + Math.min(3, energy * 2));
    const target = direction > 0 ? start + turns + norm(wanted - start) : start - turns - norm(start - wanted);
    const duration = reducedMotion() ? 500 : SPIN_MS;
    const began = performance.now();
    const step = now => {
      const t = Math.min(1, (now - began) / duration);
      apply(start + (target - start) * easeOut(t));
      if (t < 1) animRef.current = { frame: requestAnimationFrame(step) };
      else animRef.current = null;
    };
    animRef.current = { frame: requestAnimationFrame(step) };
  };

  const launch = (direction, energy) => {
    if (stateRef.current.disabled || animRef.current) return;
    const index = Math.floor(Math.random() * N);
    spinTo(index, direction, energy);
    onSpin(index);
  };

  const angleFromEvent = event => {
    const box = stageRef.current.getBoundingClientRect();
    return Math.atan2(event.clientY - (box.top + box.height / 2), event.clientX - (box.left + box.width / 2)) * 180 / Math.PI;
  };
  const onPointerDown = event => {
    if (stateRef.current.disabled || animRef.current || event.target.closest('.topic-wheel-hub')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { angle: angleFromEvent(event), samples: [{ time: performance.now(), rotation: rotationRef.current }] };
    setDragging(true);
  };
  const onPointerMove = event => {
    const drag = dragRef.current;
    if (!drag) return;
    const angle = angleFromEvent(event);
    let delta = angle - drag.angle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    drag.angle = angle;
    apply(rotationRef.current + delta);
    const now = performance.now();
    drag.samples = [...drag.samples.filter(sample => now - sample.time < 100), { time: now, rotation: rotationRef.current }];
  };
  const onPointerUp = () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    setDragging(false);
    const first = drag.samples[0];
    const last = drag.samples[drag.samples.length - 1];
    const velocity = (last.rotation - first.rotation) / Math.max(1, last.time - first.time);
    if (Math.abs(velocity) >= FLICK_DEG_PER_MS) launch(Math.sign(velocity), Math.min(1.5, Math.abs(velocity)));
  };

  const winner = !spinning && activeIndex !== null ? activeIndex : null;
  const idle = !spinning && !dragging;
  return <div className="topic-wheel-wrap">
    <div ref={stageRef} className={`topic-wheel-stage ${spinning ? 'is-spinning' : ''} ${dragging ? 'is-dragging' : ''} ${winner !== null ? 'has-winner' : ''}`}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <span ref={pointerRef} className="topic-wheel-pointer" aria-hidden="true" />
      <svg className="topic-wheel-svg" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Topic wheel with eight themes. Drag and flick it, or press spin.">
        <defs>
          <radialGradient id="topic-wheel-shine" cx="50%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fff" stopOpacity=".28" />
            <stop offset="55%" stopColor="#fff" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity=".22" />
          </radialGradient>
        </defs>
        <circle cx={C} cy={C} r={R + 10} className="topic-wheel-rim" />
        <g ref={discRef} className="topic-wheel-disc" style={{ transformOrigin: `${C}px ${C}px` }}>
          {WHEEL_THEMES.map((item, i) => {
            const [x1, y1] = point(i * STEP, R);
            const [x2, y2] = point((i + 1) * STEP, R);
            const [tx, ty] = point(i * STEP + STEP / 2, R * 0.66);
            const mid = i * STEP + STEP / 2;
            const state = winner === i ? 'is-winner' : winner !== null ? 'is-dimmed' : idle && hovered === i ? 'is-hovered' : '';
            return <g key={item.theme} className={`topic-wheel-segment ${state}`} onPointerEnter={() => setHovered(i)} onPointerLeave={() => setHovered(current => current === i ? null : current)}>
              <g className="topic-wheel-slice">
                <path d={`M${C},${C} L${x1},${y1} A${R},${R} 0 0 1 ${x2},${y2} Z`} fill={item.color} stroke="rgba(255,255,255,.6)" strokeWidth="2" strokeLinejoin="round" />
                <g transform={`rotate(${mid} ${tx} ${ty})`}><text x={tx} y={ty} fontSize="30" textAnchor="middle" dominantBaseline="central">{item.emoji}</text></g>
              </g>
            </g>;
          })}
          <circle cx={C} cy={C} r={R} fill="url(#topic-wheel-shine)" pointerEvents="none" />
        </g>
        {Array.from({ length: LIGHTS }, (_, i) => { const [x, y] = point(i * 360 / LIGHTS, R + 10); return <circle key={i} cx={x} cy={y} r="3.6" className="topic-wheel-light" style={{ '--i': i }} />; })}
      </svg>
      <button type="button" className="topic-wheel-hub" onClick={() => launch(1, 1)} disabled={disabled} aria-label={spinning ? 'Choosing a topic' : hasTopic ? 'Spin again' : 'Spin the wheel'}>
        <span>{spinning ? '' : hasTopic ? 'AGAIN' : 'SPIN'}</span>
      </button>
      {burst > 0 && <div key={burst} className="topic-wheel-burst" aria-hidden="true">
        {Array.from({ length: 22 }, (_, i) => {
          const angle = (i / 22) * Math.PI * 2 + Math.random() * 0.3;
          const distance = 90 + Math.random() * 80;
          return <span key={i} style={{ '--dx': `${Math.cos(angle) * distance}px`, '--dy': `${Math.sin(angle) * distance}px`, '--spin': `${Math.random() * 540 - 270}deg`, background: WHEEL_THEMES[i % N].color, animationDelay: `${Math.random() * 80}ms` }} />;
        })}
      </div>}
    </div>
    <p className="topic-wheel-hint">{spinning ? 'Round and round it goes…' : idle && hovered !== null ? `${WHEEL_THEMES[hovered].emoji} ${WHEEL_THEMES[hovered].label}` : 'Tip: grab the wheel and flick it to spin.'}</p>
    <ul className="topic-wheel-legend" aria-label="Themes on the wheel">
      {WHEEL_THEMES.map((item, i) => <li key={item.theme} className={winner === i ? 'is-winner' : ''}><span className="topic-wheel-legend-dot" style={{ background: item.color }} aria-hidden="true" />{item.label}</li>)}
    </ul>
  </div>;
}
