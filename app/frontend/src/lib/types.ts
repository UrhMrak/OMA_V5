export type ProgramRow = {
  id: string;
  composer: string;
  title: string;
  instrumentation: string;
  length: string;
  catalogWorkId?: string;
};

export type CatalogMaterialType = 'owned' | 'rental' | 'borrowed' | 'manuscript';

/** A physical set of music on the shelf. */
export type CatalogHolding = {
  id: string;
  work_id: string;
  accession_no: string | null;
  material_type: CatalogMaterialType;
  publisher: string | null;
  edition: string | null;
  location_cabinet: string | null;
  location_shelf: string | null;
  location_slot: string | null;
  parts_summary: string | null;
  score_count: number | null;
  condition: string | null;
  acquired_on: string | null;
  rental_due_on: string | null;
  notes: string | null;
};

/** A composition, which may have zero, one or several physical holdings. */
export type CatalogWork = {
  id: string;
  composer: string;
  title: string;
  subtitle: string | null;
  catalog_number: string | null;
  arranger: string | null;
  genre: string | null;
  instrumentation: string | null;
  duration_minutes: number | null;
  movements: string | null;
  keywords: string | null;
  notes: string | null;
  catalog_holdings?: CatalogHolding[];
};

export type SeatingPlayer = {
  id: string;
  name: string;
};

export type SeatingSection = {
  id: string;
  instrument: string;
  customLabel?: string;
  sharesStands: boolean;
  players: SeatingPlayer[];
  covers: SeatingPlayer[];
};

export type SeatingChart = {
  sections: SeatingSection[];
};

export type EventItem = {
  id: string;
  dateISO: string;
  title: string;
  color: string;
  program?: string;
  programRows?: ProgramRow[];
  seatingChart?: SeatingChart;
  stagePdfPath?: string;
  conductor?: string;
  soloists?: string;
  otherParticipants?: string;
  ensemble?: string;
  activity?: string;
  venue?: string;
  dress?: string;
  other?: string;
  endDateISO?: string;
  libraryPath?: string;
  projectId?: string;
  projectIdOverridden?: boolean;
};

export type PostItem = {
  id: string;
  createdAtISO: string;
  title: string;
  content: string;
  attachments?: Array<{
    id: string;
    name: string;
    storedFilename?: string;
    size: number;
    mimeType: string;
    downloadUrl?: string;
  }>;
};

export type LibraryNode = {
  name: string;
  type: 'folder' | 'file';
  path?: string; // relative path from uploads directory
  mimeType?: string;
  children?: LibraryNode[]; // only for folders
};


