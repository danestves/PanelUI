/**
 * Response — a model's answer, rendered as it arrives.
 *
 * An answer is markdown. It has headings and lists and fenced code in it,
 * because that is what a model writes, and rendering it as one run of plain
 * text throws away the structure the model went to the trouble of producing.
 *
 * So this reads the markdown and renders it through the library's own parts —
 * `Typography` for prose, `CodeBlock` for fences, `Table` for tables. Nothing
 * here draws its own type or its own colours: an answer inside a message bubble
 * should look like the app it is in, not like a document viewer someone
 * embedded.
 *
 * ```tsx
 * <Response isStreaming={status === 'streaming'}>{text}</Response>
 * ```
 *
 * ## Why it is a whole component and not a `<Text>`
 *
 * Because the text is still arriving, and that changes everything about how it
 * has to be read. A token stream hands you every prefix of the final answer, so
 * a renderer sees `**bo`, then `**bol`, then `**bold**` — three documents, two
 * of which have literal asterisks in them. Render each faithfully and the
 * answer flickers between styles on nearly every frame, which is worse than no
 * formatting at all: the eye tracks the flicker instead of the words.
 *
 * `isStreaming` tells the reader to finish an unterminated construct at the end
 * of the input rather than escaping it — an open fence is a code block that is
 * still filling, an open `**` is bold text still being written. The rule it
 * works to is that no word already on screen may disappear when the next token
 * arrives; delimiters may vanish as they are recognised, words never do.
 *
 * ## Where the props come from
 *
 * With the AI SDK, `children` is the text of the assistant message's text parts
 * joined together, and `isStreaming` is `status === 'streaming'`. Join the
 * parts — one `Response` per part renders a heading in one component and the
 * paragraph under it in another, and neither knows about the other.
 */
import { memo, useMemo, type ComponentType, type ReactNode } from 'react';
import { Linking, View, type ViewProps } from 'react-native';
import { Text } from '../../primitives/text';
import { cn } from '../../utils/cn';
import { CodeBlock } from '../code-block';
import { Table } from '../table';
import { Typography } from '../typography';
import {
  parseMarkdown,
  type Align,
  type Block,
  type InlineToken,
} from './markdown';

export type { Block as ResponseBlock, InlineToken as ResponseInline } from './markdown';

/** Heading levels below h4 are h4's size; a chat answer has no use for six. */
const HEADING_TYPE = ['h2', 'h3', 'h4', 'h4', 'h4', 'h4'] as const;

/** Schemes a link may open with. Anything else is rendered but not pressable. */
const DEFAULT_LINK_PREFIXES = ['https://', 'http://', 'mailto:', 'tel:'];

export interface ResponseComponents {
  /** Replaces the whole code block — for a runnable snippet, or a diff viewer. */
  code?: ComponentType<{ code: string; language?: string; streaming: boolean }>;
  /** Replaces an image. Nothing is rendered for one by default. */
  image?: ComponentType<{ src: string; alt: string }>;
}

export interface ResponseProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /** The markdown. */
  children?: string;
  /**
   * Whether more is still coming. Finishes an unterminated construct at the end
   * of the text instead of escaping it, so the answer does not flicker between
   * styles as its delimiters arrive.
   */
  isStreaming?: boolean;
  /** Turns off speculative completion entirely, even while streaming. */
  parseIncompleteMarkdown?: boolean;
  /** What a link does. Opens it with the system handler by default. */
  onLinkPress?: (href: string) => void;
  /**
   * Schemes a link is allowed to open. A model can write any URL it likes, and
   * an answer is not a trusted document — so the default list is the four that
   * cannot do anything but navigate.
   */
  allowedLinkPrefixes?: string[];
  /** Swap out how a block is drawn. */
  components?: ResponseComponents;
  /** Line numbers in fenced code. */
  showLineNumbers?: boolean;
}

