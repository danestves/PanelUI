import { useEffect, useMemo, useState } from "react";
import { Bookmark, Copy, Flag, Link2, Pencil, Share2, Sparkles, TextSelect, Trash2 } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable, View } from "react-native";
import { Avatar, BottomSheet, Button, ContextMenu, Card, Frame, InfoIcon, Input, Item, Label, Marker, Message, Meter, MessageScroller, Planner, type PlannerEntry, PlusSquareIcon, Popover, Progress, QRCode, SendIcon, ShareNodesIcon, Separator, Shimmer, Text, XIcon } from "panelui-native";
import type { ComponentEntry } from '../component-types';

/** Stable remote portraits for the Avatar demos. */
const AVATARS = [
  'https://i.pravatar.cc/150?img=12',
  'https://i.pravatar.cc/150?img=32',
  'https://i.pravatar.cc/150?img=47',
];

/* -------------------------------------------------------------------------- */
/* MessageScroller — full-screen demos                                        */
/* -------------------------------------------------------------------------- */

interface Turn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const THREAD: Turn[] = [
  { id: 't1', role: 'user', text: 'Can you summarise last quarter?' },
  { id: 't2', role: 'assistant', text: 'Revenue was up 14% on the quarter before, driven mostly by renewals.' },
  { id: 't3', role: 'user', text: 'Which plan grew fastest?' },
  { id: 't4', role: 'assistant', text: 'Team. It roughly doubled its seat count, while Pro stayed flat.' },
  { id: 't5', role: 'user', text: 'And churn?' },
  { id: 't6', role: 'assistant', text: 'Down to 2.1% monthly, the lowest it has been all year.' },
  { id: 't7', role: 'user', text: 'What should I look at next?' },
  { id: 't8', role: 'assistant', text: 'Expansion revenue. It is the line that explains most of the growth, and it is the one nobody is tracking weekly.' },
];

/** One turn, rendered as a Message. Shared by all three scroller demos. */
function Turn({ turn }: { turn: Turn }) {
  return turn.role === 'user' ? (
    <Message align="end">
      <Message.Content>
        <Message.Bubble>
          <Message.BubbleContent>{turn.text}</Message.BubbleContent>
        </Message.Bubble>
      </Message.Content>
    </Message>
  ) : (
    <Message>
      <Message.Avatar>
        <Avatar size="sm" fallback="AI" />
      </Message.Avatar>
      <Message.Content>
        <Message.Bubble>
          <Message.BubbleContent>{turn.text}</Message.BubbleContent>
        </Message.Bubble>
      </Message.Content>
    </Message>
  );
}

const REPLY =
  'Looking at the numbers now. Expansion revenue came to $412k for the quarter, up from $290k. Most of it is seat growth inside accounts that were already on Team, which is the healthiest kind — nobody had to be sold anything twice.';

/**
 * Follow-output: the transcript pins to the bottom while the reply streams,
 * but only while the reader is already there. Scroll up mid-stream and it
 * stops chasing until the button is pressed.
 */
function StreamingTranscriptDemo() {
  const [turns, setTurns] = useState<Turn[]>(THREAD.slice(0, 4));
  const [streaming, setStreaming] = useState(false);
  const insets = useSafeAreaInsets();

  const send = () => {
    if (streaming) return;
    const askId = `ask-${Date.now()}`;
    const replyId = `reply-${Date.now()}`;
    setTurns((current) => [
      ...current,
      { id: askId, role: 'user', text: 'Break down expansion revenue.' },
      { id: replyId, role: 'assistant', text: '' },
    ]);
    setStreaming(true);

    const words = REPLY.split(' ');
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setTurns((current) =>
        current.map((turn) =>
          turn.id === replyId ? { ...turn, text: words.slice(0, index).join(' ') } : turn
        )
      );
      if (index >= words.length) {
        clearInterval(timer);
        setStreaming(false);
      }
    }, 90);
  };

  return (
    <View className="flex-1">
      <MessageScroller autoScroll className="flex-1">
        <MessageScroller.Viewport>
          <MessageScroller.Content>
            {turns.map((turn) => (
              <MessageScroller.Item
                key={turn.id}
                messageId={turn.id}
                scrollAnchor={turn.role === 'user'}
              >
                <Turn turn={turn} />
              </MessageScroller.Item>
            ))}
            {streaming ? (
              <Marker>
                <Marker.Content shimmer>Generating…</Marker.Content>
              </Marker>
            ) : null}
          </MessageScroller.Content>
        </MessageScroller.Viewport>
        <MessageScroller.Button />
      </MessageScroller>

      {/* The full-page host reaches the screen edge, so the composer lifts
          itself clear of the home indicator. */}
      <View
        className="border-t border-border px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <Button onPress={send} loading={streaming} fullWidth>
          {streaming ? 'Streaming' : 'Send a message'}
        </Button>
      </View>
    </View>
  );
}

/**
 * Older turns are added above the reader. Without the correction this jumps a
 * screen backwards every time; with it the message they were reading does not
 * move at all.
 */
