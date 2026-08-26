import { CatalogWork } from '../../lib/types';
import { useLanguage } from '../../context/LanguageContext';
import {
  CatalogSortKey,
  SortDirection,
  formatWorkLocations,
  formatWorkTitle,
  getHoldings,
} from '../../lib/catalog';

type CatalogColumn = {
  key: CatalogSortKey;
  labelKey: string;
  value: (work: CatalogWork) => string;
  cellClassName?: string;
  truncate?: boolean;
};

const COLUMNS: CatalogColumn[] = [
  {
    key: 'composer',
    labelKey: 'catalog.col.composer',
    value: (work) => work.composer,
    cellClassName: 'stats-text',
  },
  {
    key: 'title',
    labelKey: 'catalog.col.title',
    value: formatWorkTitle,
    cellClassName: 'stats-text',
  },
  {
    key: 'instrumentation',
    labelKey: 'catalog.col.instrumentation',
    value: (work) => work.instrumentation || '',
    cellClassName: 'catalog-instrumentation',
    truncate: true,
  },
  {
    key: 'duration',
    labelKey: 'catalog.col.duration',
    value: (work) => (work.duration_minutes === null ? '' : `${work.duration_minutes}`),
    cellClassName: 'stats-nowrap',
  },
  {
    key: 'copies',
    labelKey: 'catalog.col.copies',
    value: (work) => `${getHoldings(work).length}`,
    cellClassName: 'stats-nowrap',
  },
  {
    key: 'location',
    labelKey: 'catalog.col.location',
    value: formatWorkLocations,
    cellClassName: 'catalog-location',
    truncate: true,
  },
];

function SortIndicator({ direction }: { direction: SortDirection }) {
  return (
    <span className="catalog-sort-indicator" aria-hidden="true">
      {direction === 'asc' ? '\u2191' : '\u2193'}
    </span>
  );
}

export default function CatalogTable({
  works,
  sortKey,
  sortDirection,
  onSort,
  onSelect,
}: {
  works: CatalogWork[];
  sortKey: CatalogSortKey;
  sortDirection: SortDirection;
  onSort: (key: CatalogSortKey) => void;
  onSelect: (work: CatalogWork) => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="stats-table-wrap">
      <table className="stats-table catalog-table">
        <thead>
          <tr>
            {COLUMNS.map((column) => {
              const isSorted = column.key === sortKey;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'
                  }
                >
                  <button
                    type="button"
                    className="catalog-sort-button"
                    aria-label={t('catalog.sortAria', { column: t(column.labelKey) })}
                    onClick={() => onSort(column.key)}
                  >
                    {t(column.labelKey)}
                    {isSorted && <SortIndicator direction={sortDirection} />}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {works.map((work) => (
            <tr
              key={work.id}
              className="stats-row-clickable"
              tabIndex={0}
              role="button"
              aria-label={t('catalog.rowOpenAria')}
              onClick={() => onSelect(work)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(work);
                }
              }}
            >
              {COLUMNS.map((column) => {
                const text = column.value(work);
                return (
                  <td
                    key={column.key}
                    className={column.cellClassName}
                    title={column.truncate ? text : undefined}
                  >
                    {text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
