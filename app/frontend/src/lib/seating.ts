import { EventItem, SeatingChart, SeatingPlayer, SeatingSection } from './types';
import { api } from './api';
import { getProjectEvents } from './program';
import { ProjectOption } from './projectOptions';

export const STRING_INSTRUMENTS = ['violin1', 'violin2', 'viola', 'cello', 'bass'] as const;

export const CUSTOM_INSTRUMENT = 'custom';

export const WEEK_34_KEY = '26|34';
export const WEEK_35_KEY = '26|35';

export type InstrumentSlot =
  | 'percussion'
  | 'timpani'
  | 'harp'
  | 'piano'
  | 'extras'
  | 'horn'
  | 'trumpet'
  | 'trombone'
  | 'bassTrombone'
  | 'tuba'
  | 'flute'
  | 'oboe'
  | 'clarinet'
  | 'bassClarinet'
  | 'bassoon'
  | 'contrabassoon'
  | 'violin1'
  | 'cello'
  | 'viola'
  | 'violin2'
  | 'bass';

export type InstrumentCatalogEntry = {
  key: string;
  sharesStands: boolean;
  slot: InstrumentSlot;
};

export const INSTRUMENT_CATALOG: InstrumentCatalogEntry[] = [
  { key: 'flute', sharesStands: false, slot: 'flute' },
  { key: 'oboe', sharesStands: false, slot: 'oboe' },
  { key: 'clarinet', sharesStands: false, slot: 'clarinet' },
  { key: 'bassClarinet', sharesStands: false, slot: 'bassClarinet' },
  { key: 'bassoon', sharesStands: false, slot: 'bassoon' },
  { key: 'contrabassoon', sharesStands: false, slot: 'contrabassoon' },
  { key: 'horn', sharesStands: false, slot: 'horn' },
  { key: 'trumpet', sharesStands: false, slot: 'trumpet' },
  { key: 'trombone', sharesStands: false, slot: 'trombone' },
  { key: 'bassTrombone', sharesStands: false, slot: 'bassTrombone' },
  { key: 'tuba', sharesStands: false, slot: 'tuba' },
  { key: 'harp', sharesStands: false, slot: 'harp' },
  { key: 'piano', sharesStands: false, slot: 'piano' },
  { key: 'timpani', sharesStands: false, slot: 'timpani' },
  { key: 'percussion', sharesStands: false, slot: 'percussion' },
  { key: 'violin1', sharesStands: true, slot: 'violin1' },
  { key: 'violin2', sharesStands: true, slot: 'violin2' },
  { key: 'viola', sharesStands: true, slot: 'viola' },
  { key: 'cello', sharesStands: true, slot: 'cello' },
  { key: 'bass', sharesStands: true, slot: 'bass' },
];

export const DEFAULT_INSTRUMENT_KEYS = [
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
  'violin1',
  'violin2',
  'viola',
  'cello',
  'bass',
] as const;

const CATALOG_BY_KEY = new Map(INSTRUMENT_CATALOG.map((entry) => [entry.key, entry]));

let seatingIdCounter = 0;

function createSeatingId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  seatingIdCounter += 1;
  return `${prefix}-${Date.now()}-${seatingIdCounter}`;
}

export function createSeatingPlayer(name = ''): SeatingPlayer {
  return { id: createSeatingId('player'), name };
}

export function createSeatingSection(
  instrument: string,
  options?: { customLabel?: string; sharesStands?: boolean }
): SeatingSection {
  const catalog = CATALOG_BY_KEY.get(instrument);
  return {
    id: createSeatingId('section'),
    instrument,
    customLabel: options?.customLabel,
    sharesStands: options?.sharesStands ?? catalog?.sharesStands ?? false,
    players: [],
    covers: [],
  };
}

export function getInstrumentSlot(instrument: string): InstrumentSlot {
  return CATALOG_BY_KEY.get(instrument)?.slot ?? 'extras';
}

export function instrumentSharesStands(instrument: string): boolean {
  return CATALOG_BY_KEY.get(instrument)?.sharesStands ?? false;
}

