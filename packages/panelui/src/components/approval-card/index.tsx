/**
 * ApprovalCard — where an agent stops and waits for a person.
 *
 * ```tsx
 * <ApprovalCard
 *   title="Apply these changes?"
 *   description="Six files, one migration."
 *   onApprove={apply}
 *   onReject={discard}
 * />
 * ```
 *
 * Two shapes in one component, because they are the same moment: a single
 * approve-or-reject decision, and a short run of questions the agent needs
 * answering before it can carry on. Pass `questions` for the second.
 *
 * ## Why it does not fold away
 *
 * The card stays in the transcript after it is answered, showing what was
 * decided. An approval that disappears leaves a conversation in which
 * something clearly happened and nothing says what — and the reader who comes
 * back to it an hour later is the one who most needs to know.
 *
 * What does go away is the machinery: the options, the fields and the buttons
 * collapse once there is nothing left to do with them, and the result takes
 * their place.
 *
 * ## One question at a time
 *
 * A run of questions is stepped rather than listed. Listed, the reader is
 * answering a form; stepped, they are having a conversation, which is what the
 * surrounding transcript already is. A single-choice question advances itself
 * shortly after it is answered — long enough for the choice to register as
 * having been made, short enough not to need a second tap.
 *
 * ## It is built out of the library
 *
 * RadioGroup, Checkbox, Input and Button, not redrawn versions of them. An
 * approval that styles its own radio is one that stops matching the app's
 * radios the first time either changes.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { View, type ViewProps } from 'react-native';
import { tv } from 'tailwind-variants';
import { Collapse } from '../../primitives/collapse';
import { useControllableState } from '../../primitives/controllable-state';
import { Text } from '../../primitives/text';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  InfoIcon,
  MessageCircleIcon,
  XIcon,
} from '../../icons';
import { cn } from '../../utils/cn';
import { Button } from '../button';
import { Checkbox } from '../checkbox';
import { Input } from '../input';
import { RadioGroup } from '../radio-group';
import { Spinner } from '../spinner';
import type {
  ApprovalCardAnswer,
  ApprovalCardAnswers,
  ApprovalCardQuestion,
  ApprovalCardStatus,
} from './types';

export type {
  ApprovalCardAnswer,
  ApprovalCardAnswers,
  ApprovalCardOption,
  ApprovalCardQuestion,
  ApprovalCardStatus,
} from './types';

/**
 * How long a single-choice question waits before moving on.
 *
 * Long enough for the disc to fill and be seen filling, short enough that it
 * reads as the card responding rather than as a delay. Advancing on the same
 * frame as the tap makes the choice look like it was not registered.
 */
const AUTO_ADVANCE_DELAY = 240;

const EMPTY_ANSWER: ApprovalCardAnswer = { selected: [] };

const approvalCardVariants = tv({
  slots: {
    root: 'w-full gap-3 rounded-2xl bg-muted p-4',
    header: 'flex-row items-start gap-3',
    mark: 'mt-0.5 h-5 w-5 items-center justify-center',
    heading: 'min-w-0 flex-1 gap-1',
    title: 'text-base font-medium text-foreground',
    description: 'text-sm text-muted-foreground',
    badge: 'shrink-0 rounded-full border px-2 py-0.5',
    badgeLabel: 'text-[11px] font-medium',
    counter: 'shrink-0 text-xs text-muted-foreground',
    body: 'gap-3 ps-8',
    actions: 'flex-row flex-wrap items-center gap-2 ps-8',
    steps: 'flex-row items-center gap-3 ps-8',
    dots: 'flex-1 flex-row items-center justify-center gap-1.5',
    dot: 'h-1.5 w-1.5 rounded-full bg-foreground',
    result: 'ps-8 text-sm text-muted-foreground',
  },
  variants: {
    status: {
      pending: {
        badge: 'border-warning/30 bg-warning/10',
        badgeLabel: 'text-warning',
        mark: 'text-muted-foreground',
      },
      submitting: {
        badge: 'border-info/30 bg-info/10',
        badgeLabel: 'text-info',
      },
      approved: {
        badge: 'border-success/30 bg-success/10',
        badgeLabel: 'text-success',
      },
      answered: {
        badge: 'border-success/30 bg-success/10',
        badgeLabel: 'text-success',
      },
      rejected: {
        badge: 'border-destructive/30 bg-destructive/10',
        badgeLabel: 'text-destructive',
      },
      'changes-requested': {
        badge: 'border-warning/30 bg-warning/10',
        badgeLabel: 'text-warning',
      },
    },
  },
  defaultVariants: {
    status: 'pending',
  },
});

