/**
 * CodeBlock — a fenced snippet, syntax-coloured and scrolled sideways.
 *
 * Code does not wrap. Wrapping a line of code puts the continuation under the
 * indentation and the two stop meaning different things, so the body scrolls
 * horizontally instead — which on a phone is the only honest way to show a
 * ninety-column line.
 *
 * ```tsx
 * <CodeBlock code={code} language="tsx">
 *   <CodeBlock.Header>
 *     <CodeBlock.Filename>calendar.tsx</CodeBlock.Filename>
 *     <CodeBlock.CopyButton />
 *   </CodeBlock.Header>
 * </CodeBlock>
 * ```
 *
 * ## Colouring
 *
 * The highlighter is a single pass of regex, shipped in the component, over the
 * languages a chat actually streams. There is no grammar and no worker, because
 * the alternative costs megabytes and has to run again on every frame of a
 * stream. It gets keywords, strings, comments and numbers right in a twelve-line
 * snippet and does not pretend to more; an unrecognised language renders as
 * clean monospace rather than as a guess. Colours come from the theme's
 * `--color-code-*` tokens, so a snippet follows light and dark like everything
 * else.
 *
 * ## Where the props come from
 *
 * With the AI SDK, `code` and `language` are what you pull out of a fenced
 * block in a text part, or the fields of a tool call that wrote a file.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { ScrollView, View, type ViewProps } from 'react-native';
import { tv } from 'tailwind-variants';
import { useCSSVariable } from 'uniwind';
import { useCopyToClipboard } from '../../hooks/use-copy-to-clipboard';
import { CheckIcon, CopyIcon } from '../../icons';
import { Text } from '../../primitives/text';
import { cn } from '../../utils/cn';
import { AnimatedPressable } from '../../primitives/animated-pressable';
import { highlight, resolveLanguage, type Token, type TokenKind } from './highlight';

const codeBlockVariants = tv({
  slots: {
    root: 'w-full overflow-hidden rounded-2xl border border-border bg-muted/40',
    header: 'flex-row items-center justify-between gap-2 border-b border-border px-3 py-2',
    filename: 'font-mono text-xs text-muted-foreground',
    language: 'text-xs uppercase tracking-wide text-muted-foreground',
    actions: 'flex-row items-center gap-1',
    action: 'h-7 w-7 items-center justify-center rounded-lg active:bg-accent',
    body: 'p-3',
    line: 'flex-row',
    /*
     * `leading-*` on the row rather than on each token: the tokens of a line
     * are separate Text nodes, and a line height set on some of them and not
     * others makes the baseline jog wherever a keyword ends.
     */
    gutter: 'w-8 pe-3 text-end font-mono text-xs text-muted-foreground/50',
    code: 'font-mono text-xs leading-5',
  },
});

interface CodeBlockContextValue {
  code: string;
}

const CodeBlockContext = createContext<CodeBlockContextValue | null>(null);

function useCodeBlock(component: string): CodeBlockContextValue {
  const context = useContext(CodeBlockContext);
  if (!context) {
    throw new Error(`${component} must be used within a <CodeBlock>`);
  }
  return context;
}

/** Which theme token paints each kind of token. */
const TOKEN_COLORS: Record<TokenKind, string> = {
  plain: '--color-foreground',
  keyword: '--color-code-keyword',
  string: '--color-code-string',
  number: '--color-code-number',
  comment: '--color-code-comment',
  function: '--color-code-function',
  property: '--color-code-property',
  punctuation: '--color-code-punctuation',
  inserted: '--color-code-inserted',
  deleted: '--color-code-deleted',
};

/**
 * The palette, resolved once for the whole block.
 *
 * `useCSSVariable` is a hook, so it cannot be called per token — and a snippet
 * has hundreds. Ten lookups at the top and a lookup table underneath is the
 * same answer at a fraction of the cost.
 */
function useTokenColors(): Record<TokenKind, string | undefined> {
  const plain = useCSSVariable(TOKEN_COLORS.plain);
  const keyword = useCSSVariable(TOKEN_COLORS.keyword);
  const string = useCSSVariable(TOKEN_COLORS.string);
  const number = useCSSVariable(TOKEN_COLORS.number);
  const comment = useCSSVariable(TOKEN_COLORS.comment);
  const fn = useCSSVariable(TOKEN_COLORS.function);
  const property = useCSSVariable(TOKEN_COLORS.property);
  const punctuation = useCSSVariable(TOKEN_COLORS.punctuation);
  const inserted = useCSSVariable(TOKEN_COLORS.inserted);
  const deleted = useCSSVariable(TOKEN_COLORS.deleted);

  const only = (value: unknown) => (typeof value === 'string' ? value : undefined);

  return useMemo(
    () => ({
      plain: only(plain),
      keyword: only(keyword),
      string: only(string),
      number: only(number),
      comment: only(comment),
      function: only(fn),
      property: only(property),
      punctuation: only(punctuation),
      inserted: only(inserted),
      deleted: only(deleted),
    }),
    [plain, keyword, string, number, comment, fn, property, punctuation, inserted, deleted]
  );
}

export interface CodeBlockProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /** The snippet. */
  code: string;
  /**
   * What it is written in. `ts`, `tsx`, `js`, `jsx`, `json`, `bash`, `python`,
   * `css`, `html`, `sql`, `markdown` and `diff` are coloured, along with the
   * usual spellings of each; anything else renders as plain monospace.
   */
  language?: string;
  /** Number the lines in a gutter down the leading edge. */
  showLineNumbers?: boolean;
  /** A header, and anything else that goes above the code. */
  children?: ReactNode;
}

