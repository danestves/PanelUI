/**
 * The Panelside blocks — seven whole screens, one per full-page demo.
 *
 * Panelside owns the screen by definition: it wraps the app content in order
 * to push it, so there is nothing to render inline in a section between two
 * dividers. Every demo here is the full thing, and each draws its own way back
 * because the route gives it no header — and, on iOS, no back-swipe either,
 * since the system claims the same screen edge the panel opens from.
 *
 * All seven share one panel. What changes is the props on the root and what the
 * scene holds, which is the point worth showing: the anatomy does not change
 * when the behaviour does.
 */
import { useMemo, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';
import {
  Avatar,
  BottomSheet,
  Button,
  FileIcon,
  ImageIcon,
  Item,
  Marker,
  MenuIcon,
  Message,
  MessageCircleIcon,
  MessageScroller,
  MicIcon,
  PackageIcon,
  Panelside,
  PlusIcon,
  SendIcon,
  Text,
  XIcon,
  usePanelside,
  type PanelsideProps,
  type PanelsideSceneProps,
} from 'panelui-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';

const NAV = [
  { id: 'chats', label: 'Chats', icon: <MessageCircleIcon size={20} /> },
  { id: 'projects', label: 'Projects', icon: <PackageIcon size={20} />, badge: 4 },
  { id: 'artifacts', label: 'Artifacts', icon: <ImageIcon size={20} /> },
  { id: 'code', label: 'Code', icon: <FileIcon size={20} /> },
];

const STARRED = [
  'Launch announcement thread',
  'Pricing page rewrite',
  'Onboarding email sequence',
];

const RECENTS = [
  'Migrating the design tokens',
  'Why is the bundle 4 MB',
  'Draft: quarterly retro notes',
  'Refactor the settings screen',
  'Copy for the empty states',
  'Comparing chart libraries',
  'Accessibility pass on forms',
  'Weekly standup summary',
];

/**
 * The panel, shared by all six demos.
 *
 * `native` only reaches the one control that has a platform equivalent. There
 * is no native list row and no native search field, so the rest stays ours —
 * which is the honest answer rather than a half-native panel that matches
 * neither.
 */
function AssistantPanel({
  native = false,
  activeId,
  onSelect,
}: {
  native?: boolean;
  /** The conversation currently open in the scene, if the demo tracks one. */
  activeId?: string;
  /** Given, every history row becomes a destination. */
  onSelect?: (title: string) => void;
}) {
  const [query, setQuery] = useState('');
  const { setOpen } = usePanelside();

  // Selecting a destination closes the panel. Leaving it open would mean the
  // thing you just navigated to is behind the thing you navigated from.
  const select = onSelect
    ? (title: string) => {
        onSelect(title);
        setOpen(false);
      }
    : undefined;

  // Filtering lives here rather than in the component: the panel does not know
  // what a history entry is, and a search that only matched titles would be
  // wrong for the first app that indexes message bodies too.
  const { starred, recents } = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const match = (title: string) => title.toLowerCase().includes(needle);
    return needle
      ? { starred: STARRED.filter(match), recents: RECENTS.filter(match) }
      : { starred: STARRED, recents: RECENTS };
  }, [query]);

  const empty = starred.length === 0 && recents.length === 0;

  return (
    <Panelside.Panel>
      <Panelside.Header title="Assistant">
        <Panelside.Search
          value={query}
          onChangeText={setQuery}
          placeholder="Search chats"
        />
      </Panelside.Header>

      <Panelside.Content>
        {query.trim() === '' && (
          <Panelside.Group>
            {NAV.map((item, index) => (
              <Panelside.Item
                key={item.id}
                icon={item.icon}
                label={item.label}
                badge={item.badge}
                active={index === 0}
              />
            ))}
          </Panelside.Group>
        )}

        {starred.length > 0 && (
          <Panelside.Group>
            <Panelside.GroupLabel>Starred</Panelside.GroupLabel>
            {starred.map((title) => (
              <Panelside.Item
                key={title}
                label={title}
                active={title === activeId}
                onPress={select && (() => select(title))}
              >
                <Panelside.Action label={`Options for ${title}`} />
              </Panelside.Item>
            ))}
          </Panelside.Group>
        )}

        {recents.length > 0 && (
          <Panelside.Group>
            <Panelside.GroupLabel>Recents</Panelside.GroupLabel>
            {recents.map((title) => (
              <Panelside.Item
                key={title}
                label={title}
                active={title === activeId}
                onPress={select && (() => select(title))}
              >
                <Panelside.Action label={`Options for ${title}`} />
              </Panelside.Item>
            ))}
          </Panelside.Group>
        )}

        {empty && (
          <View className="items-center px-6 py-10">
            <Text size="sm" muted>
              Nothing matches “{query.trim()}”.
            </Text>
          </View>
        )}
      </Panelside.Content>

      <Panelside.Footer>
        {/* No label: the avatar is the account, and a name beside it is one
            more thing between the compose button and the edge of the panel.
            Without a label the row stretches on its own, which is what pushes
            the button to the trailing end. */}
        {/* `md`, not `lg`: a 56pt avatar is taller than the pill beside it, and
            the footer row ends up sized by the account button rather than by
            the thing the footer is for. */}
        <Panelside.Item
          className="flex-1"
          icon={<Avatar size="md" fallback="K" />}
          accessibilityLabel="Account"
        />
        <Panelside.Cta
          icon={<PlusIcon size={18} />}
          label="New chat"
          native={native}
          glass={native}
        />
      </Panelside.Footer>
    </Panelside.Panel>
  );
}

