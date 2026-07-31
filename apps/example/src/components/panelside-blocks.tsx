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
import { View } from 'react-native';
import { router } from 'expo-router';
import {
  Avatar,
  Button,
  FileIcon,
  ImageIcon,
  InputGroup,
  Marker,
  MenuIcon,
  Message,
  MessageCircleIcon,
  MessageScroller,
  PackageIcon,
  PaperclipIcon,
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

/** The panel, identical across all six demos. */
function AssistantPanel() {
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
        <Panelside.Item
          className="flex-1"
          icon={<Avatar size="sm" fallback="K" />}
          label="Khalid"
        />
        <Panelside.Cta icon={<PlusIcon size={18} />} label="New chat" />
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
 * chains the toggle onto its own `onPress`.
 */
function SceneBar({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  const { docked } = usePanelside();

  return (
    <View
      style={{ paddingTop: insets.top + 8 }}
      className="flex-row items-center gap-2 px-3 pb-3"
    >
      <Panelside.Trigger>
        <Button
          size="icon"
          variant="secondary"
          className="h-10 w-10 rounded-full"
          accessibilityLabel="Open navigation panel"
        >
          <MenuIcon size={20} />
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
        size="icon"
        variant="secondary"
        className="h-10 w-10 rounded-full"
        accessibilityLabel="Close demo"
        onPress={() => router.back()}
      >
        <XIcon size={18} />
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
  title = 'Migrating the design tokens',
  ...props
}: Partial<PanelsideProps> & {
  sceneProps?: Partial<PanelsideSceneProps>;
  scene?: React.ReactNode;
  title?: string;
}) {
  return (
    <Panelside {...props}>
      <AssistantPanel />
      <Panelside.Scene {...sceneProps}>
        <SceneBar title={title} />
        {scene ?? <Transcript />}
      </Panelside.Scene>
    </Panelside>
  );
}

/** The default shape: swipe from the edge, the screen slides and curves away. */
export function PanelsideAssistantBlock() {
  return <AssistantDemo />;
}

/** The same panel, sliding over a screen that stays exactly where it is. */
export function PanelsideOverlayBlock() {
  return <AssistantDemo mode="overlay" />;
}

/**
 * Docked at 380 points, which every phone clears in portrait — so this demo
 * opens already docked, and the panel is a column of the layout rather than a
 * thing you open. The trigger removes itself, since there is nothing to toggle.
 */
export function PanelsideDockedBlock() {
  return <AssistantDemo dock={380} />;
}

/**
 * The three scene numbers turned well past their defaults, so what they do is
 * unmistakable rather than a matter of opinion.
 */
export function PanelsideCurveBlock() {
  return (
    <AssistantDemo
      width={240}
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

/** A chat with a real composer: attach, type, send, and the keyboard handled. */
function ComposerScene() {
  const [turns, setTurns] = useState<Turn[]>(THREAD.slice(0, 2));
  const [draft, setDraft] = useState('');
  const insets = useSafeAreaInsets();
  const nextId = useRef(0);

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

      {/* Pinned to the bottom edge, so it travels with the keyboard rather
          than being lifted out of a page that is not scrolling. */}
      <View
        className="flex-row items-end gap-2 border-t border-border px-4 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <Button size="icon" variant="ghost" className="h-11 w-11" accessibilityLabel="Attach a file">
          <PaperclipIcon size={20} />
        </Button>

        <InputGroup className="flex-1">
          <InputGroup.Input
            value={draft}
            onChangeText={setDraft}
            placeholder="Message the assistant"
            multiline
            onSubmitEditing={send}
            avoidKeyboard
            keyboardMode="dock"
            keyboardBottomInset={Math.max(insets.bottom, 12)}
          />
          <InputGroup.Suffix>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              accessibilityLabel="Send"
              disabled={draft.trim() === ''}
              onPress={send}
            >
              <SendIcon size={18} />
            </Button>
          </InputGroup.Suffix>
        </InputGroup>
      </View>
    </View>
  );
}

export function PanelsideComposerBlock() {
  return <AssistantDemo scene={<ComposerScene />} title="New chat" />;
}
