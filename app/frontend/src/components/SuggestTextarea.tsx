import {
  ChangeEvent,
  FocusEvent,
  KeyboardEvent,
  TextareaHTMLAttributes,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AutoResizeTextarea from './AutoResizeTextarea';
import { filterSuggestions } from '../lib/eventSuggestions';

type SuggestTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  suggestions: string[];
};

export default function SuggestTextarea({
  suggestions,
  value,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  ...rest
}: SuggestTextareaProps) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const blurTimeoutRef = useRef<number>();

  const stringValue = String(value ?? '');

  const filtered = useMemo(
    () => filterSuggestions(suggestions, stringValue, stringValue),
    [suggestions, stringValue]
  );

  const showDropdown = open && filtered.length > 0;

  useEffect(() => {
    setHighlightIndex(-1);
  }, [filtered]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  function selectSuggestion(suggestion: string) {
    onChange?.({
      target: { value: suggestion },
      currentTarget: { value: suggestion },
    } as ChangeEvent<HTMLTextAreaElement>);
    setOpen(false);
  }

  function handleFocus(event: FocusEvent<HTMLTextAreaElement>) {
    setOpen(true);
    onFocus?.(event);
  }

  function handleBlur(event: FocusEvent<HTMLTextAreaElement>) {
    blurTimeoutRef.current = window.setTimeout(() => setOpen(false), 150);
    onBlur?.(event);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (showDropdown) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightIndex((index) => Math.min(index + 1, filtered.length - 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === 'Enter' && highlightIndex >= 0) {
        event.preventDefault();
        selectSuggestion(filtered[highlightIndex]);
        return;
      }
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
    }
    onKeyDown?.(event);
  }

  return (
    <div className="suggest-textarea">
      <AutoResizeTextarea
        value={value}
        autoComplete="off"
        onChange={(event) => {
          setOpen(true);
          onChange?.(event);
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        {...rest}
      />
      {showDropdown ? (
        <ul className="suggest-textarea-dropdown" role="listbox">
          {filtered.map((suggestion, index) => (
            <li
              key={suggestion}
              role="option"
              aria-selected={index === highlightIndex}
              className={index === highlightIndex ? 'active' : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectSuggestion(suggestion)}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
