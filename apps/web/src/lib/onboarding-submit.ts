/**
 * What a refused `POST /onboarding/complete` was, and how to say it.
 *
 * The step-5 button read only `complete.isPending`, so a schema rejection, an
 * expired sign-in, a 500 and an API that never answered all presented the same
 * way: a button that did nothing (#54). Nothing had to be fetched to fix that
 * — `ApiError` already carries the kind, the status and the response body, and
 * a Zod rejection already carries the path of the answer it refused along with
 * a sentence explaining it. All of it was simply unread at the render site.
 *
 * The judging lives here rather than in the component because `apps/web` has
 * no jsdom and its vitest config collects only files under `test/`, so a pure
 * function is the only part of a refusal that can be covered by a test.
 */

import {ApiError} from './api-error';

/** A headline and a supporting line, both ready to render. */
export type SubmitFailure = {headline: string; detail: string};

/** The step-5 button's label, quoted back so the advice names what to tap. */
const BUTTON = 'Show me my number';

/**
 * One answer the server refused, reduced to the two parts that matter here.
 * `path` stays `unknown[]`: it is parsed from a response body, so nothing about
 * its shape is guaranteed, and the labelling below checks each element itself.
 */
type ServerIssue = {path: readonly unknown[]; message: string};

/** A human name for an answer, and the step the user typed it on. */
type Answer = {label: string; step: number | null};

/**
 * The scalar fields of `onboardingCompleteFields`. `name` and `email` come
 * from the Clerk profile rather than from a step, so they have no step number
 * to send the user back to — hence `step: null` rather than a guess.
 */
const SINGLE_ANSWERS: Record<string, Answer | undefined> = {
  balance: {label: 'your starting balance', step: 1},
  pay: {label: 'your paycheck', step: 2},
  cadence: {label: 'how often you are paid', step: 2},
  nextPay: {label: 'your next payday', step: 2},
  name: {label: 'your name', step: null},
  email: {label: 'your email address', step: null},
};

/**
 * The list fields, whose issue paths are `[root, index, field]`. The index is
 * 0-based on the wire and 1-based in the copy, because the user counts the
 * rows on the screen rather than the entries in an array.
 */
const ROW_ANSWERS: Record<
  string,
  | {noun: string; plural: string; step: number; fields: Record<string, string | undefined>}
  | undefined
> = {
  bills: {
    noun: 'bill',
    plural: 'bills',
    step: 3,
    fields: {name: 'name', amount: 'amount', dueDay: 'due day', kind: 'kind'},
  },
  cards: {
    noun: 'card',
    plural: 'cards',
    step: 4,
    fields: {name: 'nickname', balance: 'balance', limit: 'limit', apr: 'APR'},
  },
  cats: {
    noun: 'category',
    plural: 'categories',
    step: 5,
    fields: {name: 'name', budget: 'budget'},
  },
};

/**
 * The issues out of a Zod rejection, or none. `@hono/zod-validator` wraps them
 * as `{success: false, error: {issues, name}}`, but this runs against whatever
 * text the response happened to carry: an unhandled server throw answers with
 * a plain-text body, so both a body that is not JSON and JSON that is not this
 * envelope have to leave the caller on its generic branch rather than throw.
 */
function readIssues(body: string | undefined): ServerIssue[] {
  if (!body) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return [];
  }
  const issues = (parsed as {error?: {issues?: unknown}} | null)?.error?.issues;
  if (!Array.isArray(issues)) return [];

  const found: ServerIssue[] = [];
  for (const issue of issues) {
    const raw = issue as {path?: unknown; message?: unknown} | null;
    // An issue with an empty path blames the payload as a whole and names no
    // answer, so it cannot be pointed at a step and is not worth a sentence.
    if (!Array.isArray(raw?.path) || raw.path.length === 0) continue;
    found.push({path: raw.path, message: typeof raw.message === 'string' ? raw.message : ''});
  }
  return found;
}

/**
 * Look a key up in one of the maps above without inheriting one. A path root
 * arrives parsed from a response body, and a plain object literal answers
 * `toString` with a function — which would otherwise be returned as though it
 * were an answer and reach the copy as `Check undefined`.
 */
function own<T>(map: Record<string, T | undefined>, key: string): T | undefined {
  return Object.hasOwn(map, key) ? map[key] : undefined;
}

