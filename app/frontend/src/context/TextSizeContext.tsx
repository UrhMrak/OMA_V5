import { createContext, useContext, useEffect, useState } from 'react';

export type TextSize = 'default' | 'large' | 'extra-large';

type Ctx = {
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;
};

const STORAGE_KEY = 'oma:textSize';

const TextSizeContext = createContext<Ctx>({
  textSize: 'default',
  setTextSize: () => {},
});

function getInitialTextSize(): TextSize {
  if (typeof window === 'undefined') return 'default';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'large' || stored === 'extra-large' || stored === 'default'
      ? stored
      : 'default';
  } catch {
    return 'default';
  }
}

export function TextSizeProvider({ children }: { children: React.ReactNode }) {
  const [textSize, setTextSizeState] = useState<TextSize>(getInitialTextSize);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, textSize);
    } catch {
      // Ignore storage failures; preference still applies for this session.
    }
  }, [textSize]);

  function setTextSize(next: TextSize) {
    setTextSizeState(next);
  }

  return (
    <TextSizeContext.Provider value={{ textSize, setTextSize }}>
      {children}
    </TextSizeContext.Provider>
  );
}

export function useTextSize() {
  return useContext(TextSizeContext);
}
