/**
 * The Panelside blocks — six whole screens, one per full-page demo.
 *
 * Panelside owns the screen by definition: it wraps the app content in order
 * to push it, so there is nothing to render inline in a section between two
 * dividers. Every demo here is the full thing, and each draws its own way back
 * because the route gives it no header — and, on iOS, no back-swipe either,
 * since the system claims the same screen edge the panel opens from.
 *
 * All six share one panel. What changes is the props on the root and what the
 * scene holds, which is the point worth showing: the anatomy does not change
 * when the behaviour does.
 */
import { useMemo, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';
import {
  Avatar,
  Button,
  FileIcon,
  ImageIcon,
  BottomSheet,
  Item,
  Marker,
  MenuIcon,
  Message,
  MessageCircleIcon,
  MessageScroller,
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
function AssistantPanel({ native = false }: { native?: boolean }) {
  const [query, setQuery] = useState('');

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
              <Panelside.Item key={title} label={title}>
                <Panelside.Action label={`Options for ${title}`} />
              </Panelside.Item>
            ))}
          </Panelside.Group>
        )}

        {recents.length > 0 && (
          <Panelside.Group>
            <Panelside.GroupLabel>Recents</Panelside.GroupLabel>
            {recents.map((title) => (
              <Panelside.Item key={title} label={title}>
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
        <Panelside.Item
          className="flex-1"
          icon={<Avatar size="md" fallback="K" />}
          accessibilityLabel="Account"
        />
        <Panelside.Cta
          icon={<PlusIcon size={18} />}
          label="New chat"
          native={native}
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
 * Under `native` the platform draws them. It also stops tinting the icons for
 * us — the themed content colour is applied inside the styled button, which a
 * native one never reaches — so the colour is passed in by hand.
 */
function SceneBar({ title, native = false }: { title: string; native?: boolean }) {
  const insets = useSafeAreaInsets();
  const { docked } = usePanelside();
  const tint = useCSSVariable('--color-foreground');
  const glyph = native && typeof tint === 'string' ? tint : undefined;

  const shape = native ? undefined : 'h-10 w-10 rounded-full';
  const variant = native ? 'ghost' : 'secondary';

  return (
    <View
      style={{ paddingTop: insets.top + 8 }}
      className="flex-row items-center gap-2 px-3 pb-3"
    >
      <Panelside.Trigger>
        <Button
          native={native}
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
  ...props
}: Partial<PanelsideProps> & {
  sceneProps?: Partial<PanelsideSceneProps>;
  scene?: React.ReactNode;
  native?: boolean;
  title?: string;
}) {
  return (
    <Panelside {...props}>
      <AssistantPanel native={native} />
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
  const [placeholderTint, glyph, sendGlyph] = useCSSVariable([
    '--color-muted-foreground',
    '--color-foreground',
    '--color-primary-foreground',
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
        A composer is a pill with its controls inside it on both platforms, so
        that is what this is: attach on the leading end, a field that grows,
        and send on the trailing end. A row of labelled buttons underneath
        would be the platform's button drawn in the wrong place.
      */}
      <View
        className="border-t border-border px-3 pt-2"
        style={{ paddingBottom: Math.max(insets.bottom, 10) }}
      >
        <View className="flex-row items-end gap-1 rounded-3xl bg-secondary p-1">
          <Button
            native
            size="icon"
            variant="ghost"
            accessibilityLabel="Attach"
            onPress={() => setAttaching(true)}
          >
            <PlusIcon size={20} color={glyph} />
          </Button>

          {/*
            No `leading-*`: a line-height step adds leading above the glyphs, and
            in a field this short that is the difference between a placeholder
            on the centre line and one sitting under it. The font's own line box
            plus even padding is what centres it, and `textAlignVertical` is the
            same instruction for Android.
          */}
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message the assistant"
            placeholderTextColor={placeholderTint}
            multiline
            textAlignVertical="center"
            className="min-h-11 max-h-32 flex-1 px-2 py-2.5 text-[16px] text-foreground"
          />

          <Button
            native
            size="icon"
            variant="primary"
            accessibilityLabel="Send"
            disabled={draft.trim() === ''}
            onPress={send}
          >
            <SendIcon size={17} color={sendGlyph} />
          </Button>
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
