import { useState } from 'react';
import { CatalogHolding, CatalogMaterialType, CatalogWork } from '../../lib/types';
import { api } from '../../lib/api';
import { useLanguage } from '../../context/LanguageContext';
import { useModalClose } from '../Layout/useModalClose';
import {
  CATALOG_MATERIAL_TYPES,
  DEFAULT_MATERIAL_TYPE,
  formatWorkTitle,
  getHoldings,
} from '../../lib/catalog';
import AutoResizeTextarea from '../AutoResizeTextarea';
import DeleteIcon from '../icons/DeleteIcon';
import WaitingMessage from '../WaitingMessage';

type WorkForm = {
  composer: string;
  title: string;
  subtitle: string;
  catalog_number: string;
  arranger: string;
  genre: string;
  instrumentation: string;
  duration_minutes: string;
  movements: string;
  keywords: string;
  notes: string;
};

type HoldingForm = {
  id: string;
  isNew: boolean;
  accession_no: string;
  material_type: CatalogMaterialType;
  publisher: string;
  edition: string;
  location_cabinet: string;
  location_shelf: string;
  location_slot: string;
  parts_summary: string;
  score_count: string;
  condition: string;
  acquired_on: string;
  rental_due_on: string;
  notes: string;
};

let draftHoldingCounter = 0;

