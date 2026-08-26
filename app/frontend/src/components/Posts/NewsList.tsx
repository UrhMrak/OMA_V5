import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PostItem } from '../../lib/types';
import { API_BASE, api, authHeaders } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { usePageReady } from '../Layout/PageTransition';
import { SkeletonCardList } from '../Layout/Skeleton';
import PdfViewerModal from './PdfViewerModal';
import AutoResizeTextarea from '../AutoResizeTextarea';
import WaitingMessage from '../WaitingMessage';

type PostAttachment = NonNullable<PostItem['attachments']>[number];

type AttachmentViewer = {
  name: string;
  objectUrl: string | null;
  error: string;
  loading: boolean;
};

const INITIAL_VISIBLE_COUNT = 3;
const POSTS_PER_LOAD = 3;
const NEWS_PREVIEW_LINES = 3;
const NEWS_TOGGLE_BTN_OVERLAP = 52;
const COLLAPSE_TRANSITION_MS = 650;
const SEEN_NEWS_STORAGE_PREFIX = 'oma-seen-news-posts';
const newPostIdsThisVisitByUser = new Map<string, Set<string>>();
const NEWS_LINK_TOKEN =
  /\[([^\]]+)\]\(\s*<?((?:https?:\/\/|www\.)[^)\s>]+)>?(?:\s+"[^"]*")?\s*\)|<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>|<((?:https?:\/\/|www\.)[^>\s]+)>|((?:https?:\/\/|www\.)[^\s<]+)/gi;

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripHtmlTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ''));
}

