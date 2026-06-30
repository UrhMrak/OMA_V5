import { TextareaHTMLAttributes, useEffect, useRef } from 'react';

function resizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

type AutoResizeTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export default function AutoResizeTextarea({
  value,
  onChange,
  onInput,
  style,
  ...rest
}: AutoResizeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    resizeTextarea(ref.current);
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      style={{ overflow: 'hidden', resize: 'none', ...style }}
      onChange={onChange}
      onInput={(e) => {
        resizeTextarea(e.currentTarget);
        onInput?.(e);
      }}
      {...rest}
    />
  );
}
