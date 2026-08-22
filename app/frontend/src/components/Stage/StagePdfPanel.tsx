import { useEffect, useState } from 'react';
import PdfDocumentView from '../PdfDocumentView';
import WaitingMessage from '../WaitingMessage';
import { API_BASE, authHeaders } from '../../lib/api';
import { useLanguage } from '../../context/LanguageContext';

type StagePdfPanelProps = {
  path: string;
};

export default function StagePdfPanel({ path }: StagePdfPanelProps) {
  const { t } = useLanguage();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let activeUrl: string | null = null;

    setLoading(true);
    setError('');
    setObjectUrl(null);

    void (async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/library/download?path=${encodeURIComponent(path)}`,
          { headers: authHeaders() }
        );
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || t('stagePage.pdfLoadFailed'));
        }
        const blob = await response.blob();
        if (cancelled) return;
        activeUrl = URL.createObjectURL(blob);
        setObjectUrl(activeUrl);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error && loadError.message
              ? loadError.message
              : t('stagePage.pdfLoadFailed')
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (activeUrl) URL.revokeObjectURL(activeUrl);
    };
  }, [path, t]);

  return (
    <section className="stage-pdf-panel" aria-label={t('stagePage.pdfHeading')}>
      <h3 className="stage-pdf-heading">{t('stagePage.pdfHeading')}</h3>
      {loading && (
        <p className="muted">
          <WaitingMessage as="span" live="off">
            {t('pdf.loading')}
          </WaitingMessage>
        </p>
      )}
      {error && <p className="error">{error}</p>}
      {objectUrl && <PdfDocumentView objectUrl={objectUrl} />}
    </section>
  );
}
