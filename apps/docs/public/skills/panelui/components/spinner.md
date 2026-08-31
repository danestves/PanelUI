# Spinner

Indeterminate loading indicator.

```tsx
import { Spinner } from 'panelui-native';
// Copied into the project with the CLI instead:
// import { Spinner } from '@/components/ui/spinner';
```

### Usage

```tsx
<Spinner />
<Spinner size="lg" />
```

### Variants

- **size** — `sm`, `md` *(default)*, `lg`

### Props

#### `SpinnerProps`

Extends `VariantProps<typeof spinnerVariants>`.

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `className` | `string` | — | — |
| `label` | `string` | — | What is loading, for a screen reader. Setting it makes the spinner announce as a busy status; leaving it unset keeps it out of the accessibility tree. Leave it unset wherever something around the spinner already says the wait is on — a loading button, a row with its own caption. Set it where the spinner is the only sign, or the wait passes in silence. |

### Example — Inline

```tsx
<Spinner size="sm" />
<Spinner />
<Spinner size="lg" />
```

### Notes

A bare ring carries no words, so it is hidden from screen readers unless `label` is given. An unnamed progress indicator announces its role and nothing else, which is noise standing in for information.

Leave `label` off wherever something around the spinner already says the wait is on — `Button`'s `loading` state, a row with its own caption. Set it where the spinner is the only sign.

Under the platform's reduce-motion setting the ring stops turning and fades in place instead. It keeps moving because a spinner that holds still reads as one that has hung, which is the single thing a spinner exists to rule out.

---

Full page, with every example: https://panelui.dev/docs/components/spinner
