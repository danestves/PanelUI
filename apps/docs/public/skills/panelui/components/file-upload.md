# FileUpload

Pick files and photos, check them, and run their uploads.

```tsx
import { FileUpload } from 'panelui-native';
// Copied into the project with the CLI instead:
// import { FileUpload } from '@/components/ui/file-upload';
```

### Anatomy

```tsx
<FileUpload upload={uploadFile}>
  <FileUpload.Trigger>
    <Button>Add files</Button>
  </FileUpload.Trigger>
  <FileUpload.Dropzone />
  <FileUpload.List />
  <FileUpload.Grid />
</FileUpload>
```

### Parts

- `FileUpload.Trigger` — Wraps one pressable — a Button, an icon button — and makes it add files. With one source the press opens that picker; with several it opens a sheet listing them. It disables its child once `maxFiles` is reached.
- `FileUpload.Dropzone` — A dashed area that adds files when pressed. The line under its title is written from `accept`, `maxSize` and `maxFiles`, and is replaced by the reason when a picked file is turned away.
- `FileUpload.List` — Every file as an Attachment row: a thumbnail or type icon, the name, a status line, and cancel, retry or remove depending on the state. `horizontal` lays the files out as a strip of small cards, for a message composer.
- `FileUpload.Item` — One of those rows, for a list you lay out yourself. Pass the `file`.
- `FileUpload.Grid` — Photos as square tiles, led by a tile that adds more and counts against `maxFiles`. Tapping a photo opens it full screen. `cover` marks the first one, `placeholders` draws the empty slots, and `horizontal` makes it a strip.

### Props

#### `FileUploadProps`

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `value` | `FileUploadFile[]` | — | The files, controlled. |
| `defaultValue` | `FileUploadFile[]` | `[]` | The files to start with, uncontrolled. |
| `onValueChange` | `(files: FileUploadFile[]) => void` | — | Called with the new list whenever a file is added, changes state or is removed. |
| `sources` | `FileUploadSource[]` | `['library', 'files']` | Where files can come from, in the order the chooser lists them. One source opens its picker straight away; more than one opens a sheet to choose from. Default `['library', 'files']`. |
| `accept` | `string[]` | — | Allowed types: MIME types (`application/pdf`), families (`image/*`) or extensions (`.pdf`). Everything when left out. |
| `multiple` | `boolean` | `false` | Let the list hold more than one file. Without it the list holds one, and picking again replaces it — the shape of a profile photo or a single attachment field. |
| `maxFiles` | `number` | — | How many files the list can hold, with `multiple`. Pickers are limited to what is left, and the add controls disable once it is reached. |
| `maxSize` | `number` | — | Largest allowed file, in bytes. Checked against the size the picker reports, after any resize; a file whose size is unknown passes. |
| `minSize` | `number` | — | Smallest allowed file, in bytes. |
| `validate` | `(file: FileUploadFile) => string \| null \| undefined` | — | An app-specific rule. Return a message to turn the file away. |
| `onReject` | `(rejections: FileUploadRejection[]) => void` | — | Called with the files that were picked and turned away, and why. |
| `onError` | `(error: Error) => void` | — | Called when a picker cannot open — a missing module or a refused permission. |
| `image` | `FileUploadImageOptions` | — | Resize, compress or crop photos before they are added. |
| `upload` | `FileUploadHandler` | — | Sends one file. Without it files are only picked, and stay `idle`. |
| `concurrency` | `number` | `2` | How many uploads run at once. Default 2. |
| `autoUpload` | `boolean` | `true` | Queue files for upload as soon as they are added. Default true. Turn it off to send them later with `useFileUpload().upload()`. |
| `onUploadComplete` | `(file: FileUploadFile) => void` | — | Called once per file when its upload resolves. |
| `sourceLabels` | `Partial<Record<FileUploadSource, string>>` | — | Labels for the sources in the chooser. |
| `disabled` | `boolean` | `false` | Nothing can be added, removed or retried. |
| `invalid` | `boolean` | `false` | Draw the dropzone in its error state, for a form that failed validation. |
| `children` | `ReactNode` | — | — |

#### `FileUploadTriggerProps`

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `children` | `ReactElement` | **required** | One pressable — a Button, an icon button, an avatar. |

#### `FileUploadDropzoneProps`

