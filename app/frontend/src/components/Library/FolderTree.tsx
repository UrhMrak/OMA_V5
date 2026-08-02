import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { LibraryNode } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { API_BASE, api, authHeaders } from '../../lib/api';
import DeleteIcon from '../icons/DeleteIcon';
import PdfViewerModal from '../Posts/PdfViewerModal';
import {
  addRecentLibraryFile,
  canMoveLibraryItemToFolder,
  formatLibraryPathForDisplay,
  getRecentLibraryFileKey,
  getRecentLibraryFiles,
  LIBRARY_DRAG_MIME,
  pathToSegments,
  searchLibrary,
  segmentsToLibraryPath,
  type LibraryDragPayload,
  type RecentLibraryFile,
} from '../../lib/libraryUtils';

const UPLOAD_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,application/pdf,image/*';

type FileViewer = {
  name: string;
  objectUrl: string | null;
  error: string;
  loading: boolean;
};

function isPdfFile(file: LibraryNode): boolean {
  if (file.mimeType === 'application/pdf') return true;
  return file.name.toLowerCase().endsWith('.pdf');
}

function CreateFolderForm({
  parentPath,
  onCreated,
  onCancel,
}: {
  parentPath: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [folderName, setFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!folderName.trim()) return;

    setIsCreating(true);
    try {
      await api.post('/api/library/folder', { parentPath, name: folderName.trim() });
      setFolderName('');
      onCreated();
    } catch (err) {
      alert(err instanceof Error ? err.message : t('library.createFailed'));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="create-folder-form"
      onClick={(event) => event.stopPropagation()}
    >
      <input
        type="text"
        value={folderName}
        onChange={(e) => setFolderName(e.target.value)}
        placeholder={t('library.folderName')}
        disabled={isCreating}
        autoFocus
      />
      <div className="create-folder-form-actions">
        <button type="submit" disabled={isCreating || !folderName.trim()} className="btn btn-sm">
          {t('library.create')}
        </button>
        <button type="button" onClick={onCancel} disabled={isCreating} className="btn btn-sm">
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

const FOLDER_INDENT = 20;

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
      className={`folder-chevron${expanded ? ' expanded' : ''}`}
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function UploadButton({ folderPath, onUploaded, onSuccess }: { folderPath: string; onUploaded: () => void; onSuccess?: () => void }) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const uploadModeRef = useRef<'files' | 'folder'>('files');
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadProcessing, setUploadProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [menuOpen]);

  function getUploadRelativePath(file: File): string {
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    return relativePath?.replace(/\\/g, '/') || file.name;
  }

  function shouldPreserveStructure(files: File[]): boolean {
    return files.some((file) => getUploadRelativePath(file).includes('/'));
  }

  function shouldIncludeFile(file: File, preserveStructure: boolean): boolean {
    if (!preserveStructure) return true;
    const relativePath = getUploadRelativePath(file);
    const name = relativePath.split('/').pop() || relativePath;
    return name !== '.DS_Store' && name !== 'Thumbs.db';
  }

  function configureInput(mode: 'files' | 'folder') {
    const input = inputRef.current;
    if (!input) return;
    uploadModeRef.current = mode;
    if (mode === 'folder') {
      input.setAttribute('webkitdirectory', '');
      input.setAttribute('directory', '');
      input.removeAttribute('accept');
    } else {
      input.removeAttribute('webkitdirectory');
      input.removeAttribute('directory');
      input.setAttribute('accept', UPLOAD_ACCEPT);
    }
    input.value = '';
  }

  function startUpload(mode: 'files' | 'folder') {
    setMenuOpen(false);
    configureInput(mode);
    inputRef.current?.click();
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const preserveStructure = uploadModeRef.current === 'folder' || shouldPreserveStructure(Array.from(files));
    const selected = Array.from(files).filter((file) => shouldIncludeFile(file, preserveStructure));
    if (selected.length === 0) return;

    setBusy(true);
    setUploadProgress(0);
    setUploadProcessing(false);
    setError('');
    setSuccess('');
    try {
      const form = new FormData();
      form.append('folder', folderPath);
      for (const file of selected) {
        if (preserveStructure) {
          form.append('files', file, getUploadRelativePath(file));
        } else {
          form.append('files', file);
        }
      }
      await api.uploadWithProgress('/api/library/upload', form, (percent) => {
        setUploadProgress(percent);
        if (percent >= 100) setUploadProcessing(true);
      });
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
      setUploadProgress(0);
      setUploadProcessing(false);
    }
  }

  return (
    <div className="upload-button-container">
      <div className="upload-button-split" ref={menuRef}>
        <button
          type="button"
          onClick={() => startUpload('files')}
          disabled={busy}
          className="btn btn-sm upload-button-main"
        >
          <UploadIcon />
          {busy ? t('library.uploading') : t('library.upload')}
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          disabled={busy}
          className="btn btn-sm upload-button-menu"
          aria-label={t('library.uploadFolder')}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <FolderChevron expanded={menuOpen} />
        </button>
        {menuOpen && (
          <div className="upload-button-dropdown" role="menu">
            <button
              type="button"
              role="menuitem"
              className="upload-button-dropdown-item"
              onClick={() => startUpload('folder')}
            >
              <FolderIcon />
              {t('library.uploadFolder')}
            </button>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={UPLOAD_ACCEPT}
        style={{ display: 'none' }}
        onChange={(e) => handleUpload(e.target.files)}
      />
      {busy && (
        <div className="upload-progress">
          <div className="upload-progress-bar" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin={0} aria-valuemax={100}>
            <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
          <span className="upload-progress-label">
            {uploadProcessing ? t('library.uploadProcessing') : `${uploadProgress}%`}
          </span>
        </div>
      )}
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
  onOpenFile,
  onFolderActivate,
  expandSegments = [],
  activeFolderPath = '',
  depth = 0,
  dragEnabled = false,
  draggedItem = null,
  dropTargetPath = null,
  movingPath = null,
  onDragStartItem,
  onDragEndItem,
  onDragOverFolder,
  onDragLeaveFolder,
  onDropOnFolder,
}: {
  node: LibraryNode;
  onRefresh: () => void;
  onOpenFile: (file: LibraryNode) => Promise<void> | void;
  onFolderActivate: (path: string) => void;
  expandSegments?: string[];
  activeFolderPath?: string;
  depth?: number;
  dragEnabled?: boolean;
  draggedItem?: LibraryDragPayload | null;
  dropTargetPath?: string | null;
  movingPath?: string | null;
  onDragStartItem: (event: React.DragEvent, payload: LibraryDragPayload) => void;
  onDragEndItem: () => void;
  onDragOverFolder: (event: React.DragEvent, folderPath: string) => void;
  onDragLeaveFolder: (folderPath: string) => void;
  onDropOnFolder: (event: React.DragEvent, folderPath: string) => void;
}) {
  const { role } = useAuth();
  const { t } = useLanguage();
  const isAdmin = role === 'admin';
  const targetSegment = expandSegments[0];
  const shouldExpand = targetSegment === node.name;
  const [isExpanded, setIsExpanded] = useState(shouldExpand);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const expandOnDragTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (shouldExpand) setIsExpanded(true);
  }, [shouldExpand]);

  useEffect(
    () => () => {
      if (expandOnDragTimerRef.current !== null) {
        window.clearTimeout(expandOnDragTimerRef.current);
      }
    },
    []
  );

  const subFolders = (node.children || []).filter((c) => c.type === 'folder');
  const files = (node.children || []).filter((c) => c.type === 'file');
  const childCount = subFolders.length + files.length;
  const childSegments = shouldExpand ? expandSegments.slice(1) : [];
  const deletingThisNode = deletingPath === node.path;
  const isActive = Boolean(node.path && node.path === activeFolderPath);
  const folderPath = node.path || '';
  const isDropTarget = Boolean(folderPath && dropTargetPath === folderPath);
  const isDraggingThis = Boolean(folderPath && draggedItem?.path === folderPath);
  const isMovingThis = Boolean(folderPath && movingPath === folderPath);

  function clearExpandOnDragTimer() {
    if (expandOnDragTimerRef.current !== null) {
      window.clearTimeout(expandOnDragTimerRef.current);
      expandOnDragTimerRef.current = null;
    }
  }

  function handleFolderDragEnter(event: React.DragEvent) {
    if (!dragEnabled || !folderPath || !draggedItem) return;
    if (!canMoveLibraryItemToFolder(draggedItem.path, draggedItem.type, folderPath)) return;
    event.preventDefault();
    clearExpandOnDragTimer();
    expandOnDragTimerRef.current = window.setTimeout(() => setIsExpanded(true), 450);
  }

  function handleFolderDragLeave() {
    clearExpandOnDragTimer();
    if (folderPath) onDragLeaveFolder(folderPath);
  }

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

  const contentIndent = (depth + 1) * FOLDER_INDENT;

  return (
    <div className="folder-tree-node">
      <div
        className={`folder-row${isActive ? ' folder-row-active' : ''}${isDropTarget ? ' folder-row-drop-target' : ''}${isDraggingThis ? ' library-item-dragging' : ''}`}
        style={{ paddingLeft: depth * FOLDER_INDENT }}
        draggable={dragEnabled && Boolean(node.path) && !isMovingThis}
        onDragStart={(event) => {
          if (!node.path) return;
          onDragStartItem(event, { path: node.path, type: 'folder' });
        }}
        onDragEnd={onDragEndItem}
        onDragEnter={handleFolderDragEnter}
        onDragOver={(event) => {
          if (folderPath) onDragOverFolder(event, folderPath);
        }}
        onDragLeave={handleFolderDragLeave}
        onDrop={(event) => {
          if (folderPath) onDropOnFolder(event, folderPath);
        }}
        onClick={() => {
          setIsExpanded(!isExpanded);
          if (node.path) onFolderActivate(node.path);
        }}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setIsExpanded(!isExpanded);
            if (node.path) onFolderActivate(node.path);
          }
        }}
      >
        {childCount > 0 ? (
          <ChevronIcon expanded={isExpanded} />
        ) : (
          <span className="folder-chevron-placeholder" aria-hidden="true" />
        )}
        <FolderIcon />
        <span className="folder-name">{node.name}</span>
        {childCount > 0 ? <span className="folder-count">({childCount})</span> : null}
        {isAdmin ? (
          <>
            <button
              type="button"
              className="icon-button add-folder-button"
              aria-label={t('library.createFolderAria', { name: node.name })}
              title={t('library.createFolder')}
              onClick={(event) => {
                event.stopPropagation();
                setIsExpanded(true);
                setIsCreatingFolder((prev) => !prev);
              }}
            >
              <PlusIcon />
            </button>
            {node.path ? (
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
          </>
        ) : null}
      </div>
      {isExpanded && (
        <div className="folder-children">
          {isAdmin && isCreatingFolder ? (
            <div className="folder-admin-section" style={{ paddingLeft: contentIndent }}>
              <CreateFolderForm
                parentPath={node.path || ''}
                onCreated={() => {
                  setIsCreatingFolder(false);
                  onRefresh();
                }}
                onCancel={() => setIsCreatingFolder(false)}
              />
            </div>
          ) : null}
          {isAdmin && isRenaming ? (
            <div className="folder-admin-section" style={{ paddingLeft: contentIndent }}>
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
            <div className="folder-admin-section" style={{ paddingLeft: contentIndent }}>
              <UploadButton
                folderPath={node.path || ''}
                onUploaded={onRefresh}
                onSuccess={() => setIsExpanded(true)}
              />
            </div>
          )}
          {subFolders.map((folder) => (
            <FolderItem
              key={folder.path || folder.name}
              node={folder}
              onRefresh={onRefresh}
              onOpenFile={onOpenFile}
              onFolderActivate={onFolderActivate}
              expandSegments={childSegments}
              activeFolderPath={activeFolderPath}
              depth={depth + 1}
              dragEnabled={dragEnabled}
              draggedItem={draggedItem}
              dropTargetPath={dropTargetPath}
              movingPath={movingPath}
              onDragStartItem={onDragStartItem}
              onDragEndItem={onDragEndItem}
              onDragOverFolder={onDragOverFolder}
              onDragLeaveFolder={onDragLeaveFolder}
              onDropOnFolder={onDropOnFolder}
            />
          ))}
          {files.map((file) => (
            <div
              key={file.path || file.name}
              className={`file-item-row${dragEnabled && file.path ? ' library-draggable' : ''}${draggedItem?.path === file.path ? ' library-item-dragging' : ''}`}
              style={{ paddingLeft: contentIndent }}
              draggable={dragEnabled && Boolean(file.path) && movingPath !== file.path}
              onDragStart={(event) => {
                if (!file.path) return;
                onDragStartItem(event, { path: file.path, type: 'file' });
              }}
              onDragEnd={onDragEndItem}
            >
              <button
                type="button"
                className="file-item file-open-button"
                onClick={() => onOpenFile(file)}
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
        </div>
      )}
    </div>
  );
}

export default function FolderTree({
  node,
  onRefresh,
  initialPath,
  rememberLastFolder = false,
  onLastFolderChange,
}: {
  node: LibraryNode;
  onRefresh: () => void;
  initialPath?: string;
  rememberLastFolder?: boolean;
  onLastFolderChange?: (path: string) => void;
}) {
  const { role } = useAuth();
  const { t } = useLanguage();
  const isAdmin = role === 'admin';
  const [openError, setOpenError] = useState('');
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [isCreatingRootFolder, setIsCreatingRootFolder] = useState(false);
  const [viewer, setViewer] = useState<FileViewer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentFiles, setRecentFiles] = useState<RecentLibraryFile[]>(() => getRecentLibraryFiles());
  const [draggedItem, setDraggedItem] = useState<LibraryDragPayload | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const [movingPath, setMovingPath] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const initialSegments = useMemo(() => {
    if (!initialPath) return [] as string[];
    return pathToSegments(initialPath);
  }, [initialPath]);

  const [activeFolderPath, setActiveFolderPath] = useState(initialPath || '');
  const [expandSegments, setExpandSegments] = useState<string[]>(initialSegments);

  useEffect(() => {
    if (initialPath) {
      setActiveFolderPath(initialPath);
      setExpandSegments(pathToSegments(initialPath));
    }
  }, [initialPath]);

  const searchResults = useMemo(
    () => searchLibrary(node, searchQuery),
    [node, searchQuery]
  );

  const breadcrumbSegments = useMemo(() => pathToSegments(activeFolderPath), [activeFolderPath]);

  function rememberFolder(path: string) {
    setActiveFolderPath(path);
    if (rememberLastFolder && onLastFolderChange) {
      onLastFolderChange(path);
    }
  }

  function navigateToFolder(folderPath: string) {
    setSearchQuery('');
    setExpandSegments(pathToSegments(folderPath));
    rememberFolder(folderPath);
  }

  function handleFolderActivate(path: string) {
    rememberFolder(path);
  }

  function refreshRecentFiles() {
    setRecentFiles(getRecentLibraryFiles());
  }

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

  async function fetchFileBlob(file: LibraryNode): Promise<Blob> {
    if (!file.path) {
      throw new Error(t('library.filePathMissing'));
    }

    const response = await fetch(`${API_BASE}/api/library/download?path=${encodeURIComponent(file.path)}`, {
      headers: authHeaders(),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || t('library.downloadFailed'));
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

  const openFile = useCallback(async (file: LibraryNode) => {
    if (!file.path) {
      setOpenError(t('library.filePathMissing'));
      return;
    }

    addRecentLibraryFile(file);
    refreshRecentFiles();

    if (!isPdfFile(file)) {
      try {
        setOpenError('');
        const blob = await fetchFileBlob(file);
        const objectUrl = URL.createObjectURL(blob);
        triggerBlobDownload(objectUrl, file.name || 'download');
        URL.revokeObjectURL(objectUrl);
      } catch (error) {
        const message = error instanceof Error && error.message ? error.message : t('library.downloadFailedRetry');
        alert(message);
      }
      return;
    }

    revokeObjectUrl();
    setOpenError('');
    setViewer({ name: file.name, objectUrl: null, error: '', loading: true });
    try {
      const blob = await fetchFileBlob(file);
      const objectUrl = URL.createObjectURL(blob);
      objectUrlRef.current = objectUrl;
      setViewer({ name: file.name, objectUrl, error: '', loading: false });
    } catch (error) {
      setViewer({
        name: file.name,
        objectUrl: null,
        error: error instanceof Error && error.message ? error.message : t('news.loadPdfFailed'),
        loading: false,
      });
    }
  }, [t]);

  function closeViewer() {
    revokeObjectUrl();
    setViewer(null);
  }

  function downloadCurrentFile() {
    if (!viewer?.objectUrl) return;
    triggerBlobDownload(viewer.objectUrl, viewer.name);
  }

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

  const clearDragState = useCallback(() => {
    setDraggedItem(null);
    setDropTargetPath(null);
  }, []);

  const handleDragStartItem = useCallback(
    (event: React.DragEvent, payload: LibraryDragPayload) => {
      if (!isAdmin || movingPath) {
        event.preventDefault();
        return;
      }
      setDraggedItem(payload);
      event.dataTransfer.setData(LIBRARY_DRAG_MIME, JSON.stringify(payload));
      event.dataTransfer.effectAllowed = 'move';
    },
    [isAdmin, movingPath]
  );

  const handleDragEndItem = useCallback(() => {
    clearDragState();
  }, [clearDragState]);

  const handleDragOverFolder = useCallback(
    (event: React.DragEvent, folderPath: string) => {
      if (!isAdmin || !draggedItem) return;
      if (!canMoveLibraryItemToFolder(draggedItem.path, draggedItem.type, folderPath)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setDropTargetPath(folderPath);
    },
    [draggedItem, isAdmin]
  );

  const handleDragLeaveFolder = useCallback((folderPath: string) => {
    setDropTargetPath((current) => (current === folderPath ? null : current));
  }, []);

  const handleMoveItem = useCallback(
    async (targetFolderPath: string) => {
      if (!draggedItem) return;
      if (!canMoveLibraryItemToFolder(draggedItem.path, draggedItem.type, targetFolderPath)) return;

      setMovingPath(draggedItem.path);
      try {
        await api.post('/api/library/move', {
          path: draggedItem.path,
          targetFolder: targetFolderPath,
        });
        clearDragState();
        await onRefresh();
      } catch (error) {
        const message = error instanceof Error && error.message ? error.message : t('library.moveFailed');
        alert(message);
      } finally {
        setMovingPath(null);
      }
    },
    [clearDragState, draggedItem, onRefresh, t]
  );

  const handleDropOnFolder = useCallback(
    (event: React.DragEvent, folderPath: string) => {
      event.preventDefault();
      event.stopPropagation();
      void handleMoveItem(folderPath);
    },
    [handleMoveItem]
  );

  const handleDropOnRoot = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      void handleMoveItem('');
    },
    [handleMoveItem]
  );

  const children = node.children || [];
  const folderChildren = children.filter((c) => c.type === 'folder');
  const fileChildren = children.filter((c) => c.type === 'file');
  const isEmpty = folderChildren.length === 0 && fileChildren.length === 0;

  const openNotice = openError ? (
    <div className="error" style={{ marginBottom: '8px' }}>{openError}</div>
  ) : null;

  return (
    <div className="library-container">
      {openNotice}
      <input
        className="input library-search"
        type="search"
        placeholder={t('library.search')}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      {searchQuery.trim() ? (
        <div className="library-search-results">
          {searchResults.length === 0 ? (
            <p className="muted small">{t('library.searchNoResults')}</p>
          ) : (
            <ul className="library-search-list">
              {searchResults.map((result) => {
                const isFolder = result.item.type === 'folder';
                const itemPath = result.item.path || result.item.name;
                return (
                  <li key={itemPath} className="library-search-item">
                    <button
                      type="button"
                      className="library-search-file"
                      onClick={() => {
                        if (isFolder && result.item.path) {
                          navigateToFolder(result.item.path);
                          return;
                        }
                        openFile(result.item);
                      }}
                    >
                      {isFolder ? <FolderIcon /> : <FileIcon />}
                      <span>{result.item.name}</span>
                    </button>
                    {!isFolder && result.parentPath ? (
                      <button
                        type="button"
                        className="btn btn-sm library-search-folder-btn"
                        onClick={() => navigateToFolder(result.parentPath)}
                      >
                        {t('library.openFolderAction')}
                      </button>
                    ) : null}
                    {result.parentPath ? (
                      <span className="muted small library-search-folder-label">
                        {t('library.inFolder', { folder: formatLibraryPathForDisplay(result.parentPath) })}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <>
          {recentFiles.length > 0 && (
            <section className="library-recent">
              <h3 className="h3 library-section-title">{t('library.recentFiles')}</h3>
              <ul className="library-recent-list">
                {recentFiles.map((recent) => (
                  <li key={getRecentLibraryFileKey(recent.path)}>
                    <button
                      type="button"
                      className="library-recent-item"
                      onClick={() =>
                        openFile({
                          name: recent.name,
                          path: recent.path,
                          type: 'file',
                        })
                      }
                    >
                      <FileIcon />
                      <span>{recent.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <nav className="library-breadcrumbs" aria-label={t('library.breadcrumbs')}>
            <button
              type="button"
              className={`library-breadcrumb${breadcrumbSegments.length === 0 ? ' active' : ''}${dropTargetPath === '' && draggedItem ? ' library-drop-target' : ''}`}
              onClick={() => navigateToFolder('')}
              onDragOver={(event) => {
                if (!isAdmin || !draggedItem) return;
                if (!canMoveLibraryItemToFolder(draggedItem.path, draggedItem.type, '')) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setDropTargetPath('');
              }}
              onDragLeave={() => setDropTargetPath((current) => (current === '' ? null : current))}
              onDrop={isAdmin ? handleDropOnRoot : undefined}
            >
              {t('library.breadcrumbsRoot')}
            </button>
            {breadcrumbSegments.map((segment, index) => {
              const path = segmentsToLibraryPath(breadcrumbSegments.slice(0, index + 1));
              const isLast = index === breadcrumbSegments.length - 1;
              return (
                <span key={path} className="library-breadcrumb-wrap">
                  <span className="library-breadcrumb-sep" aria-hidden="true">/</span>
                  <button
                    type="button"
                    className={`library-breadcrumb${isLast ? ' active' : ''}`}
                    onClick={() => navigateToFolder(path)}
                  >
                    {segment}
                  </button>
                </span>
              );
            })}
          </nav>
        </>
      )}
      {!searchQuery.trim() && (
      <div className="year-section">
        {isEmpty ? (
          isAdmin ? (
            <>
              {isCreatingRootFolder ? (
                <div className="folder-admin-section">
                  <CreateFolderForm
                    parentPath=""
                    onCreated={() => {
                      setIsCreatingRootFolder(false);
                      onRefresh();
                    }}
                    onCancel={() => setIsCreatingRootFolder(false)}
                  />
                </div>
              ) : null}
              <div className="folder-row">
                <span className="folder-chevron-placeholder" aria-hidden="true" />
                <span className="folder-name muted">{t('library.noFolders')}</span>
                <button
                  type="button"
                  className="icon-button add-folder-button"
                  aria-label={t('library.createFolderRootAria')}
                  title={t('library.createFolder')}
                  onClick={() => setIsCreatingRootFolder(true)}
                >
                  <PlusIcon />
                </button>
              </div>
            </>
          ) : (
            <p className="muted">{t('library.noFolders')}</p>
          )
        ) : (
          <>
            {folderChildren.length > 0 && (
              <div className="folder-tree">
                {folderChildren.map((folder) => (
                  <FolderItem
                    key={folder.path || folder.name}
                    node={folder}
                    onRefresh={onRefresh}
                    onOpenFile={openFile}
                    onFolderActivate={handleFolderActivate}
                    expandSegments={expandSegments}
                    activeFolderPath={activeFolderPath}
                    dragEnabled={isAdmin}
                    draggedItem={draggedItem}
                    dropTargetPath={dropTargetPath}
                    movingPath={movingPath}
                    onDragStartItem={handleDragStartItem}
                    onDragEndItem={handleDragEndItem}
                    onDragOverFolder={handleDragOverFolder}
                    onDragLeaveFolder={handleDragLeaveFolder}
                    onDropOnFolder={handleDropOnFolder}
                  />
                ))}
              </div>
            )}
            {fileChildren.length > 0 && (
              <div className="file-list">
                {fileChildren.map((file) => (
                  <div
                    key={file.path || file.name}
                    className={`file-item-row${isAdmin && file.path ? ' library-draggable' : ''}${draggedItem?.path === file.path ? ' library-item-dragging' : ''}`}
                    style={{ paddingLeft: 0 }}
                    draggable={isAdmin && Boolean(file.path) && movingPath !== file.path}
                    onDragStart={(event) => {
                      if (!file.path) return;
                      handleDragStartItem(event, { path: file.path, type: 'file' });
                    }}
                    onDragEnd={handleDragEndItem}
                  >
                    <button
                      type="button"
                      className="file-item file-open-button"
                      onClick={() => openFile(file)}
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
      </div>
      )}
      {viewer && (
        <PdfViewerModal
          name={viewer.name}
          objectUrl={viewer.objectUrl}
          error={viewer.error}
          loading={viewer.loading}
          onClose={closeViewer}
          onDownload={downloadCurrentFile}
        />
      )}
    </div>
  );
}