function text(value: string | number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function toWorkForm(work: CatalogWork | null): WorkForm {
  return {
    composer: text(work?.composer),
    title: text(work?.title),
    subtitle: text(work?.subtitle),
    catalog_number: text(work?.catalog_number),
    arranger: text(work?.arranger),
    genre: text(work?.genre),
    instrumentation: text(work?.instrumentation),
    duration_minutes: text(work?.duration_minutes),
    movements: text(work?.movements),
    keywords: text(work?.keywords),
    notes: text(work?.notes),
  };
}

function toHoldingForm(holding: CatalogHolding): HoldingForm {
  return {
    id: holding.id,
    isNew: false,
    accession_no: text(holding.accession_no),
    material_type: holding.material_type || DEFAULT_MATERIAL_TYPE,
    publisher: text(holding.publisher),
    edition: text(holding.edition),
    location_cabinet: text(holding.location_cabinet),
    location_shelf: text(holding.location_shelf),
    location_slot: text(holding.location_slot),
    parts_summary: text(holding.parts_summary),
    score_count: text(holding.score_count),
    condition: text(holding.condition),
    acquired_on: text(holding.acquired_on),
    rental_due_on: text(holding.rental_due_on),
    notes: text(holding.notes),
  };
}

function createHoldingForm(): HoldingForm {
  draftHoldingCounter += 1;
  return {
    id: `draft-${draftHoldingCounter}`,
    isNew: true,
    accession_no: '',
    material_type: DEFAULT_MATERIAL_TYPE,
    publisher: '',
    edition: '',
    location_cabinet: '',
    location_shelf: '',
    location_slot: '',
    parts_summary: '',
    score_count: '',
    condition: '',
    acquired_on: '',
    rental_due_on: '',
    notes: '',
  };
}

function holdingPayload(form: HoldingForm) {
  const { id: _id, isNew: _isNew, ...fields } = form;
  return fields;
}

export default function CatalogItemModal({
  work,
  onClose,
  onSaved,
}: {
  work: CatalogWork | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { t } = useLanguage();
  const { closing, requestClose } = useModalClose(onClose);
  const isCreating = !work;

  const [form, setForm] = useState<WorkForm>(() => toWorkForm(work));
  const [holdings, setHoldings] = useState<HoldingForm[]>(() =>
    work ? getHoldings(work).map(toHoldingForm) : []
  );
  const [removedHoldingIds, setRemovedHoldingIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  function updateWorkField(key: keyof WorkForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateHoldingField(id: string, key: keyof HoldingForm, value: string) {
    setHoldings((prev) =>
      prev.map((holding) => (holding.id === id ? { ...holding, [key]: value } : holding))
    );
  }

  function addHolding() {
    setHoldings((prev) => [...prev, createHoldingForm()]);
  }

  function removeHolding(id: string) {
    setHoldings((prev) => prev.filter((holding) => holding.id !== id));
    if (!id.startsWith('draft-')) setRemovedHoldingIds((prev) => [...prev, id]);
  }

  async function save() {
    if (isSaving) return;
    if (!form.composer.trim() && !form.title.trim()) {
      setError(t('catalog.modal.titleRequired'));
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      const savedWork = isCreating
        ? await api.post<CatalogWork>('/api/catalog/works', form)
        : await api.put<CatalogWork>(`/api/catalog/works/${work!.id}`, form);

      for (const id of removedHoldingIds) {
        await api.delete(`/api/catalog/holdings/${id}`);
      }

      for (const holding of holdings) {
        if (holding.isNew) {
          await api.post('/api/catalog/holdings', {
            work_id: savedWork.id,
            ...holdingPayload(holding),
          });
        } else {
          await api.put(`/api/catalog/holdings/${holding.id}`, holdingPayload(holding));
        }
      }

      await onSaved();
    } catch (saveError) {
      console.error('Save catalog entry failed:', saveError);
      setError(
        saveError instanceof Error && saveError.message
          ? saveError.message
          : t('catalog.modal.saveFailed')
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!work || isDeleting) return;
    const name = formatWorkTitle(work) || work.composer;
    if (!window.confirm(t('catalog.modal.deleteConfirm', { name }))) return;

    setIsDeleting(true);
    setError('');
    try {
      await api.delete(`/api/catalog/works/${work.id}`);
      await onSaved();
    } catch (deleteError) {
      console.error('Delete catalog entry failed:', deleteError);
      setError(t('catalog.modal.deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  }

  function workField(
    labelKey: string,
    key: keyof WorkForm,
    options?: { multiline?: boolean; type?: string; hintKey?: string }
  ) {
    return (
      <div className="row-gap tight catalog-field">
        <label className="label" htmlFor={`catalog-work-${key}`}>
          {t(labelKey)}
        </label>
        {options?.multiline ? (
          <AutoResizeTextarea
            id={`catalog-work-${key}`}
            className="textarea"
            value={form[key]}
            onChange={(event) => updateWorkField(key, event.target.value)}
          />
        ) : (
          <input
            id={`catalog-work-${key}`}
            className="input"
            type={options?.type || 'text'}
            value={form[key]}
            onChange={(event) => updateWorkField(key, event.target.value)}
          />
        )}
        {options?.hintKey && <span className="muted small">{t(options.hintKey)}</span>}
      </div>
    );
  }

  function holdingField(
    holding: HoldingForm,
    labelKey: string,
    key: keyof HoldingForm,
    options?: { type?: string; multiline?: boolean; hintKey?: string }
  ) {
    const fieldId = `catalog-holding-${holding.id}-${key}`;
    return (
      <div className="row-gap tight catalog-field">
        <label className="label" htmlFor={fieldId}>
          {t(labelKey)}
        </label>
        {options?.multiline ? (
          <AutoResizeTextarea
            id={fieldId}
            className="textarea"
            value={holding[key] as string}
            onChange={(event) => updateHoldingField(holding.id, key, event.target.value)}
          />
        ) : (
          <input
            id={fieldId}
            className="input"
            type={options?.type || 'text'}
            value={holding[key] as string}
            onChange={(event) => updateHoldingField(holding.id, key, event.target.value)}
          />
        )}
        {options?.hintKey && <span className="muted small">{t(options.hintKey)}</span>}
      </div>
    );
  }

  return (
    <div className={`modal-backdrop ${closing ? 'closing' : ''}`}>
      <div className={`modal ${closing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
        <h3 className="h3">
          {isCreating ? t('catalog.modal.createTitle') : t('catalog.modal.editTitle')}
        </h3>

        <div className="modal-body">
          <section className="catalog-section">
            <h4 className="catalog-section-title">{t('catalog.modal.workSection')}</h4>
            <div className="catalog-form-grid">
              {workField('catalog.field.composer', 'composer')}
              {workField('catalog.field.title', 'title')}
              {workField('catalog.field.subtitle', 'subtitle')}
              {workField('catalog.field.catalogNumber', 'catalog_number')}
              {workField('catalog.field.arranger', 'arranger')}
              {workField('catalog.field.genre', 'genre')}
              {workField('catalog.field.duration', 'duration_minutes', { type: 'number' })}
            </div>
            {workField('catalog.field.instrumentation', 'instrumentation', {
              multiline: true,
              hintKey: 'catalog.modal.instrumentationHint',
            })}
            {workField('catalog.field.movements', 'movements', { multiline: true })}
            {workField('catalog.field.keywords', 'keywords', {
              hintKey: 'catalog.modal.keywordsHint',
            })}
            {workField('catalog.field.workNotes', 'notes', { multiline: true })}
          </section>

          <hr className="modal-divider" />

          <section className="catalog-section">
            <h4 className="catalog-section-title">{t('catalog.modal.holdingsSection')}</h4>
            {holdings.length === 0 && <p className="muted small">{t('catalog.modal.noHoldings')}</p>}

            {holdings.map((holding, index) => (
              <div key={holding.id} className="catalog-holding">
                <div className="row-between catalog-holding-header">
                  <span className="catalog-holding-label">
                    {t('catalog.modal.holdingLabel', { number: index + 1 })}
                  </span>
                  <button
                    type="button"
                    className="icon-button delete-button"
                    aria-label={t('catalog.modal.removeHoldingAria', { number: index + 1 })}
                    title={t('catalog.modal.removeHolding')}
                    onClick={() => removeHolding(holding.id)}
                  >
                    <DeleteIcon size={16} />
                  </button>
                </div>
                <div className="catalog-form-grid">
                  {holdingField(holding, 'catalog.field.accessionNo', 'accession_no')}
                  <div className="row-gap tight catalog-field">
                    <label className="label" htmlFor={`catalog-holding-${holding.id}-material`}>
                      {t('catalog.field.materialType')}
                    </label>
                    <select
                      id={`catalog-holding-${holding.id}-material`}
                      className="input"
                      value={holding.material_type}
                      onChange={(event) =>
                        updateHoldingField(holding.id, 'material_type', event.target.value)
                      }
                    >
                      {CATALOG_MATERIAL_TYPES.map((materialType) => (
                        <option key={materialType} value={materialType}>
                          {t(`catalog.material.${materialType}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {holdingField(holding, 'catalog.field.cabinet', 'location_cabinet')}
                  {holdingField(holding, 'catalog.field.shelf', 'location_shelf')}
                  {holdingField(holding, 'catalog.field.slot', 'location_slot')}
                  {holdingField(holding, 'catalog.field.publisher', 'publisher')}
                  {holdingField(holding, 'catalog.field.edition', 'edition')}
                  {holdingField(holding, 'catalog.field.scoreCount', 'score_count', {
                    type: 'number',
                  })}
                  {holdingField(holding, 'catalog.field.condition', 'condition')}
                  {holdingField(holding, 'catalog.field.acquiredOn', 'acquired_on', {
                    type: 'date',
                  })}
                  {holdingField(holding, 'catalog.field.rentalDueOn', 'rental_due_on', {
                    type: 'date',
                  })}
                </div>
                {holdingField(holding, 'catalog.field.partsSummary', 'parts_summary', {
                  hintKey: 'catalog.modal.partsHint',
                })}
                {holdingField(holding, 'catalog.field.holdingNotes', 'notes', { multiline: true })}
              </div>
            ))}

            <button type="button" className="btn btn-sm" onClick={addHolding}>
              {t('catalog.modal.addHolding')}
            </button>
          </section>

          {error && <p className="error">{error}</p>}
        </div>

        <div className="row-between event-modal-actions">
          {!isCreating ? (
            <button
              type="button"
              className={isDeleting ? 'btn btn-sm danger' : 'icon-button delete-button'}
              onClick={() => void handleDelete()}
              disabled={isDeleting}
              aria-label={isDeleting ? t('catalog.modal.deleting') : t('catalog.modal.delete')}
              title={isDeleting ? t('catalog.modal.deleting') : t('catalog.modal.delete')}
            >
              {isDeleting ? (
                <WaitingMessage as="span" live="off">
                  {t('catalog.modal.deleting')}
                </WaitingMessage>
              ) : (
                <DeleteIcon size={16} />
              )}
            </button>
          ) : (
            <div />
          )}
          <div className="event-modal-action-buttons">
            <button type="button" className="btn" onClick={requestClose}>
              {t('catalog.modal.cancel')}
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => void save()}
              disabled={isSaving}
            >
              {t('catalog.modal.save')}
            </button>
          </div>
        </div>

        {isSaving && (
          <WaitingMessage className="event-modal-saving waiting-message-accent">
            {t('catalog.modal.saving')}
          </WaitingMessage>
        )}
      </div>
    </div>
  );
}
