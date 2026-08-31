# Skeleton

Shimmer placeholder for loading content.

```tsx
import { Skeleton } from 'panelui-native';
// Copied into the project with the CLI instead:
// import { Skeleton } from '@/components/ui/skeleton';
```

### Usage

```tsx
<View className="flex-row items-center gap-3">
  <Skeleton className="h-12 w-12 rounded-full" />
  <View className="flex-1 gap-2">
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-4 w-1/2" />
  </View>
</View>
```

### Props

#### `SkeletonProps`

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `className` | `string` | — | — |
| `label` | `string` | — | What is loading, for a screen reader. Setting it makes this skeleton announce as a busy status; leaving it unset keeps the placeholder out of the accessibility tree entirely. A screen full of placeholders needs **one** of them labelled, not all of them — put it on the skeleton standing for the region and leave the rest silent. |

### Example — A loading card

Match the shape of the real content — a skeleton that is the wrong size is worse than none, because the layout jumps when the data lands.

```tsx
<Card>
  <Card.Content className="gap-3 p-4">
    <Skeleton className="h-5 w-1/2" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-4/5" />
  </Card.Content>
</Card>
```

### Notes

A placeholder is a picture of content that is not there, so it is hidden from screen readers by default. An unlabelled grey box announces nothing worth hearing, and a screen of them announces it many times over.

Pass `label` on the one skeleton that stands for the region — the first row of a list, the card standing in for a page — and the wait is announced once, as a busy status. Leave it off the rest.

Under the platform's reduce-motion setting the pulse stops and the placeholder holds at a middle opacity. A skeleton that stops moving still reads as content on its way, because the shape is the message.

---

Full page, with every example: https://panelui.dev/docs/components/skeleton