const STATUS_LABEL: Record<ApprovalCardStatus, string> = {
  pending: 'Input required',
  submitting: 'Submitting',
  approved: 'Approved',
  rejected: 'Rejected',
  'changes-requested': 'Changes requested',
  answered: 'Response submitted',
};

/** Whether a question has been answered well enough to move past. */
function isAnswered(answer: ApprovalCardAnswer): boolean {
  return answer.selected.length > 0 || Boolean(answer.custom?.trim());
}

export interface ApprovalCardProps extends Omit<ViewProps, 'children'> {
  className?: string;
  /** What is being asked. Replaced by the current question's own title. */
  title?: ReactNode;
  /** A line under the title, for context the title cannot carry. */
  description?: ReactNode;
  /** What is being approved — a diff, a summary, a preview. Approval mode only. */
  children?: ReactNode;
  /** Turns the card into a stepped run of questions. */
  questions?: ApprovalCardQuestion[];
  /** Where the decision has got to. Defaults to `pending`. */
  status?: ApprovalCardStatus;
  /** Controlled answers, by question id. */
  answers?: ApprovalCardAnswers;
  /** Starting answers while uncontrolled. */
  defaultAnswers?: ApprovalCardAnswers;
  /** Fires whenever an answer changes. */
  onAnswersChange?: (answers: ApprovalCardAnswers) => void;
  /** Controlled question index. */
  step?: number;
  /** Starting question index while uncontrolled. Defaults to `0`. */
  defaultStep?: number;
  /** Fires when the reader moves between questions. */
  onStepChange?: (step: number) => void;
  /** Fires with every answer once the last question is confirmed. */
  onSubmit?: (answers: ApprovalCardAnswers) => void;
  /** Approval mode. Without it there is no approve button. */
  onApprove?: () => void;
  /** Approval mode. Without it there is no reject button. */
  onReject?: () => void;
  /** Approval mode. Without it there is no request-changes button. */
  onRequestChanges?: () => void;
  /** Adds a dismiss control to the header. */
  onDismiss?: () => void;
  /** Text on the approve button. Defaults to `Approve`. */
  approveLabel?: string;
  /** Text on the last question's confirm button. Defaults to `Submit`. */
  submitLabel?: string;
  /** What is shown once there is nothing left to do. Defaults to the status. */
  result?: ReactNode;
}

