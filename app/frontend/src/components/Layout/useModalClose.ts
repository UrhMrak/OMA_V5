import { useCallback, useEffect, useRef, useState } from 'react';

const MODAL_CLOSE_ANIMATION_MS = 200;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
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
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { closing, requestClose };
}