function HistoryTranscriptDemo() {
  const [turns, setTurns] = useState<Turn[]>(THREAD.slice(4));
  const [page, setPage] = useState(0);

  const loadOlder = () => {
    const older: Turn[] = Array.from({ length: 4 }, (_, index) => ({
      id: `old-${page}-${index}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      text:
        index % 2 === 0
          ? `An older question, ${page * 4 + index + 1} turns back.`
          : 'And the answer that went with it, long enough to take a couple of lines on a phone.',
    }));
    setTurns((current) => [...older, ...current]);
    setPage((current) => current + 1);
  };

  return (
    <MessageScroller className="flex-1" defaultScrollPosition="end">
      <MessageScroller.Viewport>
        <MessageScroller.Content>
          <View className="items-center pb-1">
            <Button variant="ghost" size="sm" onPress={loadOlder}>
              Load older messages
            </Button>
          </View>
          {turns.map((turn) => (
            <MessageScroller.Item
              key={turn.id}
              messageId={turn.id}
              scrollAnchor={turn.role === 'user'}
            >
              <Turn turn={turn} />
            </MessageScroller.Item>
          ))}
        </MessageScroller.Content>
      </MessageScroller.Viewport>
      <MessageScroller.Button />
    </MessageScroller>
  );
}

/**
 * A saved thread opens on the last turn that started something, not at the
 * bottom of whatever the reply happened to be.
 */
function SavedThreadDemo() {
  return (
    <MessageScroller className="flex-1" defaultScrollPosition="last-anchor">
      <MessageScroller.Viewport>
        <MessageScroller.Content>
          <Marker variant="separator">
            <Marker.Content>Yesterday</Marker.Content>
          </Marker>
          {THREAD.map((turn) => (
            <MessageScroller.Item
              key={turn.id}
              messageId={turn.id}
              scrollAnchor={turn.role === 'user'}
            >
              <Turn turn={turn} />
            </MessageScroller.Item>
          ))}
        </MessageScroller.Content>
      </MessageScroller.Viewport>
      <MessageScroller.Button target="start" />
    </MessageScroller>
  );
}

function MessageLongPressDemo() {
  const [open, setOpen] = useState(false);

  return (
    <View className="w-full gap-3">
      <Text size="sm" muted className="text-center">
        Press and hold the bubble.
      </Text>

      <Message align="end" onLongPress={() => setOpen(true)}>
        <Message.Content>
          <Message.Bubble>
            <Message.BubbleContent>
              Ship it — long-press me for actions.
            </Message.BubbleContent>
          </Message.Bubble>
        </Message.Content>
      </Message>

      {/* The component only exposes the gesture; the menu is wired here. */}
      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheet.Content>
          <Text size="lg" weight="semibold" className="mb-3">
            Message
          </Text>
          <View className="gap-1 pb-2">
            {[
              { label: 'Copy', icon: <PlusSquareIcon size={16} /> },
              { label: 'Reply', icon: <SendIcon size={16} /> },
              { label: 'Forward', icon: <ShareNodesIcon size={16} /> },
            ].map((action) => (
              <Pressable
                key={action.label}
                accessibilityRole="menuitem"
                onPress={() => setOpen(false)}
                className="flex-row items-center gap-3 rounded-xl px-3 py-3 active:bg-accent"
              >
                {action.icon}
                <Text>{action.label}</Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="menuitem"
              onPress={() => setOpen(false)}
              className="flex-row items-center gap-3 rounded-xl px-3 py-3 active:bg-accent"
            >
              <XIcon size={16} />
              <Text className="text-destructive">Delete</Text>
            </Pressable>
          </View>
        </BottomSheet.Content>
      </BottomSheet>
    </View>
  );
}

function PlacementPopover({
  placement,
}: {
  placement: 'top' | 'bottom' | 'left' | 'right';
}) {
  return (
    <Popover>
      <Popover.Trigger>
        <Button variant="secondary" size="sm">
          {placement}
        </Button>
      </Popover.Trigger>
      <Popover.Content placement={placement} className="w-40">
        <Popover.Arrow />
        <Popover.Description>Opens {placement} of the trigger.</Popover.Description>
      </Popover.Content>
    </Popover>
  );
}

function PopoverFormDemo() {
  const [name, setName] = useState('Untitled board');
  const [open, setOpen] = useState(false);

  return (
    <View className="w-full py-4">
      <Popover open={open} onOpenChange={setOpen}>
        <Popover.Trigger>
          {/* A full-width trigger, because `width="trigger"` is only worth
              having when the trigger is wide enough to hold the content. */}
          <Button variant="outline" fullWidth>
            Rename board
          </Button>
        </Popover.Trigger>
        {/* The panel takes the trigger's width, so the two read as one control
            rather than as a panel floating over a button. `minWidth` is the
            floor for the day the trigger turns out narrower than the form. */}
        <Popover.Content width="trigger" minWidth={260} align="start" className="gap-3">
          <Popover.Title>Rename</Popover.Title>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="Board name"
            accessibilityLabel="Board name"
            autoCorrect={false}
          />
          <View className="flex-row justify-end gap-2">
            <Popover.Close>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </Popover.Close>
            <Popover.Close>
              <Button size="sm">Save</Button>
            </Popover.Close>
          </View>
        </Popover.Content>
      </Popover>
    </View>
  );
}

function ProgressDemo() {
  const [uploaded, setUploaded] = useState(20);

  useEffect(() => {
    const id = setInterval(() => {
      setUploaded((current) => (current >= 100 ? 0 : current + 20));
    }, 1200);
    return () => clearInterval(id);
  }, []);

  return (
    <View className="w-full gap-4">
      <Progress value={uploaded} label="Uploading" showValueLabel />
      <Progress value={uploaded} color="success" size="sm" />
      <Progress value={70} color="warning" size="lg" />
      <Progress indeterminate color="info" />
    </View>
  );
}

function MeterDemo() {
  const [charge, setCharge] = useState(96);

  // A battery walking down its thresholds, so the colour change is visible
  // without waiting for a real one to drain.
  useEffect(() => {
    const id = setInterval(() => {
      setCharge((current) => (current <= 4 ? 96 : current - 8));
    }, 900);
    return () => clearInterval(id);
  }, []);

  return (
    <View className="w-full gap-5">
      <Meter
        value={charge}
        label="Battery"
        showValueLabel
        thresholds={[
          { from: 0, color: 'destructive' },
          { from: 20, color: 'warning' },
          { from: 50, color: 'success' },
        ]}
      />
      <Meter
        value={168}
        maxValue={256}
        label="Storage"
        showValueLabel
        formatOptions={{ style: 'unit', unit: 'gigabyte' }}
        color="success"
        thresholds={[
          { from: 180, color: 'warning' },
          { from: 230, color: 'destructive' },
        ]}
      />
    </View>
  );
}

function PasswordStrengthDemo() {
  const [password, setPassword] = useState('hunter2');

  // A stand-in for a real estimator: length and variety, scored out of four.
  const score = useMemo(() => {
    if (!password) return 0;
    let earned = 0;
    if (password.length >= 8) earned += 1;
    if (password.length >= 12) earned += 1;
    if (/[^a-zA-Z0-9]/.test(password)) earned += 1;
    if (/[0-9]/.test(password) && /[a-z]/.test(password) && /[A-Z]/.test(password)) {
      earned += 1;
    }
    return Math.min(earned, 4);
  }, [password]);

  return (
    <View className="w-full gap-3">
      <Input
        value={password}
        onChangeText={setPassword}
        placeholder="Choose a password"
        autoCapitalize="none"
      />
      {/* Four blocks, and a word rather than a percentage — a password is not
          seventy percent strong. */}
      <Meter
        value={score}
        maxValue={4}
        segments={4}
        label="Password strength"
        showValueLabel
        valueLabel={['Too short', 'Weak', 'Fair', 'Good', 'Strong'][score]}
        thresholds={[
          { from: 0, color: 'destructive' },
          { from: 2, color: 'warning' },
          { from: 3, color: 'success' },
        ]}
      />
    </View>
  );
}

/**
 * A chat bubble whose actions are reached by holding it.
 *
 * The panel opens above the press, so the hand that opened it is not sitting
 * over the rows it is meant to be reading.
 */
function ContextMenuMessageDemo() {
  const [last, setLast] = useState<string | null>(null);

  return (
    <View className="w-full gap-3 py-2">
      <ContextMenu>
        <ContextMenu.Trigger haptics>
          <Card>
            <Card.Content className="p-4">
              <Text>
                Would you like an interactive web-based todo application, or a
                command-line one?
              </Text>
            </Card.Content>
          </Card>
        </ContextMenu.Trigger>

        <ContextMenu.Content>
          <ContextMenu.Item
            icon={<Sparkles size={18} />}
            onSelect={() => setLast('Ask AI')}
          >
            Ask AI
          </ContextMenu.Item>
          <ContextMenu.Item icon={<Share2 size={18} />} onSelect={() => setLast('Share')}>
            Share
          </ContextMenu.Item>
          <ContextMenu.Item icon={<Copy size={18} />} onSelect={() => setLast('Copy')}>
            Copy
          </ContextMenu.Item>
          <ContextMenu.Item
            icon={<TextSelect size={18} />}
            onSelect={() => setLast('Select text')}
          >
            Select text
          </ContextMenu.Item>

          <ContextMenu.Separator />

          <ContextMenu.Item
            variant="destructive"
            icon={<Flag size={18} />}
            onSelect={() => setLast('Report')}
          >
            Report
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu>

      <Text size="xs" muted>
        {last ? `Chose: ${last}` : 'Press and hold the card.'}
      </Text>
    </View>
  );
}

/**
 * The held card lifted off the page while its actions are up.
 *
 * `ContextMenu.Preview` draws the trigger's own content again over the dimmed
 * screen, and anchors the panel to it — so what is being acted on stays visible
 * and stays put, instead of being one of several cards behind a scrim.
 */
function ContextMenuPreviewDemo() {
  const [last, setLast] = useState<string | null>(null);

  return (
    <View className="w-full gap-3 py-2">
      <ContextMenu>
        <ContextMenu.Trigger haptics>
          <Card>
            <Card.Content className="gap-1 p-4">
              <Text className="font-semibold">Coastal path, Tuesday</Text>
              <Text size="sm" muted>
                14.2 km · 3h 40m · 260 m climbed
              </Text>
            </Card.Content>
          </Card>
        </ContextMenu.Trigger>

        <ContextMenu.Content>
          <ContextMenu.Preview />

          <ContextMenu.Item
            icon={<Bookmark size={18} />}
            onSelect={() => setLast('Save')}
          >
            Save
          </ContextMenu.Item>
          <ContextMenu.Item icon={<Link2 size={18} />} onSelect={() => setLast('Copy link')}>
            Copy link
          </ContextMenu.Item>
          <ContextMenu.Item icon={<Share2 size={18} />} onSelect={() => setLast('Share')}>
            Share
          </ContextMenu.Item>

          <ContextMenu.Separator />

          <ContextMenu.Item
            variant="destructive"
            icon={<Trash2 size={18} />}
            onSelect={() => setLast('Delete')}
          >
            Delete
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu>

      <Text size="xs" muted>
        {last ? `Chose: ${last}` : 'Hold the card — it comes forward with the menu.'}
      </Text>
    </View>
  );
}

/**
 * A row that does something when tapped and something else when held.
 *
 * The tap is on the trigger rather than on the row inside it, which is what
 * lets the recogniser choose between the two before either has fired.
 */
function ContextMenuRowDemo() {
  const [status, setStatus] = useState('Tap to open, hold for actions.');
  const [pinned, setPinned] = useState(false);

  return (
    <View className="w-full gap-3 py-2">
      <ContextMenu>
        <ContextMenu.Trigger
          anchor="target"
          haptics
          onPress={() => setStatus('Tapped — opened the note.')}
        >
          <Item variant="outline">
            <Item.Content>
              <Item.Title>Design review</Item.Title>
              <Item.Description>Edited 20 minutes ago</Item.Description>
            </Item.Content>
          </Item>
        </ContextMenu.Trigger>

        <ContextMenu.Content align="end">
          <ContextMenu.Item
            icon={<Pencil size={18} />}
            onSelect={() => setStatus('Held — chose Rename.')}
          >
            Rename
          </ContextMenu.Item>
          {/* A checkbox row keeps the panel open: a setting is something people
              toggle twice. */}
          <ContextMenu.CheckboxItem checked={pinned} onCheckedChange={setPinned}>
            Pinned
          </ContextMenu.CheckboxItem>
          <ContextMenu.Separator />
          <ContextMenu.Item
            variant="destructive"
            icon={<Trash2 size={18} />}
            onSelect={() => setStatus('Held — chose Delete.')}
          >
            Delete
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu>

      <Text size="xs" muted>
        {status}
        {pinned ? ' · pinned' : ''}
      </Text>
    </View>
  );
}

/**
 * The same menu opened four ways, so the two knobs can be compared side by side.
 *
 * `placement` picks the side of the press the panel opens on and `align` where
 * it sits along the other axis. Neither is a promise: a panel with no room on
 * the side it asked for flips to the other, and one that would run off an edge
 * is clamped back inside the safe area — so the last row here behaves like the
 * first once it is held near the bottom of the screen.
 */
function ContextMenuPlacementDemo() {
  const places: {
    label: string;
    placement: 'top' | 'bottom';
    align: 'start' | 'center' | 'end';
    anchor?: 'point' | 'target';
  }[] = [
    { label: 'Down from the press', placement: 'bottom', align: 'start' },
    { label: 'Down, centred', placement: 'bottom', align: 'center' },
    { label: 'Up from the press', placement: 'top', align: 'start' },
    { label: 'Lined up with the row', placement: 'bottom', align: 'end', anchor: 'target' },
  ];

  return (
    <View className="w-full gap-2 py-2">
      {places.map((place) => (
        <ContextMenu key={place.label}>
          <ContextMenu.Trigger haptics anchor={place.anchor ?? 'point'}>
            <Item variant="outline">
              <Item.Content>
                <Item.Title>{place.label}</Item.Title>
                <Item.Description>
                  placement=&quot;{place.placement}&quot; · align=&quot;{place.align}&quot;
                </Item.Description>
              </Item.Content>
            </Item>
          </ContextMenu.Trigger>

          <ContextMenu.Content placement={place.placement} align={place.align}>
            <ContextMenu.Item icon={<Share2 size={18} />}>Share</ContextMenu.Item>
            <ContextMenu.Item icon={<Copy size={18} />}>Copy</ContextMenu.Item>
            <ContextMenu.Item icon={<Bookmark size={18} />}>Save</ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu>
      ))}
    </View>
  );
}

/**
 * The same rows brought up from the bottom edge instead.
 *
 * The target is a list row rather than a card, because the sheet is what a
 * context menu turns into once there are more verbs than sit comfortably at a
 * fingertip — and that is the case in a list, where the panel would otherwise
 * cover the rows either side of the one being acted on. A `Label` names what
 * is being acted on, which a sheet needs and an anchored panel does not: the
 * sheet is nowhere near the row it came from.
 */
function ContextMenuSheetDemo() {
  const [last, setLast] = useState<string | null>(null);

  return (
    <View className="w-full gap-3 py-2">
      <ContextMenu presentation="bottom-sheet">
        <ContextMenu.Trigger haptics>
          <Item variant="outline">
            <Item.Content>
              <Item.Title>Quarterly report.pdf</Item.Title>
              <Item.Description>2.4 MB · shared with 6 people</Item.Description>
            </Item.Content>
          </Item>
        </ContextMenu.Trigger>

        <ContextMenu.Content>
          <ContextMenu.Label>Quarterly report.pdf</ContextMenu.Label>
          <ContextMenu.Item icon={<Share2 size={18} />} onSelect={() => setLast('Share')}>
            Share
          </ContextMenu.Item>
          <ContextMenu.Item icon={<Link2 size={18} />} onSelect={() => setLast('Copy link')}>
            Copy link
          </ContextMenu.Item>
          <ContextMenu.Item
            icon={<Bookmark size={18} />}
            onSelect={() => setLast('Save for later')}
          >
            Save for later
          </ContextMenu.Item>
          <ContextMenu.Item icon={<Pencil size={18} />} onSelect={() => setLast('Rename')}>
            Rename
          </ContextMenu.Item>
          <ContextMenu.Separator />
          <ContextMenu.Item
            variant="destructive"
            icon={<Trash2 size={18} />}
            onSelect={() => setLast('Delete')}
          >
            Delete
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu>

      <Text size="xs" muted>
        {last ? `Chose: ${last}` : 'Press and hold the row.'}
      </Text>
    </View>
  );
}

/** The framed version: the tray, its title strip, and the code on the card. */
function QRCodeFramedVersion() {
  return (
    <View className="flex-1 items-center justify-center gap-4 p-4">
      <QRCode value="https://panelui.dev" size="lg">
        <QRCode.Frame>
          <QRCode.Header>
            <QRCode.Title>Documentation</QRCode.Title>
            <QRCode.Action>panelui.dev</QRCode.Action>
          </QRCode.Header>
          <QRCode.Panel>
            <QRCode.Canvas />
          </QRCode.Panel>
        </QRCode.Frame>
        <QRCode.Caption>Scan to open the documentation</QRCode.Caption>
      </QRCode>
    </View>
  );
}

/** The header frame, with the trailing slot carrying how long it is good for. */
function QRCodeHeaderVersion() {
  return (
    <View className="flex-1 items-center justify-center gap-4 p-4">
      <QRCode value="https://panelui.dev/pair/8f2a41" size="lg">
        <QRCode.Frame>
          <QRCode.Header>
            <QRCode.Title>Pair a device</QRCode.Title>
            <QRCode.Action>Expires in 5m</QRCode.Action>
          </QRCode.Header>
          <QRCode.Panel>
            <QRCode.Canvas />
            {/* The mark clears its own square; the correction level covers it. */}
            <QRCode.Logo>
              <Avatar fallback="P" size="sm" />
            </QRCode.Logo>
          </QRCode.Panel>
        </QRCode.Frame>
        {/* The way through for anyone whose camera is the thing being set up. */}
        <QRCode.Value />
      </QRCode>
    </View>
  );
}

/** Folded away behind a row, the way the colour picker folds away. */
function QRCodePopoverVersion() {
  return (
    <View className="flex-1 justify-center gap-4 p-4">
      <Card>
        <Card.Header>
          <Card.Title>Share this page</Card.Title>
          <Card.Description>Anyone with the code can open it.</Card.Description>
        </Card.Header>
        <Card.Footer>
          <QRCode value="https://panelui.dev" presentation="popover">
            <QRCode.Trigger>
              <Button variant="outline">Show QR code</Button>
            </QRCode.Trigger>
            <QRCode.Content>
              <QRCode.Canvas />
              <QRCode.Caption>Scan to open the docs</QRCode.Caption>
            </QRCode.Content>
          </QRCode>
        </Card.Footer>
      </Card>

      <QRCode value="WIFI:T:WPA;S:PanelUI Guest;P:hunter2;;" presentation="bottom-sheet" size="lg">
        <QRCode.Trigger>
          <Button>Join the network</Button>
        </QRCode.Trigger>
        <QRCode.Content>
          <QRCode.Canvas />
          <QRCode.Caption>Scan to join PanelUI Guest</QRCode.Caption>
        </QRCode.Content>
      </QRCode>
    </View>
  );
}

const PLANNER_CATEGORIES = [
  { id: 'monthly', label: 'Monthly', color: '#8b5cf6' },
  { id: 'yearly', label: 'Yearly', color: '#eab308' },
];

function plannerEntries(month: Date): PlannerEntry[] {
  const on = (day: number, label: string, category: string) => ({
    id: `${label}-${day}`,
    date: new Date(month.getFullYear(), month.getMonth(), day),
    label,
    category,
  });
  return [
    on(2, 'Netflix', 'monthly'),
    on(4, 'Linear', 'yearly'),
    on(7, 'Adobe', 'monthly'),
    on(10, 'Notion', 'yearly'),
    on(12, 'iCloud', 'monthly'),
    on(15, 'Vercel', 'monthly'),
    on(20, 'Raycast', 'monthly'),
    on(25, 'Slack', 'yearly'),
    on(28, 'Figma', 'monthly'),
    on(28, 'Sentry', 'monthly'),
    on(28, 'Fly.io', 'monthly'),
  ];
}

function PlannerDayList({ entries }: { entries: PlannerEntry[] }) {
  if (entries.length === 0) {
    return (
      <Text size="sm" muted>
        Nothing renews on this day.
      </Text>
    );
  }
  return (
    <View className="gap-2">
      {entries.map((entry) => (
        <View key={entry.id} className="flex-row items-center gap-2.5">
          <View
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor: PLANNER_CATEGORIES.find((c) => c.id === entry.category)?.color,
            }}
          />
          <Text size="sm" className="flex-1">
            {entry.label}
          </Text>
          <Text size="xs" muted>
            {PLANNER_CATEGORIES.find((c) => c.id === entry.category)?.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function PlannerDemo() {
  const [month, setMonth] = useState(() => new Date());
  return (
    <Planner
      month={month}
      onMonthChange={setMonth}
      entries={plannerEntries(month)}
      categories={PLANNER_CATEGORIES}
    >
      <Planner.Header>
        <Planner.Title />
        <Planner.Today />
        <Planner.Nav />
      </Planner.Header>
      <Planner.Grid />
      <Planner.Legend counts>
        <Planner.Summary />
      </Planner.Legend>
      <Planner.Details>
        {(_date, dayEntries) => <PlannerDayList entries={dayEntries} />}
      </Planner.Details>
    </Planner>
  );
}

function PlannerDetailsDemo() {
  const [month, setMonth] = useState(() => new Date());
  const entries = plannerEntries(month);
  return (
    <Planner
      month={month}
      onMonthChange={setMonth}
      entries={entries}
      categories={PLANNER_CATEGORIES}
    >
      <Planner.Header>
        <Planner.Title />
        <Planner.Nav />
      </Planner.Header>
      <Planner.Grid />
      <Planner.Legend />
      <Planner.Details>
        {(_date, dayEntries) => <PlannerDayList entries={dayEntries} />}
      </Planner.Details>
    </Planner>
  );
}

function PlannerBareDemo() {
  const [month, setMonth] = useState(() => new Date());
  return (
    <Card className="w-full p-2">
      <Planner
        frame={false}
        month={month}
        onMonthChange={setMonth}
        entries={plannerEntries(month)}
        categories={PLANNER_CATEGORIES}
      >
        <Planner.Grid />
      </Planner>
    </Card>
  );
}

export const ENTRIES: ComponentEntry[] = [
{
    slug: 'context-menu',
    name: 'ContextMenu',
    summary: 'Actions for a piece of content, opened by holding it',
    demos: [
      { label: 'Holding a message', render: () => <ContextMenuMessageDemo /> },
      { label: 'The held card, lifted', render: () => <ContextMenuPreviewDemo /> },
      { label: 'A tap and a hold on one row', render: () => <ContextMenuRowDemo /> },
      { label: 'Where the panel goes', render: () => <ContextMenuPlacementDemo /> },
      { label: 'As a bottom sheet', render: () => <ContextMenuSheetDemo /> },
    ],
  },
{
    slug: 'message-scroller',
    name: 'MessageScroller',
    summary: 'Scroll behaviour a chat transcript needs',
    demos: [
      {
        label: 'Following a streamed reply',
        id: 'streaming',
        fullPage: true,
        description:
          'Pins to the bottom while a reply streams — but only while you are already there. Scroll up mid-stream and it stops chasing.',
        render: () => <StreamingTranscriptDemo />,
      },
      {
        label: 'Loading history',
        id: 'history',
        fullPage: true,
        description:
          'Older turns are added above you. The message you are reading does not move.',
        render: () => <HistoryTranscriptDemo />,
      },
      {
        label: 'Opening a saved thread',
        id: 'saved',
        fullPage: true,
        description:
          'Opens on the last turn that started something, rather than at the bottom of the reply to it.',
        render: () => <SavedThreadDemo />,
      },
    ],
  },
{
    slug: 'message',
    name: 'Message',
    summary: 'Chat turn with avatar, bubble and metadata',
    demos: [
      {
        label: 'Both sides',
        render: () => (
          <View className="w-full gap-3">
            <Message>
              <Message.Avatar>
                <Avatar size="sm" source={{ uri: AVATARS[1] }} fallback="OL" />
              </Message.Avatar>
              <Message.Content>
                <Message.Bubble>
                  <Message.BubbleContent>
                    How can I help you today?
                  </Message.BubbleContent>
                </Message.Bubble>
              </Message.Content>
            </Message>

            <Message align="end">
              <Message.Content>
                <Message.Bubble>
                  <Message.BubbleContent>
                    Set a reminder for 9am tomorrow.
                  </Message.BubbleContent>
                </Message.Bubble>
                <Message.Footer>Read</Message.Footer>
              </Message.Content>
            </Message>
          </View>
        ),
      },
      {
        label: 'Header and footer',
        render: () => (
          <View className="w-full gap-3">
            <Message>
              <Message.Avatar>
                <Avatar size="sm" source={{ uri: AVATARS[2] }} fallback="OL" />
              </Message.Avatar>
              <Message.Content>
                <Message.Header>Olivia</Message.Header>
                <Message.Bubble>
                  <Message.BubbleContent>
                    I pushed the fix — can you take another look?
                  </Message.BubbleContent>
                </Message.Bubble>
                <Message.Footer>Yesterday at 18:04</Message.Footer>
              </Message.Content>
            </Message>
          </View>
        ),
      },
      {
        label: 'Grouped turns',
        render: () => (
          // Only the first message keeps its avatar; the rest reserve the slot
          // so the bubbles stay in one column.
          <Message.Group align="start" className="w-full">
            {[
              'Looking that up…',
              'Found three matching invoices.',
              'Want me to export them?',
            ].map((body) => (
              <Message key={body}>
                <Message.Avatar>
                  <Avatar size="sm" fallback="AI" />
                </Message.Avatar>
                <Message.Content>
                  <Message.Bubble>
                    <Message.BubbleContent>{body}</Message.BubbleContent>
                  </Message.Bubble>
                </Message.Content>
              </Message>
            ))}
          </Message.Group>
        ),
      },
      {
        label: 'Streaming and actions',
        render: () => (
          <View className="w-full gap-3">
            <Message>
              <Message.Avatar>
                <Avatar size="sm" fallback="AI" />
              </Message.Avatar>
              <Message.Content>
                <Message.Bubble>
                  <Shimmer textClassName="text-base">Thinking…</Shimmer>
                </Message.Bubble>
              </Message.Content>
            </Message>

            <Message>
              <Message.Avatar>
                <Avatar size="sm" fallback="AI" />
              </Message.Avatar>
              <Message.Content>
                <Message.Bubble>
                  <Message.BubbleContent>
                    Your reminder is set for 9:00 tomorrow.
                  </Message.BubbleContent>
                </Message.Bubble>
                <Message.Actions>
                  <Button size="sm" variant="ghost">
                    Copy
                  </Button>
                  <Button size="sm" variant="ghost">
                    Retry
                  </Button>
                </Message.Actions>
              </Message.Content>
            </Message>
          </View>
        ),
      },
      { label: 'Long-press for actions', render: () => <MessageLongPressDemo /> },
    ],
  },
{
    slug: 'planner',
    name: 'Planner',
    summary: 'A month of days, each carrying what falls on it',
    demos: [
      { label: 'A month of renewals', render: () => <PlannerDemo /> },
      { label: 'Opening a day', render: () => <PlannerDetailsDemo /> },
      { label: 'Without the frame', render: () => <PlannerBareDemo /> },
    ],
  },
{
    slug: 'popover',
    name: 'Popover',
    summary: 'Panel anchored to the thing that opened it',
    layout: 'sections',
    demos: [
      {
        // A column of actions belongs in Menu now — what this shows instead is
        // the cap, which is the thing a hand-built panel gets wrong.
        label: 'A long panel, scrolled',
        render: () => (
          <View className="w-full items-center py-4">
            <Popover>
              <Popover.Trigger>
                <Button variant="outline">Release notes</Button>
              </Popover.Trigger>
              {/* Capped below the safe area and scrolled, so the last line is
                  reachable however many there are. */}
              <Popover.Content scrollable maxHeight={260} align="start" className="w-72">
                <Popover.Title>What changed</Popover.Title>
                {Array.from({ length: 8 }, (_, index) => (
                  <Popover.Description key={index}>
                    {`Release note ${index + 1} — a line of detail long enough to
                      take a couple of rows on a phone.`}
                  </Popover.Description>
                ))}
              </Popover.Content>
            </Popover>
          </View>
        ),
      },
      {
        label: 'Placement',
        render: () => (
          // Each trigger is pinned to the side that leaves room for the panel
          // to open the way its label says — so left and right are actually
          // distinct rather than both flipping inward.
          <View className="h-72 w-full justify-between py-4">
            <View className="flex-row justify-center">
              <PlacementPopover placement="bottom" />
            </View>
            <View className="flex-row items-center justify-between">
              <PlacementPopover placement="right" />
              <PlacementPopover placement="left" />
            </View>
            <View className="flex-row justify-center">
              <PlacementPopover placement="top" />
            </View>
          </View>
        ),
      },
      {
        label: 'With an arrow',
        render: () => (
          <View className="w-full items-center py-4">
            <Popover>
              <Popover.Trigger>
                <Button variant="ghost" size="icon" accessibilityLabel="What is this?">
                  <InfoIcon size={18} />
                </Button>
              </Popover.Trigger>
              {/* Default bottom placement: the arrow sits centred on the
                  panel's top edge, pointing up at the trigger. */}
              <Popover.Content className="w-60">
                <Popover.Arrow />
                <Popover.Title>Monthly active users</Popover.Title>
                <Popover.Description>
                  Anyone who opened the app at least once in the last 30 days.
                </Popover.Description>
              </Popover.Content>
            </Popover>
          </View>
        ),
      },
      {
        label: 'A form, matching the trigger width',
        render: () => <PopoverFormDemo />,
      },
      {
        label: 'Blurred background',
        render: () => (
          <View className="w-full items-center py-4">
            <Popover>
              <Popover.Trigger>
                <Button variant="outline">Frost the screen</Button>
              </Popover.Trigger>
              {/* `blur` frosts what is behind, falling back to a dim when
                  expo-blur is not installed. */}
              <Popover.Content blur align="start" className="w-64">
                <Popover.Arrow />
                <Popover.Title>Focus here</Popover.Title>
                <Popover.Description>
                  The list behind is blurred so this panel reads as the only
                  thing to deal with.
                </Popover.Description>
              </Popover.Content>
            </Popover>
          </View>
        ),
      },
      {
        label: 'As a bottom sheet',
        render: () => (
          <View className="w-full items-center py-4">
            {/* Same API, presented as a draggable sheet — better for a form on
                a small screen than a panel floating over the trigger. */}
            <Popover presentation="bottom-sheet">
              <Popover.Trigger>
                <Button variant="outline">Open as a sheet</Button>
              </Popover.Trigger>
              <Popover.Content>
                <Popover.Title>Sort by</Popover.Title>
                <Popover.Description className="mb-2">
                  The same content, presented from the bottom.
                </Popover.Description>
                {['Newest', 'Oldest', 'Most active'].map((option) => (
                  <Popover.Close key={option}>
                    <Pressable
                      accessibilityRole="menuitem"
                      onPress={() => {}}
                      className="rounded-xl px-3 py-3 active:bg-accent"
                    >
                      <Text>{option}</Text>
                    </Pressable>
                  </Popover.Close>
                ))}
              </Popover.Content>
            </Popover>
          </View>
        ),
      },
    ],
  },
{
    slug: 'qr-code',
    name: 'QRCode',
    summary: 'A string a camera can read',
    demos: [
      {
        label: 'Framed',
        id: 'framed',
        fullPage: true,
        description: 'The code in a bordered panel, with a line under it saying what it does.',
        render: () => <QRCodeFramedVersion />,
      },
      {
        label: 'With a header',
        id: 'header',
        fullPage: true,
        description: 'A title strip with a trailing slot, a mark in the middle, and the string underneath.',
        render: () => <QRCodeHeaderVersion />,
      },
      {
        label: 'Folded away',
        id: 'popover',
        fullPage: true,
        description: 'Behind a button, brought up in a popover or a sheet when it is wanted.',
        render: () => <QRCodePopoverVersion />,
      },
      {
        label: 'Sizes',
        render: () => (
          <View className="w-full items-center gap-6">
            <QRCode value="https://panelui.dev" size="sm">
              <QRCode.Canvas />
            </QRCode>
            <QRCode value="https://panelui.dev" size="md">
              <QRCode.Canvas />
            </QRCode>
          </View>
        ),
      },
      {
        label: 'Error correction',
        render: () => (
          <View className="w-full flex-row items-center justify-around">
            <QRCode value="https://panelui.dev" size="sm" errorCorrection="L">
              <QRCode.Canvas />
              <QRCode.Caption>L</QRCode.Caption>
            </QRCode>
            <QRCode value="https://panelui.dev" size="sm" errorCorrection="H">
              <QRCode.Canvas />
              <QRCode.Caption>H</QRCode.Caption>
            </QRCode>
          </View>
        ),
      },
      {
        label: 'With a mark',
        render: () => (
          <QRCode value="https://panelui.dev" size="lg">
            <QRCode.Frame>
              <QRCode.Header>
                <QRCode.Title>PanelUI</QRCode.Title>
              </QRCode.Header>
              <QRCode.Panel>
                <QRCode.Canvas />
                <QRCode.Logo>
                  <Avatar fallback="P" size="sm" />
                </QRCode.Logo>
              </QRCode.Panel>
            </QRCode.Frame>
          </QRCode>
        ),
      },
    ],
  },
{
    slug: 'meter',
    name: 'Meter',
    summary: 'A measurement on a fixed scale, coloured by where it falls',
    demos: [
      { label: 'Thresholds', render: () => <MeterDemo /> },
      { label: 'Segmented', render: () => <PasswordStrengthDemo /> },
      {
        label: 'Colours',
        render: () => (
          <View className="w-full gap-4">
            <Meter value={60} color="primary" />
            <Meter value={60} color="success" />
            <Meter value={60} color="warning" />
            <Meter value={60} color="destructive" />
            <Meter value={60} color="info" />
            <Meter value={60} color="muted" />
          </View>
        ),
      },
      {
        label: 'Sizes',
        render: () => (
          <View className="w-full gap-4">
            <Meter value={60} size="sm" accessibilityLabel="Small" />
            <Meter value={60} size="md" accessibilityLabel="Medium" />
            <Meter value={60} size="lg" accessibilityLabel="Large" />
          </View>
        ),
      },
      {
        // Counted readings, where a bar would round away the thing being said.
        label: 'Counted, not measured',
        render: () => (
          <View className="w-full gap-5">
            <Meter
              value={3}
              maxValue={5}
              segments={5}
              label="Signal"
              showValueLabel
              valueLabel="3 of 5 bars"
              color="info"
            />
            <Meter
              value={7}
              maxValue={10}
              segments={10}
              label="Questions right"
              showValueLabel
              size="lg"
              color="success"
            />
          </View>
        ),
      },
    ],
  },
{
    slug: 'progress',
    name: 'Progress',
    summary: 'Determinate and indeterminate progress bar',
    demos: [
      { label: 'Animated', render: () => <ProgressDemo /> },
      {
        label: 'Labelled',
        render: () => (
          <View className="w-full gap-4">
            <Progress value={64} label="Downloading" showValueLabel />
            <Progress
              value={40}
              color="success"
              label="Storage"
              showValueLabel
              formatOptions={{ style: 'currency', currency: 'USD' }}
              valueLabel="8.2 GB of 20 GB"
            />
            <Progress value={90} color="warning" showValueLabel />
          </View>
        ),
      },
      {
        // The bars below count money and seats, not percentages — nothing is
        // converted on the way in, and the readout says what was counted.
        label: 'A range of its own',
        render: () => (
          <View className="w-full gap-4">
            <Progress
              value={1250}
              maxValue={2000}
              label="Budget"
              formatOptions={{ style: 'currency', currency: 'USD' }}
              showValueLabel
            />
            <Progress
              value={18}
              maxValue={24}
              color="info"
              label="Seats"
              valueLabel="18 of 24"
              showValueLabel
            />
            <Progress value={72} minValue={40} maxValue={80} color="success" showValueLabel />
          </View>
        ),
      },
      {
        label: 'Colors',
        render: () => (
          <View className="w-full gap-4">
            <Progress value={35} />
            <Progress value={55} color="success" />
            <Progress value={75} color="warning" />
            <Progress value={90} color="destructive" />
          </View>
        ),
      },
      {
        label: 'Sizes',
        render: () => (
          <View className="w-full gap-4">
            <Progress value={60} size="sm" />
            <Progress value={60} />
            <Progress value={60} size="lg" />
          </View>
        ),
      },
    ],
  }
];
export const ENTRIES_BY_SLUG = Object.fromEntries(ENTRIES.map((entry) => [entry.slug, entry]));
