/**
 * MarkdownEditor — a field for writing markdown, and a way to see it rendered.
 *
 * ```tsx
 * const [draft, setDraft] = useState('');
 *
 * <MarkdownEditor value={draft} onValueChange={setDraft} rows={12} />
 * ```
 *
 * ## Writing and reading are two modes, not two panes
 *
 * Side by side is how this is done on a desktop, and it does not survive the
 * trip to a phone: two columns of a phone's width are two columns too narrow to
 * read, and the keyboard covers the bottom half of the screen exactly when the
 * writer is using it. So there is one pane and a switch — write, or read what
 * you wrote. The toolbar carries the switch, because the toolbar is the one
 * thing on screen in both modes.
 *
 * ## The toolbar edits the selection
 *
 * Every button here is a function of the text and where the caret is in it, and
 * the answer that matters is not which characters get inserted but where the
 * caret lands afterwards. Bolding a selected phrase leaves it selected, so it
 * can be italicised next; bolding nothing puts the caret between the new
 * markers, where the writing is about to go; and pressing the same button again
 * takes the markers off. Those rules live in `markdown-transforms.ts` as pure
 * functions over `(text, selection)`, away from anything to do with a field.
 *
 * ## Why it renders through Response
 *
 * The preview is `Response`, the same reader that renders a model's answer, so
 * markdown means the same thing everywhere in the library and there is one
 * parser to be right rather than two to keep in step. It renders through
 * `Typography`, `CodeBlock` and `Table`, which is to say through the app's own
 * type and colours — a preview that looked like a document viewer would be
 * showing the writer something they are not going to ship.
 *
 * Nothing here reaches for a platform markdown renderer. `Text` in SwiftUI can
 * parse markdown and Jetpack Compose's cannot, so a platform-backed editor
 * would render on one of the two and be a plain string on the other.
 *
 * Works controlled (`value` + `onValueChange`) or uncontrolled (`defaultValue`).
 */
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  View,
  type NativeSyntheticEvent,
  type TextInput,
  type TextInputSelectionChangeEventData,
  type ViewProps,
} from 'react-native';
import { tv } from 'tailwind-variants';
import {
  BoldIcon,
  CodeIcon,
  EyeIcon,
  HeadingIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  PencilIcon,
  QuoteIcon,
} from '../../icons';
import { Text } from '../../primitives/text';
import { cn } from '../../utils/cn';
import { Button } from '../button';
import { ButtonGroup } from '../button-group';
import { Response } from '../response';
import { Textarea, type TextareaProps } from '../textarea';
import {
  insertLink,
  toggleFence,
  toggleLinePrefix,
  toggleOrderedList,
  toggleWrap,
  type EditResult,
  type EditorSelection,
} from './markdown-transforms';

export type { EditorSelection, EditResult } from './markdown-transforms';

/** Which pane the editor is showing. */
export type MarkdownEditorMode = 'write' | 'preview';

/** A formatting action the toolbar can offer. */
export type MarkdownEditorAction =
  | 'bold'
  | 'italic'
  | 'heading'
  | 'quote'
  | 'code'
  | 'bulletList'
  | 'orderedList'
  | 'link';

/** The actions a toolbar shows when it is not told which to show. */
const DEFAULT_ACTIONS: MarkdownEditorAction[] = [
  'bold',
  'italic',
  'heading',
  'bulletList',
  'orderedList',
  'quote',
  'code',
  'link',
];

/**
 * What each action does, what it is called, and what it looks like.
 *
 * One table rather than a switch in the toolbar and another in the context:
 * adding an action should be adding a row here, and nowhere else.
 */
const ACTIONS: Record<
  MarkdownEditorAction,
  {
    label: string;
    icon: (size: number) => ReactNode;
    apply: (text: string, selection: EditorSelection) => EditResult;
  }