/**
 * The scene's top bar.
 *
 * Both controls are real `Button`s rather than bare glyphs — they sit on the
 * app's own surface with nothing around them, so they need a shape to be
 * findable at all. `Panelside.Trigger` takes the button as its child and
 * chains the toggle onto its own `onPress`, native or not.
 *
 * Ours are `outline`: a ring and no fill, which is enough to say "control"
 * without putting a second filled surface on a screen that already has the
 * panel's. A filled button here also competes with whatever the app itself
 * draws in its bar, which is the one thing a demo of a navigation frame should
 * not do.
 *
 * Under `native` the platform draws them and the variant has to change with
 * it. `ghost` maps onto the platform's *text* style, which is chromeless by
 * design and is what the Liquid Glass material wants to sit in — the material
 * is the chrome, and a border under it is a second edge.
 *
 * The platform also stops tinting the icon for us — the themed content colour
 * is applied inside the styled button, which a native one never reaches — so
 * the colour is passed in by hand.
 */
function SceneBar({ title, native = false }: { title: string; native?: boolean }) {
  const insets = useSafeAreaInsets();
  const { docked } = usePanelside();
  const tint = useCSSVariable('--color-foreground');
  const glyph = native && typeof tint === 'string' ? tint : undefined;

  const shape = native ? undefined : 'h-10 w-10 rounded-full';
  const variant = native ? 'ghost' : 'outline';

  return (
    <View
      style={{ paddingTop: insets.top + 8 }}
      className="flex-row items-center gap-2 px-3 pb-3"
    >
      <Panelside.Trigger>
        <Button
          native={native}
          glass={native}
          size="icon"
          variant={variant}
          className={shape}
          accessibilityLabel="Open navigation panel"
        >
          <MenuIcon size={20} color={glyph} />
        </Button>
      </Panelside.Trigger>

      <Text
        size="lg"
        weight="semibold"
        numberOfLines={1}
        className={docked ? 'flex-1' : 'flex-1 text-center'}
      >
        {title}
      </Text>

      {/* The route hands a full-bleed demo the whole screen and turns the
          native back-swipe off with it, so the way out is this bar's to draw. */}
      <Button
        native={native}
        glass={native}
        size="icon"
        variant={variant}
        className={shape}
        accessibilityLabel="Close demo"
        onPress={() => router.back()}
      >
        <XIcon size={18} color={glyph} />
      </Button>
    </View>
  );
}

interface Turn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const THREAD: Turn[] = [
  { id: 't1', role: 'user', text: 'Where should the semantic colours live once the primitives move?' },
  {
    id: 't2',
    role: 'assistant',
    text: 'Keep the primitives in one file and derive every semantic name from them in a second. Nothing outside the theme should reference a primitive directly.',
  },
  { id: 't3', role: 'user', text: 'And the dark values?' },
  {
    id: 't4',
    role: 'assistant',
    text: 'Same names, resolved per theme. A component asks for the semantic token and never learns which theme answered.',
  },
  { id: 't5', role: 'user', text: 'What breaks if someone reaches past it?' },
  {
    id: 't6',
    role: 'assistant',
    text: 'Nothing visible, at first. Then a theme lands where that primitive means something else, and the component is the only thing on the screen still wearing last season.',
  },
];

/** One turn. Shared by the transcript demos. */
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

/** A short static transcript — enough scene to see the push against. */
function Transcript() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 gap-3 px-4" style={{ paddingBottom: insets.bottom + 12 }}>
      {THREAD.slice(0, 4).map((turn) => (
        <Turn key={turn.id} turn={turn} />
      ))}
    </View>
  );
}

