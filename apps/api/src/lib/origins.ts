/**
 * Which browser origins this API answers, and which of them may have minted
 * the session tokens it accepts.
 *
 * `WEB_ORIGIN` is a comma-separated list of exact origins, and it cannot
 * describe a Vercel preview: every push produces a new deployment hostname, so
 * the origin a pull request preview calls from does not exist when the variable
 * is set. `WEB_ORIGIN_PREVIEW` fills that gap with comma-separated glob
 * patterns, e.g. `https://runway-*-acme.vercel.app`.
 *
 * `*` stands for one or more characters inside a single hostname label and
 * never matches a dot, so that pattern cannot be satisfied by
 * `https://runway-evil.attacker.com-acme.vercel.app`. Only Vercel can serve a
 * hostname of that shape, and only for the project and team named in it, so the
 * pattern bounds the trusted set to deployments of this project rather than
 * opening the API to any origin.
 *
 * Leave `WEB_ORIGIN_PREVIEW` unset in production, where the web origin is known
 * and fixed.
 */

/** The origin the API answers when nothing is configured: the local dev web app. */
const LOCAL_DEV_ORIGIN = 'http://localhost:3000';

export type OriginRules = {
  /** Exactly what `WEB_ORIGIN` named. Empty when it is unset or blank. */
  configured: string[];
  /** Compiled `WEB_ORIGIN_PREVIEW` globs. Empty when it is unset or blank. */
  patterns: RegExp[];
};

function commaList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Compile one glob. Everything is escaped first, so only `*` is special, and it
 * becomes a run of label characters — never a dot, and never empty.
 */
function compileGlob(glob: string): RegExp {
  const escaped = glob.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.split('\\*').join('[A-Za-z0-9-]+')}$`, 'i');
}

export function originRules(env: {WEB_ORIGIN?: string; WEB_ORIGIN_PREVIEW?: string}): OriginRules {
  return {
    configured: commaList(env.WEB_ORIGIN),
    patterns: commaList(env.WEB_ORIGIN_PREVIEW).map(compileGlob),
  };
}

function matchesPattern(origin: string, rules: OriginRules): boolean {
  return rules.patterns.some((pattern) => pattern.test(origin));
}

/**
 * Whether a browser at `origin` may call this API. With nothing configured at
 * all, only the local dev web app is allowed — the same default this API has
 * always had for `WEB_ORIGIN`.
 */
export function isAllowedOrigin(origin: string | undefined | null, rules: OriginRules): boolean {
  if (!origin) return false;
  if (rules.configured.length === 0 && rules.patterns.length === 0) {
    return origin === LOCAL_DEV_ORIGIN;
  }
  const lower = origin.toLowerCase();
  if (rules.configured.some((allowed) => allowed.toLowerCase() === lower)) return true;
  return matchesPattern(origin, rules);
}

/**
 * The origins Clerk will accept as a token's authorized party, for one request.
 *
 * A preview's origin is added only when it matches a pattern, so Clerk still
 * receives exact strings and still rejects a token minted anywhere else — a
 * token from a page at `evil.example` carries that as its `azp` and matches
 * nothing here. An empty result means the caller should omit
 * `authorizedParties` entirely, which is what this API has always done when
 * `WEB_ORIGIN` is unset.
 */
export function authorizedPartiesFor(
  origin: string | undefined | null,
  rules: OriginRules,
): string[] {
  const parties = [...rules.configured];
  if (origin && matchesPattern(origin, rules) && !parties.includes(origin)) {
    parties.push(origin);
  }
  return parties;
}