function toSafeHref(raw: string): string | null {
  const trimmed = decodeHtmlEntities(raw).trim();
  if (!trimmed) return null;
  const withProtocol = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function extraClosingChars(value: string, open: string, close: string): number {
  return value.split(close).length - value.split(open).length;
}

function splitTrailingPunctuation(value: string): [string, string] {
  let url = value;
  let trailing = '';

  while (url.length > 0) {
    const lastChar = url[url.length - 1];
    if ('.!;:,'.includes(lastChar)) {
      trailing = lastChar + trailing;
      url = url.slice(0, -1);
      continue;
    }
    if (lastChar === ')' && extraClosingChars(url, '(', ')') > 0) {
      trailing = lastChar + trailing;
      url = url.slice(0, -1);
      continue;
    }
    if (lastChar === ']' && extraClosingChars(url, '[', ']') > 0) {
      trailing = lastChar + trailing;
      url = url.slice(0, -1);
      continue;
    }
    if (lastChar === '>' && extraClosingChars(url, '<', '>') > 0) {
      trailing = lastChar + trailing;
      url = url.slice(0, -1);
      continue;
    }
    break;
  }

  return [url, trailing];
}

function consumeEmailLinkLabel(before: string): { textBefore: string; label: string } {
  const normalized = before.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const newlineIndex = normalized.lastIndexOf('\n');
  const previousLines = newlineIndex === -1 ? '' : normalized.slice(0, newlineIndex + 1);
  const sameLine = newlineIndex === -1 ? normalized : normalized.slice(newlineIndex + 1);
  const trimmed = sameLine.trimEnd();

  if (trimmed) {
    const sentenceMatch = trimmed.match(/^(.*[.!?])(\s+)(.+)$/);
    const label = (sentenceMatch ? sentenceMatch[3] : trimmed).trim();
    if (label && !/^(?:https?:\/\/|www\.)/i.test(label)) {
      const labelOffset = sameLine.lastIndexOf(label);
      if (labelOffset !== -1) {
        return {
          textBefore: previousLines + sameLine.slice(0, labelOffset),
          label,
        };
      }
    }
  }

  const withoutTrailingNl = previousLines.replace(/\n$/, '');
  const prevNl = withoutTrailingNl.lastIndexOf('\n');
  const prevLine = (prevNl === -1 ? withoutTrailingNl : withoutTrailingNl.slice(prevNl + 1)).trim();
  if (!prevLine || /^(?:https?:\/\/|www\.)/i.test(prevLine) || prevLine.length > 80) {
    return { textBefore: before, label: '' };
  }

  return {
    textBefore: prevNl === -1 ? '' : `${withoutTrailingNl.slice(0, prevNl + 1)}`,
    label: prevLine,
  };
}

function rewriteEmailAngleLinks(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const toMarkdown = (lead: string, rawLabel: string, url: string, takeLastSentence: boolean) => {
    const trimmed = rawLabel.trim();
    if (!trimmed || /^(?:https?:\/\/|www\.)/i.test(trimmed)) return null;
    const sentenceMatch = takeLastSentence ? trimmed.match(/^(.*[.!?])(\s+)(.+)$/) : null;
    const label = (sentenceMatch ? sentenceMatch[3] : trimmed).trim();
    const prefix = sentenceMatch ? `${sentenceMatch[1]}${sentenceMatch[2]}` : '';
    const href = toSafeHref(url);
    if (!href || !label) return null;
    return `${lead}${prefix}[${label}](${href})`;
  };

  const withNextLine = normalized.replace(
    /(^|\n)([^\n<>]+)\n[ \t]*<[ \t]*((?:https?:\/\/|www\.)[^>\s]+)[ \t]*>/g,
    (full, lead, rawLabel, url) => toMarkdown(lead, rawLabel, url, false) ?? full
  );
  return withNextLine.replace(
    /(^|\n)([^\n<>]*\S)[ \t]*<[ \t]*((?:https?:\/\/|www\.)[^>\s]+)[ \t]*>/g,
    (full, lead, rawLabel, url) => toMarkdown(lead, rawLabel, url, true) ?? full
  );
}

function renderNewsLink(key: string, href: string, label: string) {
  return (
    <a
      key={key}
      className="news-content-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label}
    </a>
  );
}

const HTML_BLOCK_TAGS = new Set([
  'p', 'div', 'br', 'tr', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'pre', 'table', 'thead', 'tbody', 'section', 'article',
]);

function htmlToNewsContent(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style') return '';
    if (tag === 'a') {
      const href = toSafeHref(el.getAttribute('href') || '');
      const label = Array.from(el.childNodes).map(walk).join('').replace(/\s+/g, ' ').trim();
      if (href && label) return `[${label}](${href})`;
      return label || href || '';
    }
    const inner = Array.from(el.childNodes).map(walk).join('');
    if (tag === 'br') return '\n';
    if (HTML_BLOCK_TAGS.has(tag)) return `${inner}\n`;
    return inner;
  }

  return walk(doc.body).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function extractHtmlLinks(html: string): Array<{ label: string; href: string }> {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return [...doc.querySelectorAll('a[href]')].flatMap((anchor) => {
    const href = toSafeHref(anchor.getAttribute('href') || '');
    const label = (anchor.textContent || '').replace(/\s+/g, ' ').trim();
    if (!href || !label) return [];
    return [{ label, href }];
  });
}

function applyHtmlLinksToPlainText(plain: string, html: string): string | null {
  const links = extractHtmlLinks(html);
  if (links.length === 0) return null;

  let result = plain;
  let searchFrom = 0;
  let applied = 0;
  for (const { label, href } of links) {
    const markdown = `[${label}](${href})`;
    const alreadyAt = result.indexOf(markdown, searchFrom);
    if (alreadyAt !== -1) {
      searchFrom = alreadyAt + markdown.length;
      applied += 1;
      continue;
    }
    const idx = result.indexOf(label, searchFrom);
    if (idx === -1) continue;
    result = `${result.slice(0, idx)}${markdown}${result.slice(idx + label.length)}`;
    searchFrom = idx + markdown.length;
    applied += 1;
  }

  return applied > 0 ? result : null;
}

function insertTextAtCursor(
  el: HTMLTextAreaElement,
  current: string,
  inserted: string,
  setValue: (value: string) => void
) {
  const start = el.selectionStart;
  const end = el.selectionEnd;
  setValue(`${current.slice(0, start)}${inserted}${current.slice(end)}`);
}

function handleNewsContentPaste(
  event: React.ClipboardEvent<HTMLTextAreaElement>,
  current: string,
  setValue: (value: string) => void
) {
  const html = event.clipboardData.getData('text/html');
  if (!html || !/<a\s[^>]*href/i.test(html)) return;

  const plain = event.clipboardData.getData('text/plain');
  const converted = (plain && applyHtmlLinksToPlainText(plain, html)) || htmlToNewsContent(html);
  if (!converted) return;

  event.preventDefault();
  insertTextAtCursor(event.currentTarget, current, converted, setValue);
}

function seenNewsStorageKey(username: string) {
  return `${SEEN_NEWS_STORAGE_PREFIX}:${username}`;
}

function getNewPostIdsThisVisit(username: string): Set<string> {
  let ids = newPostIdsThisVisitByUser.get(username);
  if (!ids) {
    ids = new Set();
    newPostIdsThisVisitByUser.set(username, ids);
  }
  return ids;
}

function readSeenNewsPostIds(username: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(seenNewsStorageKey(username));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

function writeSeenNewsPostIds(username: string, ids: Set<string>) {
  window.localStorage.setItem(seenNewsStorageKey(username), JSON.stringify([...ids]));
}

function shouldCollapsePost(post: PostItem): boolean {
  return Boolean(post.content.trim()) || (post.attachments?.length ?? 0) > 0;
}

function sameNewsPosts(left: PostItem[], right: PostItem[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((post, index) => {
    const other = right[index];
    return (
      post.id === other.id &&
      post.title === other.title &&
      post.content === other.content &&
      post.createdAtISO === other.createdAtISO &&
      JSON.stringify(post.attachments) === JSON.stringify(other.attachments)
    );
  });
}

function getTextScale(): number {
  const main = document.querySelector('main.container');
  if (!main) return 1;
  const scale = parseFloat(getComputedStyle(main).getPropertyValue('--text-scale'));
  return Number.isFinite(scale) ? scale : 1;
}

function getCollapsedContentMaxHeight(hasContent: boolean): number {
  if (!hasContent) return 0;
  return 13 * getTextScale() * 1.5 * NEWS_PREVIEW_LINES + 10 + NEWS_TOGGLE_BTN_OVERLAP;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type MusicianCollapsiblePostBodyProps = {
  post: PostItem;
  isExpanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  openLabel: string;
  closeLabel: string;
  renderContent: (text: string) => React.ReactNode;
  renderAttachments: (post: PostItem) => React.ReactNode;
};

function MusicianCollapsiblePostBody({
  post,
  isExpanded,
  onExpand,
  onCollapse,
  openLabel,
  closeLabel,
  renderContent,
  renderAttachments,
}: MusicianCollapsiblePostBodyProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const isAnimatingRef = useRef(false);
  const [isClosing, setIsClosing] = useState(false);
  const [contentMaxHeight, setContentMaxHeight] = useState<number | undefined>(() =>
    getCollapsedContentMaxHeight(Boolean(post.content.trim()))
  );
  const hasContent = Boolean(post.content.trim());

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el || prefersReducedMotion()) {
      setContentMaxHeight(undefined);
      return;
    }
    if (isAnimatingRef.current) return;

    if (isExpanded) {
      setContentMaxHeight(el.scrollHeight);
      return;
    }

    setContentMaxHeight(getCollapsedContentMaxHeight(hasContent));
  }, [isExpanded, hasContent, post.content, post.attachments]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || !isExpanded || prefersReducedMotion() || isAnimatingRef.current) return;

    const observer = new ResizeObserver(() => {
      if (isAnimatingRef.current) return;
      setContentMaxHeight(el.scrollHeight);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isExpanded]);

  function handleToggle() {
    const el = contentRef.current;
    if (!el || prefersReducedMotion()) {
      if (isExpanded) onCollapse();
      else onExpand();
      return;
    }

    const collapsedHeight = getCollapsedContentMaxHeight(hasContent);

    if (isExpanded) {
      isAnimatingRef.current = true;
      setIsClosing(true);
      const startHeight = el.scrollHeight;
      setContentMaxHeight(startHeight);
      void el.offsetHeight;

      requestAnimationFrame(() => {
        setContentMaxHeight(collapsedHeight);
      });

      let finished = false;
      const finishClose = (event?: Event) => {
        if (event) {
          const transitionEvent = event as TransitionEvent;
          if (transitionEvent.target !== el || transitionEvent.propertyName !== 'max-height') return;
        }
        if (finished) return;
        finished = true;
        el.removeEventListener('transitionend', finishClose);
        window.clearTimeout(fallbackTimer);
        isAnimatingRef.current = false;
        setIsClosing(false);
        onCollapse();
        setContentMaxHeight(collapsedHeight);
      };

      el.addEventListener('transitionend', finishClose);
      const fallbackTimer = window.setTimeout(() => finishClose(), COLLAPSE_TRANSITION_MS + 50);
      return;
    }

    isAnimatingRef.current = true;
    onExpand();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const expandedEl = contentRef.current;
        if (!expandedEl) {
          isAnimatingRef.current = false;
          return;
        }

        const targetHeight = expandedEl.scrollHeight;
        setContentMaxHeight(collapsedHeight);
        void expandedEl.offsetHeight;

        requestAnimationFrame(() => {
          setContentMaxHeight(targetHeight);
        });

        let finished = false;
        const finishOpen = (event?: Event) => {
          if (event) {
            const transitionEvent = event as TransitionEvent;
            if (transitionEvent.target !== expandedEl || transitionEvent.propertyName !== 'max-height') {
              return;
            }
          }
          if (finished) return;
          finished = true;
          expandedEl.removeEventListener('transitionend', finishOpen);
          window.clearTimeout(fallbackTimer);
          isAnimatingRef.current = false;
          setContentMaxHeight(expandedEl.scrollHeight);
        };

        expandedEl.addEventListener('transitionend', finishOpen);
        const fallbackTimer = window.setTimeout(() => finishOpen(), COLLAPSE_TRANSITION_MS + 50);
      });
    });
  }

  return (
    <div
      className={`news-post-collapsible${isExpanded ? ' is-expanded' : ''}${isClosing ? ' is-closing' : ''}`}
    >
      <div
        ref={contentRef}
        className="news-post-collapsible-content"
        style={contentMaxHeight !== undefined ? { maxHeight: `${contentMaxHeight}px` } : undefined}
      >
        {hasContent && <p className="news-content">{renderContent(post.content)}</p>}
        <div className="news-post-attachments-wrap">{renderAttachments(post)}</div>
      </div>
      <button
        type="button"
        className="btn news-toggle-btn"
        aria-expanded={isExpanded}
        onClick={handleToggle}
      >
        {isExpanded ? closeLabel : openLabel}
      </button>
    </div>
  );
}