export function getInstrumentLabelKey(instrument: string): string {
  if (instrument === CUSTOM_INSTRUMENT || !CATALOG_BY_KEY.has(instrument)) {
    return 'stage.instruments.custom';
  }
  return `stage.instruments.${instrument}`;
}

function normalizePlayer(player: Partial<SeatingPlayer> | string): SeatingPlayer {
  if (typeof player === 'string') {
    return createSeatingPlayer(player);
  }
  return {
    id: player.id || createSeatingId('player'),
    name: player.name || '',
  };
}

function normalizeSection(section: Partial<SeatingSection>): SeatingSection {
  const instrument = (section.instrument || CUSTOM_INSTRUMENT).trim() || CUSTOM_INSTRUMENT;
  return {
    id: section.id || createSeatingId('section'),
    instrument,
    customLabel: section.customLabel,
    sharesStands: section.sharesStands ?? instrumentSharesStands(instrument),
    players: Array.isArray(section.players) ? section.players.map(normalizePlayer) : [],
    covers: Array.isArray(section.covers) ? section.covers.map(normalizePlayer) : [],
  };
}

export function normalizeSeatingChart(chart: unknown): SeatingChart {
  if (!chart || typeof chart !== 'object') return { sections: [] };
  const sections = (chart as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) return { sections: [] };
  return {
    sections: sections
      .filter((section): section is Partial<SeatingSection> => !!section && typeof section === 'object')
      .map(normalizeSection),
  };
}

export function emptySeatingChart(): SeatingChart {
  return { sections: [] };
}

export function createDefaultSeatingChart(): SeatingChart {
  return {
    sections: DEFAULT_INSTRUMENT_KEYS.map((key) => createSeatingSection(key)),
  };
}

export function withDefaultInstruments(chart: SeatingChart): SeatingChart {
  const remaining = [...chart.sections];
  const sections: SeatingSection[] = [];

  for (const key of DEFAULT_INSTRUMENT_KEYS) {
    const index = remaining.findIndex((section) => section.instrument === key);
    if (index >= 0) {
      sections.push(remaining.splice(index, 1)[0]);
    } else {
      sections.push(createSeatingSection(key));
    }
  }

  sections.push(...remaining);
  return { sections };
}

export function isPlayerNamed(player: SeatingPlayer): boolean {
  return player.name.trim().length > 0;
}

export function isSectionEmpty(section: SeatingSection): boolean {
  return !section.players.some(isPlayerNamed) && !section.covers.some(isPlayerNamed);
}

export function seatingHasNamedPlayers(chart: SeatingChart): boolean {
  return chart.sections.some((section) => !isSectionEmpty(section));
}

export function groupPlayersIntoStands(players: SeatingPlayer[]): SeatingPlayer[][] {
  const stands: SeatingPlayer[][] = [];
  for (let index = 0; index < players.length; index += 2) {
    stands.push(players.slice(index, index + 2));
  }
  return stands;
}

function hasStoredSeating(event: Partial<EventItem>): boolean {
  return Array.isArray(event.seatingChart?.sections) && event.seatingChart.sections.length > 0;
}

export function findSeatingForProject(events: EventItem[], projectId: string): SeatingChart {
  const projectEvents = getProjectEvents(events, projectId).sort((a, b) =>
    b.dateISO.localeCompare(a.dateISO)
  );
  if (projectEvents.length === 0) return emptySeatingChart();

  const withChart = projectEvents.find(hasStoredSeating);
  return withChart ? normalizeSeatingChart(withChart.seatingChart) : emptySeatingChart();
}

export function findConductorForProject(events: EventItem[], projectId: string): string {
  const projectEvents = getProjectEvents(events, projectId).sort((a, b) =>
    b.dateISO.localeCompare(a.dateISO)
  );
  return projectEvents.find((event) => (event.conductor || '').trim())?.conductor?.trim() || '';
}

export async function propagateSeatingToProject(
  events: EventItem[],
  projectId: string,
  chart: SeatingChart
): Promise<void> {
  const targets = getProjectEvents(events, projectId);
  if (targets.length === 0) return;

  const payload = { seatingChart: normalizeSeatingChart(chart) };
  await Promise.all(targets.map((event) => api.put(`/api/events/${event.id}`, payload)));
}

