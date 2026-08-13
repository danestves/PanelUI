export type SignatureChangeKind = 'draw' | 'undo' | 'redo' | 'clear';

export interface SignatureAccessibilityAction {
  name: string;
  label: string;
}

/**
 * What the pad reads as when it is focused.
 *
 * It counts strokes and says nothing about whether the signature is finished,
 * because the component cannot know that — one mark may be the whole signature
 * or the first letter of it. Announcing "complete" after the first stroke tells
 * somebody who cannot see the pad that they are done when they may not be.
 */
export function signatureAccessibilityValue(strokeCount: number) {
  return {
    text:
      strokeCount === 0
        ? 'Empty signature'
        : `Signed, ${strokeCount} ${strokeCount === 1 ? 'stroke' : 'strokes'}`,
  };
}

export function signatureAccessibilityActions(
  strokeCount: number,
  undoneCount: number,
  alternative: boolean,
  disabled: boolean
): SignatureAccessibilityAction[] {
  if (disabled) return [];

  const actions: SignatureAccessibilityAction[] = [];
  if (strokeCount > 0) {
    actions.push(
      { name: 'signature-undo', label: 'Undo last stroke' },
      { name: 'signature-clear', label: 'Clear signature' }
    );
  }
  if (undoneCount > 0) {
    actions.push({ name: 'signature-redo', label: 'Redo last stroke' });
  }
  if (alternative) {
    actions.push({ name: 'signature-alternative', label: 'Use another signature method' });
  }
  return actions;
}

/**
 * Spoken when the pad crosses between empty and not, and nowhere else.
 *
 * Every stroke is silent on purpose: a running commentary during drawing is
 * noise over the one gesture the reader is concentrating on. The two crossings
 * are the ones that cannot be felt — that the pad now holds something, and that
 * it no longer does.
 */
export function signatureAnnouncement(
  previousCount: number,
  strokeCount: number,
  change: SignatureChangeKind
): string | null {
  if (previousCount === strokeCount) return null;
  if (change === 'clear') return 'Signature cleared. Signature is empty.';
  if (strokeCount === 0) return 'Signature is empty.';
  if (previousCount === 0) return 'Signature started.';
  return null;
}
