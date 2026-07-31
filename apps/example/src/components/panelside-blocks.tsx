/**
 * The Panelside blocks — four whole screens, one per full-page demo.
 *
 * Panelside owns the screen by definition: it wraps the app content in order
 * to push it, so there is nothing to render inline in a section between two
 * dividers. Every demo here is the full thing, and each draws its own way back
 * because the route gives it no header.
 *
 * All four share one panel and one scene, differing only in the props on the
 * root. That is the point worth showing — the anatomy does not change when the
 * behaviour does.
 */
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import {
  Avatar,
  FileIcon,
  ImageIcon,
  MessageCircleIcon,
  PackageIcon,
  Panelside,
  PlusIcon,
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

/** The panel, identical across all four demos. */
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
 * Split out because it needs `usePanelside` — a screen inside the scene reads
 * the panel's state the same way any other consumer does, which is the reason
 * the hook exists.
 */
function SceneBar() {
  const insets = useSafeAreaInsets();
  const { docked } = usePanelside();

  return (
    <View
      style={{ paddingTop: insets.top + 8 }}
      className="flex-row items-center gap-2 px-3 pb-3"
    >
      <Panelside.Trigger />
      <Text
        size="lg"
        weight="semibold"
        numberOfLines={1}
        className={docked ? 'flex-1' : 'flex-1 text-center'}
      >
        Migrating the design tokens
      </Text>
      {/* The route hands a full-bleed demo the whole screen, so the way out is
          this component's to draw. */}
      <Panelside.Action label="Close demo" onPress={() => router.back()}>
        <XIcon size={18} />
      </Panelside.Action>
    </View>
  );
}

const TRANSCRIPT = [
  { from: 'them', text: 'Where should the semantic colours live once the primitives move?' },
  {
    from: 'us',
    text: 'Keep the primitives in one file and derive every semantic name from them in a second. Nothing outside the theme should reference a primitive directly.',
  },
  { from: 'them', text: 'And the dark values?' },
  {
    from: 'us',
    text: 'Same names, resolved per theme. A component asks for --color-muted-foreground and never learns which theme answered.',
  },
];

/** The app screen the panel pushes aside. */
function AssistantScene({ sceneProps }: { sceneProps?: Partial<PanelsideSceneProps> }) {
  const insets = useSafeAreaInsets();

  return (
    <Panelside.Scene {...sceneProps}>
      <SceneBar />
      <View className="flex-1 gap-4 px-4" style={{ paddingBottom: insets.bottom + 12 }}>
        {TRANSCRIPT.map((line, index) => (
          <View
            key={index}
            className={
              line.from === 'us'
                ? 'max-w-[85%] self-start rounded-2xl bg-secondary px-4 py-3'
                : 'max-w-[85%] self-end rounded-2xl bg-primary px-4 py-3'
            }
          >
            <Text
              size="sm"
              className={line.from === 'us' ? undefined : 'text-primary-foreground'}
            >
              {line.text}
            </Text>
          </View>
        ))}
      </View>
    </Panelside.Scene>
  );
}

function AssistantDemo({
  sceneProps,
  ...props
}: Partial<PanelsideProps> & {
  sceneProps?: Partial<PanelsideSceneProps>;
}) {
  return (
    <Panelside {...props}>
      <AssistantPanel />
      <AssistantScene sceneProps={sceneProps} />
    </Panelside>
  );
}

/** The default shape: swipe from the edge, the screen slides and curves away. */
export function PanelsideAssistantBlock() {
  return <AssistantDemo />;
}

/** The same panel, sliding over a screen that stays where it is. */
export function PanelsideOverlayBlock() {
  return <AssistantDemo mode="overlay" />;
}

/**
 * Docked above 600 points, which most phones clear in landscape — so rotating
 * the device is enough to see the panel stop being an overlay and become a
 * column of the layout.
 */
export function PanelsideDockedBlock() {
  return <AssistantDemo dock={600} />;
}

/** A deeper curve, to show the three scene numbers are yours to set. */
export function PanelsideCurveBlock() {
  return <AssistantDemo sceneProps={{ scale: 0.84, radius: 40, dim: 0.6 }} />;
}