export function resolveSeatingForProject(
  events: EventItem[],
  projectId: string,
  option?: Pick<ProjectOption, 'title' | 'weekKeys'> | null
): SeatingChart {
  const stored = findSeatingForProject(events, projectId);
  if (seatingHasNamedPlayers(stored)) return stored;
  if (option && isWeek35KlassikinProject(option)) return createWeek35SeatingChart();
  if (option && isWeek34MenningarnottProject(option)) return createWeek34MenningarnottSeatingChart();
  if (option && isWeek34HljodritunProject(option)) return createWeek34SeatingChart();
  return stored;
}

export type SeatingSearchHit = {
  projectId: string;
  projectTitle: string;
  instrument: string;
  customLabel?: string;
  playerName: string;
  playerId: string;
};

export function searchAllSeating(
  events: EventItem[],
  projects: ProjectOption[],
  query: string
): SeatingSearchHit[] {
  const term = query.trim().toLowerCase();
  if (!term) return [];

  const hits: SeatingSearchHit[] = [];

  for (const project of projects) {
    const chart = resolveSeatingForProject(events, project.projectId, project);
    for (const section of chart.sections) {
      const named = [...section.players, ...section.covers].filter(isPlayerNamed);
      for (const player of named) {
        if (!player.name.toLowerCase().includes(term)) continue;
        hits.push({
          projectId: project.projectId,
          projectTitle: project.title,
          instrument: section.instrument,
          customLabel: section.customLabel,
          playerName: player.name,
          playerId: player.id,
        });
      }
    }
  }

  const latestByProject = new Map(
    projects.map((project) => [project.projectId, project.latestDateISO])
  );

  hits.sort((a, b) => {
    const dateCmp = (latestByProject.get(b.projectId) || '').localeCompare(
      latestByProject.get(a.projectId) || ''
    );
    if (dateCmp !== 0) return dateCmp;
    const titleCmp =
      (a.projectTitle || a.projectId).localeCompare(b.projectTitle || b.projectId) ||
      a.projectId.localeCompare(b.projectId);
    if (titleCmp !== 0) return titleCmp;
    return a.playerName.localeCompare(b.playerName);
  });

  return hits;
}

function foldTitle(value: string): string {
  return value.trim().toLowerCase();
}

export function isWeek34HljodritunProject(option: Pick<ProjectOption, 'title' | 'weekKeys'>): boolean {
  if (!option.weekKeys.has(WEEK_34_KEY)) return false;
  const title = foldTitle(option.title);
  return title.includes('hljóðritun') || title.includes('hljodritun');
}

export function isWeek34MenningarnottProject(
  option: Pick<ProjectOption, 'title' | 'weekKeys'>
): boolean {
  if (!option.weekKeys.has(WEEK_34_KEY)) return false;
  const title = foldTitle(option.title);
  return title.includes('menningarnótt') || title.includes('menningarnott');
}

export function isWeek35KlassikinProject(option: Pick<ProjectOption, 'title' | 'weekKeys'>): boolean {
  if (option.weekKeys.has(WEEK_35_KEY)) return true;
  const title = foldTitle(option.title);
  return title.includes('klassíkin okkar') || title.includes('klassikin okkar');
}

function namedSection(
  instrument: string,
  names: string[],
  covers: string[] = []
): SeatingSection {
  return {
    ...createSeatingSection(instrument),
    players: names.map((name) => createSeatingPlayer(name)),
    covers: covers.map((name) => createSeatingPlayer(name)),
  };
}