Extends `Omit<AnimatedPressableProps, 'children'>`.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `className` | `string` | — | — |
| `title` | `ReactNode` | — | Headline. Default "Choose files", or "Choose a file" for a single file. |
| `description` | `ReactNode` | — | The line under it. Written from `accept`, `maxSize` and `maxFiles` when left out. |
| `icon` | `ReactNode` | — | Replaces the upload glyph in the badge. |
| `children` | `ReactNode` | — | Draw the inside yourself. The press still opens the sources. |

#### `FileUploadItemProps`

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `file` | `FileUploadFile` | **required** | — |
| `className` | `string` | — | — |
| `size` | `'default' \| 'sm'` | — | Row density. |
| `nameLength` | `number` | — | Longest name shown before it is shortened from the middle, keeping the extension. Default 36. |

#### `FileUploadListProps`

Extends `ViewProps`.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `className` | `string` | — | — |
| `horizontal` | `boolean` | `false` | Lay the files out as one scrolling strip of fixed-width rows, for a message composer. |
| `size` | `'default' \| 'sm'` | — | Row density. |
| `renderItem` | `(file: FileUploadFile) => ReactNode` | — | Draw a row yourself. `FileUpload.Item` is the default. |
| `empty` | `ReactNode` | — | Shown when the list is empty. Nothing by default. |

#### `FileUploadGridProps`

Extends `ViewProps`.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `className` | `string` | — | — |
| `columns` | `number` | `3` | Tiles per row. Default 3. Ignored when `horizontal`. |
| `horizontal` | `boolean` | `false` | Lay the tiles out as one scrolling strip. |
| `tileSize` | `number` | `88` | Tile size in points, for a horizontal strip. Default 88. |
| `gap` | `number` | `8` | Space between tiles, in points. Default 8. |
| `radius` | `number` | `12` | Corner radius of a tile, in points. Default 12. |
| `cover` | `boolean` | `false` | Mark the first photo as the cover. |
| `placeholders` | `boolean` | `false` | Draw empty slots for the rest of `maxFiles`, so the limit can be seen. |
| `addLabel` | `string` | — | Label of the add tile. Default "Add photo" or "Add photos". |
| `hideAdd` | `boolean` | `false` | Leave the add tile out — for a grid with its own Trigger elsewhere. |

### Example — Writing the upload handler

Resolve when the server has the file and throw when it does not; the error's message is shown on the row. Pass `signal` on, so cancel and remove stop the request. `fetch` reports no upload progress, so use `XMLHttpRequest` or your storage SDK when the bar matters.

```tsx
const uploadFile: FileUploadHandler = (file, { signal, onProgress }) =>
  new Promise((resolve, reject) => {
    const body = new FormData();
    body.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as any);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.example.com/uploads');
    xhr.upload.onprogress = (event) => onProgress(event.loaded / event.total);
    xhr.onload = () =>
      xhr.status < 300 ? resolve(JSON.parse(xhr.response)) : reject(new Error('The server refused the file.'));
    xhr.onerror = () => reject(new Error('Connection lost. Tap retry.'));
    signal.addEventListener('abort', () => xhr.abort());
    xhr.send(body);
  });
```

### Notes

Without `multiple` the list holds one file, and picking again replaces it. With `multiple`, `maxFiles` limits the list and each picker is asked for no more than the slots that are left.

A file's `status` is `idle`, `queued`, `uploading`, `processing`, `done`, `error` or `canceled`. Call `setProcessing()` from the handler once the bytes are sent and the server is still working, and the row says so. Progress reports are batched to one update per frame.

Cancel aborts the handler's `signal` and keeps the file as `canceled`, so it can be retried. Remove aborts it and drops the file.

`maxSize` is checked against the size the picker reports. A photo resized through `image` has no reported size, so it passes.

A source that cannot return an allowed file is left out of the chooser — the camera when `accept` has no image type, for instance.

A missing module or a refused camera permission is passed to `onError` as an `Error` whose message says what to do. Taking photos in a development build needs the camera permission strings from `expo-image-picker`'s config plugin. Expo Go has them already.

Rejected files are announced to screen readers. Each row's label reads the file's name and status, and every action is labelled with the file it acts on.

---

Full page, with every example: https://panelui.dev/docs/components/file-upload
