import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { LibraryNode } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';
import { API_BASE, api, authHeaders } from '../../lib/api';
import DeleteIcon from '../icons/DeleteIcon';

function CreateFolderForm({ parentPath, onCreated }: { parentPath: string; onCreated: () => void }) {
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
      alert(err instanceof Error ? err.message : 'Failed to create folder');
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
        + Create Folder
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
        placeholder="Folder name"
        disabled={isCreating}
        style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
        autoFocus
      />
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="submit" disabled={isCreating || !folderName.trim()} className="btn btn-sm">
          Create
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
          Cancel
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

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
    >
      <polyline points="9 18 15 12 9 6" />
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

function UploadButton({ folderPath, onUploaded, onSuccess }: { folderPath: string; onUploaded: () => void; onSuccess?: () => void }) {
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
      console.log('Uploading to folder:', folderPath, 'Files:', Array.from(files).map(f => f.name));
      const result = await api.upload('/api/library/upload', form);
      console.log('Upload result:', result);
      setSuccess('Uploaded successfully');
      if (onSuccess) onSuccess();
      if (inputRef.current) inputRef.current.value = '';
      // Wait a bit then refresh to ensure backend has written the file
      setTimeout(() => {
        console.log('Refreshing tree...');
        onUploaded();
        setTimeout(() => setSuccess(''), 2000);
      }, 300);
    } catch (e: any) {
      console.error('Upload error:', e);
      const message = e?.message || 'Upload failed. Only PDFs up to 25MB are allowed.';
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
        {busy ? 'Uploading…' : 'Upload'}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf"
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

function YearSection({ yearNode, onRefresh, onDownload, initialSegments = [] }: { yearNode: LibraryNode; onRefresh: () => void; onDownload: (file: LibraryNode) => Promise<void> | void; initialSegments?: string[] }) {
  const targetSegment = initialSegments[0];
  const shouldExpand = targetSegment === yearNode.name;
  const [isExpanded, setIsExpanded] = useState(shouldExpand);
  useEffect(() => {
    if (shouldExpand) setIsExpanded(true);
  }, [shouldExpand]);
  const allWeekFolders = (yearNode.children || []).filter((c) => c.type === 'folder' && c.name.startsWith('week '));
  const weekFolders = [...allWeekFolders].sort((a, b) => {
    const numA = Number(a.name.match(/\d+$/)?.[0] || 0);
    const numB = Number(b.name.match(/\d+$/)?.[0] || 0);
    return numA - numB;
  });
  const otherFolders = (yearNode.children || []).filter((c) => !(c.type === 'folder' && c.name.startsWith('week ')));
  const files = (yearNode.children || []).filter((c) => c.type === 'file');
  const childSegments = shouldExpand ? initialSegments.slice(1) : [];

  return (
    <div className="year-section">
      <h3 className="h3 year-title" onClick={() => setIsExpanded(!isExpanded)} style={{ cursor: 'pointer' }}>
        <ChevronIcon expanded={isExpanded} />
        <FolderIcon />
        {yearNode.name}
      </h3>
      {isExpanded && (
        <>
          <div className="folder-grid">
            {weekFolders.map((weekFolder) => (
              <WeekFolder
                key={weekFolder.path || weekFolder.name}
                weekFolder={weekFolder}
                onRefresh={onRefresh}
                onDownload={onDownload}
                initialSegments={childSegments}
              />
            ))}
          </div>
          {otherFolders.length > 0 && (
            <div className="folder-grid">
              {otherFolders.map((folder) => (
                <FolderItem
                  key={folder.path || folder.name}
                  node={folder}
                  onRefresh={onRefresh}
                  onDownload={onDownload}
                  initialSegments={childSegments}
                />
              ))}
            </div>
          )}
          {files.length > 0 && (
            <div className="file-list">
              {files.map((file) => (
                <button
                  key={file.path || file.name}
                  type="button"
                  className="file-item file-download-button"
                  onClick={() => onDownload(file)}
                >
                  <FileIcon />
                  {file.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function WeekFolder({ weekFolder, onRefresh, onDownload, initialSegments = [] }: { weekFolder: LibraryNode; onRefresh: () => void; onDownload: (file: LibraryNode) => Promise<void> | void; initialSegments?: string[] }) {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const targetSegment = initialSegments[0];
  const shouldExpand = targetSegment === weekFolder.name;
  const [isExpanded, setIsExpanded] = useState(shouldExpand);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  useEffect(() => {
    if (shouldExpand) setIsExpanded(true);
  }, [shouldExpand]);
  const subFolders = (weekFolder.children || []).filter((c) => c.type === 'folder');
  const files = (weekFolder.children || []).filter((c) => c.type === 'file');
  const childSegments = shouldExpand ? initialSegments.slice(1) : [];

  const handleDelete = useCallback(
    async (target: LibraryNode) => {
      if (!target.path) return;
      const confirmed = window.confirm(`Delete "${target.name}"? This cannot be undone.`);
      if (!confirmed) return;
      setDeletingPath(target.path);
      try {
        await api.delete(`/api/library/item?path=${encodeURIComponent(target.path)}`);
        await onRefresh();
      } catch (error) {
        console.error('Delete failed:', error);
        const message = error instanceof Error && error.message ? error.message : 'Delete failed. Please try again.';
        alert(message);
      } finally {
        setDeletingPath(null);
      }
    },
    [onRefresh]
  );

  return (
    <div className="folder-item">
      <div className="folder-item-header" onClick={() => setIsExpanded(!isExpanded)}>
        <FolderIcon />
        <span className="folder-name">{weekFolder.name}</span>
        {subFolders.length > 0 || files.length > 0 ? (
          <span className="folder-count">({subFolders.length + files.length})</span>
        ) : null}
      </div>
      {isExpanded && (
        <div className="folder-item-content">
          {isAdmin && (
            <div className="upload-section">
              <UploadButton
                folderPath={weekFolder.path || ''}
                onUploaded={async () => {
                  console.log('Refreshing tree after upload to:', weekFolder.path);
                  await onRefresh();
                  console.log('Tree refreshed');
                }}
                onSuccess={() => setIsExpanded(true)}
              />
            </div>
          )}
          {subFolders.map((folder) => (
            <FolderItem
              key={folder.path || folder.name}
              node={folder}
              onRefresh={onRefresh}
              onDownload={onDownload}
              compact
              initialSegments={childSegments}
              showDelete={isAdmin}
              onDelete={handleDelete}
              deletingPath={deletingPath || undefined}
            />
          ))}
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
                  aria-label={`Delete ${file.name}`}
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
              <CreateFolderForm parentPath={weekFolder.path || ''} onCreated={onRefresh} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FolderItem({
  node,
  onRefresh,
  onDownload,
  compact = false,
  initialSegments = [],
  showDelete = false,
  onDelete,
  deletingPath,
}: {
  node: LibraryNode;
  onRefresh: () => void;
  onDownload: (file: LibraryNode) => Promise<void> | void;
  compact?: boolean;
  initialSegments?: string[];
  showDelete?: boolean;
  onDelete?: (node: LibraryNode) => void;
  deletingPath?: string;
}) {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const targetSegment = initialSegments[0];
  const shouldExpand = targetSegment === node.name;
  const [isExpanded, setIsExpanded] = useState(shouldExpand);
  useEffect(() => {
    if (shouldExpand) setIsExpanded(true);
  }, [shouldExpand]);
  const subFolders = (node.children || []).filter((c) => c.type === 'folder');
  const files = (node.children || []).filter((c) => c.type === 'file');
  const childSegments = shouldExpand ? initialSegments.slice(1) : [];
  const deletingThisNode = deletingPath === node.path;

  return (
    <div className={`folder-item${compact ? ' compact' : ''}`}>
      <div className="folder-item-header" onClick={() => setIsExpanded(!isExpanded)}>
        <FolderIcon />
        <span className="folder-name">{node.name}</span>
        {subFolders.length > 0 || files.length > 0 ? (
          <span className="folder-count">({subFolders.length + files.length})</span>
        ) : null}
        {showDelete && onDelete && node.path ? (
          <button
            type="button"
            className="icon-button delete-button"
            aria-label={`Delete ${node.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(node);
            }}
            disabled={deletingThisNode}
          >
            <DeleteIcon />
          </button>
        ) : null}
      </div>
      {isExpanded && (
        <div className="folder-item-content">
          {isAdmin && (
            <div className="upload-section">
              <UploadButton
                folderPath={node.path || ''}
                onUploaded={async () => {
                  console.log('Refreshing tree after upload to:', node.path);
                  await onRefresh();
                  console.log('Tree refreshed');
                }}
                onSuccess={() => setIsExpanded(true)}
              />
            </div>
          )}
          {subFolders.map((folder) => (
            <FolderItem
              key={folder.path || folder.name}
              node={folder}
              onRefresh={onRefresh}
              onDownload={onDownload}
              compact={compact}
              initialSegments={childSegments}
              showDelete={showDelete}
              onDelete={onDelete}
              deletingPath={deletingPath}
            />
          ))}
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
              {showDelete && onDelete && file.path ? (
                <button
                  type="button"
                  className="icon-button delete-button"
                  aria-label={`Delete ${file.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(file);
                  }}
                  disabled={Boolean(deletingPath && deletingPath === file.path)}
                >
                  <DeleteIcon />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FolderTree({ node, onRefresh, initialPath }: { node: LibraryNode; onRefresh: () => void; initialPath?: string }) {
  const [downloadError, setDownloadError] = useState('');
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
      setDownloadError('File path not found.');
      return;
    }

    try {
      setDownloadError('');
      const response = await fetch(`${API_BASE}/api/library/download?path=${encodeURIComponent(file.path)}`, {
        headers: authHeaders(),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Download failed.');
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
      console.error('Download failed:', error);
      const message = error instanceof Error && error.message ? error.message : 'Download failed. Please try again.';
      setDownloadError(message);
    }
  }, []);
  const children = node.children || [];
  const yearNodes = children.filter((c) => c.type === 'folder' && /^\d{4}$/.test(c.name));

  const downloadNotice = downloadError ? (
    <div className="error" style={{ marginBottom: '8px' }}>{downloadError}</div>
  ) : null;

  // Fallback: if no year folders detected, show whatever folders exist at root
  if (yearNodes.length === 0) {
    const folderChildren = children.filter((c) => c.type === 'folder');
    const fileChildren = children.filter((c) => c.type === 'file');
    if (folderChildren.length === 0 && fileChildren.length === 0) {
      return <p className="muted">No folders found</p>;
    }
    return (
      <div className="library-container">
        {downloadNotice}
        <div className="year-section">
          <h3 className="h3 year-title">
            <FolderIcon />
            Library
          </h3>
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
          {fileChildren.length > 0 && (
            <div className="file-list">
              {fileChildren.map((file) => (
                <button
                  key={file.path || file.name}
                  type="button"
                  className="file-item file-download-button"
                  onClick={() => downloadFile(file)}
                >
                  <FileIcon />
                  {file.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="library-container">
      {downloadNotice}
      {yearNodes.map((yearNode) => (
        <YearSection
          key={yearNode.path || yearNode.name}
          yearNode={yearNode}
          onRefresh={onRefresh}
          onDownload={downloadFile}
          initialSegments={initialSegments}
        />
      ))}
    </div>
  );
}


