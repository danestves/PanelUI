/**
 * The parts of FileUpload that are arithmetic rather than drawing: what a file
 * is, whether it is allowed, how its size reads, and which queued upload runs
 * next. Kept apart from the component so they can be tested without a renderer.
 */

/** Where a file comes from. */
export type FileUploadSource = 'camera' | 'library' | 'files';

/**
 * Where a file is in its life. `idle` has been picked and nothing is sending it;
 * `queued` is waiting for a free upload slot; `canceled` was stopped by the user
 * and can be retried.
 */
export type FileUploadStatus =
  | 'idle'
  | 'queued'
  | 'uploading'
  | 'processing'
  | 'done'
  | 'error'
  | 'canceled';

/** What a file is, for choosing a thumbnail or an icon. */
export type FileUploadKind = 'image' | 'video' | 'document';

/** One picked file and the state of its upload. */
export interface FileUploadFile {
  /** Stable key for the file while it is in the list. */
  id: string;
  /** Local URI the picker returned, or the resized copy of it. */
  uri: string;
  /** File name with its extension. */
  name: string;
  /** Size in bytes, when the picker reports it. */
  size?: number;
  /** MIME type, when the picker reports it. */
  mimeType?: string;
  /** Pixel width, for images and videos. */
  width?: number;
  /** Pixel height, for images and videos. */
  height?: number;
  kind: FileUploadKind;
  status: FileUploadStatus;
  /** Upload progress 0–1, while uploading. */
  progress?: number;
  /** Why the last upload failed. */
  error?: string;
  /** Whatever the upload handler resolved with — a remote URL, a record id. */
  response?: unknown;
}

/** A file that was picked and turned away, and why. */
export interface FileUploadRejection {
  file: Pick<FileUploadFile, 'name' | 'size' | 'mimeType' | 'uri'>;
  reason: 'type' | 'size' | 'count' | 'custom';
  /** A sentence that can be shown as it is. */
  message: string;
}

/** The rules a picked file has to pass. */
export interface FileUploadRules {
  accept?: readonly string[];
  maxSize?: number;
  minSize?: number;
  maxFiles?: number;
  validate?: (file: FileUploadFile) => string | null | undefined;
}

/** Statuses that hold an upload slot. */
export function isActive(status: FileUploadStatus): boolean {
  return status === 'uploading' || status === 'processing';
}

/** The extension of a file name, lower-cased and without the dot. */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : '';
}

/** MIME types for the extensions people most often name in `accept`. */
const EXTENSION_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv',
  txt: 'text/plain',
  json: 'application/json',
  zip: 'application/zip',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  heic: 'image/heic',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
};

/** The MIME type a file reports, or the one its extension implies. */
export function mimeOf(file: { name: string; mimeType?: string }): string | undefined {
  return file.mimeType ?? EXTENSION_TYPES[extensionOf(file.name)];
}

/** Image, video or anything else. */
export function kindOf(file: { name: string; mimeType?: string }): FileUploadKind {
  const mime = mimeOf(file) ?? '';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'document';
}

/**
 * Whether a file matches one of the `accept` patterns: an exact MIME type
 * (`application/pdf`), a family (`image/*`) or an extension (`.pdf`). No
 * patterns accepts everything.
 */
export function matchesAccept(
  file: { name: string; mimeType?: string },
  accept: readonly string[] | undefined
): boolean {
  if (!accept || accept.length === 0) return true;
  const mime = (mimeOf(file) ?? '').toLowerCase();
  const ext = extensionOf(file.name);
  return accept.some((raw) => {
    const pattern = raw.trim().toLowerCase();
    if (pattern === '*' || pattern === '*/*') return true;
    if (pattern.startsWith('.')) return pattern.slice(1) === ext;
    if (pattern.endsWith('/*')) return mime.startsWith(pattern.slice(0, -1));
    return pattern === mime;
  });
}

