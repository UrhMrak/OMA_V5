import { useMemo, useState } from 'react';
import { CatalogWork, ProgramRow } from '../../lib/types';
import { useLanguage } from '../../context/LanguageContext';
import {
  PROGRAM_COLUMNS,
  ProgramColumn,
  createEmptyProgramRow,
  sumProgramLengths,
} from '../../lib/program';
import {
  buildWorkMatchIndex,
  findWorkById,
  formatWorkLocations,
  formatWorkTitle,
  matchProgramRow,
} from '../../lib/catalog';
import AutoResizeTextarea from '../AutoResizeTextarea';
import CatalogPickerModal from '../Catalog/CatalogPickerModal';
import DeleteIcon from '../icons/DeleteIcon';

const COLUMN_LABEL_KEYS: Record<ProgramColumn, string> = {
  composer: 'program.composer',
  title: 'program.title',
  instrumentation: 'program.instrumentation',
  length: 'program.length',
};

export default function ProgramTable({
  rows,
  onChange,
  readOnly,
  catalog,
}: {
  rows: ProgramRow[];
  onChange?: (rows: ProgramRow[]) => void;
  readOnly: boolean;
  /** Supplied for admins only; its presence adds the library location column. */
  catalog?: CatalogWork[];
}) {
  const { t } = useLanguage();
  const [pickerRowId, setPickerRowId] = useState<string | null>(null);
  const totalLength = sumProgramLengths(rows);

  const showCatalog = !!catalog && !!onChange;
  const matchIndex = useMemo(() => buildWorkMatchIndex(catalog || []), [catalog]);
  const pickerRow = rows.find((row) => row.id === pickerRowId) || null;

  if (readOnly && rows.length === 0) return null;

  function updateCell(rowId: string, column: ProgramColumn, value: string) {
    if (!onChange) return;
    onChange(rows.map((row) => (row.id === rowId ? { ...row, [column]: value } : row)));
  }

  function linkRow(rowId: string, workId: string | null) {
    if (!onChange) return;
    onChange(
      rows.map((row) => {
        if (row.id !== rowId) return row;
        if (!workId) {
          const { catalogWorkId: _unlinked, ...rest } = row;
          return rest;
        }
        return { ...row, catalogWorkId: workId };
      })
    );
  }

  function addRow() {
    if (!onChange) return;
    onChange([...rows, createEmptyProgramRow()]);
  }

  function deleteRow(rowId: string) {
    if (!onChange) return;
    onChange(rows.filter((row) => row.id !== rowId));
  }

  function catalogCell(row: ProgramRow, index: number) {
    const rowNumber = index + 1;
    const linkedWork = row.catalogWorkId
      ? findWorkById(catalog || [], row.catalogWorkId)
      : undefined;

    if (linkedWork) {
      const location = formatWorkLocations(linkedWork);
      return (
        <div className="program-catalog-cell">
          <span className="program-catalog-location">
            {location || t('catalog.program.noHolding')}
          </span>
          <div className="program-catalog-actions">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setPickerRowId(row.id)}
            >
              {t('catalog.program.change')}
            </button>
            <button
              type="button"
              className="btn btn-sm"
              aria-label={t('catalog.program.unlinkAria', { number: rowNumber })}
              onClick={() => linkRow(row.id, null)}
            >
              {t('catalog.program.unlink')}
            </button>
          </div>
        </div>
      );
    }

    const suggestion = matchProgramRow(row, matchIndex);
    if (suggestion) {
      const suggestedLocation = formatWorkLocations(suggestion);
      return (
        <div className="program-catalog-cell">
          <span className="muted small">
            {t('catalog.program.suggested', { name: formatWorkTitle(suggestion) })}
          </span>
          {suggestedLocation && (
            <span className="program-catalog-location">{suggestedLocation}</span>
          )}
          <div className="program-catalog-actions">
            <button
              type="button"
              className="btn btn-sm primary"
              aria-label={t('catalog.program.acceptAria', {
                number: rowNumber,
                name: formatWorkTitle(suggestion),
              })}
              onClick={() => linkRow(row.id, suggestion.id)}
            >
              {t('catalog.program.accept')}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="program-catalog-cell">
        <span className="muted small">{t('catalog.program.notInLibrary')}</span>
        <div className="program-catalog-actions">
          <button
            type="button"
            className="btn btn-sm"
            aria-label={t('catalog.program.linkAria', { number: rowNumber })}
            onClick={() => setPickerRowId(row.id)}
          >
            {t('catalog.program.link')}
          </button>
        </div>
      </div>
    );
  }

  const emptyRowColSpan =
    PROGRAM_COLUMNS.length + (readOnly ? 1 : 2) + (showCatalog ? 1 : 0);

  return (
    <div className="program-table-section">
      <div className="program-table-wrap">
        <table className="program-table">
          <thead>
            <tr>
              <th className="program-col-no" scope="col">{t('program.no')}</th>
              {PROGRAM_COLUMNS.map((column) => (
                <th key={column} className={`program-col-${column}`} scope="col">
                  {t(COLUMN_LABEL_KEYS[column])}
                </th>
              ))}
              {showCatalog && (
                <th className="program-col-catalog" scope="col">
                  {t('catalog.program.column')}
                </th>
              )}
              {!readOnly && <th className="program-col-actions" scope="col">
                <span className="sr-only">{t('program.actions')}</span>
              </th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id}>
                <td className="program-col-no">{index + 1}</td>
                {PROGRAM_COLUMNS.map((column) => (
                  <td key={column} className={`program-col-${column}`}>
                    {readOnly ? (
                      <span className="program-readonly-value">{row[column]}</span>
                    ) : (
                      <AutoResizeTextarea
                        className="textarea program-input"
                        value={row[column]}
                        aria-label={`${t(COLUMN_LABEL_KEYS[column])} ${index + 1}`}
                        onChange={(e) => updateCell(row.id, column, e.target.value)}
                      />
                    )}
                  </td>
                ))}
                {showCatalog && (
                  <td className="program-col-catalog">{catalogCell(row, index)}</td>
                )}
                {!readOnly && (
                  <td className="program-col-actions">
                    <button
                      type="button"
                      className="icon-button delete-button"
                      aria-label={t('program.deleteRow', { number: index + 1 })}
                      title={t('program.deleteRow', { number: index + 1 })}
                      onClick={() => deleteRow(row.id)}
                    >
                      <DeleteIcon size={16} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr className="program-empty-row">
                <td colSpan={emptyRowColSpan}>
                  <span className="muted small">{t('program.empty')}</span>
                </td>
              </tr>
            )}
          </tbody>
          {totalLength && (
            <tfoot>
              <tr className="program-total-row">
                <td colSpan={4} className="program-total-label">
                  {t('program.total')}
                </td>
                <td className="program-col-length program-total-value">{totalLength}</td>
                {showCatalog && <td className="program-col-catalog" />}
                {!readOnly && <td className="program-col-actions" />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {!readOnly && (
        <button type="button" className="btn btn-sm program-add-row" onClick={addRow}>
          {t('program.addRow')}
        </button>
      )}
      {showCatalog && pickerRow && (
        <CatalogPickerModal
          works={catalog || []}
          initialQuery={[pickerRow.composer, pickerRow.title].filter(Boolean).join(' ').trim()}
          onSelect={(work) => linkRow(pickerRow.id, work.id)}
          onClose={() => setPickerRowId(null)}
        />
      )}
    </div>
  );
}
