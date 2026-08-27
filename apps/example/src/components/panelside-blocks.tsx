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
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import {
  AIInput,
  Avatar,
  BottomSheet,
  Button,
  Item,
  KeyboardAvoider,
  Marker,
  Menu,
  Message,
  MessageScroller,
  Panelside,
  Popover,
  SearchBar,
  Text,
  useIconColor,
  usePanelside,
  type PanelsideProps,
  type PanelsideSceneProps,
} from 'panelui-native';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react-native';
// Deep imports, not the barrel. The barrel is one module that re-exports
// every icon in the set, and Metro follows all of them — six thousand
// modules and seven megabytes of source, for the fourteen used here.
import BubbleChatIcon from '@hugeicons/core-free-icons/BubbleChatIcon';
import Analytics01Icon from '@hugeicons/core-free-icons/Analytics01Icon';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import DollarCircleIcon from '@hugeicons/core-free-icons/DollarCircleIcon';
import FilterHorizontalIcon from '@hugeicons/core-free-icons/FilterHorizontalIcon';
import GiftIcon from '@hugeicons/core-free-icons/GiftIcon';
import InformationCircleIcon from '@hugeicons/core-free-icons/InformationCircleIcon';
import Link01Icon from '@hugeicons/core-free-icons/Link01Icon';
import Moon02Icon from '@hugeicons/core-free-icons/Moon02Icon';
import Notification01Icon from '@hugeicons/core-free-icons/Notification01Icon';
import PinIcon from '@hugeicons/core-free-icons/PinIcon';
import PlugSocketIcon from '@hugeicons/core-free-icons/PlugSocketIcon';
import SecurityLockIcon from '@hugeicons/core-free-icons/SecurityLockIcon';
import Settings02Icon from '@hugeicons/core-free-icons/Settings02Icon';
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon';
import UserIcon from '@hugeicons/core-free-icons/UserIcon';
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon';
import File01Icon from '@hugeicons/core-free-icons/File01Icon';
import Image01Icon from '@hugeicons/core-free-icons/Image01Icon';
import Menu01Icon from '@hugeicons/core-free-icons/Menu01Icon';
import Mic01Icon from '@hugeicons/core-free-icons/Mic01Icon';
import Package01Icon from '@hugeicons/core-free-icons/Package01Icon';
import PencilEdit02Icon from '@hugeicons/core-free-icons/PencilEdit02Icon';
import PlusSignIcon from '@hugeicons/core-free-icons/PlusSignIcon';
import Share01Icon from '@hugeicons/core-free-icons/Share01Icon';
import SourceCodeIcon from '@hugeicons/core-free-icons/SourceCodeIcon';
import SparklesIcon from '@hugeicons/core-free-icons/SparklesIcon';
import StarIcon from '@hugeicons/core-free-icons/StarIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';

/**
 * One glyph, drawn at the weight the panel's own chrome uses.
 *
 * Panelside tints whatever goes in an icon slot by providing a colour around
 * it, so the wrapper reads that and hands it down — the drawing component
 * underneath takes a colour and knows nothing about inheriting one.
 */
function Glyph({ icon, size = 20 }: { icon: IconSvgElement; size?: number }) {
  const color = useIconColor();
  return <HugeiconsIcon icon={icon} size={size} color={color ?? '#737373'} strokeWidth={1.8} />;
}

