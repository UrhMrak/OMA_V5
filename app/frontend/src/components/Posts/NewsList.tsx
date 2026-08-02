import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PostItem } from '../../lib/types';
import { API_BASE, api, authHeaders } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { usePageReady } from '../Layout/PageTransition';
import { SkeletonCardList } from '../Layout/Skeleton';
import PdfViewerModal from './PdfViewerModal';
import AutoResizeTextarea from '../AutoResizeTextarea';

type PostAttachment = NonNullable<PostItem['attachments']>[number];

type AttachmentViewer = {
  name: string;
  objectUrl: string | null;
  error: string;
  loading: boolean;
};

const INITIAL_VISIBLE_COUNT = 3;
const POSTS_PER_LOAD = 1;
const NEWS_PREVIEW_LINES = 4;
const COLLAPSE_TRANSITION_MS = 650;

function shouldCollapsePost(post: PostItem): boolean {
  return Boolean(post.content.trim()) || (post.attachments?.length ?? 0) > 0;
}

function getTextScale(): number {
  const main = document.querySelector('main.container');
  if (!main) return 1;
  const scale = parseFloat(getComputedStyle(main).getPropertyValue('--text-scale'));
  return Number.isFinite(scale) ? scale : 1;
}

function getCollapsedContentMaxHeight(hasContent: boolean): number {
  if (!hasContent) return 0;
  return 13 * getTextScale() * 1.5 * NEWS_PREVIEW_LINES + 10;
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
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(() => new Set());
  const objectUrlRef = useRef<string | null>(null);
  const loadMoreRef = useRef<HTMLButtonElement | null>(null);
  const wasIntersectingRef = useRef<boolean | null>(null);
  const autoLoadEnabledRef = useRef(false);
  const { role, username } = useAuth();
  const isAdmin = role === 'admin' || username === 'admin';
  const { t } = useLanguage();

  usePageReady(true);

  function revokeObjectUrl() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  useEffect(() => () => revokeObjectUrl(), []);

  useEffect(() => {
    if (!viewer) {
      document.body.classList.remove('modal-open');
      return;
    }
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [viewer]);

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
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const segments = text.split(urlRegex);
    return segments.map((segment, index) => {
      if (segment.match(urlRegex)) {
        return (
          <a
            key={`link-${index}`}
            className="news-content-link"
            href={segment}
            target="_blank"
            rel="noopener noreferrer"
          >
            {segment}
          </a>
        );
      }
      return <span key={`text-${index}`}>{segment}</span>;
    });
  }

  async function refresh() {
    try {
      const data = await api.get<PostItem[]>('/api/posts');
      setPosts(data);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    wasIntersectingRef.current = null;
    autoLoadEnabledRef.current = false;
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  }, [posts]);

  useEffect(() => {
    function onScroll() {
      autoLoadEnabledRef.current = true;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => {
      if (prev >= posts.length) return prev;
      return Math.min(prev + POSTS_PER_LOAD, posts.length);
    });
  }, [posts.length]);

  useEffect(() => {
    const button = loadMoreRef.current;
    if (!button || visibleCount >= posts.length) return;

    wasIntersectingRef.current = null;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        const isIntersecting = entry.isIntersecting;
        if (wasIntersectingRef.current === null) {
          wasIntersectingRef.current = isIntersecting;
          return;
        }

        if (isIntersecting && !wasIntersectingRef.current && autoLoadEnabledRef.current) {
          loadMore();
        }

        wasIntersectingRef.current = isIntersecting;
      },
      { threshold: 0.1 }
    );

    observer.observe(button);
    return () => observer.disconnect();
  }, [visibleCount, posts.length, loadMore]);

  async function addPost() {
    if (!title.trim()) return;
    const form = new FormData();
    form.append('title', title.trim());
    form.append('content', content.trim());
    files.forEach((file) => form.append('attachments', file, file.name));

    await api.upload('/api/posts', form);
    setTitle('');
    setContent('');
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    refresh();
  }

  async function remove(id: string) {
    await api.delete(`/api/posts/${id}`);
    if (editingId === id) cancelEdit();
    refresh();
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
    if (!editingId || !editTitle.trim()) return;
    const form = new FormData();
    form.append('title', editTitle.trim());
    form.append('content', editContent.trim());
    if (editRemovedAttachmentIds.length > 0) {
      form.append('removedAttachmentIds', JSON.stringify(editRemovedAttachmentIds));
    }
    editFiles.forEach((file) => form.append('attachments', file, file.name));

    await api.uploadPut(`/api/posts/${editingId}`, form);
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
            <button className="btn primary" onClick={addPost}>{t('news.post')}</button>
          </div>
        </div>
      )}
      {!loaded ? (
        <SkeletonCardList count={3} />
      ) : (
      <ul className="card-list">
        {posts.slice(0, visibleCount).map((p) => (
          <li key={p.id} className="card">
            {editingId === p.id ? (
              <div className="row-gap">
                <div className="news-admin-actions">
                  <button className="btn primary" type="button" onClick={saveEdit}>
                    {t('news.save')}
                  </button>
                  <button className="btn" type="button" onClick={cancelEdit}>
                    {t('news.cancel')}
                  </button>
                </div>
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
                      <button className="btn" type="button" onClick={() => startEdit(p)}>
                        {t('news.edit')}
                      </button>
                      <button className="btn danger" type="button" onClick={() => remove(p.id)}>
                        {t('news.delete')}
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
