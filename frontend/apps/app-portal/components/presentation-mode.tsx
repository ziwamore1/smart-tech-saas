'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useIsDirector } from '@/lib/auth-context';

type PresentationTheme = {
  name: string;
  accent: string;
  soft: string;
  glow: string;
};

const THEMES: PresentationTheme[] = [
  { name: 'Ember', accent: '#ea6645', soft: '#fff1ec', glow: 'rgba(234, 102, 69, 0.2)' },
  { name: 'Ocean', accent: '#1687a7', soft: '#e9f8fc', glow: 'rgba(22, 135, 167, 0.2)' },
  { name: 'Emerald', accent: '#059669', soft: '#e9fbf3', glow: 'rgba(5, 150, 105, 0.2)' },
  { name: 'Violet', accent: '#7c3aed', soft: '#f2edff', glow: 'rgba(124, 58, 237, 0.2)' },
  { name: 'Sun', accent: '#d97706', soft: '#fff8e8', glow: 'rgba(217, 119, 6, 0.2)' },
];

const ZOOM_LEVELS = [1, 1.15, 1.2, 1.3, 1.5];

export function PresentationMode() {
  const isDirector = useIsDirector();
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [active, setActive] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(1);
  const [themeIndex, setThemeIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 24, y: 24 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const controlRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedActive = window.localStorage.getItem('smarttech.presentation.active') === 'true';
    const savedZoom = Number(window.localStorage.getItem('smarttech.presentation.zoom'));
    const savedTheme = Number(window.localStorage.getItem('smarttech.presentation.theme'));
    const savedPosX = Number(window.localStorage.getItem('smarttech.presentation.posX'));
    const savedPosY = Number(window.localStorage.getItem('smarttech.presentation.posY'));
    setActive(savedActive);
    setZoomIndex(Number.isInteger(savedZoom) && savedZoom >= 0 && savedZoom < ZOOM_LEVELS.length ? savedZoom : 1);
    setThemeIndex(Number.isInteger(savedTheme) && savedTheme >= 0 && savedTheme < THEMES.length ? savedTheme : 0);
    if (Number.isFinite(savedPosX) && Number.isFinite(savedPosY)) {
      setPos({ x: savedPosX, y: savedPosY });
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 769px) and (hover: hover) and (pointer: fine)');
    const update = () => setIsDesktop(mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener('change', update);
    else mq.addListener?.(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', update);
      else mq.removeListener?.(update);
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (!isDirector || !isDesktop) {
      root.dataset.presentationMode = 'false';
      return;
    }
    const theme = THEMES[themeIndex];
    root.dataset.presentationMode = active ? 'true' : 'false';
    root.dataset.presentationTheme = theme.name.toLowerCase();
    root.style.setProperty('--presentation-accent', theme.accent);
    root.style.setProperty('--presentation-soft', theme.soft);
    root.style.setProperty('--presentation-glow', theme.glow);
    root.style.setProperty('--presentation-zoom', String(ZOOM_LEVELS[zoomIndex]));
    window.localStorage.setItem('smarttech.presentation.active', String(active));
    window.localStorage.setItem('smarttech.presentation.zoom', String(zoomIndex));
    window.localStorage.setItem('smarttech.presentation.theme', String(themeIndex));
  }, [active, mounted, themeIndex, zoomIndex, isDirector, isDesktop]);

  useEffect(() => {
    if (!mounted || !isDirector || !isDesktop) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      if (event.key.toLowerCase() === 'p') {
        event.preventDefault();
        setActive((value) => !value);
      }
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        setZoomIndex((value) => Math.min(ZOOM_LEVELS.length - 1, value + 1));
      }
      if (event.key === '-') {
        event.preventDefault();
        setZoomIndex((value) => Math.max(0, value - 1));
      }
      if (event.key === '0') {
        event.preventDefault();
        setZoomIndex(1);
      }
      if (event.key === 'Escape' && active) {
        setActive(false);
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, mounted, isDirector, isDesktop]);

  const savePos = useCallback((x: number, y: number) => {
    setPos({ x, y });
    window.localStorage.setItem('smarttech.presentation.posX', String(x));
    window.localStorage.setItem('smarttech.presentation.posY', String(y));
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, input, [role="dialog"]')) return;
    e.preventDefault();
    dragging.current = true;
    const rect = controlRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const newX = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - dragOffset.current.x));
    const newY = Math.max(0, Math.min(window.innerHeight - 50, e.clientY - dragOffset.current.y));
    savePos(newX, newY);
  }, [savePos]);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  };

  if (!mounted || !isDirector || !isDesktop) return null;

  return (
    <div
      ref={controlRef}
      className={`presentation-control ${active ? 'presentation-control-active' : ''}`}
      style={{ right: 'auto', bottom: 'auto', left: pos.x, top: pos.y, touchAction: 'none', cursor: 'grab' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {open && (
        <div className="presentation-panel" role="dialog" aria-label="Presentation controls">
          <div className="presentation-panel-heading">
            <div>
              <strong>Presentation mode</strong>
              <span>Projector-ready controls</span>
            </div>
            <button type="button" className="presentation-close" onClick={() => setOpen(false)} aria-label="Close presentation controls">×</button>
          </div>

          <div className="presentation-control-group">
            <div className="presentation-label"><span>Page scale</span><strong>{Math.round(ZOOM_LEVELS[zoomIndex] * 100)}%</strong></div>
            <div className="presentation-zoom-row">
              <button type="button" onClick={() => setZoomIndex((value) => Math.max(0, value - 1))} aria-label="Decrease page scale">−</button>
              <input
                type="range"
                min={0}
                max={ZOOM_LEVELS.length - 1}
                step={1}
                value={zoomIndex}
                onChange={(event) => setZoomIndex(Number(event.target.value))}
                aria-label="Page scale"
              />
              <button type="button" onClick={() => setZoomIndex((value) => Math.min(ZOOM_LEVELS.length - 1, value + 1))} aria-label="Increase page scale">+</button>
            </div>
          </div>

          <div className="presentation-control-group">
            <div className="presentation-label"><span>Accent color</span><strong>{THEMES[themeIndex].name}</strong></div>
            <div className="presentation-themes">
              {THEMES.map((theme, index) => (
                <button
                  key={theme.name}
                  type="button"
                  className={`presentation-theme ${themeIndex === index ? 'selected' : ''}`}
                  style={{ backgroundColor: theme.accent }}
                  onClick={() => setThemeIndex(index)}
                  aria-label={`${theme.name} accent theme`}
                  title={theme.name}
                />
              ))}
            </div>
          </div>

          <div className="presentation-shortcuts">Press <b>P</b> to toggle · <b>+</b>/<b>−</b> to zoom · <b>Esc</b> to exit</div>
        </div>
      )}

      <div className="presentation-actions" style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}>
        <button type="button" className="presentation-main-button" onClick={() => { setActive((value) => !value); setOpen(true); }}>
          <span className="presentation-spark">✦</span>
          <span>{active ? 'Exit presentation' : 'Present'}</span>
        </button>
        <button type="button" className="presentation-icon-button" onClick={() => setOpen((value) => !value)} aria-label="Open presentation controls" title="Presentation controls">⚙</button>
        {active && <button type="button" className="presentation-icon-button" onClick={toggleFullscreen} aria-label="Toggle fullscreen" title="Toggle fullscreen">⛶</button>}
      </div>
    </div>
  );
}
