# ScrollBlur

Blurs the edges of a scroll container.

```tsx
import { ScrollBlur } from 'panelui-native';
// Copied into the project with the CLI instead:
// import { ScrollBlur } from '@/components/ui/scroll-blur';
```

### Usage

```tsx
<ScrollBlur size={64}>
  <ScrollView showsVerticalScrollIndicator={false}>
    {rows.map((row) => (
      <Item key={row.id}>
        <Item.Content>
          <Item.Title>{row.name}</Item.Title>
          <Item.Description>{row.summary}</Item.Description>
        </Item.Content>
      </Item>
    ))}
  </ScrollView>
</ScrollBlur>
```

### Props

#### `ScrollBlurProps`

Extends `ViewProps`.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `className` | `string` | — | — |
| `size` | `number` | `64` | Depth of the blurred band in pixels. |
| `edges` | `'both' \| 'start' \| 'end' \| 'none'` | `both` | Which edges blur. |
| `orientation` | `'horizontal' \| 'vertical'` | — | Scroll axis. Inferred from the child's `horizontal` prop when omitted — pass it explicitly for children that scroll horizontally without that prop (a `FlatList` with `horizontal` set through `contentContainerStyle`, say). |
| `layers` | `number` | `4` | How many blur views make up the ramp. More is smoother and costs more; the band shows visible steps below three. |
| `intensity` | `number` | `40` | Blur strength at the very edge, 0–100. The layers share it between them. |
| `tint` | `ScrollBlurTint` | `default` | Which way the material tints. Defaults to the app's theme rather than the phone's, so an app running dark on a light phone does not blur light. |
| `color` | `string` | — | Colour the fallback gradient resolves to, for a device that cannot blur or has asked not to. Defaults to the theme's background — pass the surface the scrollable actually sits on, or the fallback will not blend. |
| `fadeInDistance` | `number` | `24` | Distance in pixels over which an edge comes in from clear to full. |
| `enabled` | `boolean` | `true` | Set false to render the child with no bands at all. |
| `children` | `ReactNode` | — | — |

### Example — A vertical list

The rows go soft as they reach the top and bottom of the viewport, and the band only appears once there is something behind it to blur.

```tsx
<ScrollBlur size={64}>
  <ScrollView showsVerticalScrollIndicator={false}>
    {rows.map((row) => (
      <Item key={row.id} variant="outline">
        <Item.Media variant="icon"><PackageIcon size={16} /></Item.Media>
        <Item.Content>
          <Item.Title>{row.name}</Item.Title>
          <Item.Description>{row.summary}</Item.Description>
        </Item.Content>
      </Item>
    ))}
  </ScrollView>
</ScrollBlur>
```

### Notes

### The ramp is a stack, not a mask

A blur that goes from nothing to full across a band needs a per-pixel blur radius, and there is no such thing on either platform — a blur view has one strength for its whole rectangle.

So the ramp is built out of several of them. Each layer covers a shorter span than the last, measured from the edge, and each blurs what the layer under it has already blurred. Near the edge every layer is stacked up; at the inner boundary only the widest one is there, and the widest is also the faintest, so the band starts from nothing rather than from a visible step.

`layers` is that count. Four is enough for a 64-point band; a deeper band wants more. Each layer is a real native view, so this is the knob that costs something — below three the band shows steps, above six you are paying for a difference nobody can see.

### Where it cannot blur, it fades

`expo-blur` is an optional peer, and Reduce Transparency is a preference that outranks the design. Both cases fall back to a gradient towards `color`.

So pass `color` whenever the scrollable does not sit on the theme background. It is unused in the blurred case and it is the whole effect in the other one.

### The rest

Orientation is read from the child's `horizontal` prop. Pass `orientation` explicitly for scrollables that do not expose it.

An edge only blurs once there is content past it, and neither edge blurs when the content fits inside the viewport — this is correct from the first frame, not just after the first scroll event.

**The child becomes a Reanimated animated component.** If you need `onScroll` on it yourself, it has to be an animated handler from `useAnimatedScrollHandler` — a plain function will not run.

`tint` follows the app's theme rather than the phone's, so an app running dark on a light phone does not blur light. Pass `light` or `dark` to fix it.

For a flat, known background, [ScrollFade](/docs/components/scroll-fade) is cheaper: one gradient per edge against this component's four native views.

---

Full page, with every example: https://panelui.dev/docs/components/scroll-blur