/** Roster from Vika 34 Hljómsveitarlisti — Menningarnótt (20.–22. ágúst 2026). */
export function createWeek34MenningarnottSeatingChart(): SeatingChart {
  return {
    sections: [
      namedSection('flute', ['Rafael Adobas', 'Áshildur Haraldsdóttir', 'Caterina Compagno']),
      namedSection('oboe', ['Julia Hantschel', 'Matthías Nardeau', 'Peter Tompkins']),
      namedSection('clarinet', ['Grímur Helgason', 'Rúnar Óskarsson']),
      namedSection('bassClarinet', []),
      namedSection('bassoon', ['Clara Manaud', 'Brjánn Ingason', 'Bryndís Þórsdóttir']),
      namedSection('contrabassoon', []),
      namedSection('horn', [
        'Stefán Jón Bernharðsson',
        'Emil Friðfinnsson',
        'Joseph Ognibene',
        'Yi-Ling Shih',
      ]),
      namedSection('trumpet', ['Zach Silberschlag', 'Einar Jónsson', 'Eiríkur Örn Pálsson']),
      namedSection('trombone', ['Jón Arnar Einarsson', 'Sigurður Þorbergsson']),
      namedSection('bassTrombone', ['David Bobroff']),
      namedSection('tuba', ['Charley Pollard']),
      namedSection('harp', ['Katie Buckley']),
      namedSection('piano', ['Liam Kaplan']),
      namedSection('timpani', ['Ginevra Palo', 'Bryndís Halla Gylfadóttir']),
      namedSection(
        'percussion',
        ['Frank Aarnink', 'Kjartan Guðnason', 'Emil Þorri Emilsson'],
        ['Bryndís Björgvinsdóttir']
      ),
      namedSection(
        'violin1',
        [
          'Una Sveinbjarnardóttir',
          'Zbigniew Dubik',
          'Herdís Mjöll Guðmundsdóttir',
          'Helga Þóra Björgvinsdóttir',
          'Pálína Árnadóttir',
          'Laura Liu',
          'Geirþrúður Ása Guðjónsdóttir Skelton',
          'Bryndís Pálsdóttir',
          'Margrét Kristjánsdóttir',
          'Hildigunnur Halldórsdóttir',
        ],
        ['Olga Björk Ólafsdóttir', 'Sigrún Harðardóttir', 'Laufey Jensdóttir', 'Lin Wei', 'Joanna Bauer']
      ),
      namedSection(
        'violin2',
        [
          'Alexandra Woroniecka',
          'Justyna Bidler',
          'Kristján Matthíasson',
          'Sólrún Ylfa Ingimarsdóttir',
          'Ólöf Þorvarðsdóttir',
          'Þórdís Stross',
          'Hekla Finnsdóttir',
          'Sólveig Steinþórsdóttir',
        ],
        [
          'Sigurlaug Eðvaldsdóttir',
          'Ingrid Karlsdóttir',
          'Margrét Þorsteinsdóttir',
          'Emma Garðarsdóttir',
          'Gunnhildur Daðadóttir',
        ]
      ),
      namedSection(
        'viola',
        [
          'Rita Porfiris',
          'Sarah Buckley',
          'Guðrún Hrund Harðardóttir',
          'Guðrún Þórarinsdóttir',
          'Sigrún Mary McCormick',
          'Eyjólfur Bjarni Alfreðsson',
        ],
        ['Guðbjartur Hákonarson', 'Þórarinn Már Baldursson', 'Svava Bernharðsdóttir']
      ),
      namedSection('cello', [
        'Sigurgeir Agnarsson',
        'Steiney Sigurðardóttir',
        'Guðný Jónasdóttir',
        'Hrafnkell Orri Egilsson',
        'Margrét Árnadóttir',
        'Sigurður Bjarki Gunnarsson',
        'Urh Mrak',
      ]),
      namedSection(
        'bass',
        ['Xun Yang', 'Jacek Karwan', 'Gunnlaugur Torfi Stefánsson', 'Richard Korn'],
        ['T.C. Fitzgerald']
      ),
    ],
  };
}

