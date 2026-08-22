import { ElementType, ReactNode } from 'react';

type WaitingMessageProps = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  live?: 'polite' | 'off';
};

export default function WaitingMessage({
  children,
  className = '',
  as: Tag = 'span',
  live = 'polite',
}: WaitingMessageProps) {
  return (
    <Tag
      className={['waiting-message', className].filter(Boolean).join(' ')}
      {...(live !== 'off' ? { 'aria-live': live } : {})}
    >
      {children}
      <span className="waiting-message-dots" aria-hidden="true">
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
    </Tag>
  );
}
