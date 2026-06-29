import {
  AnimationEvent,
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Location, useLocation } from 'react-router-dom';

type Stage = 'enter' | 'exit' | 'pending';

type PageTransitionContextValue = {
  addPending: () => void;
  removePending: () => void;
};

const PageTransitionContext = createContext<PageTransitionContextValue | null>(null);

export function usePageReady(ready: boolean) {
  const ctx = useContext(PageTransitionContext);
  useLayoutEffect(() => {
    if (!ctx || ready) return;
    ctx.addPending();
    return () => ctx.removePending();
  }, [ctx, ready]);
}

type Props = {
  children: (location: Location) => ReactNode;
};

export default function PageTransition({ children }: Props) {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [stage, setStage] = useState<Stage>('pending');
  const pendingRef = useRef(0);
  const [pendingTick, setPendingTick] = useState(0);

  const addPending = useCallback(() => {
    pendingRef.current += 1;
    setPendingTick((tick) => tick + 1);
  }, []);

  const removePending = useCallback(() => {
    pendingRef.current = Math.max(0, pendingRef.current - 1);
    setPendingTick((tick) => tick + 1);
  }, []);

  const contextValue = useMemo<PageTransitionContextValue>(
    () => ({ addPending, removePending }),
    [addPending, removePending]
  );

  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      setStage('exit');
    }
  }, [location.pathname, displayLocation.pathname]);

  useLayoutEffect(() => {
    if (stage === 'pending' && pendingRef.current === 0) {
      setStage('enter');
    }
  }, [stage, pendingTick]);

  function handleAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (stage === 'exit') {
      setDisplayLocation(location);
      setStage('pending');
    }
  }

  const className =
    stage === 'exit'
      ? 'page-anim-exit'
      : stage === 'pending'
      ? 'page-anim-pending'
      : 'page-anim-enter';

  return (
    <PageTransitionContext.Provider value={contextValue}>
      <div className={className} onAnimationEnd={handleAnimationEnd}>
        {children(displayLocation)}
      </div>
    </PageTransitionContext.Provider>
  );
}