/** Roster from Vika 34 Hljómsveitarlisti — Hljóðritun (17. ágúst 2026). */
export function createWeek34SeatingChart(): SeatingChart {
  return {
    sections: [
      namedSection('flute', ['Rafael Adobas', 'Áshildur Haraldsdóttir']),
      namedSection('oboe', ['Julia Hantschel', 'Matthías Nardeau', 'Peter Tompkins']),
      namedSection('clarinet', ['Grímur Helgason', 'Rúnar Óskarsson']),
      namedSection('bassClarinet', []),
      namedSection('bassoon', ['Clara Manaud', 'Brjánn Ingason', 'Bryndís Þórsdóttir']),
      namedSection('contrabassoon', []),
      namedSection('horn', [
        'Stefán Jón Bernharðsson',
        'Emil Friðfinnsson',
        'Joseph Ognibene',
        'Yi-Ling Shih',
        'Kristján Matthíasson',
      ]),
      namedSection('trumpet', ['Zach Silberschlag', 'Einar Jónsson', 'Eiríkur Örn Pálsson']),
      namedSection('trombone', ['Jón Arnar Einarsson', 'Sigurður Þorbergsson']),
      namedSection('bassTrombone', ['David Bobroff']),
      namedSection('tuba', ['Daníel Birkir Snorrason']),
      namedSection('harp', ['Katie Buckley']),
      namedSection('piano', ['Liam Kaplan']),
      namedSection('timpani', ['Ginevra Palo', 'Bryndís Halla Gylfadóttir']),
      namedSection(
        'percussion',
        ['Frank Aarnink', 'Steef van Oosterhout', 'Kjartan Guðnason'],
        ['Bryndís Björgvinsdóttir']
      ),
      namedSection(
        'violin1',
        [
          'Una Sveinbjarnardóttir',
          'Zbigniew Dubik',
          'Herdís Mjöll Guðmundsdóttir',
          'Helga Þóra Björgvinsdóttir',
          'Sigrún Harðardóttir',
          'Laura Liu',
          'Geirþrúður Ása Guðjónsdóttir Skelton',
          'Bryndís Pálsdóttir',
          'Hildigunnur Halldórsdóttir',
          'Lin Wei',
          'Margrét Kristjánsdóttir',
          'Joanna Bauer',
          'Olga Björk Ólafsdóttir',
        ],
        ['Pálína Árnadóttir', 'Laufey Jensdóttir']
      ),
      namedSection(
        'violin2',
        [
          'Alexandra Woroniecka',
          'Sólveig Steinþórsdóttir',
          'Emma Garðarsdóttir',
          'Þórdís Stross',
          'Sigurlaug Eðvaldsdóttir',
          'Margrét Þorsteinsdóttir',
          'Ingrid Karlsdóttir',
          'Hekla Finnsdóttir',
        ],
        ['Justyna Bidler', 'Sólrún Ylfa Ingimarsdóttir', 'Ólöf Þorvarðsdóttir', 'Gunnhildur Daðadóttir']
      ),
      namedSection(
        'viola',
        [
          'Rita Porfiris',
          'Sarah Buckley',
          'Guðrún Hrund Harðardóttir',
          'Guðrún Þórarinsdóttir',
          'Sigrún Mary McCormick',
          'Eyjólfur Bjarni Alfreðsson',
        ],
        ['Guðbjartur Hákonarson', 'Þórarinn Már Baldursson', 'Svava Bernharðsdóttir']
      ),
      namedSection('cello', [
        'Sigurgeir Agnarsson',
        'Steiney Sigurðardóttir',
        'Guðný Jónasdóttir',
        'Hrafnkell Orri Egilsson',
        'Margrét Árnadóttir',
        'Sigurður Bjarki Gunnarsson',
        'Urh Mrak',
      ]),
      namedSection(
        'bass',
        ['Xun Yang', 'Jacek Karwan', 'Gunnlaugur Torfi Stefánsson', 'Richard Korn'],
        ['T.C. Fitzgerald']
      ),
    ],
  };
}