function ApprovalCardRoot({
  className,
  title = 'Approval required',
  description,
  children,
  questions,
  status = 'pending',
  answers,
  defaultAnswers,
  onAnswersChange,
  step,
  defaultStep = 0,
  onStepChange,
  onSubmit,
  onApprove,
  onReject,
  onRequestChanges,
  onDismiss,
  approveLabel = 'Approve',
  submitLabel = 'Submit',
  result,
  ...props
}: ApprovalCardProps) {
  const questionList = questions ?? [];
  const asQuestions = questionList.length > 0;
  const busy = status === 'submitting';
  const open = status === 'pending' || busy;

  const { value: currentAnswers, setValue: setAnswers } = useControllableState<
    ApprovalCardAnswers
  >({
    value: answers,
    defaultValue: defaultAnswers ?? {},
    onChange: onAnswersChange,
  });

  const { value: rawStep, setValue: setStepValue } = useControllableState<number>({
    value: step,
    defaultValue: defaultStep,
    onChange: onStepChange,
  });

  // Clamped rather than trusted: a caller can shorten `questions` while a later
  // step is showing, and an index past the end renders an empty card.
  const currentStep = Math.min(Math.max(0, rawStep), Math.max(0, questionList.length - 1));
  const question = asQuestions ? questionList[currentStep] : undefined;
  const answer = question ? (currentAnswers[question.id] ?? EMPTY_ANSWER) : EMPTY_ANSWER;
  const last = currentStep === questionList.length - 1;

  const advanceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clearAdvance = useCallback(() => {
    if (advanceTimer.current === undefined) return;
    clearTimeout(advanceTimer.current);
    advanceTimer.current = undefined;
  }, []);
  useEffect(() => clearAdvance, [clearAdvance]);

  const goTo = useCallback(
    (next: number) => {
      clearAdvance();
      setStepValue(next);
    },
    [clearAdvance, setStepValue]
  );

  const answerCurrent = useCallback(
    (next: ApprovalCardAnswer) => {
      if (!question) return;
      setAnswers({ ...currentAnswers, [question.id]: next });
    },
    [currentAnswers, question, setAnswers]
  );

  const confirm = useCallback(() => {
    if (!last) {
      goTo(currentStep + 1);
      return;
    }
    clearAdvance();
    onSubmit?.(currentAnswers);
  }, [clearAdvance, currentAnswers, currentStep, goTo, last, onSubmit]);

  /*
   * A single choice moves on by itself. Multiple-choice cannot — the reader is
   * still adding to the answer — and neither can the last question, where
   * moving on means submitting, which nobody should do without meaning to.
   */
  const queueAdvance = useCallback(() => {
    if (!question || question.multiple || question.autoAdvance === false || last || busy) return;
    clearAdvance();
    advanceTimer.current = setTimeout(() => goTo(currentStep + 1), AUTO_ADVANCE_DELAY);
  }, [busy, clearAdvance, currentStep, goTo, last, question]);

  const slots = approvalCardVariants({ status });
  const statusLabel = STATUS_LABEL[status];
  const heading = question?.title ?? title;

  const mark = busy ? (
    <Spinner size="sm" />
  ) : status === 'approved' || status === 'answered' ? (
    <CheckCircleIcon size={18} />
  ) : status === 'rejected' ? (
    <AlertTriangleIcon size={18} />
  ) : asQuestions ? (
    <InfoIcon size={18} />
  ) : (
    <MessageCircleIcon size={18} />
  );

  return (
    <View {...props} className={slots.root({ className })}>
      <View className={slots.header()}>
        <View className={slots.mark()}>{mark}</View>

        <View className={slots.heading()}>
          <Text className={slots.title()}>{heading}</Text>
          {question?.description ? (
            <Text className={slots.description()}>{question.description}</Text>
          ) : !asQuestions && description ? (
            <Text className={slots.description()}>{description}</Text>
          ) : null}
        </View>

        {/* A counter while there are questions left, a verdict once there are
            not. Both at once would be two answers to "where am I". */}
        {asQuestions && open ? (
          <Text className={slots.counter()}>
            {currentStep + 1}/{questionList.length}
          </Text>
        ) : (
          <View className={slots.badge()}>
            <Text className={slots.badgeLabel()}>{statusLabel}</Text>
          </View>
        )}

        {onDismiss ? (
          <Button
            variant="ghost"
            size="icon"
            accessibilityLabel="Dismiss"
            onPress={onDismiss}
            className="h-6 w-6 shrink-0 rounded-full"
          >
            <XIcon size={14} />
          </Button>
        ) : null}
      </View>

      <Collapse open={open}>
        <View className="gap-3">
          {asQuestions && question ? (
            <View className={slots.body()}>
              <QuestionBody
                question={question}
                answer={answer}
                disabled={busy}
                onChange={answerCurrent}
                onChoose={queueAdvance}
              />
            </View>
          ) : children ? (
            <View className={slots.body()}>{children}</View>
          ) : null}

          {asQuestions ? (
            <View className={slots.steps()}>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy || currentStep === 0}
                onPress={() => goTo(currentStep - 1)}
              >
                Back
              </Button>
              {/* One label for the whole row, on the row. A screen reader has
                  no way to read a dot, and eight of them announced one at a
                  time is noise standing in for a number. */}
              <View
                accessible
                accessibilityLabel={`Question ${currentStep + 1} of ${questionList.length}`}
                className={slots.dots()}
              >
                {questionList.map((item, index) => (
                  <View
                    key={item.id}
                    className={cn(
                      slots.dot(),
                      index === currentStep ? 'opacity-100' : 'opacity-30'
                    )}
                  />
                ))}
              </View>
              <Button
                size="sm"
                disabled={busy || !isAnswered(answer)}
                onPress={confirm}
              >
                {last ? submitLabel : 'Next'}
              </Button>
            </View>
          ) : (
            <View className={slots.actions()}>
              {onApprove ? (
                <Button size="sm" disabled={busy} onPress={onApprove}>
                  {approveLabel}
                </Button>
              ) : null}
              {onRequestChanges ? (
                <Button variant="secondary" size="sm" disabled={busy} onPress={onRequestChanges}>
                  Request changes
                </Button>
              ) : null}
              {onReject ? (
                <Button variant="ghost" size="sm" disabled={busy} onPress={onReject}>
                  Reject
                </Button>
              ) : null}
            </View>
          )}
        </View>
      </Collapse>

      {open ? null : (
        <Text accessibilityLiveRegion="polite" className={slots.result()}>
          {result ?? statusLabel}
        </Text>
      )}
    </View>
  );
}

