import { useRef, useState } from 'react';
import { ArrowUpRight, Code2, Pause, Play, Sparkles, Users } from 'lucide-react';

export function TeamScene({ compact = false }: { compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  return (
    <div ref={ref} className={`team-scene ${compact ? 'compact' : ''} ${paused ? 'is-paused' : ''}`}
      onPointerMove={event => {
        if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const box = event.currentTarget.getBoundingClientRect();
        ref.current?.style.setProperty('--tilt-y', `${(event.clientX - box.left - box.width / 2) / 35}deg`);
        ref.current?.style.setProperty('--tilt-x', `${-(event.clientY - box.top - box.height / 2) / 40}deg`);
      }}
      onPointerLeave={() => {
        ref.current?.style.setProperty('--tilt-y', '0deg');
        ref.current?.style.setProperty('--tilt-x', '0deg');
      }}>
      <div className="scene-decoration" aria-hidden="true">
        <div className="scene-halo" />
        <div className="scene-grid" />
        <span className="scene-label">THE COLLECTIVE EFFECT</span>
        <div className="scene-stage">
          <div className="sculpture">
            <div className="sculpture-ring ring-one" />
            <div className="sculpture-ring ring-two" />
            <div className="sculpture-ring ring-three" />
            <div className="sculpture-core"><Sparkles strokeWidth={1.1} /><span>together.</span></div>
            <span className="orb orb-one" /><span className="orb orb-two" /><span className="orb orb-three" />
          </div>
        </div>
        <div className="scene-card scene-card-code">
          <span className="scene-icon"><Code2 size={21} /></span>
          <div><small>01 / THE IDEA</small><b>Санаа чинь. Дараагийн алхам.</b></div><ArrowUpRight size={17} />
        </div>
        <div className="scene-card scene-card-team">
          <div className="scene-avatars"><i>А</i><i>Т</i><i>Н</i></div>
          <div><small>02 / THE PEOPLE</small><b>Нэг зорилго. Нэг баг.</b></div><Users size={18} />
        </div>
        <div className="scene-caption"><span className="scene-dot" />CREATED TO CONNECT<span>↗</span></div>
      </div>
      <button type="button" className="scene-pause" aria-pressed={paused} onClick={() => setPaused(!paused)} aria-label={paused ? 'Анимац асаах' : 'Анимац зогсоох'}>
        {paused ? <Play size={12} /> : <Pause size={12} />}<span>{paused ? 'Асаах' : 'Түр зогсоох'}</span>
      </button>
    </div>
  );
}
