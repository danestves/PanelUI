import { fetchRepositoryInfo } from 'fumadocs-ui/components/github-info';

const OWNER = 'panel-ui';
const REPO = 'PanelUI';

/**
 * Contents for the GitHub navigation link, with a star count.
 *
 * The count is best-effort: `fetchRepositoryInfo` calls the public GitHub API,
 * which 404s while the repository is private. Rather than break the navbar,
 * the link falls back to a bare icon and starts showing a count on its own
 * once the repo is public.
 *
 * `cache: 'force-cache'` is load-bearing, not an optimisation. This component
 * renders in the shared nav that wraps every page, so its data dependency
 * decides how the whole tree is rendered. Left to its default the fetch
 * revalidates on a short timer, which pulls every page into ISR and rewrites
 * it to the cache on each crawl — a static docs site would then bill a steady
 * stream of ISR writes for a number that barely moves. Caching the fetch
 * permanently keeps the pages statically prerendered; the count refreshes when
 * the data cache is purged.
 */
export async function GithubStars() {
  let stars: number | null = null;

  try {
    const info = await fetchRepositoryInfo({
      owner: OWNER,
      repo: REPO,
      token: process.env.GITHUB_TOKEN,
      fetchOptions: { cache: 'force-cache' },
    });
    stars = info.stars;
  } catch {
    stars = null;
  }

  return (
    /*
     * The row is drawn here rather than left to whatever renders this.
     *
     * Preflight sets `svg { display: block }`, so a mark and a number dropped
     * loose into a link break onto two lines unless something above them is a
     * flex container. One of the two navbars styles this link as a button and
     * gets that for free; the other styles it as plain text and does not — and
     * the docs pages spent a release with the GitHub mark sitting on top of
     * the star count. Owning the row here is what makes the contents render
     * the same wherever the link is used.
     */
    <span className="inline-flex items-center gap-1.5">
      <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
        <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2 0-.4-.5-1.6.2-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.6.2 2.8.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
      </svg>
      <span className="sr-only">GitHub repository</span>
      {stars === null ? null : (
        <span className="tabular-nums" aria-label={`${stars} stars`}>
          {formatStars(stars)}
        </span>
      )}
    </span>
  );
}

/** 1200 → "1.2k", matching how GitHub itself abbreviates. */
function formatStars(count: number): string {
  if (count < 1000) return String(count);
  return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
}
