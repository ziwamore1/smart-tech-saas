'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

interface ExamTimerProps {
  durationMinutes: number;
  onTimeUp?: () => void;
  autoStart?: boolean;
}

export default function ExamTimer({ durationMinutes, onTimeUp, autoStart = false }: ExamTimerProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(durationMinutes * 60);
  const [running, setRunning] = useState(autoStart);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const onTimeUpRef = useRef(onTimeUp);

  onTimeUpRef.current = onTimeUp;

  useEffect(() => {
    if (running && secondsRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            setRunning(false);
            onTimeUpRef.current?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const hours = Math.floor(secondsRemaining / 3600);
  const minutes = Math.floor((secondsRemaining % 3600) / 60);
  const secs = secondsRemaining % 60;
  const totalMinutes = durationMinutes;
  const elapsed = totalMinutes * 60 - secondsRemaining;
  const pct = (elapsed / (totalMinutes * 60)) * 100;

  const urgent = secondsRemaining < 300;
  const warning = secondsRemaining < 600 && !urgent;

  const format = (n: number) => n.toString().padStart(2, '0');

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '16px',
      padding: '12px 20px', borderRadius: '12px',
      background: urgent ? '#fef2f2' : warning ? '#fffbeb' : '#f0fdf4',
      border: `1px solid ${urgent ? '#fecaca' : warning ? '#fde68a' : '#bbf7d0'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
        <i className={`fa fa-clock ${urgent ? 'fa-bounce' : ''}`}
          style={{ fontSize: '20px', color: urgent ? '#dc2626' : warning ? '#d97706' : '#16a34a' }} />
        <div>
          <div style={{ fontSize: '24px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: urgent ? '#dc2626' : warning ? '#d97706' : '#16a34a' }}>
            {hours > 0 ? `${format(hours)}:` : ''}{format(minutes)}:{format(secs)}
          </div>
          <div style={{ fontSize: '11px', color: urgent ? '#ef4444' : warning ? '#d97706' : '#16a34a', fontWeight: 500 }}>
            {urgent ? 'Time is almost up!' : warning ? 'Less than 10 minutes' : `${durationMinutes} minute${durationMinutes > 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      <div style={{ width: '120px', height: '6px', background: '#e8ddd0', borderRadius: '999px', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{
          height: '100%', borderRadius: '999px', transition: 'width 1s linear',
          background: urgent ? '#dc2626' : warning ? '#d97706' : '#16a34a',
          width: `${Math.min(100, pct)}%`,
        }} />
      </div>

      <button onClick={() => setRunning(r => !r)}
        style={{
          padding: '8px 16px', border: 'none', borderRadius: '8px',
          background: running ? '#f3f4f6' : '#ea6645', color: running ? '#374151' : 'white',
          cursor: 'pointer', fontWeight: 600, fontSize: '13px', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
        <i className={`fa ${running ? 'fa-pause' : 'fa-play'}`} />
        {running ? 'Pause' : 'Start'}
      </button>

      <button onClick={() => { setSecondsRemaining(durationMinutes * 60); setRunning(false); }}
        style={{ padding: '8px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9', cursor: 'pointer', color: '#6b7280', fontSize: '13px', flexShrink: 0 }}>
        <i className="fa fa-redo" />
      </button>
    </div>
  );
}
