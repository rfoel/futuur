/**
 * HMAC request signing, matching what the Futuur API rebuilds on its side.
 *
 * The server collects the request's parameters, converts each value to text the
 * way Python does, sorts them by name in code-point order, joins them with
 * `urlencode` and compares the HMAC-SHA512 of that string with the `HMAC`
 * header. Every rule below exists because a mismatch yields a bare
 * `401 authentication_failed`. See https://docs.futuur.com/authentication.md.
 */

/**
 * Percent-encoding that matches Python's `urlencode` (`quote_plus`). It differs
 * from `encodeURIComponent` in two ways: a space becomes `+` rather than `%20`,
 * and `!'()*` are escaped instead of passed through.
 */
export function quotePlus(value: string): string {
  return encodeURIComponent(value)
    .replace(
      /[!'()*]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    )
    .replace(/%20/g, "+");
}

/**
 * Text of a query string value. Query values reach the server as the strings we
 * put on the wire, so this is also how they are serialized. Arrays of
 * primitives become a comma-joined list, which is how the API reads repeated
 * filters.
 */
export function queryValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.every((v) => v === null || typeof v !== "object")
      ? value.join(",")
      : JSON.stringify(value);
  }
  if (value !== null && typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Text of a top-level JSON body value: what Python's `str()` gives for the value
 * the server parsed. `true` signs as `True`, `null` as `None`, and nested
 * objects and arrays as their Python `repr`.
 *
 * Expects a value that has already been through a JSON round trip, so it holds
 * only what the server can see.
 */
export function pyStr(value: unknown): string {
  return typeof value === "string" ? value : pyRepr(value);
}

function pyRepr(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return pyNumber(value);
  if (typeof value === "string") return pyStringRepr(value);
  if (Array.isArray(value)) return `[${value.map(pyRepr).join(", ")}]`;
  if (typeof value === "object") {
    const items = Object.entries(value).map(
      ([k, v]) => `${pyStringRepr(k)}: ${pyRepr(v)}`,
    );
    return `{${items.join(", ")}}`;
  }
  return String(value);
}

/**
 * Python's `json` parses a number without a fraction or exponent as an `int`
 * and everything else as a `float`. `JSON.stringify` writes integers below
 * 1e21 without either, so those sign as plain integers.
 */
function pyNumber(n: number): string {
  if (Number.isInteger(n) && Math.abs(n) < 1e21) return BigInt(n).toString();
  // Python's float repr uses the same shortest digits as JS, but switches to
  // scientific notation outside 1e-4 ≤ |n| < 1e16 and pads the exponent to two
  // digits (`1e-05`, `1e+21`).
  const [mantissa, exp] = n.toExponential().split("e");
  const e = Number(exp);
  if (e >= -4 && e < 16) return String(n);
  return `${mantissa}e${e < 0 ? "-" : "+"}${String(Math.abs(e)).padStart(2, "0")}`;
}

/** Characters `str.isprintable()` rejects, other than the ASCII space. */
const NON_PRINTABLE = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\p{Zl}\p{Zp}\p{Zs}]/u;

function pyStringRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = quote;
  for (const char of s) {
    if (char === "\\" || char === quote) out += `\\${char}`;
    else if (char === "\n") out += "\\n";
    else if (char === "\r") out += "\\r";
    else if (char === "\t") out += "\\t";
    else if (char !== " " && NON_PRINTABLE.test(char)) {
      const cp = char.codePointAt(0)!;
      const hex = cp.toString(16);
      out +=
        cp <= 0xff
          ? `\\x${hex.padStart(2, "0")}`
          : cp <= 0xffff
            ? `\\u${hex.padStart(4, "0")}`
            : `\\U${hex.padStart(8, "0")}`;
    } else out += char;
  }
  return out + quote;
}

/** Join signed parameters in code-point order of their names. */
export function signatureString(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${quotePlus(k)}=${quotePlus(params[k])}`)
    .join("&");
}

/** Hex HMAC-SHA512 of `message`, through Web Crypto so it runs anywhere. */
export async function hmacSha512Hex(
  key: CryptoKey,
  message: string,
): Promise<string> {
  const digest = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export function importHmacKey(secret: string): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
}