function ResponseRoot({
  className,
  children = '',
  isStreaming = false,
  parseIncompleteMarkdown = true,
  onLinkPress,
  allowedLinkPrefixes = DEFAULT_LINK_PREFIXES,
  components,
  showLineNumbers = false,
  ...props
}: ResponseProps) {
  const speculate = isStreaming && parseIncompleteMarkdown;
  const blocks = useMemo(
    () => parseMarkdown(children, speculate),
    [children, speculate]
  );

  const context: RenderContext = {
    streaming: isStreaming,
    onLinkPress,
    allowedLinkPrefixes,
    components,
    showLineNumbers,
  };

  return (
    <View className={cn('w-full gap-3', className)} {...props}>
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} context={context} />
      ))}
    </View>
  );
}

/**
 * Re-renders only when the text changes.
 *
 * A stream re-renders its parent on every token, and everything else the parent
 * hands down — the callbacks, the overrides — is usually a fresh object each
 * time. Comparing the one prop that actually decides the output keeps a long
 * answer from re-parsing because a sibling moved.
 */
export const Response = memo(
  ResponseRoot,
  (previous, next) =>
    previous.children === next.children &&
    previous.isStreaming === next.isStreaming &&
    previous.className === next.className
);
Response.displayName = 'Response';

/* -------------------------------------------------------------------------- */
/* Blocks                                                                     */
/* -------------------------------------------------------------------------- */

interface RenderContext {
  streaming: boolean;
  onLinkPress?: (href: string) => void;
  allowedLinkPrefixes: string[];
  components?: ResponseComponents;
  showLineNumbers: boolean;
}

function BlockView({ block, context }: { block: Block; context: RenderContext }) {
  switch (block.type) {
    case 'heading':
      return (
        <Typography.Heading type={HEADING_TYPE[block.level - 1]}>
          {spans(block.inline, context)}
        </Typography.Heading>
      );

    case 'paragraph':
      return (
        <Typography.Paragraph>{spans(block.inline, context)}</Typography.Paragraph>
      );

    case 'code': {
      const Custom = context.components?.code;
      if (Custom) {
        return (
          <Custom
            code={block.code}
            language={block.language}
            streaming={block.open && context.streaming}
          />
        );
      }
      return (
        <CodeBlock
          code={block.code}
          language={block.language}
          showLineNumbers={context.showLineNumbers}
        >
          {block.language ? (
            <CodeBlock.Header>
              <CodeBlock.Language>{block.language}</CodeBlock.Language>
              <CodeBlock.Actions>
                {/*
                  No copy button while the fence is still open: copying half a
                  snippet is worse than not offering to, because it succeeds.
                */}
                {block.open && context.streaming ? null : <CodeBlock.CopyButton />}
              </CodeBlock.Actions>
            </CodeBlock.Header>
          ) : null}
        </CodeBlock>
      );
    }

    case 'quote':
      // The rule is drawn here rather than by `Typography.Blockquote`, which
      // puts its children inside a `Text` — right for a quoted sentence, wrong
      // for a quote that turns out to contain a list and a snippet. `border-s`
      // so the rule moves to the other side under a right-to-left `Direction`.
      return (
        <View className="w-full gap-2 border-s-2 border-border ps-4">
          {block.blocks.map((child, index) => (
            <BlockView key={index} block={child} context={context} />
          ))}
        </View>
      );

    case 'list':
      return (
        <Typography.List ordered={block.ordered}>
          {block.items.map((item, index) => (
            <View key={index} className="gap-2">
              {item.map((child, position) => (
                <BlockView key={position} block={child} context={context} />
              ))}
            </View>
          ))}
        </Typography.List>
      );

    case 'table':
      return <TableBlock block={block} context={context} />;

    case 'rule':
      return <View className="h-px w-full bg-border" />;
  }
}

const ALIGNMENT: Record<Align, 'start' | 'center' | 'end'> = {
  left: 'start',
  center: 'center',
  right: 'end',
};