> = {
  bold: {
    label: 'Bold',
    icon: (size) => <BoldIcon size={size} />,
    apply: (text, selection) => toggleWrap(text, selection, '**'),
  },
  italic: {
    label: 'Italic',
    icon: (size) => <ItalicIcon size={size} />,
    apply: (text, selection) => toggleWrap(text, selection, '_'),
  },
  heading: {
    label: 'Heading',
    icon: (size) => <HeadingIcon size={size} />,
    apply: (text, selection) => toggleLinePrefix(text, selection, '## '),
  },
  quote: {
    label: 'Quote',
    icon: (size) => <QuoteIcon size={size} />,
    apply: (text, selection) => toggleLinePrefix(text, selection, '> '),
  },
  code: {
    label: 'Code block',
    icon: (size) => <CodeIcon size={size} />,
    apply: toggleFence,
  },
  bulletList: {
    label: 'Bulleted list',
    icon: (size) => <ListIcon size={size} />,
    apply: (text, selection) => toggleLinePrefix(text, selection, '- '),
  },
  orderedList: {
    label: 'Numbered list',
    icon: (size) => <ListOrderedIcon size={size} />,
    apply: toggleOrderedList,
  },
  link: {
    label: 'Link',
    icon: (size) => <LinkIcon size={size} />,
    apply: insertLink,
  },
};

const markdownEditorVariants = tv({
  slots: {
    root: 'w-full gap-2',
    toolbar: 'flex-row items-center justify-between gap-2',
    // The preview stands in the field's place, so it takes the field's shape.
    // A rendered draft that sat on the page with no edge around it would not
    // read as the same object the writing was in.
    preview: 'w-full rounded-xl border border-input bg-popover px-3 py-2.5',
    empty: 'py-6 text-center',
  },
});

interface MarkdownEditorContextValue {
  value: string;
  mode: MarkdownEditorMode;
  setMode: (mode: MarkdownEditorMode) => void;
  /** Runs a transform against the live text and selection. */
  run: (action: MarkdownEditorAction) => void;
  /** What the field should be showing as selected, once, after an edit. */
  pending: EditorSelection | undefined;
  setSelection: (selection: EditorSelection) => void;
  clearPending: () => void;
  onChangeText: (next: string) => void;
  disabled: boolean;
}

const MarkdownEditorContext = createContext<MarkdownEditorContextValue | null>(null);

function useMarkdownEditor(part: string): MarkdownEditorContextValue {
  const ctx = useContext(MarkdownEditorContext);
  if (!ctx) throw new Error(`${part} must be used inside <MarkdownEditor>.`);
  return ctx;
}

export interface MarkdownEditorProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /** Controlled text. Leave unset and pass `defaultValue` to run uncontrolled. */
  value?: string;
  /** Starting text when uncontrolled. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Controlled pane. */
  mode?: MarkdownEditorMode;
  /** Starting pane when uncontrolled. */
  defaultMode?: MarkdownEditorMode;
  onModeChange?: (mode: MarkdownEditorMode) => void;
  /** Stop the field being edited and the toolbar being pressed. */
  disabled?: boolean;
  /**
   * The parts, in the order they should stack. Left out, the editor draws its
   * toolbar, its field and its preview in that order — which is the whole
   * component, and the reason it usually needs no children.
   */
  children?: ReactNode;
  /** Forwarded to the field when the editor draws its own. */
  placeholder?: string;
  /** Height of the field, in lines. Forwarded to the field the editor draws. */
  rows?: number;
}