/** The choices for one question — discs, boxes, a field, or a field alone. */
function QuestionBody({
  question,
  answer,
  disabled,
  onChange,
  onChoose,
}: {
  question: ApprovalCardQuestion;
  answer: ApprovalCardAnswer;
  disabled: boolean;
  onChange: (answer: ApprovalCardAnswer) => void;
  onChoose: () => void;
}) {
  const options = question.options ?? [];
  const custom = answer.custom ?? '';

  return (
    <View className="gap-2">
      {options.length > 0 ? (
        question.multiple ? (
          <View className="gap-1">
            {options.map((option) => (
              <Checkbox
                key={option.value}
                checked={answer.selected.includes(option.value)}
                disabled={disabled || option.disabled}
                label={option.label}
                description={option.description}
                onCheckedChange={(checked) =>
                  onChange({
                    ...answer,
                    selected: checked
                      ? [...answer.selected, option.value]
                      : answer.selected.filter((value) => value !== option.value),
                  })
                }
              />
            ))}
          </View>
        ) : (
          <RadioGroup
            value={answer.selected[0]}
            disabled={disabled}
            onValueChange={(value) => {
              // A custom answer and a listed one are alternatives, so choosing
              // from the list clears the field rather than sending both.
              onChange({ selected: [value], custom: '' });
              onChoose();
            }}
          >
            {options.map((option) => (
              <RadioGroup.Item
                key={option.value}
                value={option.value}
                label={option.label}
                description={option.description}
                disabled={option.disabled}
              />
            ))}
          </RadioGroup>
        )
      ) : null}

      {question.allowCustom ? (
        <Input
          value={custom}
          disabled={disabled}
          placeholder={question.customPlaceholder ?? 'Something else…'}
          onChangeText={(text) =>
            onChange({
              // Typing replaces a single choice and sits alongside multiple
              // ones, matching what each kind of question means.
              selected: question.multiple ? answer.selected : [],
              custom: text,
            })
          }
        />
      ) : null}
    </View>
  );
}

ApprovalCardRoot.displayName = 'ApprovalCard';

export const ApprovalCard = ApprovalCardRoot;
