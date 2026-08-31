# Fab

The floating action button — one action pinned over the content, with an optional dial of others behind it.

```tsx
import { Fab } from 'panelui-native';
// Copied into the project with the CLI instead:
// import { Fab } from '@/components/ui/fab';
```

### Anatomy

```tsx
{/* on its own */}
<Fab icon={…} accessibilityLabel="…" onPress={…} />

{/* or with a dial behind it */}
<Fab.Group icon={…} accessibilityLabel="…">
  <Fab.Action icon={…} label="…" onPress={…} />
  <Fab.Action icon={…} label="…" onPress={…} />
</Fab.Group>
```

### Variants

- **size** — `sm`, `md` *(default)*, `lg`
- **extended** — `true`, `false` *(default)*
- **variant** — `primary` *(default)*, `secondary`, `surface`, `destructive`
- **disabled** — `true`

### Parts

- `Fab.Group` — A trigger with actions behind it — the speed dial. It owns the open state, the scrim, and the quarter turn the trigger takes while it is open.
- `Fab.Action` — One choice in an open dial: a smaller round button with its label beside it. Pressing one closes the dial and then runs the action.

### Props

#### `FabProps`

Extends `Omit<AnimatedPressableProps, 'children' \| 'style' \| 'disabled'>, Omit<FabVariantProps, 'disabled'>`.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `className` | `string` | — | — |
| `icon` | `ReactNode` | — | The glyph. Sized by you — this is the one thing that should not guess. |
| `children` | `ReactNode` | — | The label, which turns the circle into a stadium. Needs `extended`; a label with nowhere to go is a label that gets clipped by the circle. |
| `extended` | `boolean` | `false` | Spell the action out beside the glyph. |
| `placement` | `FabPlacement` | `bottom-right` | Pin it over the content, in a corner. Left out, it is an ordinary button in the flow — which is what you want inside a `Fab.Group`, or when the screen already has somewhere for it to sit. |
| `offset` | `number` | `16` | Distance from the edges when `placement` is set, in points. |
| `style` | `ViewProps['style']` | — | Placement-aware view style. Press-state styling belongs in `className`. |
| `disabled` | `boolean` | `false` | — |
| `haptics` | `boolean` | `false` | A tick on press. Off by default — needs the optional `expo-haptics`, and is silent without it. |
| `accessibilityLabel` | `string` | — | Required for an icon-only button. A lone glyph reads out as nothing. |

#### `FabGroupProps`

Extends `Omit<ViewProps, 'children'>`.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `className` | `string` | — | — |
| `icon` | `ReactNode` | — | The glyph on the trigger. |
| `label` | `string` | — | The trigger's label, if it should be extended while closed. |
| `children` | `ReactNode` | — | `Fab.Action` children, in the order they should unfold. |
| `open` | `boolean` | — | Controlled open state. |
| `onOpenChange` | `(open: boolean) => void` | — | — |
| `placement` | `FabPlacement` | `bottom-right` | Which corner of the *screen* the whole dial parks in. |
| `offset` | `number` | `16` | Distance from the screen's edges, in points. Add your safe-area inset. |
| `size` | `FabSize` | `md` | — |
| `variant` | `FabVariant` | `primary` | — |
| `disabled` | `boolean` | `false` | — |
| `haptics` | `boolean` | `false` | — |
| `blur` | `boolean` | `false` | Frost the screen behind the open dial instead of dimming it. |
| `accessibilityLabel` | `string` | — | Required — the trigger is a lone glyph until it is opened. |
| `rotateOnOpen` | `boolean` | `true` | Turn the trigger's glyph a quarter circle while the dial is open. On by default, and it is doing real work when the glyph is a plus: the same mark becomes a cross, which says "this closes now" without a second icon that has to be swapped in. Turn it off for a glyph that means something at one angle only. |

#### `FabActionProps`

Extends `Omit<ViewProps, 'children'>`.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `className` | `string` | — | — |
| `icon` | `ReactNode` | — | The glyph. |
| `label` | `string` | — | What it does, beside the glyph. A column of unlabelled circles is a quiz. |
| `onPress` | `() => void` | — | — |
| `disabled` | `boolean` | `false` | — |
| `destructive` | `boolean` | — | Draws it in the destructive colour, for the one that removes something. |
| `labelClassName` | `string` | — | Extra classes for the label chip. |

### Example — Over a list

The case it exists for. `placement` pins it to a corner against the nearest positioned ancestor, which on a screen means the screen — so give the content below it enough bottom padding to scroll clear. Nothing here can work out how tall your list is, and a button sitting on the last row forever is the failure people actually hit.

```tsx
<View className="flex-1">
  <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
    {/* …rows… */}
  </ScrollView>

  <Fab
    placement="bottom-right"
    icon={<PlusIcon size={24} />}
    accessibilityLabel="New note"
    haptics
    onPress={compose}
  />
</View>
```

### Notes

### Give it a label

`accessibilityLabel` is not optional in practice. An icon-only button reads out as nothing, and the plus that is obvious to someone looking at it says nothing to someone who is not. `Fab.Action` takes its label from `label`, so it is already covered.

### Write a group in the screen's root container

A `Fab.Group` draws its scrim and its buttons as two absolutely positioned siblings in whatever it is written inside. That parent is what `offset` is measured from and what the scrim covers, so it should be the container that fills the screen.

This is also what makes the dial belong to its screen. Pushing a new screen over this one hides the dial with everything else on it, because it is part of the screen's own view tree rather than lifted above the app.

Add your safe-area inset to `offset` to clear the home indicator.

### Pressing an action closes the dial

Any child of a `Fab.Group` closes it when pressed, including a plain `Fab` used as an action. A menu that stays up after a choice reads as the choice not having registered — and an action that navigates would otherwise leave the dial standing over the screen it navigated to.

The Android back button closes an open dial too, rather than popping the screen behind it.

### The actions are unmounted while the dial is closed

Not hidden. A column kept alive behind the trigger would still be in the accessibility tree, and a screen reader would walk into four buttons nobody can see.

### One timing, not one per action

The whole dial runs off a single shared value, and each action works out its own share of it on the UI thread from its index. There is no chain of timeouts to fall out of step with itself when the dial is closed halfway through opening — closing runs the same value back down, and every action follows it.

### The trigger turns rather than swapping

`rotateOnOpen` gives the glyph a quarter circle while the dial is up. That is doing real work when the glyph is a plus: the same mark becomes a cross, so the button says *this closes now* without a second icon to swap in. Turn it off for a glyph that means something at one angle only.

### Press behavior composes with the button

`Fab` forwards the ordinary animated Pressable controls such as `hitSlop`, `onLongPress`, `pressOpacity`, and the native press event passed to `onPress`. Its button role, disabled state, haptic tick, and primary press handler remain owned by the component. Use `className` for pressed-state styling; `style` remains a placement-aware view style so an absolutely positioned Fab keeps one deterministic anchor.

---

Full page, with every example: https://panelui.dev/docs/components/fab