/** Name the answer an issue path points at, without ever quoting the path. */
function describeAnswer(path: readonly unknown[]): Answer {
  const root = path[0];
  if (typeof root !== 'string') return {label: 'one of your answers', step: null};

  const single = own(SINGLE_ANSWERS, root);
  if (single) return single;

  const row = own(ROW_ANSWERS, root);
  // The schema can grow a field this map has never heard of. Saying so plainly
  // beats inventing a step number, and the server's own message still follows.
  if (!row) return {label: `an answer called “${root}”`, step: null};

  const index = path[1];
  if (typeof index !== 'number') return {label: `your ${row.plural}`, step: row.step};

  const rowLabel = `${row.noun} ${index + 1}`;
  const field = path[2];
  const fieldLabel = typeof field === 'string' ? own(row.fields, field) : undefined;
  return {label: fieldLabel ? `${rowLabel}'s ${fieldLabel}` : rowLabel, step: row.step};
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Quote the server's own sentence verbatim. Zod's built-in messages have no
 * final stop and the `nextPay` rule's messages do, so the closing period is
 * added only where one is missing rather than by editing the message.
 */
function quote(message: string): string {
  return `“${message}”${/[.!?]$/.test(message) ? '' : '.'}`;
}

/** The copy for a validation refusal: which answer, which step, why, retry. */
function describeRefusedAnswers(issues: ServerIssue[]): SubmitFailure {
  const first = issues[0];
  const {label, step} = describeAnswer(first.path);
  const rest = issues.length - 1;

  const named = step === null ? capitalize(label) : `Step ${step}: ${label}`;
  const because = first.message ? ` — ${quote(first.message)}` : '.';
  const others =
    rest > 0 ? ` ${rest} other answer${rest === 1 ? '' : 's'} came back refused too.` : '';
  // An answer with no step behind it is not one the flow can be walked back to
  // — `name` and `email` come from the Clerk profile — so it gets the retry
  // without the instruction to go back to a step that does not exist.
  const retry =
    step === null
      ? `Everything you typed is still on this page, so tapping ${BUTTON} again is safe once it is fixed.`
      : `Everything you typed is still on this page, so go back, fix ${rest > 0 ? 'them' : 'it'}, and tap ${BUTTON} again.`;

  return {headline: `Check ${label}`, detail: `${named} was refused${because}${others} ${retry}`};
}

/**
 * Turn whatever the completion mutation rejected with into something a reader
 * can act on. Every branch says that the answers survived, because the button
 * doing nothing left people believing five steps of typing had been lost.
 */
export function describeOnboardingFailure(error: unknown): SubmitFailure {
  if (error instanceof ApiError && error.kind === 'rejected') {
    const status = error.status;

    if (status === 400 || status === 422) {
      const issues = readIssues(error.body);
      if (issues.length > 0) return describeRefusedAnswers(issues);
    }

    if (status === 401 || status === 403) {
      return {
        headline: 'Your sign-in has expired',
        detail:
          `The API answered ${status}, so it would not take the setup. Sign in again in another ` +
          `tab, come back to this one, and tap ${BUTTON} — everything you typed is still on this ` +
          `page, and reloading would lose it.`,
      };
    }

    if (status !== undefined && status >= 500) {
      return {
        headline: 'The Runway API broke',
        detail:
          `It answered ${status}, which is the server's fault rather than anything you typed. ` +
          `Your answers are still on this page — give it a moment and tap ${BUTTON} again.`,
      };
    }

    return {
      headline: 'The Runway API refused the setup',
      detail:
        `It answered ${status ?? 'an error'} without saying why. Your answers are still on this ` +
        `page, so tapping ${BUTTON} again is safe; if it keeps failing, the API's own logs hold ` +
        `the reason.`,
    };
  }

  if (error instanceof ApiError || error instanceof TypeError) {
    return {
      headline: 'Nothing came back from the Runway API',
      detail:
        `The request never got an answer — the API may be unreachable, or the browser may have ` +
        `blocked the response. Your answers are still on this page, so check your connection and ` +
        `tap ${BUTTON} again.`,
    };
  }

  return {
    headline: "That didn't go through",
    detail:
      `The request failed and reported no reason. Your answers are still on this page, so ` +
      `tapping ${BUTTON} again is safe — the browser console has the error.`,
  };
}
