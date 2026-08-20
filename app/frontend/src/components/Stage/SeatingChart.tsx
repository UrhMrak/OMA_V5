import { useState } from 'react';
import { SeatingChart as SeatingChartData, SeatingPlayer, SeatingSection } from '../../lib/types';
import { useLanguage } from '../../context/LanguageContext';
import DeleteIcon from '../icons/DeleteIcon';
import {
  CUSTOM_INSTRUMENT,
  InstrumentSlot,
  createSeatingPlayer,
  getInstrumentLabelKey,
  getInstrumentSlot,
  groupPlayersIntoStands,
  isPlayerNamed,
  isSectionEmpty,
} from '../../lib/seating';

const LEFT_COLUMN_SLOTS: InstrumentSlot[] = [
  'flute',
  'oboe',
  'clarinet',
  'bassClarinet',
  'bassoon',
  'contrabassoon',
  'horn',
  'trumpet',
  'trombone',
  'bassTrombone',
  'tuba',
  'harp',
  'piano',
  'timpani',
  'percussion',
  'extras',
];

const RIGHT_COLUMN_SLOTS: InstrumentSlot[] = [
  'violin1',
  'violin2',
  'viola',
  'cello',
  'bass',
];

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`stage-section-chevron${expanded ? ' expanded' : ''}`}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function sectionLabel(
  section: SeatingSection,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  if (section.instrument === CUSTOM_INSTRUMENT || section.customLabel) {
    return (section.customLabel || '').trim() || t('stage.instruments.custom');
  }
  return t(getInstrumentLabelKey(section.instrument));
}

function playerRemoveLabel(
  player: SeatingPlayer,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  return t('stagePage.removePlayer', { name: player.name.trim() || player.id });
}

