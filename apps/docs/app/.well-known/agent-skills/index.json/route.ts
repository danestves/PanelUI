import skills from '@/lib/skills.generated.json';
import { absoluteUrl } from '@/lib/site';

/**
 * The Agent Skills discovery index (RFC v0.2.0).
 *
 * The skill itself is written in this repository and copied under `public/` by
 * `scripts/build-skill-assets.mjs`, which also computes the digests below. A
 * hash written by hand would be wrong the first time anybody edited the file it
 * describes — and one of the skill's files is regenerated from `meta.json` on
 * every `docs:generate`, so it changes whenever a component is added.
 *
 * URLs are made absolute here rather than in the generator, so a preview
 * deploy's index points at the preview's own copy instead of at production's.
 */
export const dynamic = 'force-static';

export function GET(): Response {
  const index = {
    $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    skills: skills.map((skill) => ({
      name: skill.name,
      type: skill.type,
      description: skill.description,
      url: absoluteUrl(skill.path),
      digest: skill.digest,
    })),
  };

  return new Response(JSON.stringify(index, null, 2) + '\n', {
    headers: { 'Content-Type': 'application/json' },
  });
}
