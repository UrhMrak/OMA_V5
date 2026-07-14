import { LibraryNode } from './types';

export type LibrarySearchResult = {
  item: LibraryNode;
  parentPath: string;
};

export type RecentLibraryFile = {
  path: string;
  name: string;
  openedAt: number;
};

const RECENT_KEY = 'oma:recentLibraryFiles';
const MAX_RECENT = 5;

export function encodePathSegment(segment: string): string {
  return segment.replace(/%/g, '%25').replace(/\//g, '%2F');
}

export function decodePathSegment(segment: string): string {
  return segment.replace(/%2F/gi, '/').replace(/%25/g, '%');
}

function normalizeLibraryPath(path: string): string {
  return path.replace(/^\/+|\/+$/g, '').trim();
}

export function splitLibraryPath(path: string): string[] {
  const normalized = normalizeLibraryPath(path);
  if (!normalized) return [];
  const parts = normalized
    .split('/')
    .map((segment) => decodePathSegment(segment.trim()))
    .filter((segment) => segment.length > 0);
  if (parts[0]?.toLowerCase() === 'uploads') {
    parts.shift();
  }
  return parts;
}

export function segmentsToLibraryPath(segments: string[]): string {
  return segments
    .map((segment) => encodePathSegment(segment.trim()))
    .filter((segment) => segment.length > 0)
    .join('/');
}

export function appendToLibraryPath(parentPath: string, name: string): string {
  const encodedName = encodePathSegment(name.trim());
  const parent = normalizeLibraryPath(parentPath);
  return parent ? `${parent}/${encodedName}` : encodedName;
}

export function formatLibraryPathForDisplay(path: string): string {
  return splitLibraryPath(path).join('/');
}

export function pathToSegments(path: string): string[] {
  return splitLibraryPath(path);
}

export function dirname(filePath: string): string {
  const parts = splitLibraryPath(filePath);
  parts.pop();
  return segmentsToLibraryPath(parts);
}

export const LIBRARY_DRAG_MIME = 'application/x-oma-library-item';

export type LibraryDragPayload = {
  path: string;
  type: 'folder' | 'file';
};

export function canMoveLibraryItemToFolder(
  draggedPath: string,
  draggedType: 'folder' | 'file',
  targetFolderPath: string
): boolean {
  const normalizedTarget = normalizeLibraryPath(targetFolderPath);
  const normalizedDragged = normalizeLibraryPath(draggedPath);
  if (!normalizedDragged) return false;
  if (dirname(normalizedDragged) === normalizedTarget) return false;
  if (normalizedTarget === normalizedDragged) return false;
  if (draggedType === 'folder' && normalizedTarget.startsWith(`${normalizedDragged}/`)) {
    return false;
  }
  return true;
}

export function searchLibrary(node: LibraryNode, query: string): LibrarySearchResult[] {
  const term = query.trim().toLowerCase();
  if (!term) return [];

  const results: LibrarySearchResult[] = [];

  function walk(current: LibraryNode, folderPath: string) {
    for (const child of current.children || []) {
      if (child.name.toLowerCase().includes(term)) {
        results.push({
          item: child,
          parentPath: folderPath,
        });
      }
      if (child.type === 'folder') {
        const nextPath = child.path || (folderPath ? `${folderPath}/${child.name}` : child.name);
        walk(child, nextPath);
      }
    }
  }

  walk(node, '');
  return results.sort((a, b) => {
    if (a.item.type !== b.item.type) {
      return a.item.type === 'folder' ? -1 : 1;
    }
    return a.item.name.localeCompare(b.item.name);
  });
}

export function getRecentLibraryFiles(): RecentLibraryFile[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentLibraryFile[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function addRecentLibraryFile(file: LibraryNode): void {
  if (typeof window === 'undefined' || !file.path) return;
  try {
    const existing = getRecentLibraryFiles().filter((item) => item.path !== file.path);
    const next: RecentLibraryFile[] = [
      { path: file.path, name: file.name, openedAt: Date.now() },
      ...existing,
    ].slice(0, MAX_RECENT);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage failures.
  }
}
