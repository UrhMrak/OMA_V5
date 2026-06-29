import { useEffect, useRef, useState } from 'react';
import { PostItem } from '../../lib/types';
import { API_BASE, api, authHeaders } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { usePageReady } from '../Layout/PageTransition';
import { SkeletonCardList } from '../Layout/Skeleton';

type PostAttachment = NonNullable<PostItem['attachments']>[number];

type AttachmentViewer = {
  name: string;
  objectUrl: string | null;
  error: string;
  loading: boolean;
};

export default function NewsList() {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [viewer, setViewer] = useState<AttachmentViewer | null>(null);
  const [loaded, setLoaded] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const { role } = useAuth();

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
      throw new Error(message || 'Failed to load file.');
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
        alert(error instanceof Error ? error.message : 'Failed to download file.');
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
        error: error instanceof Error ? error.message : 'Failed to load PDF.',
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

  async function addPost() {
    if (!title.trim()) return;
    const form = new FormData();
    form.append('title', title.trim());
    form.append('content', content.trim());
    files.forEach((file) => form.append('attachments', file));

    await api.upload('/api/posts', form);
    setTitle('');
    setContent('');
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    refresh();
  }

  async function remove(id: string) {
    await api.delete(`/api/posts/${id}`);
    refresh();
  }

  return (
    <div>
      {role === 'admin' && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="row-gap">
            <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="textarea" placeholder="Write an update..." value={content} onChange={(e) => setContent(e.target.value)} />
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
            <button className="btn primary" onClick={addPost}>Post</button>
          </div>
        </div>
      )}
      {!loaded ? (
        <SkeletonCardList count={3} />
      ) : (
      <ul className="card-list">
        {posts.map((p) => (
          <li key={p.id} className="card">
            <div className="card-title">{p.title}</div>
            <div className="muted small">{new Date(p.createdAtISO).toLocaleString()}</div>
            <p className="news-content">{renderContent(p.content)}</p>
            {p.attachments && p.attachments.length > 0 && (
              <div className="news-attachments">
                <div className="muted small">Attachments</div>
                <ul>
                  {p.attachments.map((attachment) => (
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
            )}
            {role === 'admin' && (
              <button className="btn danger" onClick={() => remove(p.id)}>Delete</button>
            )}
          </li>
        ))}
      </ul>
      )}
      {viewer && (
        <div className="modal-backdrop" onClick={closeViewer}>
          <div className="modal pdf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pdf-modal-header">
              <span className="card-title pdf-modal-title">{viewer.name}</span>
              <div className="pdf-modal-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={downloadCurrentAttachment}
                  disabled={!viewer.objectUrl}
                >
                  Download
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={closeViewer}
                  aria-label="Close"
                  title="Close"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="pdf-modal-body">
              {viewer.loading && <p className="muted">Loading PDF…</p>}
              {viewer.error && <div className="error">{viewer.error}</div>}
              {viewer.objectUrl && (
                <iframe className="pdf-modal-frame" title={viewer.name} src={viewer.objectUrl} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