export default function SeatingChart({
  chart,
  conductor,
  readOnly,
  onChange,
}: {
  chart: SeatingChartData;
  conductor: string;
  readOnly: boolean;
  onChange?: (chart: SeatingChartData) => void;
}) {
  const { t } = useLanguage();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const visibleSections = readOnly
    ? chart.sections.filter((section) => !isSectionEmpty(section))
    : chart.sections;

  const sectionsBySlot = new Map<InstrumentSlot, SeatingSection[]>();
  for (const section of visibleSections) {
    const slot = getInstrumentSlot(section.instrument);
    const existing = sectionsBySlot.get(slot);
    if (existing) existing.push(section);
    else sectionsBySlot.set(slot, [section]);
  }

  function toggleSection(sectionId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  function updateSections(sections: SeatingSection[]) {
    onChange?.({ sections });
  }

  function updateSection(sectionId: string, nextSection: SeatingSection) {
    updateSections(
      chart.sections.map((section) => (section.id === sectionId ? nextSection : section))
    );
  }

  function removeSection(sectionId: string) {
    updateSections(chart.sections.filter((section) => section.id !== sectionId));
  }

  function updatePlayerList(
    section: SeatingSection,
    list: 'players' | 'covers',
    players: SeatingPlayer[]
  ) {
    updateSection(section.id, { ...section, [list]: players });
  }

  function movePlayer(
    section: SeatingSection,
    list: 'players' | 'covers',
    index: number,
    direction: -1 | 1
  ) {
    const nextIndex = index + direction;
    const players = [...section[list]];
    if (nextIndex < 0 || nextIndex >= players.length) return;
    const [moved] = players.splice(index, 1);
    players.splice(nextIndex, 0, moved);
    updatePlayerList(section, list, players);
  }

  function renderPlayerEditor(section: SeatingSection, list: 'players' | 'covers') {
    return (
      <ul className="stage-edit-list">
        {section[list].map((player, index) => (
          <li key={player.id} className="stage-edit-row">
            <input
              className="input"
              type="text"
              value={player.name}
              aria-label={t('stagePage.searchPlayer')}
              onChange={(event) => {
                const players = section[list].map((entry) =>
                  entry.id === player.id ? { ...entry, name: event.target.value } : entry
                );
                updatePlayerList(section, list, players);
              }}
            />
            <button
              type="button"
              className="icon-button"
              aria-label={t('stagePage.moveUp')}
              title={t('stagePage.moveUp')}
              disabled={index === 0}
              onClick={() => movePlayer(section, list, index, -1)}
            >
              ▲
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={t('stagePage.moveDown')}
              title={t('stagePage.moveDown')}
              disabled={index === section[list].length - 1}
              onClick={() => movePlayer(section, list, index, 1)}
            >
              ▼
            </button>
            <button
              type="button"
              className="icon-button delete-button"
              aria-label={playerRemoveLabel(player, t)}
              title={playerRemoveLabel(player, t)}
              onClick={() =>
                updatePlayerList(
                  section,
                  list,
                  section[list].filter((entry) => entry.id !== player.id)
                )
              }
            >
              <DeleteIcon size={16} />
            </button>
          </li>
        ))}
      </ul>
    );
  }

  function renderNames(section: SeatingSection) {
    const players = readOnly ? section.players.filter(isPlayerNamed) : section.players;
    const covers = readOnly ? section.covers.filter(isPlayerNamed) : section.covers;

    if (readOnly) {
      return (
        <div className="stage-section-body">
          {section.sharesStands ? (
            <ol className="stage-stands">
              {groupPlayersIntoStands(players).map((stand, index) => (
                <li key={`${section.id}-stand-${index}`} className="stage-stand">
                  <span className="stage-stand-number">{index + 1}</span>
                  <span className="stage-stand-brace" aria-hidden="true" />
                  <div className="stage-stand-names">
                    {stand.map((player) => (
                      <div key={player.id}>{player.name}</div>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <ul className="stage-name-list">
              {players.map((player) => (
                <li key={player.id}>{player.name}</li>
              ))}
            </ul>
          )}
          {covers.length > 0 && (
            <div className="stage-covers">
              <div className="stage-covers-label">{t('stagePage.covers')}</div>
              <ul className="stage-name-list">
                {covers.map((player) => (
                  <li key={player.id}>{player.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="stage-section-body">
        {section.sharesStands && players.filter(isPlayerNamed).length > 0 && (
          <ol className="stage-stands stage-stands-preview">
            {groupPlayersIntoStands(players.filter(isPlayerNamed)).map((stand, index) => (
              <li key={`${section.id}-preview-${index}`} className="stage-stand">
                <span className="sr-only">{t('stagePage.stand', { number: index + 1 })}</span>
                <span className="stage-stand-number" aria-hidden="true">{index + 1}</span>
                <span className="stage-stand-brace" aria-hidden="true" />
                <div className="stage-stand-names">
                  {stand.map((player) => (
                    <div key={player.id}>{player.name}</div>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}
        {renderPlayerEditor(section, 'players')}
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => updatePlayerList(section, 'players', [...section.players, createSeatingPlayer()])}
        >
          {t('stagePage.addPlayer')}
        </button>
        <div className="stage-covers">
          <div className="stage-covers-label">{t('stagePage.covers')}</div>
          {renderPlayerEditor(section, 'covers')}
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => updatePlayerList(section, 'covers', [...section.covers, createSeatingPlayer()])}
          >
            {t('stagePage.addCover')}
          </button>
        </div>
        <button
          type="button"
          className="btn btn-sm danger"
          onClick={() => removeSection(section.id)}
        >
          {t('stagePage.removeInstrument', { instrument: sectionLabel(section, t) })}
        </button>
      </div>
    );
  }

  function renderSection(section: SeatingSection) {
    const expanded = expandedIds.has(section.id);
    const label = sectionLabel(section, t);
    const playerCount = section.players.filter(isPlayerNamed).length;
    const titledLabel = `${label} (${playerCount})`;
    return (
      <article key={section.id} className={`stage-section${expanded ? ' expanded' : ''}`}>
        <button
          type="button"
          className="stage-section-toggle"
          aria-expanded={expanded}
          aria-label={
            expanded
              ? t('stagePage.collapseSection', { instrument: titledLabel })
              : t('stagePage.expandSection', { instrument: titledLabel })
          }
          onClick={() => toggleSection(section.id)}
        >
          <span className="stage-section-title">
            {label}{' '}
            <span className="stage-section-count">({playerCount})</span>
          </span>
          <ChevronIcon expanded={expanded} />
        </button>
        {expanded && renderNames(section)}
      </article>
    );
  }

  function renderSlot(slot: InstrumentSlot) {
    const sections = sectionsBySlot.get(slot) || [];
    if (sections.length === 0) return null;
    return (
      <div key={slot} className="stage-slot">
        {sections.map(renderSection)}
      </div>
    );
  }

  return (
    <div className="stage-chart" role="group" aria-label={t('stagePage.title')}>
      <div className="stage-conductor">
        <div className="stage-conductor-label">{t('stagePage.conductor')}</div>
        {conductor ? <div className="stage-conductor-name">{conductor}</div> : null}
      </div>
      <div className="stage-columns">
        <div className="stage-column">
          {LEFT_COLUMN_SLOTS.map(renderSlot)}
        </div>
        <div className="stage-column">
          {RIGHT_COLUMN_SLOTS.map(renderSlot)}
        </div>
      </div>
    </div>
  );
}