function AssistantDemo({
  sceneProps,
  scene,
  native = false,
  title = 'Migrating the design tokens',
  activeId,
  onSelect,
  ...props
}: Partial<PanelsideProps> & {
  sceneProps?: Partial<PanelsideSceneProps>;
  scene?: React.ReactNode;
  native?: boolean;
  title?: string;
  activeId?: string;
  onSelect?: (title: string) => void;
}) {
  return (
    // On in every demo: the swipe is the way this component is opened, and a
    // tick where it commits is what tells your thumb it took.
    <Panelside haptics {...props}>
      <AssistantPanel native={native} activeId={activeId} onSelect={onSelect} />
      <Panelside.Scene {...sceneProps}>
        <SceneBar title={title} native={native} />
        {scene ?? <Transcript />}
      </Panelside.Scene>
    </Panelside>
  );
}

/** The default shape: swipe from the edge, the screen slides and curves away. */
export function PanelsideAssistantBlock() {
  return <AssistantDemo title="Migrating the design tokens" />;
}

/** The same panel, sliding over a screen that stays exactly where it is. */
export function PanelsideOverlayBlock() {
  return <AssistantDemo mode="overlay" title="Why is the bundle 4 MB" />;
}

/**
 * Docking is a tablet layout, not a phone one: below about 700 points there is
 * no width that gives both a usable sidebar and a usable app. So this demo
 * says which side of the threshold the device is on, and rotating a phone is
 * enough to cross it.
 */
function DockedScene() {
  const { docked } = usePanelside();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 gap-3 px-4" style={{ paddingBottom: insets.bottom + 12 }}>
      <View className="rounded-xl bg-secondary p-4">
        <Text weight="semibold">{docked ? 'Docked' : 'Not docked yet'}</Text>
        <Text size="sm" muted className="mt-1">
          {docked
            ? 'The panel is a column of this layout. It has no trigger, no gesture and no scrim, because there is nothing to open.'
            : 'Rotate the device. Past 700 points the panel stops being an overlay and takes a column of its own.'}
        </Text>
      </View>
      {THREAD.slice(0, 2).map((turn) => (
        <Turn key={turn.id} turn={turn} />
      ))}
    </View>
  );
}

/**
 * Docked past 700 points — the first width where a sidebar and an app both
 * have room. The trigger removes itself, since there is nothing to toggle.
 */
export function PanelsideDockedBlock() {
  return <AssistantDemo dock={700} title="Weekly standup summary" scene={<DockedScene />} />;
}

/**
 * The three scene numbers turned well past their defaults, so what they do is
 * unmistakable rather than a matter of opinion.
 */
export function PanelsideCurveBlock() {
  return (
    <AssistantDemo
      title="Copy for the empty states"
      sceneProps={{ scale: 0.72, radius: 44, dim: 0.7 }}
    />
  );
}

const REPLY =
  'Looking at it now. The token file resolves every semantic name per theme, so a component asking for the muted foreground gets the right value in all six without knowing any of them exist. The only rule is that nothing outside the theme reads a primitive.';

/** A full chat: streaming reply, scroll anchoring, and the panel over it all. */
function ChatScene() {
  const [turns, setTurns] = useState<Turn[]>(THREAD.slice(0, 4));
  const [streaming, setStreaming] = useState(false);
  const insets = useSafeAreaInsets();

  const send = () => {
    if (streaming) return;
    const askId = `ask-${Date.now()}`;
    const replyId = `reply-${Date.now()}`;
    setTurns((current) => [
      ...current,
      { id: askId, role: 'user', text: 'Show me how a theme resolves one token.' },
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
    }, 70);
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
                <Marker.Content shimmer>Thinking…</Marker.Content>
              </Marker>
            ) : null}
          </MessageScroller.Content>
        </MessageScroller.Viewport>
        <MessageScroller.Button />
      </MessageScroller>

      <View
        className="border-t border-border px-4 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <Button onPress={send} loading={streaming} fullWidth>
          {streaming ? 'Streaming' : 'Send a message'}
        </Button>
      </View>
    </View>
  );
}

export function PanelsideChatBlock() {
  return <AssistantDemo scene={<ChatScene />} title="Theme tokens" />;
}

/**
 * The native version.
 *
 * Panelside itself has no `native` prop, and cannot: the platform toolkits
 * ship a switch, a picker, a sheet and a button, and none of them is a pushing
 * navigation panel. What goes native is what is inside it — the attachment
 * sheet is a real platform sheet, and the panel's compose button is a real
 * platform button.
 *
 * The transcript, the rows and the composer field stay ours, because there is
 * no platform control for any of them. A screen that went half-native would
 * match neither.
 */