const MarkdownEditorRoot = forwardRef<View, MarkdownEditorProps>(
  (
    {
      className,
      value: valueProp,
      defaultValue = '',
      onValueChange,
      mode: modeProp,
      defaultMode = 'write',
      onModeChange,
      disabled = false,
      children,
      placeholder,
      rows,
      ...props
    },
    ref
  ) => {
    const slots = markdownEditorVariants();

    const [internalValue, setInternalValue] = useState(defaultValue);
    const value = valueProp ?? internalValue;

    const [internalMode, setInternalMode] = useState<MarkdownEditorMode>(defaultMode);
    const mode = modeProp ?? internalMode;

    /*
     * The live selection is a ref rather than state.
     *
     * It changes on every caret move — every keystroke, every tap in the text —
     * and nothing on screen depends on it. Holding it in state would re-render
     * the field, and therefore the preview under it, once per character typed.
     */
    const selectionRef = useRef<EditorSelection>({ start: 0, end: 0 });

    /*
     * What the field should show as selected after a toolbar edit, held for
     * exactly one render.
     *
     * A `selection` prop that stays set is a field the writer cannot move the
     * caret in — every tap would be pulled back to wherever the last edit put
     * it. So it is set once, applied, and cleared by the very selection change
     * it causes.
     */
    const [pending, setPending] = useState<EditorSelection | undefined>(undefined);

    const valueRef = useRef(value);
    valueRef.current = value;

    const commit = useCallback(
      (next: string) => {
        if (valueProp === undefined) setInternalValue(next);
        onValueChange?.(next);
      },
      [valueProp, onValueChange]
    );

    const setMode = useCallback(
      (next: MarkdownEditorMode) => {
        if (modeProp === undefined) setInternalMode(next);
        onModeChange?.(next);
      },
      [modeProp, onModeChange]
    );

    const run = useCallback(
      (action: MarkdownEditorAction) => {
        const result = ACTIONS[action].apply(valueRef.current, selectionRef.current);
        // Kept locally too: the parent may be slow to hand the new text back,
        // and the next press must not be computed against the old string.
        valueRef.current = result.text;
        selectionRef.current = result.selection;
        commit(result.text);
        setPending(result.selection);
      },
      [commit]
    );

    const context = useMemo<MarkdownEditorContextValue>(
      () => ({
        value,
        mode,
        setMode,
        run,
        pending,
        setSelection: (selection) => {
          selectionRef.current = selection;
        },
        clearPending: () => setPending(undefined),
        onChangeText: (next) => {
          valueRef.current = next;
          commit(next);
        },
        disabled,
      }),
      [value, mode, setMode, run, pending, commit, disabled]
    );

    return (
      <MarkdownEditorContext.Provider value={context}>
        <View ref={ref} className={slots.root({ className })} {...props}>
          {children ?? (
            <>
              <MarkdownEditorToolbar />
              <MarkdownEditorInput placeholder={placeholder} rows={rows} />
              <MarkdownEditorPreview />
            </>
          )}
        </View>
      </MarkdownEditorContext.Provider>
    );
  }
);

MarkdownEditorRoot.displayName = 'MarkdownEditor';

/* -------------------------------------------------------------------------- *
 * Toolbar
 * -------------------------------------------------------------------------- */

export interface MarkdownEditorToolbarProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /** Which formatting actions to offer, in the order given. */
  actions?: MarkdownEditorAction[];
  /**
   * Show the write/preview switch. On by default — a preview nobody can reach
   * is a pane that does not exist.
   */
  showModeSwitch?: boolean;
  /** Anything else to put on the row: a word count, a save state, a submit. */
  children?: ReactNode;
}

/**
 * The formatting actions, and the switch between writing and reading.
 *
 * The formatting run is hidden rather than disabled while previewing. Its
 * buttons act on a selection, and in the preview there is no selection for them
 * to act on — a row of controls that are present but inert is a row that has to
 * be tried before it can be understood.
 */
