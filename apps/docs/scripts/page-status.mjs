/**
 * Shared by every generator that writes a docs page: the frontmatter scalar
 * rule and the sidebar mark a page carries. One copy, so a component page and a
 * block page cannot disagree about when a "new" dot comes off.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/**
 * A summary as a YAML scalar the frontmatter parser will accept.
 *
 * A plain scalar ends at the first `: `, so a perfectly ordinary summary — "A
 * prompt composer: a field that grows" — turns the rest of the line into a
 * mapping key and fails the whole build. It fails at `next build` rather than
 * here, which is after the drift check has already passed and, at release
 * time, after the tag exists.
 *
 * Quoted only when it has to be, so the frontmatter of the other pages does
 * not churn.
 */
export function yamlScalar(value) {
  const unsafe = /^[-?:,[\]{}#&*!|>'"%@`]|: |:$| #/.test(value);
  return unsafe ? JSON.stringify(value) : value;
}

/** The version being documented, for the sidebar dots below. */
const libVersion = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'packages/panelui/package.json'), 'utf8')
).version;

/**
 * How many minor releases a mark survives, per mark.
 *
 * Deriving this from a version rather than hand-writing a `status` field means
 * nobody has to remember to take the badge off — which is the failure mode
 * every "new" marker has, and the reason half of them end up permanent.
 *
 * The two are not on the same schedule, because they are not the same news. A
 * component arriving is worth knowing about for a while, whoever you are, so
 * `new` runs for three. A component *changing* is only worth knowing about if
 * you already have it and have not upgraded yet, and that audience has moved on
 * by the next release — so `updated` runs for one, and is gone the moment
 * anything else ships. Held for three it was on so many rows at once that it
 * stopped pointing at anything.
 */
const BADGE_FOR_MINORS = { new: 3, updated: 1 };

/**
 * True while `version` is recent enough to still be worth marking.
 *
 * `current` is the version of the package the page documents. It is the
 * library's unless the caller says otherwise, which the web collection does:
 * it is versioned on its own, and a component added in its 0.1.0 is not six
 * releases old because the library happens to be at 0.109.
 */
function isRecent(version, mark, current) {
  if (!version) return false;
  const [thenMajor, thenMinor] = version.split('.').map(Number);
  const [major, minor] = current.split('.').map(Number);
  if (major !== thenMajor) return major < thenMajor;
  return minor - thenMinor < BADGE_FOR_MINORS[mark];
}

/** `x.y.z`, the only shape `addedIn` and `updatedIn` are compared as. */
const VERSION = /^\d+\.\d+\.\d+$/;

/**
 * Turn a mistyped mark into a failed generation rather than a wrong sidebar.
 *
 * Both failures are silent otherwise. `"0.2"` or `"v0.2.0"` splits into numbers
 * that compare as something, so the dot lands on the wrong releases with nothing
 * to say why; and an `updatedIn` older than its `addedIn` can never show, because
 * the "new" window covers it, which reads as the field being ignored.
 */
function checkMarks({ addedIn, updatedIn }, label) {
  for (const [key, value] of [['addedIn', addedIn], ['updatedIn', updatedIn]]) {
    if (value !== undefined && !VERSION.test(String(value))) {
      throw new Error(`${label}: ${key} "${value}" is not a version — write it as x.y.z.`);
    }
  }
  if (addedIn && updatedIn) {
    const [a, b] = [addedIn, updatedIn].map((v) => v.split('.').map(Number));
    const older = a[0] !== b[0] ? b[0] < a[0] : a[1] !== b[1] ? b[1] < a[1] : b[2] < a[2];
    if (older) {
      throw new Error(`${label}: updatedIn ${updatedIn} is older than addedIn ${addedIn}.`);
    }
  }
}

/**
 * Which dot a component gets, if any.
 *
 * `addedIn` wins over `updatedIn`: a component that arrived and then changed
 * inside the same window is still news, and two marks on one row is noise.
 * `updatedIn` is bumped by hand when a component's API changes, and forgetting
 * to clear it costs nothing — it clears itself at the next release.
 */
export function statusOf(options, current = libVersion, label = 'page') {
  checkMarks(options, label);
  const { alpha, beta, addedIn, updatedIn } = options;
  // `alpha` and `beta` win and never expire: they state how settled the API
  // is, not which release it landed in, so they come off the page when someone
  // decides it has settled and not a version sooner. Alpha outranks beta so a
  // half-finished promotion reads as the more cautious of the two.
  if (alpha) return 'alpha';
  if (beta) return 'beta';
  if (isRecent(addedIn, 'new', current)) return 'new';
  if (isRecent(updatedIn, 'updated', current)) return 'updated';
  return null;
}