function CodeBlockRoot({
  className,
  code,
  language,
  showLineNumbers = false,
  children,
  ...props
}: CodeBlockProps) {
  const slots = codeBlockVariants();
  const colors = useTokenColors();
  const lines = useMemo(() => highlight(code, language), [code, language]);
  const context = useMemo(() => ({ code }), [code]);
  const gutterWidth = String(lines.length).length;

  return (
    <CodeBlockContext.Provider value={context}>
      <View {...props} className={cn(slots.root(), className)}>
        {children}
        {/*
          Horizontal only. The rows are laid out at their natural width inside
          it, so the longest line sets the scrollable width and every row shares
          it — otherwise each row would scroll to its own end and the gutter
          would drift away from its code.
        */}
        <ScrollView
          horizontal
          bounces={false}
          showsHorizontalScrollIndicator={false}
          contentContainerClassName={slots.body()}
        >
          <View>
            {lines.map((tokens, index) => (
              <View key={index} className={slots.line()}>
                {showLineNumbers ? (
                  <Text
                    className={slots.gutter()}
                    style={{ width: 16 + gutterWidth * 7 }}
                  >
                    {index + 1}
                  </Text>
                ) : null}
                <CodeLine tokens={tokens} colors={colors} className={slots.code()} />
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </CodeBlockContext.Provider>
  );
}
CodeBlockRoot.displayName = 'CodeBlock';

/**
 * One line, as a single Text with a run of coloured children.
 *
 * Nested Text rather than a row of Views: only inside one Text do the runs
 * share a baseline and keep their spaces. A row of Views gives every token its
 * own box and the line comes apart at the seams.
 */
function CodeLine({
  tokens,
  colors,
  className,
}: {
  tokens: Token[];
  colors: Record<TokenKind, string | undefined>;
  className: string;
}) {
  return (
    <Text className={className}>
      {/* An empty line still needs a glyph's worth of height. */}
      {tokens.length === 0 ? ' ' : null}
      {tokens.map((token, index) => (
        <Text key={index} className={className} style={{ color: colors[token.kind] }}>
          {token.text}
        </Text>
      ))}
    </Text>
  );
}

export interface CodeBlockHeaderProps extends ViewProps {
  className?: string;
  children?: ReactNode;
}

/** The bar above the code: what the file is, and what can be done with it. */
function CodeBlockHeader({ className, children, ...props }: CodeBlockHeaderProps) {
  const { header } = codeBlockVariants();
  return (
    <View {...props} className={cn(header(), className)}>
      {children}
    </View>
  );
}

export interface CodeBlockFilenameProps extends ViewProps {
  className?: string;
  children?: ReactNode;
}

function CodeBlockFilename({ className, children, ...props }: CodeBlockFilenameProps) {
  const { filename } = codeBlockVariants();
  return (
    <Text numberOfLines={1} className={cn(filename(), className)} {...props}>
      {children}
    </Text>
  );
}

export interface CodeBlockLanguageProps extends ViewProps {
  className?: string;
  children?: ReactNode;
}

/** The language, for a block with no filename to name it by. */
function CodeBlockLanguage({ className, children, ...props }: CodeBlockLanguageProps) {
  const { language } = codeBlockVariants();
  return (
    <Text className={cn(language(), className)} {...props}>
      {children}
    </Text>
  );
}

export interface CodeBlockActionsProps extends ViewProps {
  className?: string;
  children?: ReactNode;
}

function CodeBlockActions({ className, children, ...props }: CodeBlockActionsProps) {
  const { actions } = codeBlockVariants();
  return (
    <View {...props} className={cn(actions(), className)}>
      {children}
    </View>
  );
}

export interface CodeBlockCopyButtonProps {
  className?: string;
  /** How long the tick stays up before turning back into the copy glyph. */
  timeout?: number;
  onCopy?: () => void;
}

/**
 * Copies the block's code.
 *
 * The tick is the whole feedback: there is no toast, because a snippet in a
 * transcript is copied often and a notification for each one is noise.
 */
function CodeBlockCopyButton({ className, timeout = 2000, onCopy }: CodeBlockCopyButtonProps) {
  const { code } = useCodeBlock('CodeBlock.CopyButton');
  const { action } = codeBlockVariants();
  const { copy, copied } = useCopyToClipboard({ timeout });
  // Both glyphs are given a colour: the check's own fallback is white, which is
  // invisible on this header in a light theme.
  const rawTick = useCSSVariable('--color-success');
  const rawIdle = useCSSVariable('--color-muted-foreground');
  const tick = typeof rawTick === 'string' ? rawTick : undefined;
  const idle = typeof rawIdle === 'string' ? rawIdle : undefined;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={copied ? 'Copied' : 'Copy code'}
      accessibilityState={{ selected: copied }}
      hitSlop={6}
      onPress={() => {
        void copy(code);
        onCopy?.();
      }}
      className={cn(action(), className)}
    >
      {copied ? <CheckIcon size={14} color={tick} /> : <CopyIcon size={14} color={idle} />}
    </AnimatedPressable>
  );
}

CodeBlockHeader.displayName = 'CodeBlock.Header';
CodeBlockFilename.displayName = 'CodeBlock.Filename';
CodeBlockLanguage.displayName = 'CodeBlock.Language';
CodeBlockActions.displayName = 'CodeBlock.Actions';
CodeBlockCopyButton.displayName = 'CodeBlock.CopyButton';

export { resolveLanguage, type CodeLanguage, type Token, type TokenKind } from './highlight';

export const CodeBlock = Object.assign(CodeBlockRoot, {
  Header: CodeBlockHeader,
  Filename: CodeBlockFilename,
  Language: CodeBlockLanguage,
  Actions: CodeBlockActions,
  CopyButton: CodeBlockCopyButton,
});
