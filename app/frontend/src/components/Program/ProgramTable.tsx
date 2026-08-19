import { ProgramRow } from '../../lib/types';
import { useLanguage } from '../../context/LanguageContext';
import { PROGRAM_COLUMNS, ProgramColumn, createEmptyProgramRow } from '../../lib/program';
import AutoResizeTextarea from '../AutoResizeTextarea';
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
}: {
  rows: ProgramRow[];
  onChange?: (rows: ProgramRow[]) => void;
  readOnly: boolean;
}) {
  const { t } = useLanguage();

  if (readOnly && rows.length === 0) return null;

  function updateCell(rowId: string, column: ProgramColumn, value: string) {
    if (!onChange) return;
    onChange(rows.map((row) => (row.id === rowId ? { ...row, [column]: value } : row)));
  }

  function addRow() {
    if (!onChange) return;
    onChange([...rows, createEmptyProgramRow()]);
  }

  function deleteRow(rowId: string) {
    if (!onChange) return;
    onChange(rows.filter((row) => row.id !== rowId));
  }

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
                <td colSpan={PROGRAM_COLUMNS.length + (readOnly ? 1 : 2)}>
                  <span className="muted small">{t('program.empty')}</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <button type="button" className="btn btn-sm program-add-row" onClick={addRow}>
          {t('program.addRow')}
        </button>
      )}
    </div>
  );
}
