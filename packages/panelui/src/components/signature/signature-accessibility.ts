export type SignatureChangeKind = 'draw' | 'undo' | 'redo' | 'clear';

export interface SignatureAccessibilityAction {
  name: string;
  label: string;
}

export function signatureAccessibilityValue(strokeCount: number) {
  return {
    text:
      strokeCount === 0
        ? 'Empty signature'
        : `Signature complete, ${strokeCount} ${strokeCount === 1 ? 'stroke' : 'strokes'}`,
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

export function signatureAnnouncement(
  previousCount: number,
  strokeCount: number,
  change: SignatureChangeKind
): string | null {
  if (previousCount === strokeCount) return null;
  if (change === 'clear') return 'Signature cleared. Signature is empty.';
  if (strokeCount === 0) return 'Signature is empty.';
  if (previousCount === 0) return 'Signature completed.';
  return null;
}
