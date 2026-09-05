import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { computePosition, offset, flip, shift, autoUpdate } from '@floating-ui/dom';

// `title=` attributes (used everywhere before this) never fire on tap on a
// touch device — there is no hover on a phone — so every badge/score
// explanation in the app was invisible to mobile users. This replaces them:
// hover+focus opens it on desktop, a single tap toggles it on touch devices.
// Detected once globally (a device is touch-capable or it isn't; no need to
// re-detect per tooltip instance).
let isTouchDevice = false;
if (typeof window !== 'undefined') {
  window.addEventListener('touchstart', () => { isTouchDevice = true; }, { once: true, passive: true });
}

// Rendered into document.body via a portal (not inline where the trigger
// sits) so it can never be clipped by an ancestor's overflow:auto — several
// triggers live inside table.wrap's scroll container, and an inline
// absolutely-positioned tooltip would get cut off there exactly the way a
// badge inside PitchView's clip-path jersey used to (see CLAUDE.md).
export default function Tooltip({ content, children, className = '' }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false); // true once first-positioned, avoids a (0,0) flash
  const triggerRef = useRef(null);
  const bubbleRef = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }
    const trigger = triggerRef.current;
    const bubble = bubbleRef.current;
    if (!trigger || !bubble) return;
    return autoUpdate(trigger, bubble, () => {
      computePosition(trigger, bubble, {
        strategy: 'fixed',
        placement: 'top',
        middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
      }).then(({ x, y }) => {
        bubble.style.left = `${x}px`;
        bubble.style.top = `${y}px`;
        setReady(true);
      });
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (triggerRef.current?.contains(e.target) || bubbleRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!content) return children;

  return (
    <span
      ref={triggerRef}
      className={`tooltip-trigger ${className}`}
      tabIndex={0}
      aria-describedby={open ? id : undefined}
      onMouseEnter={() => !isTouchDevice && setOpen(true)}
      onMouseLeave={() => !isTouchDevice && setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={(e) => {
        if (!isTouchDevice) return;
        e.stopPropagation();
        setOpen((o) => !o);
      }}
    >
      {children}
      {open &&
        createPortal(
          <span
            role="tooltip"
            id={id}
            ref={bubbleRef}
            className="tooltip-bubble"
            style={{ position: 'fixed', top: 0, left: 0, visibility: ready ? 'visible' : 'hidden' }}
          >
            {content}
          </span>,
          document.body
        )}
    </span>
  );
}