function NativeChatScene() {
  const [turns, setTurns] = useState<Turn[]>(THREAD.slice(0, 2));
  const [draft, setDraft] = useState('');
  const [attaching, setAttaching] = useState(false);
  const insets = useSafeAreaInsets();
  const nextId = useRef(0);
  // A bare TextInput has no themed placeholder of its own, and a native button
  // never reaches the icon tint the styled one provides — so both are read here.
  const [placeholderTint, glyph] = useCSSVariable([
    '--color-muted-foreground',
    '--color-foreground',
  ]) as (string | undefined)[];

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    nextId.current += 1;
    const id = nextId.current;
    setDraft('');
    setTurns((current) => [...current, { id: `u${id}`, role: 'user', text }]);
    setTimeout(() => {
      setTurns((current) => [
        ...current,
        {
          id: `a${id}`,
          role: 'assistant',
          text: 'Noted. Anything that reads a primitive directly is the thing to change first.',
        },
      ]);
    }, 700);
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
          </MessageScroller.Content>
        </MessageScroller.Viewport>
        <MessageScroller.Button />
      </MessageScroller>

      {/*
        A composer is a card, not a line. One row for what you are writing and
        one for the controls, because a single row makes the field compete with
        every button in it — the field ends up too short to read a sentence in
        and the buttons too close together to hit.
      */}
      <View
        className="px-3 pt-2"
        style={{ paddingBottom: Math.max(insets.bottom, 10) }}
      >
        <View className="gap-2 rounded-3xl bg-secondary px-3 py-3">
          {/*
            No `leading-*`: a line-height step adds leading above the glyphs,
            and in a field this short that is the difference between a
            placeholder on the centre line and one sitting under it.
          */}
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message the assistant"
            placeholderTextColor={placeholderTint}
            multiline
            className="max-h-32 min-h-6 px-1 text-[16px] text-foreground"
          />

          <View className="flex-row items-center gap-2">
            <Button
              native
              glass
              size="icon"
              variant="ghost"
              accessibilityLabel="Attach"
              onPress={() => setAttaching(true)}
            >
              <PlusIcon size={20} color={glyph} />
            </Button>

            <View className="flex-1" />

            <Button native glass size="icon" variant="ghost" accessibilityLabel="Dictate">
              <MicIcon size={19} color={glyph} />
            </Button>

            {/* Prominent glass: the tinted variant, and the platform paints
                the icon white rather than reading a theme token. */}
            <Button
              native
              glass
              size="icon"
              variant="primary"
              accessibilityLabel="Send"
              disabled={draft.trim() === ''}
              onPress={send}
            >
              <SendIcon size={17} />
            </Button>
          </View>
        </View>
      </View>

      {/* A real platform sheet, resting at half height. */}
      <BottomSheet native open={attaching} onOpenChange={setAttaching} snapPoints={['half']}>
        <BottomSheet.Content>
          <BottomSheet.Header title="Attach" description="Anything the assistant should read." />
          <BottomSheet.Body>
            {['Photo library', 'Files', 'Camera'].map((label) => (
              <Item key={label}>
                <Item.Content>
                  <Item.Title>{label}</Item.Title>
                </Item.Content>
              </Item>
            ))}
          </BottomSheet.Body>
        </BottomSheet.Content>
      </BottomSheet>
    </View>
  );
}

export function PanelsideNativeBlock() {
  return (
    <AssistantDemo
      native
      scene={<NativeChatScene />}
      title="Refactor the settings screen"
    />
  );
}

/**
 * One conversation, built from its own title so that opening a different row
 * visibly lands somewhere different. A transcript that is the same eight turns
 * whichever row you pressed proves the panel closed, and nothing about whether
 * anything was navigated to.
 */
function conversation(title: string): Turn[] {
  return [
    { id: `${title}-1`, role: 'user', text: `${title} — where did we leave this?` },
    {
      id: `${title}-2`,
      role: 'assistant',
      text: `Two things outstanding on “${title}”. The first is a decision, the second is only work.`,
    },
    { id: `${title}-3`, role: 'user', text: 'Which is the decision?' },
    {
      id: `${title}-4`,
      role: 'assistant',
      text: 'Whether it ships behind a flag. Everything after that follows from the answer, so it is the one worth spending the meeting on.',
    },
  ];
}

/** The scene for the navigable demo: whichever conversation is selected. */
function ConversationScene({ title }: { title: string }) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 gap-3 px-4" style={{ paddingBottom: insets.bottom + 12 }}>
      {conversation(title).map((turn) => (
        <Turn key={turn.id} turn={turn} />
      ))}
    </View>
  );
}

/**
 * The panel used as navigation rather than as a display: press a conversation
 * and the scene becomes that conversation, with the panel closing itself on
 * the way.
 *
 * The selected row stays marked. A history list where nothing is active tells
 * you what you could open and never what you have open, which is the question
 * anyone opening the panel a second time is asking.
 */
export function PanelsideNavigateBlock() {
  const [active, setActive] = useState(STARRED[0] as string);

  return (
    <AssistantDemo
      title={active}
      activeId={active}
      onSelect={setActive}
      scene={<ConversationScene title={active} />}
    />
  );
}
