export interface ApiErrorEntry {
  /** Machine-readable code. Match on this. */
  code: string;
  /** Human-readable message. Wording can change. */
  detail: string;
  /** The request field the error refers to, or null. */
  attr: string | null;
}

export interface ApiErrorBody {
  /** `validation_error` (400), `client_error` (other 4xx) or `server_error` (5xx). */
  type: "validation_error" | "client_error" | "server_error" | string;
  errors: ApiErrorEntry[];
}

/** Thrown for every non-2xx response from the Futuur API. */
export class FutuurError extends Error {
  override readonly name = "FutuurError";
  /** HTTP status code. */
  readonly status: number;
  /** Parsed response body: JSON when the server sent JSON, otherwise text. */
  readonly body: unknown;
  /** Entries of the standard error envelope; empty for other bodies. */
  readonly errors: ApiErrorEntry[];
  /**
   * The error code to match on. For on-chain order errors this is the code the
   * API puts in the `detail` of the entry whose `attr` is `"code"` (for example
   * `order_intent_nonce_stale`); otherwise it is the first entry's `code`.
   */
  readonly code: string | undefined;

  constructor(status: number, body: unknown, method: string, url: string) {
    const errors = isErrorBody(body) ? body.errors : [];
    const onchainCode = errors.find((e) => e.attr === "code")?.detail;
    const detail =
      errors.find((e) => e.attr !== "code")?.detail ??
      (isDetailBody(body) ? body.detail : undefined);

    super(
      `${method} ${url} failed with ${status}${detail ? `: ${detail}` : ""}`,
    );
    this.status = status;
    this.body = body;
    this.errors = errors;
    this.code = onchainCode ?? errors[0]?.code;
  }
}

function isErrorBody(body: unknown): body is ApiErrorBody {
  return (
    typeof body === "object" &&
    body !== null &&
    Array.isArray((body as ApiErrorBody).errors)
  );
}

function isDetailBody(body: unknown): body is { detail: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as { detail?: unknown }).detail === "string"
  );
}
