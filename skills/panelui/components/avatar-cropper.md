# AvatarCropper

Frame a photo under a circle, and get that circle back as an image.

```tsx
import { AvatarCropper } from 'panelui-native';
// Copied into the project with the CLI instead:
// import { AvatarCropper } from '@/components/ui/avatar-cropper';
```

### Anatomy

```tsx
<AvatarCropper ref={cropper} source={photo}>
  <AvatarCropper.Canvas />
  <AvatarCropper.Reset />
  <AvatarCropper.Rotate />
</AvatarCropper>
```

### Parts

- `AvatarCropper.Canvas` — The photo under its outline, and the surface the gestures land on. It fills the space it is given. Leave the root's children out and it is rendered on its own.
- `AvatarCropper.Rotate` — An icon button that turns the photo a quarter turn about the middle of the outline. `direction="counterclockwise"` turns it the other way.
- `AvatarCropper.Reset` — A text button that puts the photo back centred, unzoomed and upright.

### Props

#### `AvatarCropperProps`

Extends `ViewProps`.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `source` | `AvatarCropperSource` | **required** | The photo. Changing it starts the crop again from the centre. |
| `shape` | `CropShape` | `circle` | The outline the photo is framed in. Default `'circle'`, which is how `Avatar` draws it. The image written out is square for every shape. |
| `maxZoom` | `number` | `5` | How far the photo can be zoomed past filling the mask. Default 5. |
| `inset` | `number` | `24` | Space between the mask and the canvas's shorter side, in points. Default 24. |
| `className` | `string` | — | — |
| `children` | `ReactNode` | `Reset` | `AvatarCropper.Canvas` and any controls. Left out, the canvas alone. |

#### `AvatarCropperCanvasProps`

Extends `Omit<ViewProps, 'children'>`.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `className` | `string` | — | — |
| `accessibilityLabel` | `string` | `Photo crop` | What a screen reader calls the canvas. Default "Photo crop". |

#### `AvatarCropperRotateProps`

Extends `Omit<ButtonProps, 'onPress'>`.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `direction` | `'clockwise' \| 'counterclockwise'` | `clockwise` | Which way a press turns the photo. Default `'clockwise'`. |

### Example — Pick, crop, show

`pickAvatarImage()` resolves `null` when the user cancels. It throws when camera permission is refused, so the app can say why nothing happened.

```tsx
const cropper = useRef<AvatarCropperHandle>(null);
const [photo, setPhoto] = useState<AvatarCropperSource | null>(null);
const [avatar, setAvatar] = useState<string | null>(null);

const choose = async () => setPhoto(await pickAvatarImage({ from: 'library' }));

const done = async () => {
  const result = await cropper.current?.crop({ size: 512 });
  if (result) setAvatar(result.uri);
  setPhoto(null);
};

{photo ? (
  <AvatarCropper ref={cropper} source={photo}>
    <AvatarCropper.Canvas />
    <Button onPress={done}>Done</Button>
  </AvatarCropper>
) : (
  <>
    <Avatar size="xl" source={avatar ? { uri: avatar } : undefined} fallback="KA" />
    <Button onPress={choose}>Choose photo</Button>
  </>
)}
```

### Notes

Two fingers move, zoom and turn the photo at once. Zooming and turning happen about the point between the fingers.

A square or squircle outline needs more zoom at an angle than a circle does, because its corners reach further. The minimum zoom follows the angle.

Screen readers can zoom and rotate with the canvas's actions, and hear the current zoom and angle as its value.

The photo is redrawn upright before it is turned and cut, so a camera photo that stores its orientation as a flag comes out the right way up.

Taking a photo in a development build needs the camera permission strings from `expo-image-picker`'s config plugin. Expo Go has them already.

---

Full page, with every example: https://panelui.dev/docs/components/avatar-cropper