const NAV = [
  { id: 'chats', label: 'Chats', icon: <Glyph icon={BubbleChatIcon} /> },
  { id: 'projects', label: 'Projects', icon: <Glyph icon={Package01Icon} />, badge: 4 },
  { id: 'artifacts', label: 'Artifacts', icon: <Glyph icon={Image01Icon} /> },
  { id: 'code', label: 'Code', icon: <Glyph icon={SourceCodeIcon} /> },
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
 * What the search surface searches.
 *
 * Three kinds rather than one, because that is what the tabs are for: a set of
 * tabs over a corpus of one kind is four ways of saying the same thing.
 */
const SEARCHABLE: { id: string; title: string; kind: 'chats' | 'images' | 'documents' }[] = [
  ...RECENTS.map((title) => ({ id: title, title, kind: 'chats' as const })),
  ...STARRED.map((title) => ({ id: title, title, kind: 'chats' as const })),
  { id: 'i1', title: 'Panel anatomy sketch.png', kind: 'images' },
  { id: 'i2', title: 'Token ramp, six themes.png', kind: 'images' },
  { id: 'i3', title: 'Chart gallery contact sheet.png', kind: 'images' },
  { id: 'd1', title: 'Migration notes.md', kind: 'documents' },
  { id: 'd2', title: 'Release checklist.pdf', kind: 'documents' },
  { id: 'd3', title: 'Accessibility audit.csv', kind: 'documents' },
];

const KIND_LABEL = { chats: 'Chat', images: 'Image', documents: 'Document' } as const;
const KIND_ICON = {
  chats: <Glyph icon={BubbleChatIcon} size={18} />,
  images: <Glyph icon={Image01Icon} size={18} />,
  documents: <Glyph icon={File01Icon} size={18} />,
} as const;

/**
 * The chats the search page lists, with when they were last touched.
 *
 * A time on every row, because a list of chat titles sorted by recency with no
 * dates on it is a list whose order the reader has to take on trust.
 */
const CHATS: { id: string; title: string; when: string; pinned?: boolean }[] = [
  { id: 'c1', title: 'Migrating the design tokens', when: '29m ago', pinned: true },
  { id: 'c2', title: 'Why is the bundle 4 MB', when: '3h ago' },
  { id: 'c3', title: 'Draft: quarterly retro notes', when: 'yesterday' },
  { id: 'c4', title: 'Refactor the settings screen', when: '4d ago', pinned: true },
  { id: 'c5', title: 'Copy for the empty states', when: '5d ago' },
  { id: 'c6', title: 'Comparing chart libraries', when: 'last wk.' },
  { id: 'c7', title: 'Accessibility pass on forms', when: 'last wk.' },
  { id: 'c8', title: 'Weekly standup summary', when: 'last wk.' },
  { id: 'c9', title: 'Launch announcement thread', when: 'last wk.', pinned: true },
  { id: 'c10', title: 'Pricing page rewrite', when: '2 wk. ago' },
  { id: 'c11', title: 'Onboarding email sequence', when: '2 wk. ago' },
];

/**
 * How much room the floating chrome needs, so the scroller can reserve it.
 *
 * Measured rather than guessed would be better, but a re-measure on every
 * layout to place padding that never changes is a re-render for nothing —
 * these are the two bars' own fixed heights, and they are here where changing
 * one means changing the other.
 */
const HEADER_HEIGHT = 52;
const FOOTER_HEIGHT = 112;
/** …and the settings sheet's, which the platform list has to be sized around. */
const SHEET_HEADER_HEIGHT = 92;

const FILTERS = [
  { value: 'all', label: 'All chats', icon: BubbleChatIcon },
  { value: 'pinned', label: 'Pinned', icon: PinIcon },
] as const;

type ChatFilter = (typeof FILTERS)[number]['value'];

/**
 * The filter, in a popover anchored to the button that opened it.
 *
 * A popover rather than a sheet: there are two options and the list behind
 * them is what you are filtering, so covering it to choose is covering the
 * answer. Under `native` the platform draws the panel — which is why the
 * content states a width, since a hosted subtree has no parent for a
 * percentage to resolve against.
 */
function ChatFilterMenu({
  value,
  onChange,
  native = false,
}: {
  value: ChatFilter;
  onChange: (next: ChatFilter) => void;
  native?: boolean;
}) {
  const tint = useCSSVariable('--color-foreground');
  const glyph = typeof tint === 'string' ? tint : undefined;

  return (
    <Popover native={native}>
      <Popover.Trigger>
        <Button
          native={native}
          glass={native}
          size="icon"
          variant={native ? 'ghost' : 'outline'}
          className={native ? undefined : 'h-10 w-10 rounded-full'}
          accessibilityLabel="Filter chats"
        >
          <HugeiconsIcon
            icon={FilterHorizontalIcon}
            size={20}
            color={glyph ?? '#737373'}
            strokeWidth={1.8}
          />
        </Button>
      </Popover.Trigger>
      <Popover.Content width={220} placement="bottom" align="end">
        {FILTERS.map((filter) => (
          <Popover.Close key={filter.value}>
            <Item size="sm" variant="default" onPress={() => onChange(filter.value)}>
              {/* The tick keeps its space when it is not drawn, so choosing the
                  other option does not shift the labels one glyph to the left. */}
              <Item.Media variant="icon" className="w-5">
                {value === filter.value ? <Glyph icon={Tick02Icon} size={16} /> : null}
              </Item.Media>
              <Item.Media variant="icon">
                <Glyph icon={filter.icon} size={18} />
              </Item.Media>
              <Item.Content>
                <Item.Title>{filter.label}</Item.Title>
              </Item.Content>
            </Item>
          </Popover.Close>
        ))}
      </Popover.Content>
    </Popover>
  );
}

/**
 * The search page.
 *
 * A page rather than a sheet. Searching your chats is somewhere you go and
 * stay for a while — you read the list, filter it, type, read it again — and a
 * sheet over the screen you came from spends the whole time covering the thing
 * it is a list of. It also gives the field the whole screen above it to put
 * results in, instead of the half a sheet leaves once the keyboard is up.
 *
 * There is no way back on this page, and that is the design: the panel is
 * behind the button at the leading edge and every chat in it is a destination,
 * and the compose pill above the field starts a new one. A search page you
 * have to dismiss to use is a search page with a modal's manners.
 *
 * The field is at the bottom, where the thumb is and where the keyboard comes
 * up. At the top it would be at the far end of the screen from both, and every
 * character typed into it would be read at the other end of a list that is
 * moving.
 */
function SearchScene({
  native = false,
  onOpen,
}: {
  native?: boolean;
  onOpen: (title: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const tint = useCSSVariable('--color-foreground');
  const glyph = typeof tint === 'string' ? tint : undefined;

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ChatFilter>('all');

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return CHATS.filter(
      (chat) =>
        (filter === 'all' || chat.pinned) &&
        (needle === '' || chat.title.toLowerCase().includes(needle))
    );
  }, [filter, query]);

  const shape = native ? undefined : 'h-10 w-10 rounded-full';

  return (
    <View className="flex-1">
      {/*
        The list is the page, and the chrome floats over it.
        
        In flow the two bars were opaque bands with the list squeezed between
        them, which is a screen in three parts rather than a list you are
        looking at. The room they need is reserved by the scroller's own
        content padding instead, so the rows travel underneath and the page
        reads as one surface.
      */}
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-2 px-4"
        contentContainerStyle={{
          paddingTop: insets.top + HEADER_HEIGHT,
          paddingBottom: Math.max(insets.bottom, 12) + FOOTER_HEIGHT,
        }}
      >
        {results.length === 0 ? (
          <View className="items-center px-6 py-16">
            <Text size="sm" muted>
              Nothing matches “{query.trim()}”.
            </Text>
          </View>
        ) : (
          results.map((chat) => (
            <Item
              key={chat.id}
              variant="muted"
              size="sm"
              className="rounded-2xl"
              onPress={() => onOpen(chat.title)}
            >
              <Item.Media variant="icon">
                <Glyph icon={BubbleChatIcon} size={18} />
              </Item.Media>
              <Item.Content>
                <Item.Title numberOfLines={1}>{chat.title}</Item.Title>
                <Item.Description>{chat.when}</Item.Description>
              </Item.Content>
            </Item>
          ))
        )}
      </ScrollView>

      {/* `box-none` so the bar takes no touches of its own and the rows
          underneath stay pressable right up to the buttons. */}
      <View
        pointerEvents="box-none"
        style={{ paddingTop: insets.top + 8 }}
        className="absolute end-0 start-0 top-0 flex-row items-center px-3 pb-3"
      >
        <Panelside.Trigger>
          <Button
            native={native}
            glass={native}
            size="icon"
            variant={native ? 'ghost' : 'outline'}
            className={shape}
            accessibilityLabel="Open navigation panel"
          >
            <HugeiconsIcon icon={Menu01Icon} size={20} color={glyph ?? '#737373'} strokeWidth={1.8} />
          </Button>
        </Panelside.Trigger>

        <Text size="lg" weight="semibold" numberOfLines={1} className="flex-1 text-center">
          Chats
        </Text>

        {/*
          A box of the same width as the button opposite, and the title centres
          between them.
          
          Under `native` the filter is the platform's own popover host, which
          reports as an auto-sized leaf with no width of its own — so a
          `flex-1` title centred itself inside a box that was not the row, and
          the button ended up against the title instead of at the edge.
        */}
        <View className="w-10 items-end" pointerEvents="box-none">
          <ChatFilterMenu value={filter} onChange={setFilter} native={native} />
        </View>
      </View>

      {/*
        The compose pill and the field are one piece of chrome, so one avoider
        carries both: docking them separately would leave the pill behind on
        the screen the field just left.
      */}
      <KeyboardAvoider
        mode="dock"
        bottomInset={Math.max(insets.bottom, 12)}
        pointerEvents="box-none"
        className="absolute bottom-0 end-0 start-0"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <View className="items-end px-4 pb-3" pointerEvents="box-none">
          <Button
            native={native}
            glass={native}
            variant="primary"
            className={native ? undefined : 'rounded-full'}
            // `Glyph` rather than the drawing component directly: the button
            // provides the colour that reads against its own fill, and only
            // the wrapper is listening for it.
            startContent={native ? undefined : <Glyph icon={PlusSignIcon} size={18} />}
            onPress={() => onOpen('New chat')}
          >
            New chat
          </Button>
        </View>

        <View className="px-4">
          <SearchBar
            shape="pill"
            variant="filled"
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            cancel="never"
          />
        </View>
      </KeyboardAvoider>
    </View>
  );
}

/**
 * What the account sheet lists. Two groups, because the rows split cleanly in
 * two and a settings screen of eleven undivided rows is a list you scan rather
 * than read.
 */
const SETTINGS_GROUPS: {
  label: string;
  rows: { id: string; label: string; icon: IconSvgElement; symbol: string; value?: string }[];
}[] = [
  {
    label: 'Account',
    rows: [
      { id: 'profile', label: 'Profile', icon: UserIcon, symbol: 'person.circle' },
      {
        id: 'billing',
        label: 'Billing',
        icon: DollarCircleIcon,
        symbol: 'dollarsign.circle',
        value: 'Pro plan',
      },
      {
        id: 'usage',
        label: 'Usage',
        icon: Analytics01Icon,
        symbol: 'chart.line.uptrend.xyaxis',
      },
      { id: 'notifications', label: 'Notifications', icon: Notification01Icon, symbol: 'bell' },
      { id: 'focus', label: 'Time & focus', icon: Moon02Icon, symbol: 'moon' },
      { id: 'privacy', label: 'Privacy', icon: SecurityLockIcon, symbol: 'lock.shield' },
      { id: 'links', label: 'Shared links', icon: Link01Icon, symbol: 'link' },
    ],
  },
  {
    label: 'App',
    rows: [
      {
        id: 'capabilities',
        label: 'Capabilities',
        icon: Settings02Icon,
        symbol: 'slider.horizontal.3',
      },
      { id: 'connectors', label: 'Connectors', icon: PlugSocketIcon, symbol: 'powerplug' },
    ],
  },
];

/**
 * The SwiftUI list components, resolved once and only where they exist.
 *
 * A lazy require rather than an import: `@expo/ui/swift-ui` asks the platform
 * for its native views at module scope, and there are no `ExpoUI` views on
 * Android or on the web. Reaching for them there throws before anything has a
 * chance to choose the styled rows instead.
 */
let swiftUIList: Record<string, any> | null | undefined;

function getSwiftUIList() {
  if (swiftUIList !== undefined) return swiftUIList;
  if (Platform.OS !== 'ios') {
    swiftUIList = null;
    return swiftUIList;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const views = require('@expo/ui/swift-ui');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const modifiers = require('@expo/ui/swift-ui/modifiers');
    swiftUIList = views.List && views.Section && views.Label ? { ...views, ...modifiers } : null;
  } catch {
    swiftUIList = null;
  }
  return swiftUIList;
}

/**
 * The account rows as the platform draws them.
 *
 * A SwiftUI list, and nothing of ours inside it: the glyphs are SF Symbols and
 * the values are the platform's own text, so there is no React Native view
 * hosted anywhere in the list. That is deliberate rather than lazy — a hosted
 * view inside a native control needs a definite size above it on both axes,
 * and a list of rows whose heights the platform decides is exactly the shape
 * that cannot give it one.
 *
 * `insetGrouped` is the settings-screen style. Its own background is turned
 * off so the groups sit on the sheet's solid surface rather than on a second
 * one the platform paints underneath them.
 */
function NativeSettingsList({ height }: { height: number }) {
  const ui = getSwiftUIList();
  if (!ui) return null;

  const { Host, List, Section, Label, Text: SwiftText, HStack, Spacer, listStyle,
    scrollContentBackground } = ui;

  return (
    // A list fills the space it is given rather than sizing to its contents,
    // so the host is told to measure the viewport and handed a height. With
    // `matchContents` — right for every other control here — it would ask the
    // list how tall it is, and the list would answer by asking back.
    <Host useViewportSizeMeasurement style={{ height }}>
      <List modifiers={[listStyle('insetGrouped'), scrollContentBackground('hidden')]}>
        <Section>
          <SwiftText>khalid@example.com</SwiftText>
          <Label title="Give the gift of PanelUI" systemImage="gift" />
        </Section>

        {SETTINGS_GROUPS.map((group) => (
          <Section key={group.label} title={group.label}>
            {group.rows.map((row) => (
              <HStack key={row.id} spacing={12}>
                <Label title={row.label} systemImage={row.symbol} />
                <Spacer />
                {row.value ? <SwiftText>{row.value}</SwiftText> : null}
              </HStack>
            ))}
          </Section>
        ))}
      </List>
    </Host>
  );
}

/** One settings row, as we draw it. */
function SettingsRow({
  label,
  icon,
  value,
}: {
  label: string;
  icon: IconSvgElement;
  value?: string;
}) {
  return (
    <Item variant="muted" size="sm" className="rounded-none">
      {/* No `Item.Media`: its icon slot draws a bordered box, and a settings
          list of eleven boxed glyphs is eleven more edges than the rows need.
          The glyph and the width it sits in are enough. */}
      <View className="w-7 items-center">
        <Glyph icon={icon} size={19} />
      </View>
      <Item.Content>
        <Item.Title>{label}</Item.Title>
      </Item.Content>
      <Item.Actions>
        {value ? (
          <Text size="sm" muted>
            {value}
          </Text>
        ) : null}
        <Glyph icon={ArrowRight01Icon} size={16} />
      </Item.Actions>
    </Item>
  );
}

/**
 * The account sheet, opened from the avatar in the panel's footer.
 *
 * Full height, because it is a settings screen rather than a confirmation: the
 * rows go on past the fold and a sheet that stops halfway is one you have to
 * drag before you can read it.
 *
 * Under `native` it is the platform's own sheet, painted solid rather than
 * left in the material — a settings list is a column of rows on a surface, and
 * a translucent surface with a moving screen behind it makes every one of
 * those rows harder to read for nothing. The rows inside it are the platform's
 * too, on iOS. Android has no equivalent list here, so it keeps ours.
 */
function SettingsSheet({
  open,
  onOpenChange,
  native = false,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  native?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const shape = native ? undefined : 'h-10 w-10 rounded-full';
  const accent = useCSSVariable('--color-primary');
  const accentTint = typeof accent === 'string' ? accent : '#5e6ad2';

  const platformRows = native ? getSwiftUIList() !== null : false;
  // What the sheet's own chrome leaves for the list: its detent, less the
  // header row and the safe area it already pads for.
  const listHeight = screenHeight * 0.94 - SHEET_HEADER_HEIGHT - Math.max(insets.bottom, 16);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      native={native}
      nativeBackground={native}
      snapPoints={['full']}
    >
      {/*
        The top padding, not the horizontal one, is what was wrong here. The
        platform draws its grabber *inside* the sheet, over the first 24 to 28
        points of whatever is hosted in it, and the wrapper's own 20 was all
        that stood clear of it — so the header row arrived with its top third
        behind the grabber.
      */}
      <BottomSheet.Content
        size="full"
        showClose={false}
        className={native ? 'gap-3 pt-9' : 'gap-3'}
      >
        <BottomSheet.Header className="pb-0 pe-0">
          <View className="flex-row items-center">
            <Button
              native={native}
              glass={native}
              size="icon"
              variant={native ? 'ghost' : 'outline'}
              className={shape}
              accessibilityLabel="Close settings"
              onPress={() => onOpenChange(false)}
            >
              <Glyph icon={Cancel01Icon} size={18} />
            </Button>

            <Text size="lg" weight="semibold" className="flex-1 text-center">
              Settings
            </Text>

            {/* Matched to the button opposite so the title centres between
                them — under `native` the platform's button has no width we
                know, and a `flex-1` title centres in whatever is left. */}
            <View className="w-10 items-end">
              <Button
                native={native}
                glass={native}
                size="icon"
                variant={native ? 'ghost' : 'outline'}
                className={shape}
                accessibilityLabel="About"
              >
                <Glyph icon={InformationCircleIcon} size={18} />
              </Button>
            </View>
          </View>
        </BottomSheet.Header>

        {platformRows ? (
          <NativeSettingsList height={listHeight} />
        ) : (
          <BottomSheet.Body contentContainerClassName="gap-6 pb-6">
            <Item variant="muted" size="sm" className="rounded-2xl">
              <Item.Content>
                <Item.Title numberOfLines={1}>khalid@example.com</Item.Title>
              </Item.Content>
            </Item>

            {/* The one row that is not a destination, so it is the one row
                drawn in the accent. */}
            <Item variant="muted" size="sm" className="rounded-2xl">
              <View className="w-7 items-center">
                <HugeiconsIcon icon={GiftIcon} size={19} color={accentTint} strokeWidth={1.8} />
              </View>
              <Item.Content>
                <Item.Title className="text-primary">Give the gift of PanelUI</Item.Title>
              </Item.Content>
            </Item>

            {SETTINGS_GROUPS.map((group) => (
              <View key={group.label} className="gap-2">
                <Text size="sm" muted className="px-1">
                  {group.label}
                </Text>
                <Item.Group className="overflow-hidden rounded-2xl">
                  {group.rows.map((row, index) => (
                    <View key={row.id}>
                      {/* Inset to the label rather than run edge to edge: a
                          full-width rule cuts the glyph column off from the
                          text it belongs to. */}
                      {index === 0 ? null : <Item.Separator className="ms-11" />}
                      <SettingsRow label={row.label} icon={row.icon} value={row.value} />
                    </View>
                  ))}
                </Item.Group>
              </View>
            ))}
          </BottomSheet.Body>
        )}
      </BottomSheet.Content>
    </BottomSheet>
  );
}

/**
 * The panel, shared by every demo.
 *
 * `native` only reaches the controls that have a platform equivalent. There is
 * no native list row and no native search field, so the rest stays ours —
 * which is the honest answer rather than a half-native panel that matches
 * neither.
 *
 * Everything below that is not native is `outline`: a ring and no fill, so the
 * compose pill is the only filled thing in the panel and reads as the one
 * control the footer is for.
 */
function AssistantPanel({
  native = false,
  activeId,
  onSelect,
  routed = false,
  actions,
  starred = STARRED,
  recents = RECENTS,
  onSearch,
  onAccount,
}: {
  native?: boolean;
  /** The conversation currently open in the scene, if the demo tracks one. */
  activeId?: string;
  /** Given, every history row becomes a destination. */
  onSelect?: (title: string) => void;
  /** Given, the rows navigate through the panel's own route instead. */
  routed?: boolean;
  /** Given, every history row carries an overflow menu built from it. */
  actions?: (title: string) => ReactNode;
  starred?: readonly string[];
  recents?: readonly string[];
  /** Where the header's search button goes. */
  onSearch?: () => void;
  /** Where the footer's avatar goes. */
  onAccount?: () => void;
}) {
  const { setOpen } = usePanelside();

  // Selecting a destination closes the panel. Leaving it open would mean the
  // thing you just navigated to is behind the thing you navigated from. The
  // routed demo does not need this — `to` closes the panel itself.
  const select = onSelect
    ? (title: string) => {
        onSelect(title);
        setOpen(false);
      }
    : undefined;

  const control = native ? undefined : ('outline' as const);

  return (
    <Panelside.Panel>
      {/* The search button goes in the header's trailing slot, and what it
          opens is the demo's to decide — here, the scene becomes the search
          page. A field in the header instead would be 40 points of an
          80%-wide panel, at the far end of the screen from the keyboard it
          opens. */}
      <Panelside.Header
        title="Assistant"
        action={
          <Panelside.SearchTrigger
            native={native}
            glass={native}
            variant={control}
            onPress={() => {
              onSearch?.();
              setOpen(false);
            }}
          />
        }
      />

      <Panelside.Content>
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

        {starred.length > 0 && (
          <Panelside.Group>
            <Panelside.GroupLabel>Starred</Panelside.GroupLabel>
            {/* No star glyph on the rows. The group label says Starred, and
                repeating it on every row underneath it spends the leading slot
                — the one place a row could carry something a reader does not
                already know — on saying the heading again. */}
            {starred.map((title) => (
              <Panelside.Item
                key={title}
                label={title}
                to={routed ? title : undefined}
                active={routed ? undefined : title === activeId}
                onPress={select && (() => select(title))}
              >
                {actions?.(title)}
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
                to={routed ? title : undefined}
                active={routed ? undefined : title === activeId}
                onPress={select && (() => select(title))}
              >
                {actions?.(title)}
              </Panelside.Item>
            ))}
          </Panelside.Group>
        )}

      </Panelside.Content>

      {/* Transparent: the history runs under the two controls rather than
          being cut off above a band, which is what makes the panel read as one
          surface with things floating on it. */}
      <Panelside.Footer>
        {/* The compose pill leads, and the account button is pushed to the
            trailing end by the spacer between them. No label on the account:
            the avatar is the account, and a name beside it is one more thing
            between the compose button and the edge of the panel.

            A size up under `native`. The platform's own metrics land the two
            controls a step smaller than ours do, which reads as the footer of
            a different panel than the one every other version has. */}
        <Panelside.Cta
          className="shrink-0"
          icon={<Glyph icon={PlusSignIcon} size={18} />}
          label="New chat"
          size={native ? 'xl' : 'default'}
          native={native}
          glass={native}
        />
        <View className="flex-1" />
        {native ? (
          /*
            The initial as a plain string, not an `Avatar` hosted inside the
            button.
            
            A string is the platform's own text: it needs no `RNHostView`, no
            measurement chain and no frame with room to spare, and the platform
            draws its glass around it the way it draws it around any other
            label. Hosting a React Native circle in there to get the same
            letter is the expensive way to arrive at what the platform already
            does — and it is the shape that has cost two crashes.
          */
          <Button
            native
            glass
            size="xl"
            variant="ghost"
            accessibilityLabel="Account"
            onPress={onAccount}
          >
            K
          </Button>
        ) : (
          /* The avatar itself, pressable. An avatar inside a button is two
             rings and two surfaces drawn around one face — the avatar already
             is the shape, and putting a control around it only says so twice.
             `shrink-0` because it has a fixed square to be, and the compose
             pill beside it is the thing that gives way. */
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Account"
            className="shrink-0"
            onPress={onAccount}
          >
            <Avatar size="md" fallback="K" />
          </Pressable>
        )}
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
 * The colour is passed in by hand on both paths. A native button never reaches
 * the themed content colour a styled one applies around its child, and the
 * glyphs here are drawn by a component that takes a colour rather than
 * inheriting one — so neither half can be left to work it out.
 */
function SceneBar({ title, native = false }: { title: string; native?: boolean }) {
  const insets = useSafeAreaInsets();
  const { docked } = usePanelside();
  const tint = useCSSVariable('--color-foreground');
  const glyph = typeof tint === 'string' ? tint : undefined;

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
          <HugeiconsIcon icon={Menu01Icon} size={20} color={glyph ?? '#737373'} strokeWidth={1.8} />
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
        <HugeiconsIcon icon={Cancel01Icon} size={18} color={glyph ?? '#737373'} strokeWidth={1.8} />
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
  routed,
  actions,
  starred,
  recents,
  onOpenChat,
  ...props
}: Partial<PanelsideProps> & {
  sceneProps?: Partial<PanelsideSceneProps>;
  scene?: React.ReactNode;
  native?: boolean;
  title?: string;
  activeId?: string;
  onSelect?: (title: string) => void;
  routed?: boolean;
  actions?: (title: string) => ReactNode;
  starred?: readonly string[];
  recents?: readonly string[];
  /**
   * Given, opening a chat from the search page goes through the demo's own
   * navigation instead of this one's.
   *
   * The two demos that route — by the panel's route, and by a selected title —
   * already own where the scene goes. Setting a second piece of state here
   * would leave the title saying one thing and the page showing another.
   */
  onOpenChat?: (title: string) => void;
}) {
  /*
   * Two pieces of demo state, both about where the search page fits.
   *
   * `searching` replaces the scene rather than covering it — the search page
   * *is* the screen while you are on it, which is the whole difference between
   * it and the sheet it replaced. `opened` is the conversation the search page
   * sent you to, so leaving search lands on that chat rather than back where
   * you started; a search you have to undo is a search that did nothing.
   */
  const [searching, setSearching] = useState(false);
  const [account, setAccount] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);

  const openChat = (chat: string) => {
    setSearching(false);
    if (onOpenChat) onOpenChat(chat);
    // A demo that brought its own scene keeps it: replacing the content here
    // would throw away the thing that version exists to show, and changing
    // only the title would leave the bar naming a chat the page is not.
    else if (!scene) setOpened(chat);
  };

  return (
    // On in every demo: the swipe is the way this component is opened, and a
    // tick where it commits is what tells your thumb it took.
    <Panelside haptics {...props}>
      <AssistantPanel
        native={native}
        activeId={activeId}
        onSelect={onSelect}
        routed={routed}
        actions={actions}
        starred={starred}
        recents={recents}
        onSearch={() => setSearching(true)}
        onAccount={() => setAccount(true)}
      />
      <Panelside.Scene {...sceneProps}>
        {searching ? (
          <SearchScene native={native} onOpen={openChat} />
        ) : (
          <>
            <SceneBar title={opened ?? title} native={native} />
            {scene ?? (opened ? <ConversationScene title={opened} /> : <Transcript />)}
          </>
        )}
      </Panelside.Scene>
      <SettingsSheet open={account} onOpenChange={setAccount} native={native} />
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
  const [title, setTitle] = useState('Weekly standup summary');

  return (
    <AssistantDemo dock={700} title={title} onOpenChat={setTitle} scene={<DockedScene />} />
  );
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
  const [title, setTitle] = useState('Theme tokens');

  return <AssistantDemo scene={<ChatScene />} title={title} onOpenChat={setTitle} />;
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
 * The transcript and the rows stay ours, because there is no platform control
 * for either. A screen that went half-native would match neither.
 *
 * The composer is `AIInput`, which is the component for this and hands its own
 * controls to the platform under `native`. It used to be a bare `TextInput` in
 * a rounded card with three buttons laid out beside it by hand — which is what
 * `AIInput` is, written out again badly: no growth to five lines, no voice
 * state on the submit button, and a placeholder colour read from a token here
 * because a raw field has none.
 */
function NativeChatScene() {
  const [turns, setTurns] = useState<Turn[]>(THREAD.slice(0, 2));
  const [draft, setDraft] = useState('');
  const [attaching, setAttaching] = useState(false);
  const insets = useSafeAreaInsets();
  const nextId = useRef(0);

  const send = (value: string) => {
    const text = value.trim();
    if (!text) return;
    nextId.current += 1;
    const id = nextId.current;
    // The composer does not clear itself — the app owns the value, and a
    // submit that failed should not have thrown the text away.
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
        The composer is `AIInput` under `native`, which hands the field's
        controls to the platform the same way the picker and the sheet above it
        are handed over.

        Written the way the composer's own chat version is written, down to the
        keyboard numbers: the composer owns lifting itself, and is told how far
        it already sits above the bottom so it does not travel that distance
        twice. Deviating from that shape is what broke it the first time.
      */}
      <View className="px-3 pt-2" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <AIInput
          native
          value={draft}
          onValueChange={setDraft}
          onSubmit={send}
          keyboardBottomInset={Math.max(insets.bottom, 12)}
          keyboardGap={12}
        >
          <AIInput.Field placeholder="Message the assistant" />
          <AIInput.Toolbar>
            <AIInput.Action
              label="Attach"
              icon={<Glyph icon={PlusSignIcon} size={17} />}
              onPress={() => setAttaching(true)}
            />
            <AIInput.Spacer />
            <AIInput.Action label="Dictate" icon={<Glyph icon={Mic01Icon} size={15} />} />
            <AIInput.Submit />
          </AIInput.Toolbar>
        </AIInput>
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
  const [title, setTitle] = useState('Refactor the settings screen');

  return (
    <AssistantDemo
      native
      scene={<NativeChatScene />}
      title={title}
      // The scene is the native composer either way, so opening a chat from
      // the search page moves the title rather than the transcript — enough to
      // show the page went somewhere without swapping out what the version is
      // here to demonstrate.
      onOpenChat={setTitle}
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

const CONVERSATIONS = [...STARRED, ...RECENTS];

/**
 * The panel used as navigation rather than as a display: press a conversation
 * and the scene becomes that conversation, with the panel closing itself on
 * the way.
 *
 * The panel holds the route, so a row is a `to` and nothing else — no state
 * threaded through the list, no `active` computed per row, no closing written
 * out. The selected row stays marked from the same prop: a history list where
 * nothing is active tells you what you could open and never what you have
 * open, which is the question anyone opening the panel a second time is
 * asking.
 *
 * Each conversation is a `Panelside.Page`. The first press mounts one; every
 * press after that is a style change, so going back to a conversation you have
 * already read does not rebuild it.
 */
export function PanelsideNavigateBlock() {
  const [route, setRoute] = useState(CONVERSATIONS[0] as string);

  return (
    <AssistantDemo
      routed
      route={route}
      onRouteChange={setRoute}
      title={route}
      // The search page opens a chat by setting the route, the same way a row
      // in the panel does. A page for the compose pill to land on, too — the
      // route it sets has to be one of these or the scene shows nothing.
      onOpenChat={setRoute}
      scene={
        <Panelside.Pages>
          {['New chat', ...CONVERSATIONS].map((title) => (
            <Panelside.Page key={title} value={title}>
              <ConversationScene title={title} />
            </Panelside.Page>
          ))}
        </Panelside.Pages>
      }
    />
  );
}

/**
 * Every conversation carries a "…". The menu it opens renames, stars, shares
 * or deletes the row it belongs to, and the list changes underneath — a menu
 * whose rows only close it proves nothing about where the actions go.
 */
export function PanelsideActionsBlock() {
  const [starred, setStarred] = useState<readonly string[]>(STARRED);
  const [recents, setRecents] = useState<readonly string[]>(RECENTS);
  const [active, setActive] = useState(STARRED[0] as string);

  const rename = (title: string) => {
    const next = `${title} (renamed)`;
    const swap = (list: readonly string[]) =>
      list.map((entry) => (entry === title ? next : entry));
    setStarred(swap);
    setRecents(swap);
    setActive((current) => (current === title ? next : current));
  };

  const star = (title: string) => {
    if (starred.includes(title)) return;
    setStarred((list) => [...list, title]);
    setRecents((list) => list.filter((entry) => entry !== title));
  };

  const remove = (title: string) => {
    const drop = (list: readonly string[]) => list.filter((entry) => entry !== title);
    setStarred(drop);
    setRecents(drop);
  };

  return (
    <AssistantDemo
      title={active}
      activeId={active}
      onSelect={setActive}
      onOpenChat={setActive}
      starred={starred}
      recents={recents}
      scene={<ConversationScene title={active} />}
      actions={(title) => (
        <Panelside.ItemActions>
          <Menu.Item icon={<Glyph icon={PencilEdit02Icon} size={17} />} onSelect={() => rename(title)}>
            Rename
          </Menu.Item>
          <Menu.Item icon={<Glyph icon={StarIcon} size={17} />} onSelect={() => star(title)}>
            Star
          </Menu.Item>
          <Menu.Item icon={<Glyph icon={Share01Icon} size={17} />}>Share</Menu.Item>
          <Menu.Separator />
          <Menu.Item
            variant="destructive"
            icon={<Glyph icon={Delete02Icon} size={17} />}
            onSelect={() => remove(title)}
          >
            Delete
          </Menu.Item>
        </Panelside.ItemActions>
      )}
    />
  );
}
