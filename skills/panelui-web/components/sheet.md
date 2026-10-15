# Sheet

A panel that rises from an edge of the screen, floating clear of it, and leaves with a swipe.

```tsx
import { Sheet } from "@/components/panelui/sheet"
```

From npm the path is `panelui-web/sheet`. Install with `npx shadcn@latest add @panelui/sheet`.

## When to use it

Use it for a task that belongs to the page but should not leave it: answering an invitation, editing a profile, changing a setting. It rises from an edge, stands a few pixels clear of every side with its corners rounded, and goes back with a swipe, the Escape key or a click outside.

A sheet that needs the whole height can meet the edges instead: set `size="full"` or `detached={false}`.

Open a sheet from inside another and the first one steps back behind it. Wrap the app in `Sheet.Stage` and the page steps back too.

For a decision that needs an answer before anything else, use a dialog. For one question with a written answer, use [Feedback](/docs/web/components/feedback).

## Usage

```tsx
<Sheet>
  <Sheet.Trigger render={<Button />}>Edit profile</Sheet.Trigger>
  <Sheet.Content>
    <Sheet.Header title="Edit profile" description="Shown on your public page." />
    <Sheet.Body>
      <Field>
        <FieldLabel>Name</FieldLabel>
        <Input defaultValue="Noor Haddad" />
      </Field>
    </Sheet.Body>
    <Sheet.Footer>
      <Sheet.Close render={<Button />}>Save changes</Sheet.Close>
      <Sheet.Close render={<Button variant="ghost" />}>Cancel</Sheet.Close>
    </Sheet.Footer>
  </Sheet.Content>
</Sheet>
```

## Parts

```tsx
<Sheet.Stage>
  <Sheet>
    <Sheet.Trigger />
    <Sheet.Content>
      <Sheet.Header>
        <Sheet.Title />
        <Sheet.Description />
      </Sheet.Header>
      <Sheet.Body />
      <Sheet.Footer>
        <Sheet.Close />
      </Sheet.Footer>
    </Sheet.Content>
  </Sheet>
</Sheet.Stage>
```

- `Sheet.Trigger` — What opens the sheet. A plain button, or your own through `render`.
- `Sheet.Content` — The sheet and the backdrop behind it. It draws the grabber on a top or bottom sheet and the round close button; `showGrabber` and `showClose` turn them off. `inline` draws it in the page instead of over it.
- `Sheet.Header` — The title and a line under it, as `title` and `description` or as `Title` and `Description` children. It leaves room for the close button on the same line.
- `Sheet.Title` — The sheet's name. It is also what a screen reader announces when the sheet opens.
- `Sheet.Description` — A sentence under the title, read out after it.
- `Sheet.Body` — The part that scrolls. The header and footer stay where they are while it moves.
- `Sheet.Footer` — The actions, stacked full width.
- `Sheet.Close` — Closes the sheet, even when `dismissible` is off. Give it `render` to make your own button close it.
- `Sheet.Stage` — Wraps the page. While a sheet inside it is open, the page steps back slightly and rounds its corners. Set `--stage-radius` to the radius of what it sits in, less the gap, so the two corners are concentric.

## Props

Every part also takes the props of the element it renders, and a `className`.

#### `SheetProps`

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `open` | `boolean` | — | Whether the sheet is open, when the caller holds that. |
| `onOpenChange` | `(open: boolean) => void` | — | Called when the sheet asks to open or close. |
| `defaultOpen` | `boolean` | `false` | Whether it starts open, when the caller does not hold it. |
| `side` | `SheetSide` | `'bottom'` | The edge it rises from and is swiped back to. Default `bottom`. |
| `dismissible` | `boolean` | `true` | Whether a click outside, a swipe or Escape closes it. Turn it off for a sheet that must be answered; `Sheet.Close` still works. |

#### `SheetTriggerProps`

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `render` | `ReactElement` | — | Your own element to be the trigger, such as a styled button. It is given the click handler and the attributes that tie it to the sheet. |

#### `SheetContentProps`

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `detached` | `boolean` | `true` | Stand clear of the screen edges with every corner rounded. On by default; off, the sheet meets the edges it rises from. |
| `size` | `'auto' \| 'half' \| 'full'` | `'auto'` | How tall a top or bottom sheet is. `auto` fits the content; `half` and `full` take that share of the screen, and `full` meets the edges. |
| `showGrabber` | `boolean` | — | Show the grabber. On by default for a top or bottom sheet. |
| `showClose` | `boolean` | `true` | Show the round close button in the top trailing corner. Default true. |
| `blur` | `boolean` | `false` | Frost the page behind the sheet instead of only dimming it. |
| `inline` | `boolean` | `false` | Draw the sheet in the page instead of over it: no backdrop, no trigger, always there. For previews and for a layout that shows the sheet as part of a screen. |

#### `SheetHeaderProps`

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `title` | `ReactNode` | — | The heading. In an open sheet it is also what the sheet is announced as. |
| `description` | `ReactNode` | — | A line under the heading. |

#### `SheetCloseProps`

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `render` | `ReactElement` | — | Your own element to close the sheet with, such as a Cancel button. Without it, and without children, this is the round close button. |
| `icon` | `boolean` | — | Draw the cross glyph. Set for you on the built-in close button. |

## In a Server Component

`Sheet` is a client component. A Server Component cannot read `Sheet.Trigger` off the import, so import each part by name: `SheetTrigger`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription`, `SheetBody`, `SheetFooter`, `SheetClose`, `SheetStage`.

## Notes

Swiping follows the pointer, and a quick flick toward the edge closes the sheet even when it has not moved far.

`dismissible={false}` keeps a click outside, Escape and a swipe from closing it. Only `Sheet.Close` and your own `open` state close it then.

`size` applies to top and bottom sheets. Side sheets always run the full height.

Focus moves into the sheet when it opens and returns to the trigger when it closes. The page behind cannot be scrolled or focused while it is open.

With reduced motion turned on, the sheet appears and disappears without sliding.

## Example

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { Radio, RadioGroup } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Sheet } from '@/components/panelui/sheet';

export default function SheetEvent() {
  return (
    <Sheet>
      <Sheet.Trigger render={<Button variant="outline" />}>Respond to invite</Sheet.Trigger>
      <Sheet.Content>
        <Sheet.Header
          title="Design critique"
          description="Thursday 22 October · 14:00–15:00"
        />
        <Sheet.Body className="flex flex-col gap-6">
          <RadioGroup defaultValue="going" aria-label="Your answer">
            <Label>
              <Radio value="going" /> Going
            </Label>
            <Label>
              <Radio value="maybe" /> Maybe
            </Label>
            <Label>
              <Radio value="declined" /> Can’t make it
            </Label>
          </RadioGroup>
          <Field>
            <FieldLabel>Note to Noor</FieldLabel>
            <Textarea placeholder="Running ten minutes late, start without me." />
          </Field>
          <Label className="justify-between">
            Remind me 15 minutes before
            <Switch defaultChecked />
          </Label>
        </Sheet.Body>
        <Sheet.Footer>
          <Sheet.Close render={<Button size="lg" />}>Send answer</Sheet.Close>
          <Sheet.Close render={<Button size="lg" variant="ghost" />}>Cancel</Sheet.Close>
        </Sheet.Footer>
      </Sheet.Content>
    </Sheet>
  );
}
```