/**
 * A GFM table.
 *
 * Every column gets the same share of the width. A markdown table carries no
 * widths, and guessing them from the longest cell makes the columns jump about
 * as rows stream in — which is exactly the movement everything else here is
 * built to avoid.
 */
function TableBlock({
  block,
  context,
}: {
  block: Extract<Block, { type: 'table' }>;
  context: RenderContext;
}) {
  const align = (index: number) => ALIGNMENT[block.align[index] ?? 'left'];

  return (
    <Table variant="outline" size="sm">
      <Table.Header>
        <Table.Row>
          {block.head.map((cell, index) => (
            <Table.Head key={index} align={align(index)}>
              <InlineRun
                tokens={cell}
                context={context}
                className="text-[11px] font-medium text-muted-foreground"
              />
            </Table.Head>
          ))}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {block.rows.map((row, rowIndex) => (
          <Table.Row key={rowIndex}>
            {block.head.map((_unused, index) => (
              <Table.Cell key={index} align={align(index)}>
                <InlineRun
                  tokens={row[index] ?? []}
                  context={context}
                  className="text-xs text-foreground"
                />
              </Table.Cell>
            ))}
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

/* -------------------------------------------------------------------------- */
/* Inline                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A run of styled spans, inside a `Text` of its own.
 *
 * Nested `Text` rather than a row of views, because only nested text wraps as
 * one paragraph — a bolded word in a view would break the line before it and
 * leave a gap where the sentence should have continued.
 *
 * The wrapper is not optional. Half these spans are bare strings, and a bare
 * string is only legal inside a `Text`: dropped into a `Table.Cell` — which is
 * a view — React Native refuses to render it at all.
 */
function InlineRun({
  tokens,
  context,
  className,
}: {
  tokens: InlineToken[];
  context: RenderContext;
  className?: string;
}) {
  return <Text className={className}>{spans(tokens, context)}</Text>;
}

function spans(tokens: InlineToken[], context: RenderContext): ReactNode {
  return tokens.map((token, index) => {
    if (token.kind === 'image') {
      const Custom = context.components?.image;
      // Nothing by default. An image in an answer is a URL the model wrote, and
      // fetching it unasked is a request to a host nobody chose.
      return Custom ? <Custom key={index} src={token.href ?? ''} alt={token.value} /> : null;
    }

    if (token.kind === 'code') {
      // A `Text`, not `Typography.Code` — that one is a view around a text, and
      // a view inside a paragraph breaks the line before it and leaves a gap
      // where the sentence should have carried on. A background and a
      // monospace face are what make it read as code; they survive nesting,
      // and padding does not.
      //
      // No relative font size either. There is no `em` here to be relative to:
      // a value in one sends the style resolver looking for a parent size that
      // is itself expressed in `em`, and it does not come back. The inherited
      // size is the right one anyway — inline code is part of its sentence.
      return (
        <Text key={index} className={cn('bg-muted font-mono', marks(token))}>
          {token.value}
        </Text>
      );
    }

    if (token.kind === 'link') {
      const href = token.href ?? '';
      const openable = context.allowedLinkPrefixes.some((prefix) => href.startsWith(prefix));
      return (
        <Text
          key={index}
          className={cn('text-primary underline', marks(token))}
          onPress={
            openable
              ? () => (context.onLinkPress ?? defaultOpen)(href)
              : undefined
          }
        >
          {token.value}
        </Text>
      );
    }

    if (!token.bold && !token.italic && !token.strike) return token.value;

    return (
      <Text key={index} className={marks(token)}>
        {token.value}
      </Text>
    );
  });
}

function marks(token: InlineToken): string {
  return cn(
    token.bold && 'font-semibold',
    token.italic && 'italic',
    token.strike && 'line-through'
  );
}

function defaultOpen(href: string) {
  // Fire and forget: a link the platform declines to open is not worth an
  // unhandled rejection, and there is nothing useful to do about one.
  void Linking.openURL(href).catch(() => {});
}
