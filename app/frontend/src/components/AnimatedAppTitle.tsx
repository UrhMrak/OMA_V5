import { useEffect, useMemo, useState } from 'react';

const INITIAL_TEXT = 'OMA';
const ACRONYM_LETTERS = ['O', 'M', 'A'];
const INITIAL_DELAY_MS = 1000;
const CHAR_DELAY_MS = 65;
const WORD_PAUSE_MS = 280;

function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const id = window.setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(id);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

async function typeText(
  text: string,
  signal: AbortSignal,
  onUpdate: (next: string) => void,
  currentText: string,
) {
  let result = currentText;

  for (const char of text) {
    await delay(CHAR_DELAY_MS, signal);
    result += char;
    onUpdate(result);
  }

  return result;
}

function buildTypingWords(fullTitle: string): string[] | null {
  if (!fullTitle.startsWith('Orchestra')) return null;
  return fullTitle.split(' ');
}

type AnimatedAppTitleProps = {
  title: string;
};

export default function AnimatedAppTitle({ title }: AnimatedAppTitleProps) {
  const words = useMemo(() => buildTypingWords(title), [title]);
  const [displayText, setDisplayText] = useState(words ? INITIAL_TEXT : title);

  useEffect(() => {
    if (!words) {
      setDisplayText(title);
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    setDisplayText(INITIAL_TEXT);

    async function runTypingAnimation() {
      try {
        await delay(INITIAL_DELAY_MS, signal);

        let currentText = ACRONYM_LETTERS[0];
        setDisplayText(currentText);
        currentText = await typeText(words![0].slice(1), signal, setDisplayText, currentText);
        await delay(WORD_PAUSE_MS, signal);

        for (let i = 1; i < words!.length; i++) {
          const word = words![i];
          const acronymLetter = ACRONYM_LETTERS[i];

          if (acronymLetter && word.startsWith(acronymLetter)) {
            currentText += ` ${acronymLetter}`;
            setDisplayText(currentText);
            currentText = await typeText(word.slice(1), signal, setDisplayText, currentText);
          } else {
            currentText = await typeText(` ${word}`, signal, setDisplayText, currentText);
          }

          await delay(WORD_PAUSE_MS, signal);
        }
      } catch {
        // Aborted when title changes or component unmounts.
      }
    }

    runTypingAnimation();

    return () => controller.abort();
  }, [title, words]);

  return (
    <h1 className="auth-title" aria-label={title}>
      {displayText}
    </h1>
  );
}
