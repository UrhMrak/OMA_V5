export type EventItem = {
  id: string;
  dateISO: string;
  title: string;
  color: string;
  program?: string;
  conductor?: string;
  soloists?: string;
  otherParticipants?: string;
  ensemble?: string;
  activity?: string;
  venue?: string;
  dress?: string;
  endDateISO?: string;
  libraryPath?: string;
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
  children?: LibraryNode[]; // only for folders
};


