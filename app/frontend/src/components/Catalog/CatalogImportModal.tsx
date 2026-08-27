import { useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useLanguage } from '../../context/LanguageContext';
import { useModalClose } from '../Layout/useModalClose';
import { CATALOG_FIELDS } from '../../lib/catalog';
import { parseCsv } from '../../lib/csv';
import { parseDurationMinutes } from '../../lib/program';
import WaitingMessage from '../WaitingMessage';

const PREVIEW_ROW_LIMIT = 5;
const IGNORE_COLUMN = '';

type ImportSummary = {
  worksCreated: number;
  holdingsCreated: number;
  holdingsUpdated: number;
  skipped: number;
};

function normalizeHeader(value: string): string {
  return value
    .trim()
    .replace(/[_\s]+/g, ' ')
    .toLowerCase();
}

/** Matches spreadsheet headers against both the translated labels and the raw column names. */
function autoMapColumns(headers: string[], labelFor: (labelKey: string) => string): string[] {
  const byLabel = new Map<string, string>();
  for (const field of CATALOG_FIELDS) {
    byLabel.set(normalizeHeader(labelFor(field.labelKey)), field.key);
    byLabel.set(normalizeHeader(field.key), field.key);
  }
  byLabel.set(normalizeHeader('Duration (minutes)'), 'duration_minutes');
  byLabel.set(normalizeHeader('Lengd (mínútur)'), 'duration_minutes');

  const used = new Set<string>();
  return headers.map((header) => {
    const match = byLabel.get(normalizeHeader(header));
    if (!match || used.has(match)) return IGNORE_COLUMN;
    used.add(match);
    return match;
  });
}

export default function CatalogImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => Promise<void> | void;
}) {
  const { t } = useLanguage();
  const { closing, requestClose } = useModalClose(onClose);

  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const previewRows = useMemo(() => dataRows.slice(0, PREVIEW_ROW_LIMIT), [dataRows]);
  const mappedFieldKeys = useMemo(
    () => new Set(mapping.filter((key) => key !== IGNORE_COLUMN)),
    [mapping]
  );
  const hasIdentity = mappedFieldKeys.has('composer') || mappedFieldKeys.has('title');

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError('');
    setSummary(null);

    try {
      const parsed = parseCsv(await file.text());
      if (parsed.headers.length === 0) {
        setError(t('catalog.import.parseFailed'));
        return;
      }
      if (parsed.rows.length === 0) {
        setError(t('catalog.import.noRows'));
        setHeaders([]);
        setDataRows([]);
        setMapping([]);
        return;
      }
      setHeaders(parsed.headers);
      setDataRows(parsed.rows);
      setMapping(autoMapColumns(parsed.headers, t));
    } catch (parseError) {
      console.error('Parse CSV failed:', parseError);
      setError(t('catalog.import.parseFailed'));
    }
  }

  function setColumnMapping(index: number, fieldKey: string) {
    setMapping((prev) =>
      prev.map((current, currentIndex) => {
        if (currentIndex === index) return fieldKey;
        // A catalog field can only receive one column.
        if (fieldKey !== IGNORE_COLUMN && current === fieldKey) return IGNORE_COLUMN;
        return current;
      })
    );
  }

  function buildPayloadRows(): Record<string, string>[] {
    return dataRows.map((row) => {
      const payload: Record<string, string> = {};
      mapping.forEach((fieldKey, index) => {
        if (fieldKey === IGNORE_COLUMN) return;
        const raw = (row[index] || '').trim();
        if (fieldKey === 'duration_minutes') {
          const parsed = parseDurationMinutes(raw);
          payload[fieldKey] = parsed === null ? '' : String(parsed);
          return;
        }
        payload[fieldKey] = raw;
      });
      return payload;
    });
  }

  async function startImport() {
    if (isImporting || !hasIdentity) return;
    setIsImporting(true);
    setError('');
    setSummary(null);

    try {
      const result = await api.post<ImportSummary>('/api/catalog/import', {
        rows: buildPayloadRows(),
      });
      setSummary(result);
      await onImported();
    } catch (importError) {
      console.error('Catalog import failed:', importError);
      setError(
        importError instanceof Error && importError.message
          ? importError.message
          : t('catalog.import.failed')
      );
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className={`modal-backdrop ${closing ? 'closing' : ''}`}>
      <div className={`modal ${closing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
        <h3 className="h3">{t('catalog.import.title')}</h3>

        <div className="modal-body">
          <div className="row-gap tight catalog-field">
            <label className="label" htmlFor="catalog-import-file">
              {t('catalog.import.chooseFile')}
            </label>
            <input
              id="catalog-import-file"
              className="input"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
            <span className="muted small">{t('catalog.import.fileHint')}</span>
          </div>

          {headers.length > 0 && (
            <>
              <hr className="modal-divider" />

              <section className="catalog-section">
                <h4 className="catalog-section-title">{t('catalog.import.mapping')}</h4>
                <p className="muted small">{t('catalog.import.matchHint')}</p>
                <div className="catalog-form-grid">
                  {headers.map((header, index) => (
                    <div key={`${header}-${index}`} className="row-gap tight catalog-field">
                      <label className="label" htmlFor={`catalog-import-column-${index}`}>
                        {header}
                      </label>
                      <select
                        id={`catalog-import-column-${index}`}
                        className="input"
                        value={mapping[index] || IGNORE_COLUMN}
                        onChange={(event) => setColumnMapping(index, event.target.value)}
                      >
                        <option value={IGNORE_COLUMN}>{t('catalog.import.ignore')}</option>
                        {CATALOG_FIELDS.map((field) => (
                          <option key={field.key} value={field.key}>
                            {t(field.labelKey)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </section>

              <hr className="modal-divider" />

              <section className="catalog-section">
                <h4 className="catalog-section-title">{t('catalog.import.preview')}</h4>
                <p className="muted small">
                  {t('catalog.import.previewNote', {
                    count: previewRows.length,
                    total: dataRows.length,
                  })}
                </p>
                <div className="stats-table-wrap">
                  <table className="stats-table">
                    <thead>
                      <tr>
                        {headers.map((header, index) => (
                          <th key={`${header}-${index}`} scope="col">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {headers.map((_header, columnIndex) => (
                            <td key={columnIndex} className="stats-text">
                              {row[columnIndex] || ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {!hasIdentity && headers.length > 0 && (
            <p className="muted small">{t('catalog.import.unmapped')}</p>
          )}
          {summary && (
            <p className="muted small">
              {t('catalog.import.done', {
                worksCreated: summary.worksCreated,
                holdingsCreated: summary.holdingsCreated,
                holdingsUpdated: summary.holdingsUpdated,
                skipped: summary.skipped,
              })}
            </p>
          )}
          {error && <p className="error">{error}</p>}
        </div>

        <div className="row-between event-modal-actions">
          <div />
          <div className="event-modal-action-buttons">
            <button type="button" className="btn" onClick={requestClose}>
              {t('catalog.modal.close')}
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => void startImport()}
              disabled={isImporting || !hasIdentity || dataRows.length === 0}
            >
              {t('catalog.import.start')}
            </button>
          </div>
        </div>

        {isImporting && (
          <WaitingMessage className="event-modal-saving waiting-message-accent">
            {t('catalog.import.importing')}
          </WaitingMessage>
        )}
      </div>
    </div>
  );
}