/** Roster from Vika 35 Hljómsveitarlisti — Klassíkin okkar (25.–28. ágúst 2026). */
export function createWeek35SeatingChart(): SeatingChart {
  return {
    sections: [
      namedSection('flute', [
        'Rafael Adobas',
        'Áshildur Haraldsdóttir',
        'Caterina Compagno',
        'Pálína Árnadóttir',
        'Lin Wei',
      ]),
      namedSection('oboe', [
        'Matthías Nardeau',
        'Eydís Lára Franzdóttir',
        'Peter Tompkins',
        'Bryndís Pálsdóttir',
        'Helga Þóra Björgvinsdóttir',
      ]),
      namedSection('clarinet', [
        'Grímur Helgason',
        'Baldvin Ingvar Tryggvason',
        'Rúnar Óskarsson',
      ]),
      namedSection('bassClarinet', []),
      namedSection('bassoon', [
        'Clara Manaud',
        'Bryndís Þórsdóttir',
        'Sabina Aran Clota',
        'Sólveig Steinþórsdóttir',
        'Justyna Bidler',
      ]),
      namedSection('contrabassoon', []),
      namedSection('horn', [
        'Kristján Matthíasson',
        'Stefán Jón Bernharðsson',
        'Emil Friðfinnsson',
        'Jósef Ognibene',
        'Yi-Ling Shih',
      ]),
      namedSection('trumpet', [
        'Zach Silberschlag',
        'Einar Jónsson',
        'Eiríkur Örn Pálsson',
        'Szabolcs Koczur',
      ]),
      namedSection('trombone', [
        'Jón Arnar Einarsson',
        'Sigurður Þorbergsson',
        'Guðrún Hrund Harðardóttir',
      ]),
      namedSection('bassTrombone', ['David Bobroff', 'Herdís Anna Jónsdóttir']),
      namedSection('tuba', ['Charley Pollard', 'Steina Kristín Ingólfsdóttir']),
      namedSection('harp', ['Katie Buckley']),
      namedSection('piano', ['Liam Kaplan']),
      namedSection('timpani', ['Ginevra Palo', 'Bryndís Halla Gylfadóttir']),
      namedSection('percussion', [
        'Marco Santos',
        'Frank Aarnink',
        'Steef van Oosterhout',
      ], ['Bryndís Björgvinsdóttir']),
      namedSection(
        'violin1',
        [
          'Sigrún Eðvaldsdóttir',
          'Anton Miller',
          'Herdís Mjöll Guðmundsdóttir',
          'Joanna Bauer',
          'Sigrún Harðardóttir',
          'Margrét Kristjánsdóttir',
          'Hildigunnur Halldórsdóttir',
          'Matthildur Traustadóttir',
          'Olga Björk Ólafsdóttir',
          'Helga Diljá Jörundsdóttir',
          'Zbigniew Dubik',
        ],
        ['Laufey Jensdóttir']
      ),
      namedSection(
        'violin2',
        [
          'Gunnhildur Daðadóttir',
          'Hekla Finnsdóttir',
          'Ólöf Þorvarðsdóttir',
          'Emma Garðarsdóttir',
          'Ingrid Karlsdóttir',
          'Sigurlaug Eðvaldsdóttir',
          'Hlín Erlendsdóttir',
          'Margrét Þorsteinsdóttir',
          'Gróa Margrét Valdimarsdóttir',
        ],
        ['Sólrún Ylfa Ingimarsdóttir']
      ),
      namedSection(
        'viola',
        [
          'Þórunn Ósk Marinósdóttir',
          'Rita Porfiris',
          'Eyjólfur Bjarni Alfreðsson',
          'Guðbjartur Hákonarson',
          'Þórarinn Már Baldursson',
          'Sigrún Mary',
          'Kathryn Harrison',
        ],
        ['Guðrún Þórarinsdóttir']
      ),
      namedSection('cello', [
        'Sigurgeir Agnarsson',
        'Steiney Sigurðardóttir',
        'Urh Mrak',
        'Margrét Árnadóttir',
        'Sigurður Bjarki Gunnarsson',
        'Hrafnkell Orri Egilsson',
        'Guðný Jónasdóttir',
      ]),
      namedSection('bass', [
        'Xun Yang',
        'Adam Bernstein',
        'T.C. Fitzgerald',
        'Gunnlaugur Torfi Stefánsson',
        'Richard Korn',
        'Jacek Karwan',
      ]),
    ],
  };
}
