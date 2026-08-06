'use client';

import { useEffect, useState } from 'react';

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
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(1);
  const [themeIndex, setThemeIndex] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const savedActive = window.localStorage.getItem('smarttech.presentation.active') === 'true';
    const savedZoom = Number(window.localStorage.getItem('smarttech.presentation.zoom'));
    const savedTheme = Number(window.localStorage.getItem('smarttech.presentation.theme'));
    setActive(savedActive);
    setZoomIndex(Number.isInteger(savedZoom) && savedZoom >= 0 && savedZoom < ZOOM_LEVELS.length ? savedZoom : 1);
    setThemeIndex(Number.isInteger(savedTheme) && savedTheme >= 0 && savedTheme < THEMES.length ? savedTheme : 0);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const theme = THEMES[themeIndex];
    const root = document.documentElement;
    root.dataset.presentationMode = active ? 'true' : 'false';
    root.dataset.presentationTheme = theme.name.toLowerCase();
    root.style.setProperty('--presentation-accent', theme.accent);
    root.style.setProperty('--presentation-soft', theme.soft);
    root.style.setProperty('--presentation-glow', theme.glow);
    root.style.setProperty('--presentation-zoom', String(ZOOM_LEVELS[zoomIndex]));
    window.localStorage.setItem('smarttech.presentation.active', String(active));
    window.localStorage.setItem('smarttech.presentation.zoom', String(zoomIndex));
    window.localStorage.setItem('smarttech.presentation.theme', String(themeIndex));
  }, [active, mounted, themeIndex, zoomIndex]);

  useEffect(() => {
    if (!mounted) return;
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
  }, [active, mounted]);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  };

  if (!mounted) return null;

  return (
    <div className={`presentation-control ${active ? 'presentation-control-active' : ''}`}>
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

      <div className="presentation-actions">
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
