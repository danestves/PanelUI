/**
 * FileUpload decides, before anything is drawn, whether a picked file may join
 * the list and which queued upload runs next. Both are rules a user feels as a
 * bug when they are wrong — a PDF turned away from a form that asked for PDFs,
 * a sixth file sneaking past a limit of five, three uploads running when the app
 * asked for two — so they are checked here, apart from the component.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  describeAccept,
  describeRules,
  fitWithin,
  formatFileSize,
  kindOf,
  libraryMediaTypes,
  matchesAccept,
  nextToStart,
  partitionFiles,
  pickerTypes,
  truncateMiddle,
} from '../packages/panelui/src/components/file-upload/file-upload-core.ts';

const MB = 1024 * 1024;

const file = (name, fields = {}) => ({
  id: name,
  uri: `file:///tmp/${name}`,
  name,
  kind: 'document',
  status: 'idle',
  ...fields,
});

test('accept matches MIME types, families and extensions', () => {
  const pdf = { name: 'lease.pdf', mimeType: 'application/pdf' };
  const photo = { name: 'IMG_2041.HEIC', mimeType: 'image/heic' };
  const sheet = { name: 'budget.xlsx' };

  assert.equal(matchesAccept(pdf, ['application/pdf']), true);
  assert.equal(matchesAccept(photo, ['image/*']), true);
  assert.equal(matchesAccept(photo, ['application/pdf']), false);
  assert.equal(matchesAccept(sheet, ['.xlsx']), true, 'extension, no MIME type reported');
  assert.equal(matchesAccept(sheet, ['image/*']), false);
  assert.equal(matchesAccept({ name: 'notes' }, ['.txt']), false, 'no extension at all');
  assert.equal(matchesAccept(pdf, undefined), true, 'no rule accepts everything');
  assert.equal(matchesAccept(pdf, []), true);
  assert.equal(matchesAccept(pdf, ['*/*']), true);
});

test('a file with no MIME type is judged by its extension', () => {
  assert.equal(matchesAccept({ name: 'scan.PDF' }, ['application/pdf']), true);
  assert.equal(kindOf({ name: 'clip.mov' }), 'video');
  assert.equal(kindOf({ name: 'photo.jpeg' }), 'image');
  assert.equal(kindOf({ name: 'archive.tar.gz' }), 'document');
});

test('sizes read the way they were written', () => {
  assert.equal(formatFileSize(0), '0 B');
  assert.equal(formatFileSize(812), '812 B');
  assert.equal(formatFileSize(2.4 * MB), '2.4 MB');
  assert.equal(formatFileSize(10 * MB), '10 MB');
  assert.equal(formatFileSize(1023.7 * 1024), '1 MB', 'rounding carries into the next unit');
  assert.equal(formatFileSize(340 * 1024), '340 KB');
  assert.equal(formatFileSize(1003 * 1024), '1 MB', 'never four digits');
  assert.equal(formatFileSize(999), '999 B');
  assert.equal(formatFileSize(-1), '');
  assert.equal(formatFileSize(Number.NaN), '');
});

test('the hint names what is allowed in plain words', () => {
  assert.equal(describeAccept(['application/pdf', 'image/*']), 'PDF or images');
  assert.equal(describeAccept(['.pdf', '.docx', '.png']), 'PDF, DOCX or PNG');
  assert.equal(describeAccept(['image/png', 'image/png']), 'PNG', 'duplicates collapse');
  assert.equal(describeAccept(undefined), '');
  assert.equal(
    describeRules({ accept: ['application/pdf', 'image/*'], maxSize: 10 * MB, maxFiles: 5 }),
    'PDF or images · up to 10 MB · 5 files max'
  );
  assert.equal(describeRules({ accept: ['image/*'] }), 'Images');
});

test('the document picker is given MIME types, never extensions', () => {
  assert.deepEqual(pickerTypes(['.pdf', 'image/*']), ['application/pdf', 'image/*']);
  assert.deepEqual(pickerTypes(['.sketch']), ['*/*'], 'an unknown extension widens, the validator narrows');
  assert.deepEqual(pickerTypes(undefined), ['*/*']);
});

test('the photo library only offers what accept allows', () => {
  assert.deepEqual(libraryMediaTypes(['image/*']), ['images']);
  assert.deepEqual(libraryMediaTypes(['video/mp4']), ['videos']);
  assert.deepEqual(libraryMediaTypes(['application/pdf']), []);
  assert.deepEqual(libraryMediaTypes(undefined), ['images', 'videos']);
});

