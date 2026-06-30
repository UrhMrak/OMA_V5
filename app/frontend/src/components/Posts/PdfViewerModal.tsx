import { useModalClose } from '../Layout/useModalClose';

type PdfViewerModalProps = {
  name: string;
  objectUrl: string | null;
  error: string;
  loading: boolean;
  onClose: () => void;
  onDownload: () => void;
};

export default function PdfViewerModal({
  name,
  objectUrl,
  error,
  loading,
  onClose,
  onDownload,
}: PdfViewerModalProps) {
  const { closing, requestClose } = useModalClose(onClose);

  return (
    <div className={`modal-backdrop ${closing ? 'closing' : ''}`} onClick={requestClose}>
      <div
        className={`modal pdf-modal ${closing ? 'closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pdf-modal-header">
          <span className="card-title pdf-modal-title">{name}</span>
          <div className="pdf-modal-actions">
            <button type="button" className="btn" onClick={onDownload} disabled={!objectUrl}>
              Download
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={requestClose}
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
          {loading && <p className="muted">Loading PDF…</p>}
          {error && <div className="error">{error}</div>}
          {objectUrl && (
            <iframe className="pdf-modal-frame" title={name} src={objectUrl} />
          )}
        </div>
      </div>
    </div>
  );
}
