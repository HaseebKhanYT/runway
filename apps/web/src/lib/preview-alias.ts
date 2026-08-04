/**
 * Preview deployments are reachable by two hostnames: the immutable
 * per-deployment URL, `runway-<hash>-<scope>.vercel.app`, and the branch alias,
 * `runway-git-<branch>-<scope>.vercel.app`. Only the alias is in the staging
 * API's `WEB_ORIGIN`, and only the alias can be — a new deployment hostname
 * exists after every push.
 *
 * GitHub's deployment links and the Vercel dashboard both point at the
 * deployment hostname, because that is what a deployment *is*. Opening one
 * gives a shell that renders and then has every API call blocked. This module
 * decides when to send such a request to the alias instead, so the link that
 * GitHub shows lands somewhere that works.
 */

export type PreviewEnv = {
  /** `VERCEL_ENV` — `preview`, `production`, or unset outside Vercel. */
  vercelEnv: string | undefined;
  /** `VERCEL_BRANCH_URL` — the branch alias hostname, without a scheme. */
  branchHost: string | undefined;
};

/**
 * Where this request should be instead, or `null` to leave it alone.
 *
 * Only preview deployments are redirected: production is served from its own
 * domain, and locally neither variable is set. `pathAndQuery` is carried over
 * untouched so a deep link survives the hop.
 */
export function branchAliasRedirect(
  host: string | null,
  pathAndQuery: string,
  env: PreviewEnv,
): string | null {
  if (env.vercelEnv !== 'preview') return null;

  // Defensive: the variable is documented as a bare hostname, and a scheme in
  // it would otherwise produce `https://https://…`.
  const branchHost = (env.branchHost ?? '').trim().replace(/^https?:\/\//, '');
  if (!branchHost) return null;
  if (!host) return null;

  // Hostnames are case-insensitive, and a redirect to the host we are already
  // on is a loop.
  if (host.toLowerCase() === branchHost.toLowerCase()) return null;

  return `https://${branchHost}${pathAndQuery}`;
}
