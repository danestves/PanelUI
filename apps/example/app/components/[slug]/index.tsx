import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRightIcon, EmptyState, Item, SectionRail, Text } from 'panelui-native';
import { ScreenHeader } from '../../../src/components/screen-header';
import { COMPONENTS_BY_SLUG, type ComponentEntry, type Demo } from '../../../src/data/components';

/**
 * A demo that needs the whole screen gets a row here instead of being rendered
 * inline. A chat transcript squeezed into a section between two dividers
 * demonstrates nothing except that it does not fit — so it is listed,
 * described, and opened on a screen of its own.
 */
function VersionRow({ slug, demo, index }: { slug: string; demo: Demo; index: number }) {
  return (
    <Item
      variant="muted"
      size="sm"
      onPress={() => router.push(`/components/${slug}/${demo.id}`)}
    >
      {/* Numbered, because "version three" is how these get talked about — and
          a filled row needs something on its leading edge to sit against. */}
      <Item.Media variant="icon">
        <Text size="sm" weight="medium" muted>
          {index + 1}
        </Text>
      </Item.Media>
      <Item.Content>
        <Item.Title>{demo.label}</Item.Title>
        {demo.description ? <Item.Description>{demo.description}</Item.Description> : null}
      </Item.Content>
      <Item.Actions>
        <ChevronRightIcon size={16} />
      </Item.Actions>
    </Item>
  );
}

/** The heading over a demo, in both layouts, so they read as the same screen. */
function DemoLabel({ children }: { children: string }) {
  return (
    <Text size="xs" weight="semibold" muted className="mb-4 uppercase tracking-wider">
      {children}
    </Text>
  );
}

function VersionList({ entry, versions }: { entry: ComponentEntry; versions: Demo[] }) {
  return (
    // Gaps, not hairlines: each row is its own filled surface, and a separator
    // between two cards reads as a mistake.
    <Item.Group className="gap-2">
      {versions.map((demo, index) => (
        <VersionRow key={demo.id} slug={entry.slug} demo={demo} index={index} />
      ))}
    </Item.Group>
  );
}

/** Every variant down one scroll, divided by hairlines. */
function SectionsLayout({
  entry,
  versions,
  inline,
}: {
  entry: ComponentEntry;
  versions: Demo[];
  inline: Demo[];
}) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerClassName="px-5 pt-2"
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      showsVerticalScrollIndicator={false}
    >
      <Text size="sm" muted className="pb-6">
        {entry.summary}
      </Text>

      {versions.length ? (
        <View>
          <DemoLabel>Versions</DemoLabel>
          <VersionList entry={entry} versions={versions} />
        </View>
      ) : null}

      {inline.map((demo, index) => (
        <View key={demo.label}>
          {index > 0 || versions.length ? <View className="my-8 h-px bg-border" /> : null}
          <DemoLabel>{demo.label}</DemoLabel>
          <View className="w-full items-center">{demo.render()}</View>
        </View>
      ))}
    </ScrollView>
  );
}

/**
 * One demo per screen, swiped vertically, with a rail in the corner standing in
 * for the scrollbar.
 *
 * The page height is the scroll view's own, measured — not the window's.
 * The header and the summary above the pager make the viewport shorter than
 * the screen, and window-height pages then sit a little further out of
 * alignment with each snap position than the last, until one of them lands
 * entirely between two and never shows.
 */
function PagerLayout({
  entry,
  versions,
  inline,
}: {
  entry: ComponentEntry;
  versions: Demo[];
  inline: Demo[];
}) {
  const [page, setPage] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);
  const scroller = useRef<ScrollView>(null);

  // The versions list, if there is one, is the first page: it is the index to
  // the screens that are too big to be pages themselves.
  const pages: { id: string; label: string; demo?: Demo }[] = [
    ...(versions.length ? [{ id: 'versions', label: 'Versions' }] : []),
    ...inline.map((demo) => ({ id: demo.label, label: demo.label, demo })),
  ];

  const scrollToPage = (index: number) => {
    if (index < 0 || !pageHeight) return;
    setPage(index);
    scroller.current?.scrollTo({ y: index * pageHeight, animated: true });
  };

  return (
    <>
      <Text size="sm" muted className="px-5 pb-3">
        {entry.summary}
      </Text>

      <ScrollView
        ref={scroller}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onLayout={(event) => setPageHeight(event.nativeEvent.layout.height)}
        onScroll={(event) => {
          const { contentOffset, layoutMeasurement } = event.nativeEvent;
          if (!layoutMeasurement.height) return;
          const next = Math.round(contentOffset.y / layoutMeasurement.height);
          if (next !== page) setPage(next);
        }}
      >
        {pages.map((entryPage, index) => (
          <View
            key={entryPage.id}
            // Nothing to lay out until the viewport has been measured; a page
            // of the wrong height would scroll to the wrong place first.
            style={{ height: pageHeight || undefined }}
            className="justify-center px-5"
          >
            <Text size="xs" muted className="mb-2">
              {index + 1} of {pages.length}
            </Text>
            <DemoLabel>{entryPage.label}</DemoLabel>
            {entryPage.demo ? (
              <View className="w-full items-center">{entryPage.demo.render()}</View>
            ) : (
              <VersionList entry={entry} versions={versions} />
            )}
          </View>
        ))}
      </ScrollView>

      <SectionRail
        placement="left"
        align="bottom"
        haptics
        value={pages[page]?.id}
        onValueChange={(next) => scrollToPage(pages.findIndex((item) => item.id === next))}
      >
        <SectionRail.Trigger>
          {pages.map((item) => (
            <SectionRail.Bar key={item.id} value={item.id} />
          ))}
        </SectionRail.Trigger>
        <SectionRail.Content>
          {pages.map((item) => (
            <SectionRail.Item key={item.id} value={item.id}>
              {item.label}
            </SectionRail.Item>
          ))}
        </SectionRail.Content>
      </SectionRail>
    </>
  );
}

export default function ComponentDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const entry = COMPONENTS_BY_SLUG[slug ?? ''];

  if (!entry) {
    return (
      <View className="flex-1">
        <ScreenHeader title="Not found" showBack />
        <EmptyState>
          <EmptyState.Header>
            <EmptyState.Title>Unknown component</EmptyState.Title>
            <EmptyState.Description>
              There is no component with the slug “{slug}”.
            </EmptyState.Description>
          </EmptyState.Header>
        </EmptyState>
      </View>
    );
  }

  const versions = entry.demos.filter((demo) => demo.fullPage);
  const inline = entry.demos.filter((demo) => !demo.fullPage);

  /*
   * Paged by default, with two cases that fall back however the entry is
   * marked. A component whose demos are all full-screen has nothing to page
   * but its own Versions list, and a component with one inline demo would get
   * a single page and a rail that does nothing — both are the sections layout
   * with extra steps.
   */
  const paged = entry.layout !== 'sections' && inline.length > 1;

  return (
    <View className="flex-1">
      <ScreenHeader title={entry.name} showBack />
      {paged ? (
        <PagerLayout entry={entry} versions={versions} inline={inline} />
      ) : (
        <SectionsLayout entry={entry} versions={versions} inline={inline} />
      )}
    </View>
  );
}
