export type ProgramRow = {
  id: string;
  composer: string;
  title: string;
  instrumentation: string;
  length: string;
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


