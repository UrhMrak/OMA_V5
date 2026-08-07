import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { useModalClose } from '../Layout/useModalClose';
import { useLanguage } from '../../context/LanguageContext';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

type PdfViewerModalProps = {
  name: string;
  objectUrl: string | null;
  error: string;
  loading: boolean;
  onClose: () => void;
  onDownload: () => void;
};

function PdfDocumentView({ objectUrl }: { objectUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState('');
  const [rendering, setRendering] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    setRendering(true);
    setRenderError('');
    container.replaceChildren();

    const loadingTask = pdfjsLib.getDocument(objectUrl);

    loadingTask.promise
      .then(async (pdf) => {
        if (cancelled) {
          pdf.destroy();
          return;
        }

        const containerWidth = container.clientWidth || 800;
        // Render at device pixel ratio so pages stay sharp on HiDPI / mobile screens
        const outputScale = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) {
            pdf.destroy();
            return;
          }

          const page = await pdf.getPage(pageNum);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = containerWidth / baseViewport.width;
          const viewport = page.getViewport({ scale });

          const pageWrapper = document.createElement('div');
          pageWrapper.className = 'pdf-page';

          const canvas = document.createElement('canvas');
          canvas.className = 'pdf-page-canvas';
          canvas.width = Math.floor(viewport.width * outputScale);
          canvas.height = Math.floor(viewport.height * outputScale);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          canvas.setAttribute('role', 'img');
          canvas.setAttribute('aria-label', `Page ${pageNum}`);

          pageWrapper.appendChild(canvas);
          container.appendChild(pageWrapper);

          const context = canvas.getContext('2d');
          if (!context) continue;

          const transform =
            outputScale !== 1 ? ([outputScale, 0, 0, outputScale, 0, 0] as const) : undefined;

          await page.render({
            canvasContext: context,
            viewport,
            ...(transform ? { transform } : {}),
          }).promise;
        }

        if (!cancelled) setRendering(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setRenderError(err instanceof Error ? err.message : t('news.loadPdfFailed'));
          setRendering(false);
        }
      });

    return () => {
      cancelled = true;
      loadingTask.destroy();
      container.replaceChildren();
    };
  }, [objectUrl, t]);

  return (
    <>
      {rendering && <p className="muted pdf-loading">{t('pdf.loading')}</p>}
      {renderError && <div className="error">{renderError}</div>}
      <div ref={containerRef} className="pdf-pages-container" />
    </>
  );
}

export default function PdfViewerModal({
  name,
  objectUrl,
  error,
  loading,
  onClose,
  onDownload,
}: PdfViewerModalProps) {
  const { closing, requestClose } = useModalClose(onClose);
  const { t } = useLanguage();

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
              {t('pdf.download')}
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={requestClose}
              aria-label={t('pdf.close')}
              title={t('pdf.close')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
        <div className="pdf-modal-body">
          {loading && <p className="muted">{t('pdf.loading')}</p>}
          {error && <div className="error">{error}</div>}
          {objectUrl && <PdfDocumentView objectUrl={objectUrl} />}
        </div>
      </div>
    </div>
  );
}