function SaveProgressBar({
  visible,
  progress,
  processing,
  processingLabel,
}: {
  visible: boolean;
  progress: number;
  processing: boolean;
  processingLabel: string;
}) {
  if (!visible) return null;
  return (
    <div className="upload-progress">
      <div className="upload-progress-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="upload-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <span className="upload-progress-label">
        {processing ? (
          <WaitingMessage as="span" live="off">
            {processingLabel}
          </WaitingMessage>
        ) : (
          `${progress}%`
        )}
      </span>
    </div>
  );
}

export default function NewsList() {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);
  const [viewer, setViewer] = useState<AttachmentViewer | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editFiles, setEditFiles] = useState<File[]>([]);
  const [editRemovedAttachmentIds, setEditRemovedAttachmentIds] = useState<string[]>([]);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveProcessing, setSaveProcessing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(() => new Set());
  const objectUrlRef = useRef<string | null>(null);
  const loadMoreRef = useRef<HTMLButtonElement | null>(null);
  const loadMoreInViewRef = useRef(false);
  const seenNewsIdsRef = useRef<Set<string> | null>(null);
  const { role, username } = useAuth();
  const isAdmin = role === 'admin' || username === 'admin';
  const isMusician = !isAdmin && (role === 'user' || username === 'musician');
  const [newPostIds, setNewPostIds] = useState<Set<string>>(() => new Set());
  const { t } = useLanguage();

  usePageReady(true);

  function revokeObjectUrl() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  useEffect(() => () => revokeObjectUrl(), []);

  async function fetchAttachmentBlob(attachment: PostAttachment): Promise<Blob> {
    const response = await fetch(`${API_BASE}${attachment.downloadUrl}`, {
      headers: authHeaders(),
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || t('news.loadFileFailed'));
    }
    return response.blob();
  }

  function triggerBlobDownload(objectUrl: string, fileName: string) {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function openAttachment(attachment: PostAttachment) {
    if (!attachment.downloadUrl) return;
    const isPdf = attachment.mimeType === 'application/pdf';

    if (!isPdf) {
      try {
        const blob = await fetchAttachmentBlob(attachment);
        const objectUrl = URL.createObjectURL(blob);
        triggerBlobDownload(objectUrl, attachment.name);
        URL.revokeObjectURL(objectUrl);
      } catch (error) {
        alert(error instanceof Error ? error.message : t('news.downloadFileFailed'));
      }
      return;
    }

    revokeObjectUrl();
    setViewer({ name: attachment.name, objectUrl: null, error: '', loading: true });
    try {
      const blob = await fetchAttachmentBlob(attachment);
      const objectUrl = URL.createObjectURL(blob);
      objectUrlRef.current = objectUrl;
      setViewer({ name: attachment.name, objectUrl, error: '', loading: false });
    } catch (error) {
      setViewer({
        name: attachment.name,
        objectUrl: null,
        error: error instanceof Error ? error.message : t('news.loadPdfFailed'),
        loading: false,
      });
    }
  }

  function closeViewer() {
    revokeObjectUrl();
    setViewer(null);
  }

  function downloadCurrentAttachment() {
    if (!viewer?.objectUrl) return;
    triggerBlobDownload(viewer.objectUrl, viewer.name);
  }

  function renderContent(text: string) {
    const nodes: React.ReactNode[] = [];
    const source = rewriteEmailAngleLinks(text);
    const pattern = new RegExp(NEWS_LINK_TOKEN.source, 'gi');
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = pattern.exec(source)) !== null) {
      const markdownLabel = match[1];
      const markdownUrl = match[2];
      const htmlHref = match[3];
      const htmlInner = match[4];
      const angleUrl = match[5];
      const bareUrl = match[6];

      let before = source.slice(lastIndex, match.index);
      let emailLabel = '';
      if (angleUrl) {
        const split = consumeEmailLinkLabel(before);
        before = split.textBefore;
        emailLabel = split.label;
      }

      if (before) {
        nodes.push(<span key={`text-${key++}`}>{before}</span>);
      }

      if (markdownLabel != null && markdownUrl != null) {
        const href = toSafeHref(markdownUrl);
        nodes.push(
          href
            ? renderNewsLink(`link-${key++}`, href, markdownLabel)
            : <span key={`text-${key++}`}>{match[0]}</span>
        );
      } else if (htmlHref != null && htmlInner != null) {
        const href = toSafeHref(htmlHref);
        const label = stripHtmlTags(htmlInner) || href || match[0];
        nodes.push(
          href
            ? renderNewsLink(`link-${key++}`, href, label)
            : <span key={`text-${key++}`}>{label}</span>
        );
      } else if (angleUrl) {
        const href = toSafeHref(angleUrl);
        const label = emailLabel || angleUrl;
        nodes.push(
          href
            ? renderNewsLink(`link-${key++}`, href, label)
            : <span key={`text-${key++}`}>{emailLabel ? `${emailLabel} ${match[0]}` : match[0]}</span>
        );
      } else if (bareUrl) {
        const [url, trailing] = splitTrailingPunctuation(bareUrl);
        const href = toSafeHref(url);
        if (href) {
          nodes.push(renderNewsLink(`link-${key++}`, href, url));
          if (trailing) nodes.push(<span key={`text-${key++}`}>{trailing}</span>);
        } else {
          nodes.push(<span key={`text-${key++}`}>{match[0]}</span>);
        }
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < source.length) {
      nodes.push(<span key={`text-${key++}`}>{source.slice(lastIndex)}</span>);
    }

    return nodes;
  }

  async function refresh() {
    try {
      const data = await api.get<PostItem[]>('/api/posts');
      setPosts((prev) => (sameNewsPosts(prev, data) ? prev : data));
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    refresh();
    const intervalId = window.setInterval(() => {
      refresh();
    }, 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    seenNewsIdsRef.current = null;
  }, [username]);

  useEffect(() => {
    if (!isMusician || !username || !loaded) return;

    if (!seenNewsIdsRef.current) {
      seenNewsIdsRef.current = readSeenNewsPostIds(username);
    }
    const seen = seenNewsIdsRef.current;
    const shownNew = getNewPostIdsThisVisit(username);
    let persisted = false;

    for (const post of posts.slice(0, visibleCount)) {
      if (shownNew.has(post.id) || seen.has(post.id)) continue;
      shownNew.add(post.id);
      seen.add(post.id);
      persisted = true;
    }

    setNewPostIds((prev) => {
      if (prev.size === shownNew.size && [...shownNew].every((id) => prev.has(id))) {
        return prev;
      }
      return new Set(shownNew);
    });
    if (persisted) writeSeenNewsPostIds(username, seen);
  }, [isMusician, username, loaded, posts, visibleCount]);

  useEffect(() => {
    loadMoreInViewRef.current = false;
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  }, [posts]);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => {
      if (prev >= posts.length) return prev;
      return Math.min(prev + POSTS_PER_LOAD, posts.length);
    });
  }, [posts.length]);

  useEffect(() => {
    const button = loadMoreRef.current;
    if (!button || visibleCount >= posts.length) return;

    function onScroll() {
      const rect = button.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;

      if (inView && !loadMoreInViewRef.current) {
        loadMore();
      }

      loadMoreInViewRef.current = inView;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [visibleCount, posts.length, loadMore]);

  function trackSaveProgress(percent: number) {
    setSaveProgress(percent);
    if (percent >= 100) setSaveProcessing(true);
  }

  async function uploadPostForm(url: string, form: FormData, method: 'POST' | 'PUT') {
    setSaveBusy(true);
    setSaveProgress(0);
    setSaveProcessing(false);
    try {
      if (method === 'POST') {
        await api.uploadWithProgress(url, form, trackSaveProgress);
      } else {
        await api.uploadPutWithProgress(url, form, trackSaveProgress);
      }
    } finally {
      setSaveBusy(false);
      setSaveProgress(0);
      setSaveProcessing(false);
    }
  }

  async function addPost() {
    if (!title.trim() || saveBusy) return;
    const form = new FormData();
    form.append('title', title.trim());
    form.append('content', content.trim());
    files.forEach((file) => form.append('attachments', file, file.name));

    await uploadPostForm('/api/posts', form, 'POST');
    setTitle('');
    setContent('');
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    refresh();
  }

  async function remove(id: string) {
    setDeletingId(id);
    try {
      await api.delete(`/api/posts/${id}`);
      if (editingId === id) cancelEdit();
      await refresh();
    } catch {
      setDeletingId(null);
    }
  }

  function startEdit(post: PostItem) {
    setEditingId(post.id);
    setEditTitle(post.title);
    setEditContent(post.content);
    setEditFiles([]);
    setEditRemovedAttachmentIds([]);
    if (editFileInputRef.current) editFileInputRef.current.value = '';
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle('');
    setEditContent('');
    setEditFiles([]);
    setEditRemovedAttachmentIds([]);
    if (editFileInputRef.current) editFileInputRef.current.value = '';
  }

  function toggleRemovedAttachment(attachmentId: string) {
    setEditRemovedAttachmentIds((prev) =>
      prev.includes(attachmentId)
        ? prev.filter((id) => id !== attachmentId)
        : [...prev, attachmentId]
    );
  }

  async function saveEdit() {
    if (!editingId || !editTitle.trim() || saveBusy) return;
    const form = new FormData();
    form.append('title', editTitle.trim());
    form.append('content', editContent.trim());
    if (editRemovedAttachmentIds.length > 0) {
      form.append('removedAttachmentIds', JSON.stringify(editRemovedAttachmentIds));
    }
    editFiles.forEach((file) => form.append('attachments', file, file.name));

    await uploadPostForm(`/api/posts/${editingId}`, form, 'PUT');
    cancelEdit();
    refresh();
  }

  function renderAttachments(post: PostItem) {
    if (!post.attachments || post.attachments.length === 0) return null;
    return (
      <div className="news-attachments">
        <div className="muted small">{t('news.attachments')}</div>
        <ul>
          {post.attachments.map((attachment) => (
            <li key={attachment.id}>
              <span className="news-attachment-dot" aria-hidden="true" />
              <button
                type="button"
                className="news-attachment-link"
                onClick={() => openAttachment(attachment)}
                disabled={!attachment.downloadUrl}
              >
                {attachment.name} ({Math.max(1, Math.round(attachment.size / 1024))} KB)
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  function expandPost(id: string) {
    setExpandedPostIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  function collapsePost(id: string) {
    setExpandedPostIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function renderPostBody(post: PostItem) {
    if (isAdmin || !shouldCollapsePost(post)) {
      return (
        <>
          {post.content.trim() && <p className="news-content">{renderContent(post.content)}</p>}
          {renderAttachments(post)}
        </>
      );
    }

    const isExpanded = expandedPostIds.has(post.id);

    return (
      <MusicianCollapsiblePostBody
        post={post}
        isExpanded={isExpanded}
        onExpand={() => expandPost(post.id)}
        onCollapse={() => collapsePost(post.id)}
        openLabel={t('news.open')}
        closeLabel={t('news.close')}
        renderContent={renderContent}
        renderAttachments={renderAttachments}
      />
    );
  }

  function renderEditAttachments(post: PostItem) {
    const visibleAttachments = (post.attachments || []).filter(
      (attachment) => !editRemovedAttachmentIds.includes(attachment.id)
    );

    return (
      <>
        {visibleAttachments.length > 0 && (
          <div className="news-attachments">
            <div className="muted small">{t('news.attachments')}</div>
            <ul>
              {visibleAttachments.map((attachment) => (
                <li key={attachment.id}>
                  <span className="news-attachment-dot" aria-hidden="true" />
                  <span>{attachment.name}</span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => toggleRemovedAttachment(attachment.id)}
                  >
                    {t('news.removeAttachment')}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <input
          ref={editFileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx"
          onChange={(e) => setEditFiles(Array.from(e.target.files || []))}
        />
        {editFiles.length > 0 && (
          <ul className="muted small">
            {editFiles.map((file) => (
              <li key={file.name}>{file.name}</li>
            ))}
          </ul>
        )}
      </>
    );
  }

  return (
    <div>
      {isAdmin && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="row-gap">
            <AutoResizeTextarea
              className="textarea"
              placeholder={t('news.titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <AutoResizeTextarea
              className="textarea"
              placeholder={t('news.contentPlaceholder')}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onPaste={(e) => handleNewsContentPaste(e, content, setContent)}
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
            {files.length > 0 && (
              <ul className="muted small">
                {files.map((file) => (
                  <li key={file.name}>{file.name}</li>
                ))}
              </ul>
            )}
            <SaveProgressBar
              visible={saveBusy && editingId === null}
              progress={saveProgress}
              processing={saveProcessing}
              processingLabel={t('library.uploadProcessing')}
            />
            <button className="btn primary" onClick={addPost} disabled={saveBusy}>
              {t('news.post')}
            </button>
          </div>
        </div>
      )}
      {!loaded ? (
        <SkeletonCardList count={3} />
      ) : (
      <ul className="card-list">
        {posts.slice(0, visibleCount).map((p) => (
          <li
            key={p.id}
            className={`card${isMusician && newPostIds.has(p.id) ? ' news-post-card--new' : ''}`}
          >
            {isMusician && newPostIds.has(p.id) && (
              <span className="news-new-badge">{t('news.new')}</span>
            )}
            {editingId === p.id ? (
              <div className="row-gap">
                <div className="news-admin-actions">
                  <button className="btn primary" type="button" onClick={saveEdit} disabled={saveBusy}>
                    {t('news.save')}
                  </button>
                  <button className="btn" type="button" onClick={cancelEdit} disabled={saveBusy}>
                    {t('news.cancel')}
                  </button>
                </div>
                <SaveProgressBar
                  visible={saveBusy && editingId === p.id}
                  progress={saveProgress}
                  processing={saveProcessing}
                  processingLabel={t('library.uploadProcessing')}
                />
                <AutoResizeTextarea
                  className="textarea"
                  placeholder={t('news.titlePlaceholder')}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
                <AutoResizeTextarea
                  className="textarea"
                  placeholder={t('news.contentPlaceholder')}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onPaste={(e) => handleNewsContentPaste(e, editContent, setEditContent)}
                />
                {renderEditAttachments(p)}
              </div>
            ) : (
              <>
                <div className="news-post-header">
                  <div>
                    <div className="card-title">{p.title}</div>
                    <div className="muted small">{new Date(p.createdAtISO).toLocaleString()}</div>
                  </div>
                  {isAdmin && (
                    <div className="news-admin-actions">
                      <button className="btn" type="button" onClick={() => startEdit(p)} disabled={deletingId === p.id}>
                        {t('news.edit')}
                      </button>
                      <button
                        className="btn danger"
                        type="button"
                        onClick={() => remove(p.id)}
                        disabled={deletingId === p.id}
                      >
                        {deletingId === p.id ? (
                          <WaitingMessage as="span" live="off">
                            {t('news.deleting')}
                          </WaitingMessage>
                        ) : (
                          t('news.delete')
                        )}
                      </button>
                    </div>
                  )}
                </div>
                {renderPostBody(p)}
              </>
            )}
          </li>
        ))}
      </ul>
      )}
      {loaded && visibleCount < posts.length && (
        <button
          ref={loadMoreRef}
          type="button"
          className="btn news-load-more"
          onClick={loadMore}
        >
          {t('news.loadMore')}
        </button>
      )}
      {viewer && (
        <PdfViewerModal
          name={viewer.name}
          objectUrl={viewer.objectUrl}
          error={viewer.error}
          loading={viewer.loading}
          onClose={closeViewer}
          onDownload={downloadCurrentAttachment}
        />
      )}
    </div>
  );
}
