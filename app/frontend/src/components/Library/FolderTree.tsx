import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { LibraryNode } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { API_BASE, api, authHeaders } from '../../lib/api';
import DeleteIcon from '../icons/DeleteIcon';

const UPLOAD_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,application/pdf,image/*';

function CreateFolderForm({ parentPath, onCreated }: { parentPath: string; onCreated: () => void }) {
  const { t } = useLanguage();
  const [folderName, setFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!folderName.trim()) return;

    setIsCreating(true);
    try {
      const fullPath = parentPath ? `${parentPath}/${folderName.trim()}` : folderName.trim();
      await api.post('/api/library/folder', { folder: fullPath });
      setFolderName('');
      setShowForm(false);
      onCreated();
    } catch (err) {
      alert(err instanceof Error ? err.message : t('library.createFailed'));
    } finally {
      setIsCreating(false);
    }
  }

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="btn btn-sm"
        style={{ marginTop: '0.5rem' }}
      >
        {t('library.createFolder')}
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginTop: '0.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'stretch',
        maxWidth: 360,
      }}
    >
      <input
        type="text"
        value={folderName}
        onChange={(e) => setFolderName(e.target.value)}
        placeholder={t('library.folderName')}
        disabled={isCreating}
        style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
        autoFocus
      />
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="submit" disabled={isCreating || !folderName.trim()} className="btn btn-sm">
          {t('library.create')}
        </button>
        <button
          type="button"
          onClick={() => {
            setShowForm(false);
            setFolderName('');
          }}
          disabled={isCreating}
          className="btn btn-sm"
        >
          {t('library.cancel')}
        </button>
      </div>
    </form>
  );
}

function RenameForm({
  node,
  onRenamed,
  onCancel,
}: {
  node: LibraryNode;
  onRenamed: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState(node.name);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!node.path || !trimmed || trimmed === node.name) {
      onCancel();
      return;
    }
    setIsSaving(true);
    try {
      await api.post('/api/library/rename', { path: node.path, newName: trimmed });
      onRenamed();
    } catch (err) {
      alert(err instanceof Error ? err.message : t('library.renameFailed'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'stretch',
        maxWidth: 360,
      }}
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('library.newName')}
        disabled={isSaving}
        style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
        autoFocus
      />
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="submit" disabled={isSaving || !name.trim()} className="btn btn-sm">
          {t('library.save')}
        </button>
        <button type="button" onClick={onCancel} disabled={isSaving} className="btn btn-sm">
          {t('library.cancel')}
        </button>
      </div>
    </form>
  );
}

function FolderIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function RenameIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function UploadButton({ folderPath, onUploaded, onSuccess }: { folderPath: string; onUploaded: () => void; onSuccess?: () => void }) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const form = new FormData();
      form.append('folder', folderPath);
      for (const f of Array.from(files)) form.append('files', f);
      await api.upload('/api/library/upload', form);
      setSuccess(t('library.uploadSuccess'));
      if (onSuccess) onSuccess();
      if (inputRef.current) inputRef.current.value = '';
      setTimeout(() => {
        onUploaded();
        setTimeout(() => setSuccess(''), 2000);
      }, 300);
    } catch (e: any) {
      const message = e?.message || t('library.uploadFailed');
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="upload-button-container">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="btn btn-sm"
        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
      >
        <UploadIcon />
        {busy ? t('library.uploading') : t('library.upload')}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={UPLOAD_ACCEPT}
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error && <div className="error" style={{ fontSize: '11px', marginTop: '4px' }}>{error}</div>}
      {success && !error && (
        <div className="small" style={{ color: '#16a34a', fontSize: '11px', marginTop: '4px' }}>{success}</div>
      )}
    </div>
  );
}

function FolderItem({
  node,
  onRefresh,
  onDownload,
  initialSegments = [],
  depth = 0,
}: {
  node: LibraryNode;
  onRefresh: () => void;
  onDownload: (file: LibraryNode) => Promise<void> | void;
  initialSegments?: string[];
  depth?: number;
}) {
  const { role } = useAuth();
  const { t } = useLanguage();
  const isAdmin = role === 'admin';
  const compact = depth > 0;
  const targetSegment = initialSegments[0];
  const shouldExpand = targetSegment === node.name;
  const [isExpanded, setIsExpanded] = useState(shouldExpand);
  const [isRenaming, setIsRenaming] = useState(false);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  useEffect(() => {
    if (shouldExpand) setIsExpanded(true);
  }, [shouldExpand]);

  const subFolders = (node.children || []).filter((c) => c.type === 'folder');
  const files = (node.children || []).filter((c) => c.type === 'file');
  const childCount = subFolders.length + files.length;
  const childSegments = shouldExpand ? initialSegments.slice(1) : [];
  const deletingThisNode = deletingPath === node.path;

  const handleDelete = useCallback(
    async (target: LibraryNode) => {
      if (!target.path) return;
      const confirmed = window.confirm(t('library.deleteConfirm', { name: target.name }));
      if (!confirmed) return;
      setDeletingPath(target.path);
      try {
        await api.delete(`/api/library/item?path=${encodeURIComponent(target.path)}`);
        await onRefresh();
      } catch (error) {
        const message = error instanceof Error && error.message ? error.message : t('library.deleteFailed');
        alert(message);
      } finally {
        setDeletingPath(null);
      }
    },
    [onRefresh, t]
  );

  return (
    <div className={`folder-item${compact ? ' compact' : ''}`}>
      <div className="folder-item-header" onClick={() => setIsExpanded(!isExpanded)}>
        <FolderIcon />
        <span className="folder-name">{node.name}</span>
        {childCount > 0 ? <span className="folder-count">({childCount})</span> : null}
        {isAdmin && node.path ? (
          <>
            <button
              type="button"
              className="icon-button rename-button"
              aria-label={t('library.renameAria', { name: node.name })}
              title={t('library.renameFolder')}
              onClick={(event) => {
                event.stopPropagation();
                setIsExpanded(true);
                setIsRenaming((prev) => !prev);
              }}
            >
              <RenameIcon />
            </button>
            <button
              type="button"
              className="icon-button delete-button"
              aria-label={t('library.deleteAria', { name: node.name })}
              onClick={(event) => {
                event.stopPropagation();
                handleDelete(node);
              }}
              disabled={deletingThisNode}
            >
              <DeleteIcon />
            </button>
          </>
        ) : null}
      </div>
      {isExpanded && (
        <div className="folder-item-content">
          {isAdmin && isRenaming ? (
            <div className="rename-section">
              <RenameForm
                node={node}
                onRenamed={() => {
                  setIsRenaming(false);
                  onRefresh();
                }}
                onCancel={() => setIsRenaming(false)}
              />
            </div>
          ) : null}
          {isAdmin && (
            <div className="upload-section">
              <UploadButton
                folderPath={node.path || ''}
                onUploaded={onRefresh}
                onSuccess={() => setIsExpanded(true)}
              />
            </div>
          )}
          {subFolders.length > 0 && (
            <div className="folder-grid">
              {subFolders.map((folder) => (
                <FolderItem
                  key={folder.path || folder.name}
                  node={folder}
                  onRefresh={onRefresh}
                  onDownload={onDownload}
                  initialSegments={childSegments}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
          {files.map((file) => (
            <div key={file.path || file.name} className="file-item-row">
              <button
                type="button"
                className="file-item file-download-button"
                onClick={() => onDownload(file)}
                disabled={Boolean(deletingPath && deletingPath === file.path)}
              >
                <FileIcon />
                {file.name}
              </button>
              {isAdmin && file.path ? (
                <button
                  type="button"
                  className="icon-button delete-button"
                  aria-label={t('library.deleteAria', { name: file.name })}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDelete(file);
                  }}
                  disabled={Boolean(deletingPath && deletingPath === file.path)}
                >
                  <DeleteIcon />
                </button>
              ) : null}
            </div>
          ))}
          {isAdmin && (
            <div className="create-folder">
              <CreateFolderForm parentPath={node.path || ''} onCreated={onRefresh} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FolderTree({ node, onRefresh, initialPath }: { node: LibraryNode; onRefresh: () => void; initialPath?: string }) {
  const { role } = useAuth();
  const { t } = useLanguage();
  const isAdmin = role === 'admin';
  const [downloadError, setDownloadError] = useState('');
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const initialSegments = useMemo(() => {
    if (!initialPath) return [] as string[];
    const cleaned = initialPath.replace(/^\/+|\/+$/g, '');
    const parts = cleaned
      .split('/')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);
    if (parts[0]?.toLowerCase() === 'uploads') {
      parts.shift();
    }
    return parts;
  }, [initialPath]);

  const downloadFile = useCallback(async (file: LibraryNode) => {
    if (!file.path) {
      setDownloadError(t('library.filePathMissing'));
      return;
    }

    try {
      setDownloadError('');
      const response = await fetch(`${API_BASE}/api/library/download?path=${encodeURIComponent(file.path)}`, {
        headers: authHeaders(),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || t('library.downloadFailed'));
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name || 'download';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : t('library.downloadFailedRetry');
      setDownloadError(message);
    }
  }, [t]);

  const handleDeleteFile = useCallback(
    async (file: LibraryNode) => {
      if (!file.path) return;
      const confirmed = window.confirm(t('library.deleteConfirm', { name: file.name }));
      if (!confirmed) return;
      setDeletingPath(file.path);
      try {
        await api.delete(`/api/library/item?path=${encodeURIComponent(file.path)}`);
        await onRefresh();
      } catch (error) {
        const message = error instanceof Error && error.message ? error.message : t('library.deleteFailed');
        alert(message);
      } finally {
        setDeletingPath(null);
      }
    },
    [onRefresh, t]
  );

  const children = node.children || [];
  const folderChildren = children.filter((c) => c.type === 'folder');
  const fileChildren = children.filter((c) => c.type === 'file');

  const downloadNotice = downloadError ? (
    <div className="error" style={{ marginBottom: '8px' }}>{downloadError}</div>
  ) : null;

  return (
    <div className="library-container">
      {downloadNotice}
      <div className="year-section">
        {folderChildren.length === 0 && fileChildren.length === 0 ? (
          <p className="muted">{t('library.noFolders')}</p>
        ) : (
          <>
            {folderChildren.length > 0 && (
              <div className="folder-grid">
                {folderChildren.map((folder) => (
                  <FolderItem
                    key={folder.path || folder.name}
                    node={folder}
                    onRefresh={onRefresh}
                    onDownload={downloadFile}
                    initialSegments={initialSegments}
                  />
                ))}
              </div>
            )}
            {fileChildren.length > 0 && (
              <div className="file-list">
                {fileChildren.map((file) => (
                  <div key={file.path || file.name} className="file-item-row">
                    <button
                      type="button"
                      className="file-item file-download-button"
                      onClick={() => downloadFile(file)}
                      disabled={Boolean(deletingPath && deletingPath === file.path)}
                    >
                      <FileIcon />
                      {file.name}
                    </button>
                    {isAdmin && file.path ? (
                      <button
                        type="button"
                        className="icon-button delete-button"
                        aria-label={t('library.deleteAria', { name: file.name })}
                        onClick={() => handleDeleteFile(file)}
                        disabled={Boolean(deletingPath && deletingPath === file.path)}
                      >
                        <DeleteIcon />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {isAdmin && (
          <div className="create-folder">
            <CreateFolderForm parentPath="" onCreated={onRefresh} />
          </div>
        )}
      </div>
    </div>
  );
}
