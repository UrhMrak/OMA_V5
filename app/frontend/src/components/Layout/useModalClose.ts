import { useCallback, useEffect, useRef, useState } from 'react';

const MODAL_CLOSE_ANIMATION_MS = 200;
const MODAL_OPEN_CLASS = 'modal-open';
const SCROLLABLE_MODAL_SELECTOR = '.modal-body, .pdf-modal-body';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

let scrollLockCount = 0;

function isInsideScrollableModal(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(SCROLLABLE_MODAL_SELECTOR));
}

function preventBackgroundScroll(event: WheelEvent | TouchEvent) {
  if (isInsideScrollableModal(event.target)) return;
  event.preventDefault();
}

function lockBodyScroll() {
  scrollLockCount += 1;
  if (scrollLockCount !== 1) return;

  document.documentElement.classList.add(MODAL_OPEN_CLASS);
  document.body.classList.add(MODAL_OPEN_CLASS);
  document.addEventListener('wheel', preventBackgroundScroll, { passive: false });
  document.addEventListener('touchmove', preventBackgroundScroll, { passive: false });
}

function unlockBodyScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount !== 0) return;

  document.documentElement.classList.remove(MODAL_OPEN_CLASS);
  document.body.classList.remove(MODAL_OPEN_CLASS);
  document.removeEventListener('wheel', preventBackgroundScroll);
  document.removeEventListener('touchmove', preventBackgroundScroll);
}

export function useModalClose(onClose: () => void) {
  const [closing, setClosing] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const requestClose = useCallback(() => {
    if (prefersReducedMotion()) {
      onClose();
      return;
    }
    setClosing((prev) => {
      if (prev) return prev;
      timeoutRef.current = window.setTimeout(onClose, MODAL_CLOSE_ANIMATION_MS);
      return true;
    });
  }, [onClose]);

  useEffect(() => {
    lockBodyScroll();
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      unlockBodyScroll();
    };
  }, []);

  return { closing, requestClose };
}
