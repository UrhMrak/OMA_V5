import { useCallback, useEffect, useRef, useState } from 'react';
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

const INITIAL_VISIBLE_COUNT = 1;
const POSTS_PER_LOAD = 1;

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
                <p className="news-content">{renderContent(p.content)}</p>
                {renderAttachments(p)}
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