const MarkdownEditorToolbar = forwardRef<View, MarkdownEditorToolbarProps>(
  ({ className, actions = DEFAULT_ACTIONS, showModeSwitch = true, children, ...props }, ref) => {
    const { mode, setMode, run, disabled } = useMarkdownEditor('MarkdownEditor.Toolbar');
    const slots = markdownEditorVariants();

    return (
      <View ref={ref} className={slots.toolbar({ className })} {...props}>
        {mode === 'write' ? (
          <ButtonGroup variant="ghost" size="sm" className="shrink">
            {actions.map((action) => (
              <Button
                key={action}
                accessibilityLabel={ACTIONS[action].label}
                disabled={disabled}
                onPress={() => run(action)}
                className="px-2"
              >
                {ACTIONS[action].icon(16)}
              </Button>
            ))}
          </ButtonGroup>
        ) : (
          <View className="shrink" />
        )}

        <View className="flex-row items-center gap-2">
          {children}
          {showModeSwitch ? (
            <ButtonGroup size="sm">
              <Button
                variant={mode === 'write' ? 'secondary' : 'ghost'}
                startContent={<PencilIcon size={14} />}
                onPress={() => setMode('write')}
              >
                Write
              </Button>
              <Button
                variant={mode === 'preview' ? 'secondary' : 'ghost'}
                startContent={<EyeIcon size={14} />}
                onPress={() => setMode('preview')}
              >
                Preview
              </Button>
            </ButtonGroup>
          ) : null}
        </View>
      </View>
    );
  }
);

MarkdownEditorToolbar.displayName = 'MarkdownEditor.Toolbar';

/* -------------------------------------------------------------------------- *
 * Input
 * -------------------------------------------------------------------------- */

export interface MarkdownEditorInputProps
  extends Omit<TextareaProps, 'value' | 'onChangeText' | 'defaultValue'> {
  className?: string;
}

/**
 * The field the markdown is written in — a `Textarea`, tracking its selection.
 *
 * Renders nothing while the preview is up. Unmounted rather than hidden: a
 * field kept alive behind the preview keeps the keyboard up with it.
 */
const MarkdownEditorInput = forwardRef<TextInput, MarkdownEditorInputProps>(
  ({ className, rows = 8, ...props }, ref) => {
    const { value, mode, pending, setSelection, clearPending, onChangeText, disabled } =
      useMarkdownEditor('MarkdownEditor.Input');

    const handleSelectionChange = useCallback(
      (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
        setSelection(event.nativeEvent.selection);
        // The edit's own selection has now landed, so stop forcing it and give
        // the caret back to whoever is holding the phone.
        clearPending();
      },
      [setSelection, clearPending]
    );

    if (mode !== 'write') return null;

    return (
      <Textarea
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        selection={pending}
        onSelectionChange={handleSelectionChange}
        disabled={disabled}
        rows={rows}
        autoCapitalize="none"
        autoCorrect={false}
        // A markdown source is code as much as it is prose: an editor that
        // capitalises the word after a fence, or rewrites a dash into an
        // en dash, is an editor that changes what the document renders as.
        className={cn('font-mono', className)}
        {...props}
      />
    );
  }
);

MarkdownEditorInput.displayName = 'MarkdownEditor.Input';

/* -------------------------------------------------------------------------- *
 * Preview
 * -------------------------------------------------------------------------- */

export interface MarkdownEditorPreviewProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /** What to show when there is nothing written yet. */
  emptyText?: string;
}

/**
 * The draft, rendered.
 *
 * Renders nothing while the field is up, which is what makes the two one pane
 * rather than two.
 */
const MarkdownEditorPreview = forwardRef<View, MarkdownEditorPreviewProps>(
  ({ className, emptyText = 'Nothing to preview yet.', ...props }, ref) => {
    const { value, mode } = useMarkdownEditor('MarkdownEditor.Preview');
    const slots = markdownEditorVariants();

    if (mode !== 'preview') return null;

    return (
      <View ref={ref} className={slots.preview({ className })} {...props}>
        {value.trim() ? (
          <Response>{value}</Response>
        ) : (
          <Text size="sm" muted className={slots.empty()}>
            {emptyText}
          </Text>
        )}
      </View>
    );
  }
);

MarkdownEditorPreview.displayName = 'MarkdownEditor.Preview';

export const MarkdownEditor = Object.assign(MarkdownEditorRoot, {
  Toolbar: MarkdownEditorToolbar,
  Input: MarkdownEditorInput,
  Preview: MarkdownEditorPreview,
});
