import type { ReactNode } from 'react';

/** Where a decision has got to. */
export type ApprovalCardStatus =
  | 'pending'
  | 'submitting'
  | 'approved'
  | 'rejected'
  | 'changes-requested'
  | 'answered';

/** One choice within a question. */
export interface ApprovalCardOption {
  /** What is reported when this option is chosen. */
  value: string;
  /** What the reader sees. */
  label: string;
  /** Secondary line under the label. */
  description?: string;
  /** Shown but unselectable. */
  disabled?: boolean;
}

/** One thing the agent needs answering before it goes on. */
export interface ApprovalCardQuestion {
  /** Identifies the answer. Must be unique within the card. */
  id: string;
  /** The question itself. Replaces the card's `title` while it is showing. */
  title: ReactNode;
  /** A line under the question, for context the title cannot carry. */
  description?: ReactNode;
  /** The choices. Without any, the question is a free-text one. */
  options?: ApprovalCardOption[];
  /** Allow more than one choice, drawn as checkboxes rather than discs. */
  multiple?: boolean;
  /**
   * Move to the next question a moment after a single choice is made. On by
   * default for single-choice questions; set `false` to make the reader
   * confirm each one.
   */
  autoAdvance?: boolean;
  /** Offer a field for an answer that is not on the list. */
  allowCustom?: boolean;
  /** Placeholder for that field. */
  customPlaceholder?: string;
}

/** What was chosen for one question. */
export interface ApprovalCardAnswer {
  /** The `value`s chosen. One entry unless the question is `multiple`. */
  selected: string[];
  /** What was typed, when the question allows a custom answer. */
  custom?: string;
}

/** Every answer on the card, by question id. */
export type ApprovalCardAnswers = Record<string, ApprovalCardAnswer>;