/**
 * The `type` list for the system document picker. Extensions are turned into
 * MIME types, since that is all the picker understands; an extension it has no
 * type for widens the list to everything, and the validator catches the rest.
 */
export function pickerTypes(accept: readonly string[] | undefined): string[] {
  if (!accept || accept.length === 0) return ['*/*'];
  const types = new Set<string>();
  for (const raw of accept) {
    const pattern = raw.trim().toLowerCase();
    if (pattern.startsWith('.')) {
      const type = EXTENSION_TYPES[pattern.slice(1)];
      if (!type) return ['*/*'];
      types.add(type);
    } else {
      types.add(pattern);
    }
  }
  return [...types];
}

/**
 * Which of images and videos the photo library should offer, from `accept`.
 * Empty when `accept` allows neither, which means the library has nothing to
 * give and the source is left out of the chooser.
 */
export function libraryMediaTypes(accept: readonly string[] | undefined): Array<'images' | 'videos'> {
  if (!accept || accept.length === 0) return ['images', 'videos'];
  const out: Array<'images' | 'videos'> = [];
  if (matchesAccept({ name: 'a.jpg', mimeType: 'image/jpeg' }, accept)) out.push('images');
  if (matchesAccept({ name: 'a.mp4', mimeType: 'video/mp4' }, accept)) out.push('videos');
  return out;
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/**
 * A byte count as people read it: `820 KB`, `2.4 MB`, `10 MB`. One decimal
 * below ten units, none above, never four digits, and binary multiples, so
 * `10 * 1024 * 1024` reads as the round `10 MB` it was written as.
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1000) return `${Math.round(bytes)} B`;
  let value = bytes;
  let unit = 0;
  // Four digits never show: 1003 KB reads as 1 MB.
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  return `${rounded} ${UNITS[unit]}`;
}

/** Short names for the families and types a hint is written from. */
const PATTERN_NAMES: Record<string, string> = {
  'image/*': 'images',
  'video/*': 'videos',
  'audio/*': 'audio',
  'text/*': 'text files',
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/heic': 'HEIC',
  'image/webp': 'WebP',
  'image/gif': 'GIF',
  'video/mp4': 'MP4',
  'text/csv': 'CSV',
  'text/plain': 'TXT',
  'application/zip': 'ZIP',
};

/** "PDF, JPG or PNG", from the accept list. Empty when anything goes. */
export function describeAccept(accept: readonly string[] | undefined): string {
  if (!accept || accept.length === 0) return '';
  const names: string[] = [];
  for (const raw of accept) {
    const pattern = raw.trim().toLowerCase();
    const name = pattern.startsWith('.')
      ? pattern.slice(1).toUpperCase()
      : (PATTERN_NAMES[pattern] ?? extensionFromMime(pattern));
    if (name && !names.includes(name)) names.push(name);
  }
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

function extensionFromMime(mime: string): string {
  const entry = Object.entries(EXTENSION_TYPES).find(([, type]) => type === mime);
  return entry ? entry[0].toUpperCase() : '';
}

/** "PDF or images · up to 10 MB" — what a dropzone says under its title. */
export function describeRules({ accept, maxSize, maxFiles }: FileUploadRules): string {
  const parts: string[] = [];
  const types = describeAccept(accept);
  if (types) parts.push(types.charAt(0).toUpperCase() + types.slice(1));
  if (maxSize) parts.push(`up to ${formatFileSize(maxSize)}`);
  if (maxFiles && maxFiles > 1) parts.push(`${maxFiles} files max`);
  return parts.join(' · ');
}

/**
 * Split picked files into those that pass the rules and those that do not.
 *
 * Checks run in the order a person would explain them — type, then size, then
 * the app's own rule — and the count comes last, so a file that would have
 * been turned away anyway does not use up one of the remaining slots.
 */
export function partitionFiles(
  candidates: readonly FileUploadFile[],
  current: number,
  rules: FileUploadRules
): { accepted: FileUploadFile[]; rejected: FileUploadRejection[] } {
  const accepted: FileUploadFile[] = [];
  const rejected: FileUploadRejection[] = [];
  const typeNames = describeAccept(rules.accept);

  for (const file of candidates) {
    const summary = { name: file.name, size: file.size, mimeType: file.mimeType, uri: file.uri };
    if (!matchesAccept(file, rules.accept)) {
      rejected.push({
        file: summary,
        reason: 'type',
        message: typeNames ? `${file.name} isn't ${articleFor(typeNames)}.` : `${file.name} can't be added.`,
      });
      continue;
    }
    if (rules.maxSize !== undefined && file.size !== undefined && file.size > rules.maxSize) {
      rejected.push({
        file: summary,
        reason: 'size',
        message: `${file.name} is ${formatFileSize(file.size)}. The limit is ${formatFileSize(rules.maxSize)}.`,
      });
      continue;
    }
    if (rules.minSize !== undefined && file.size !== undefined && file.size < rules.minSize) {
      rejected.push({
        file: summary,
        reason: 'size',
        message: `${file.name} is smaller than ${formatFileSize(rules.minSize)}.`,
      });
      continue;
    }
    const custom = rules.validate?.(file);
    if (custom) {
      rejected.push({ file: summary, reason: 'custom', message: custom });
      continue;
    }
    if (rules.maxFiles !== undefined && current + accepted.length >= rules.maxFiles) {
      rejected.push({
        file: summary,
        reason: 'count',
        message: `Only ${rules.maxFiles} ${rules.maxFiles === 1 ? 'file' : 'files'} can be added.`,
      });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

/** "a PDF or image" reads better than "PDF or images" inside a sentence. */
function articleFor(names: string): string {
  const singular = names.replace(/\bimages\b/, 'image').replace(/\bvideos\b/, 'video')
    .replace(/\btext files\b/, 'text file');
  const first = singular.trim().charAt(0).toLowerCase();
  // Letters whose spoken name starts with a vowel sound: "an MP4", "an image".
  const vowel = 'aefhilmnorsx'.includes(first) && /^[A-Z]{2,}/.test(singular)
    ? true
    : 'aeiou'.includes(first);
  return `${vowel ? 'an' : 'a'} ${singular}`;
}

/**
 * The queued files that may start now, in list order, given how many slots
 * `concurrency` allows and how many are already busy.
 */
export function nextToStart(files: readonly FileUploadFile[], concurrency: number): string[] {
  const limit = Math.max(1, Math.floor(concurrency));
  const busy = files.filter((file) => isActive(file.status)).length;
  const free = limit - busy;
  if (free <= 0) return [];
  return files.filter((file) => file.status === 'queued').slice(0, free).map((file) => file.id);
}

/** Scale a width and height down to fit inside a box, never up. */
export function fitWithin(
  size: { width: number; height: number },
  box: { maxWidth?: number; maxHeight?: number }
): { width: number; height: number } | null {
  const scale = Math.min(
    box.maxWidth ? box.maxWidth / size.width : Infinity,
    box.maxHeight ? box.maxHeight / size.height : Infinity,
    1
  );
  if (scale >= 1) return null;
  return { width: Math.round(size.width * scale), height: Math.round(size.height * scale) };
}

/**
 * Shorten a file name from the middle, keeping its start and its extension:
 * `service-hist…2025.pdf`. A name cut at the end loses the part that says what
 * kind of file it is.
 */
export function truncateMiddle(name: string, max: number): string {
  if (name.length <= max || max < 8) return name;
  const ext = extensionOf(name);
  const tail = Math.min(name.length - 1, Math.max(ext.length + 5, Math.floor(max / 3)));
  const head = max - tail - 1;
  return `${name.slice(0, head)}…${name.slice(name.length - tail)}`;
}

let counter = 0;

/** A key unique within the app's lifetime. */
export function createFileId(): string {
  counter += 1;
  return `file-${Date.now().toString(36)}-${counter.toString(36)}`;
}
