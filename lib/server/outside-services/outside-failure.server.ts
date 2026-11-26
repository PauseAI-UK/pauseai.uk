import "server-only";

// One error for every outside service (docs/code-structure.md, "Errors"):
// whatever a binding in this folder throws is an OutsideFailure, or its own
// subclass of it, with the same fields whichever service it was. So a caller
// asks what kind of failure it was (`error.kind === "rate-limited"`), the
// same way for each, and never reads an error's words to find out. Each
// binding works out the kind, in one place, from the status and the
// service's own code.

/** The outside services, each with its name as an error's words say it. */
export const OUTSIDE_SERVICES = {
  blobs: "Netlify Blobs",
  civicrm: "CiviCRM",
  controlai: "ControlAI",
  gmail: "Gmail",
  "google-maps": "Google Maps",
  "link-page": "A linked page",
  luma: "Luma",
  "map-tiles": "OpenStreetMap's map",
  netlify: "Netlify",
  "ni-assembly": "The Northern Ireland Assembly",
  parliament: "Parliament",
  photon: "Photon",
  postcodes: "postcodes.io",
  postmark: "Postmark",
  "scottish-parliament": "The Scottish Parliament",
  senedd: "The Senedd",
  stripe: "Stripe",
  turnstile: "Turnstile",
  whatsapp: "WhatsApp",
  wikidata: "Wikidata",
} as const;

export type OutsideService = keyof typeof OUTSIDE_SERVICES;

/**
 * What kind of failure it was:
 *
 * - `unreachable`: no answer, as the connection failed;
 * - `timeout`: no answer in the time it was given;
 * - `rate-limited`: asked too much, so worth trying again later, after `retryAfter` where the service says;
 * - `unauthorised`: our key or token is missing, wrong or no longer accepted;
 * - `not-found`: what was asked for isn't there;
 * - `refused`: any other answer that isn't what was asked for.
 */
export type FailureKind = "unreachable" | "timeout" | "refused" | "rate-limited" | "unauthorised" | "not-found";

/** How much of a service's own message is kept. */
const SAID_KEPT = 500;

export type FailureDetails = {
  /** The HTTP status, or 0 if there was no answer. */
  status?: number;
  /** The service's own error code, where it has one. */
  serviceCode?: string | number;
  /** The service's own message. */
  said?: string;
  /** What was asked for, a path or a URL, for the error's words. */
  asked?: string;
  /** How many seconds to wait before trying again, where the service says. */
  retryAfter?: number;
  /** The error's words, in place of those written from the rest. */
  message?: string;
  cause?: unknown;
};

/** The kind of failure a status says, by itself: a binding that knows more from the service's own code says so. */
export function kindOfStatus(status: number): FailureKind {
  if (status === 429) return "rate-limited";
  if (status === 401 || status === 403) return "unauthorised";
  if (status === 404) return "not-found";
  return "refused";
}

/** The seconds a response's Retry-After header says to wait, if it says. */
export function retryAfterOf(res: Response): number | undefined {
  const header = res.headers.get("retry-after");
  const seconds = Number(header);
  return header !== null && header !== "" && Number.isFinite(seconds) ? seconds : undefined;
}

/** A failure's words, from its parts. */
function words(service: OutsideService, kind: FailureKind, { status, said, asked }: FailureDetails): string {
  const name = OUTSIDE_SERVICES[service];
  const detail = `${asked ? ` for ${asked}` : ""}${said ? `: ${said.slice(0, SAID_KEPT)}` : ""}`;
  if (kind === "unreachable") return `${name} couldn't be reached${detail}`;
  if (kind === "timeout") return `${name} didn't answer in time${detail}`;
  return status ? `${name} answered ${status}${detail}` : `${name} refused${detail}`;
}

/** An outside service failing, in a way that's the same for each. */
export class OutsideFailure extends Error {
  readonly service: OutsideService;
  readonly kind: FailureKind;
  /** The HTTP status, or 0 if there was no answer. */
  readonly status: number;
  /** The service's own error code, where it has one: Postmark's ErrorCode, WhatsApp's code. */
  readonly serviceCode?: string | number;
  /** The service's own message, cut short. */
  readonly said?: string;
  /** How many seconds to wait before trying again, where the service says. */
  readonly retryAfter?: number;

  constructor(service: OutsideService, kind: FailureKind, details: FailureDetails = {}) {
    super(details.message ?? words(service, kind, details), { cause: details.cause });
    this.name = new.target.name;
    this.service = service;
    this.kind = kind;
    this.status = details.status ?? 0;
    this.serviceCode = details.serviceCode;
    this.said = details.said?.slice(0, SAID_KEPT) || undefined;
    this.retryAfter = details.retryAfter;
  }
}

/**
 * The failure for an answer that isn't ok: its kind from its status, with
 * the wait its Retry-After says, and `details` for what the binding read
 * from its body.
 */
export function refusal(service: OutsideService, res: Response, details: FailureDetails = {}): OutsideFailure {
  return new OutsideFailure(service, kindOfStatus(res.status), {
    status: res.status,
    retryAfter: retryAfterOf(res),
    ...details,
  });
}

/** The failure for a key or token of ours that isn't set, named by its setting: nothing was asked. */
export function notSet(service: OutsideService, setting: string): OutsideFailure {
  return new OutsideFailure(service, "unauthorised", { message: `${setting} is not set` });
}

/**
 * A response's body as JSON, or an OutsideFailure for one that isn't: a
 * service answering with a page of HTML where its JSON should be has
 * failed, as surely as one that answers 500. Typed as Response.json() is.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- as Response.json() gives it, for the binding to read.
export async function outsideJson(service: OutsideService, res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new OutsideFailure(service, "refused", {
      status: res.status,
      message: `${OUTSIDE_SERVICES[service]} answered ${res.status} with a body that isn't JSON`,
      cause: error,
    });
  }
}
