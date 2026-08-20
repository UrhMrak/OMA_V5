import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { useLanguage } from '../context/LanguageContext';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

type PdfDocumentViewProps = {
  objectUrl: string;
};

export default function PdfDocumentView({ objectUrl }: PdfDocumentViewProps) {
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
            outputScale !== 1 ? ([outputScale, 0, 0, outputScale, 0, 0] as [number, number, number, number, number, number]) : undefined;

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