test('picked files are split by type, then size, then the app rule, then the count', () => {
  const picked = [
    file('lease.pdf', { mimeType: 'application/pdf', size: 1.2 * MB }),
    file('song.mp3', { mimeType: 'audio/mpeg', size: 4 * MB }),
    file('scan.pdf', { mimeType: 'application/pdf', size: 14 * MB }),
    file('draft.pdf', { mimeType: 'application/pdf', size: 300 * 1024 }),
    file('id.pdf', { mimeType: 'application/pdf', size: 800 * 1024 }),
    file('payslip.pdf', { mimeType: 'application/pdf', size: 600 * 1024 }),
  ];
  const { accepted, rejected } = partitionFiles(picked, 1, {
    accept: ['application/pdf'],
    maxSize: 10 * MB,
    maxFiles: 3,
    validate: (entry) => (entry.name.startsWith('draft') ? 'Drafts cannot be submitted.' : null),
  });

  assert.deepEqual(accepted.map((entry) => entry.name), ['lease.pdf', 'id.pdf']);
  assert.deepEqual(
    rejected.map((entry) => [entry.file.name, entry.reason]),
    [
      ['song.mp3', 'type'],
      ['scan.pdf', 'size'],
      ['draft.pdf', 'custom'],
      ['payslip.pdf', 'count'],
    ]
  );
  assert.equal(rejected[0].message, "song.mp3 isn't a PDF.");
  assert.equal(rejected[1].message, 'scan.pdf is 14 MB. The limit is 10 MB.');
  assert.equal(rejected[2].message, 'Drafts cannot be submitted.');
  assert.equal(rejected[3].message, 'Only 3 files can be added.');
});

test('a file whose size is unknown is not turned away for it', () => {
  const { accepted } = partitionFiles([file('photo.jpg', { mimeType: 'image/jpeg' })], 0, {
    maxSize: 1,
  });
  assert.equal(accepted.length, 1);
});

test('rejection messages use the right article', () => {
  const reason = (accept) =>
    partitionFiles([file('a.zip', { mimeType: 'application/zip' })], 0, { accept }).rejected[0]
      .message;
  assert.equal(reason(['image/*']), "a.zip isn't an image.");
  assert.equal(reason(['video/mp4']), "a.zip isn't an MP4.");
  assert.equal(reason(['application/pdf', 'image/*']), "a.zip isn't a PDF or image.");
});

test('the queue starts at most `concurrency` uploads, in list order', () => {
  const queue = [
    file('a', { status: 'done' }),
    file('b', { status: 'uploading' }),
    file('c', { status: 'queued' }),
    file('d', { status: 'error' }),
    file('e', { status: 'queued' }),
    file('f', { status: 'queued' }),
  ];
  assert.deepEqual(nextToStart(queue, 2), ['c']);
  assert.deepEqual(nextToStart(queue, 3), ['c', 'e']);
  assert.deepEqual(nextToStart(queue, 1), []);
  assert.deepEqual(nextToStart(queue, 0), [], 'a slot count below one still means one');

  const processing = queue.map((entry) => (entry.id === 'b' ? { ...entry, status: 'processing' } : entry));
  assert.deepEqual(nextToStart(processing, 2), ['c'], 'processing still holds its slot');
});

test('photos are scaled down to fit, never up', () => {
  assert.deepEqual(fitWithin({ width: 4032, height: 3024 }, { maxWidth: 1600 }), {
    width: 1600,
    height: 1200,
  });
  assert.deepEqual(fitWithin({ width: 3024, height: 4032 }, { maxWidth: 1600, maxHeight: 1600 }), {
    width: 1200,
    height: 1600,
  });
  assert.equal(fitWithin({ width: 800, height: 600 }, { maxWidth: 1600 }), null);
  assert.equal(fitWithin({ width: 800, height: 600 }, {}), null);
});

test('long names are shortened from the middle and keep their extension', () => {
  assert.equal(truncateMiddle('service-history-2025.pdf', 22), 'service-histo…2025.pdf');
  assert.equal(truncateMiddle('short.pdf', 22), 'short.pdf');
  const cut = truncateMiddle('a-really-quite-long-file-name-for-a-scan.jpeg', 24);
  assert.equal(cut.length, 24);
  assert.ok(cut.endsWith('.jpeg'));
});
