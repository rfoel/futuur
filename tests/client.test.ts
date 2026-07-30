import CryptoJS from "crypto-js";
import nock from "nock";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Futuur } from "../src/client";

const BASE = "https://api.futuur.com";
const PREFIX = "/v2.0";
const PUBLIC_KEY = "test_public";
const PRIVATE_KEY = "test_private";

function signatureValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.every((v) => v === null || typeof v !== "object")
      ? value.join(",")
      : JSON.stringify(value);
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Mirrors Python's `urlencode`, which is how the API builds its own signature. */
function quotePlus(value: string): string {
  return encodeURIComponent(value)
    .replace(
      /[!'()*]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    )
    .replace(/%20/g, "+");
}

/**
 * Every key given is signed. Omit a key to model a null query param, which never
 * reaches the wire; pass the string `"None"` to model a null body param, which
 * does.
 */
function expectedHmac(params: Record<string, unknown>): string {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    flat[k] = signatureValue(v);
  }
  const paramString = Object.keys(flat)
    .sort()
    .map((k) => `${quotePlus(k)}=${quotePlus(flat[k])}`)
    .join("&");
  return CryptoJS.HmacSHA512(paramString, PRIVATE_KEY).toString(
    CryptoJS.enc.Hex,
  );
}

function makeSdk() {
  return new Futuur({ publicKey: PUBLIC_KEY, privateKey: PRIVATE_KEY });
}

function api() {
  return nock(BASE);
}

const PAGINATION = {
  total: 0,
  next: null,
  previous: null,
  page_size: 20,
  offset: 0,
};

beforeAll(() => {
  nock.disableNetConnect();
});

afterEach(() => {
  nock.cleanAll();
});

afterAll(() => {
  nock.enableNetConnect();
});

describe("Futuur auth headers", () => {
  it("attaches Key, Timestamp and HMAC headers", async () => {
    const sdk = makeSdk();
    let capturedHeaders: Record<string, string> = {};

    api()
      .get(`${PREFIX}/me/`)
      .reply(function () {
        capturedHeaders = this.req.headers as Record<string, string>;
        return [200, { id: 1, username: "alice" }];
      });

    await sdk.me();

    expect(capturedHeaders.key).toBe(PUBLIC_KEY);
    expect(capturedHeaders.timestamp).toMatch(/^\d+$/);
    expect(capturedHeaders.hmac).toMatch(/^[a-f0-9]{128}$/);

    const ts = capturedHeaders.timestamp;
    expect(capturedHeaders.hmac).toBe(
      expectedHmac({ Key: PUBLIC_KEY, Timestamp: ts }),
    );
  });

  it("includes query params in signature", async () => {
    const sdk = makeSdk();
    let capturedHeaders: Record<string, string> = {};

    api()
      .get(`${PREFIX}/events/`)
      .query({ currency_mode: "play_money", live: "true", limit: "5" })
      .reply(function () {
        capturedHeaders = this.req.headers as Record<string, string>;
        return [200, { pagination: PAGINATION, results: [] }];
      });

    await sdk.listEvents({
      currency_mode: "play_money",
      live: true,
      limit: 5,
    });

    const ts = capturedHeaders.timestamp;
    expect(capturedHeaders.hmac).toBe(
      expectedHmac({
        Key: PUBLIC_KEY,
        Timestamp: ts,
        currency_mode: "play_money",
        live: true,
        limit: 5,
      }),
    );
  });

  it("includes POST body in signature", async () => {
    const sdk = makeSdk();
    let capturedHeaders: Record<string, string> = {};

    const body = {
      market: 4567,
      side: "bid" as const,
      currency: "USDC",
      price: 0.62,
      shares: 100,
    };

    api()
      .post(`${PREFIX}/orders/`, body)
      .reply(function () {
        capturedHeaders = this.req.headers as Record<string, string>;
        return [201, { id: 1, ...body, position: "long", status: "open" }];
      });

    await sdk.createOrder(body);

    const ts = capturedHeaders.timestamp;
    expect(capturedHeaders.hmac).toBe(
      expectedHmac({ Key: PUBLIC_KEY, Timestamp: ts, ...body }),
    );
  });

  it("signs a space as + rather than %20", async () => {
    const sdk = makeSdk();
    let capturedHeaders: Record<string, string> = {};

    api()
      .get(`${PREFIX}/events/`)
      .query({ search: "bitcoin hourly", limit: "5" })
      .reply(function () {
        capturedHeaders = this.req.headers as Record<string, string>;
        return [200, { pagination: PAGINATION, results: [] }];
      });

    await sdk.listEvents({ search: "bitcoin hourly", limit: 5 });

    const ts = capturedHeaders.timestamp;
    expect(capturedHeaders.hmac).toBe(
      expectedHmac({
        Key: PUBLIC_KEY,
        Timestamp: ts,
        search: "bitcoin hourly",
        limit: 5,
      }),
    );
  });

  it("signs a null body param as None", async () => {
    const sdk = makeSdk();
    let capturedHeaders: Record<string, string> = {};

    const body = {
      market: 4567,
      side: "bid" as const,
      currency: "USDC",
      price: null,
      shares: 100,
    };

    api()
      .post(`${PREFIX}/orders/`, body)
      .reply(function () {
        capturedHeaders = this.req.headers as Record<string, string>;
        return [201, { id: 1, ...body, position: "long", status: "open" }];
      });

    await sdk.createOrder(body);

    const ts = capturedHeaders.timestamp;
    expect(capturedHeaders.hmac).toBe(
      expectedHmac({ ...body, Key: PUBLIC_KEY, Timestamp: ts, price: "None" }),
    );
  });

  it("leaves a null query param out of the signature", async () => {
    const sdk = makeSdk();
    let capturedHeaders: Record<string, string> = {};

    api()
      .get(`${PREFIX}/events/`)
      .query({ limit: "5" })
      .reply(function () {
        capturedHeaders = this.req.headers as Record<string, string>;
        return [200, { pagination: PAGINATION, results: [] }];
      });

    await sdk.listEvents({
      limit: 5,
      search: null as unknown as string,
    });

    const ts = capturedHeaders.timestamp;
    expect(capturedHeaders.hmac).toBe(
      expectedHmac({ Key: PUBLIC_KEY, Timestamp: ts, limit: 5 }),
    );
  });

  it("joins array params with comma in signature", async () => {
    const sdk = makeSdk();
    let capturedHeaders: Record<string, string> = {};

    api()
      .get(`${PREFIX}/orders/`)
      .query(true)
      .reply(function () {
        capturedHeaders = this.req.headers as Record<string, string>;
        return [200, { pagination: PAGINATION, results: [] }];
      });

    await sdk.listOrders({ currencies: ["USDC", "USDT"] });

    const ts = capturedHeaders.timestamp;
    expect(capturedHeaders.hmac).toBe(
      expectedHmac({
        Key: PUBLIC_KEY,
        Timestamp: ts,
        currencies: ["USDC", "USDT"],
      }),
    );
  });

  it("serializes array query params as a comma-joined list", async () => {
    const sdk = makeSdk();

    const scope = api()
      .get(`${PREFIX}/events/`)
      .query({ categories: "98,106", limit: "1" })
      .reply(200, { pagination: PAGINATION, results: [] });

    await sdk.listEvents({ categories: [98, 106], limit: 1 });

    expect(scope.isDone()).toBe(true);
  });

  it("serializes nested body params as JSON in signature", async () => {
    const sdk = makeSdk();
    let capturedHeaders: Record<string, string> = {};

    const orders = [
      {
        market: 2231,
        side: "bid" as const,
        position: "long" as const,
        currency: "OOM",
        shares: "13",
        price: "0.43",
      },
    ];

    api()
      .post(`${PREFIX}/orders/batch/`, { orders })
      .reply(function () {
        capturedHeaders = this.req.headers as Record<string, string>;
        return [200, { results: [], cancelled_existing_order_ids: [] }];
      });

    await sdk.batchCreateOrders({ orders });

    const ts = capturedHeaders.timestamp;
    expect(capturedHeaders.hmac).toBe(
      expectedHmac({ Key: PUBLIC_KEY, Timestamp: ts, orders }),
    );
  });

  it("signs form-encoded bodies", async () => {
    const sdk = makeSdk();
    let capturedHeaders: Record<string, string> = {};

    api()
      .post(`${PREFIX}/pusher/auth/`)
      .reply(function () {
        capturedHeaders = this.req.headers as Record<string, string>;
        return [200, { auth: "key:sig" }];
      });

    await sdk.pusherAuth("1234.5678", "private-user-1");

    const ts = capturedHeaders.timestamp;
    expect(capturedHeaders.hmac).toBe(
      expectedHmac({
        Key: PUBLIC_KEY,
        Timestamp: ts,
        socket_id: "1234.5678",
        channel_name: "private-user-1",
      }),
    );
  });

  it("sends Idempotency-Key when provided", async () => {
    const sdk = makeSdk();
    let capturedHeaders: Record<string, string> = {};

    api()
      .post(`${PREFIX}/orders/`)
      .reply(function () {
        capturedHeaders = this.req.headers as Record<string, string>;
        return [201, { id: 1 }];
      });

    await sdk.createOrder(
      { market: 1, side: "bid", currency: "OOM", shares: 1 },
      { idempotencyKey: "abc-123" },
    );

    expect(capturedHeaders["idempotency-key"]).toBe("abc-123");
  });
});

describe("Futuur endpoints", () => {
  it("me() → GET /me/", async () => {
    const sdk = makeSdk();
    api()
      .get(`${PREFIX}/me/`)
      .reply(200, {
        id: 1,
        username: "alice",
        email: "a@b.com",
        wallet: { OOM: "5000.00", USDC: "100.00" },
        email_confirmed: true,
        real_currency_enabled: true,
        kyc_status: "approved",
      });
    const me = await sdk.me();
    expect(me.username).toBe("alice");
    expect(me.wallet.USDC).toBe("100.00");
  });

  it("balances() → GET /me/balances/", async () => {
    const sdk = makeSdk();
    api()
      .get(`${PREFIX}/me/balances/`)
      .query({ currency: "USDC" })
      .reply(200, [{ currency: "USDC", amount: "100.00" }]);
    const b = await sdk.balances({ currency: "USDC" });
    expect(b[0].amount).toBe("100.00");
  });

  it("registerSafe() → POST /me/safe/", async () => {
    const sdk = makeSdk();
    const body = { safe_address: "0xAbC123", chain_id: 137 };
    api()
      .post(`${PREFIX}/me/safe/`, body)
      .reply(200, { id: 42, email: "a@b.com", wallet: {} });
    const me = await sdk.registerSafe(body);
    expect(me.id).toBe(42);
  });

  it("ranking() → GET /me/ranking/", async () => {
    const sdk = makeSdk();
    api().get(`${PREFIX}/me/ranking/`).reply(200, { ranking: "127" });
    const r = await sdk.ranking();
    expect(r.ranking).toBe("127");
  });

  it("listEvents() unwraps the pagination envelope", async () => {
    const sdk = makeSdk();
    api()
      .get(`${PREFIX}/events/`)
      .reply(200, {
        pagination: { ...PAGINATION, total: 3 },
        results: [{ id: 42 }],
      });
    const r = await sdk.listEvents();
    expect(r.pagination.total).toBe(3);
    expect(r.results[0].id).toBe(42);
  });

  it("getEvent(id) → GET /events/{id}/", async () => {
    const sdk = makeSdk();
    api().get(`${PREFIX}/events/42/`).reply(200, { id: 42, title: "X" });
    const e = await sdk.getEvent(42);
    expect(e.id).toBe(42);
  });

  it("getEventActions passes filters", async () => {
    const sdk = makeSdk();
    api()
      .get(`${PREFIX}/events/42/actions/`)
      .query({
        my_bets: "true",
        currency_mode: "real_money",
        aggregate_by_orders: "false",
      })
      .reply(200, { pagination: PAGINATION, results: [] });
    const r = await sdk.getEventActions(42, {
      my_bets: true,
      currency_mode: "real_money",
      aggregate_by_orders: false,
    });
    expect(r.results).toEqual([]);
  });

  it("getEventTax → GET /events/{id}/get_tax/", async () => {
    const sdk = makeSdk();
    api()
      .get(`${PREFIX}/events/42/get_tax/`)
      .reply(200, { tax_play_money: 0.04, tax_real_money: 0.04 });
    const t = await sdk.getEventTax(42);
    expect(t.tax_real_money).toBe(0.04);
  });

  it("getRelatedEvents → GET /events/{id}/related_events/", async () => {
    const sdk = makeSdk();
    api()
      .get(`${PREFIX}/events/42/related_events/`)
      .reply(200, [{ id: 1187, title: "Another market" }]);
    const r = await sdk.getRelatedEvents(42);
    expect(r[0].id).toBe(1187);
  });

  it("getOrderBook hits /markets/{id}/book/", async () => {
    const sdk = makeSdk();
    api()
      .get(`${PREFIX}/markets/501/book/`)
      .query({ currency_mode: "play_money", position: "long" })
      .reply(200, { bid: [], ask: [] });
    const r = await sdk.getOrderBook(501, {
      currency_mode: "play_money",
      position: "long",
    });
    expect(r.bid).toEqual([]);
    expect(r.ask).toEqual([]);
  });

  it("getPriceHistory hits correct path", async () => {
    const sdk = makeSdk();
    api()
      .get(`${PREFIX}/events/42/price_history/`)
      .query({ currency_mode: "play_money", time_interval: "week" })
      .reply(200, [
        { name: "Candidate A", data: [{ x: "2026-07-23T23:49:49.0", y: 51 }] },
      ]);
    const r = await sdk.getPriceHistory(42, {
      currency_mode: "play_money",
      time_interval: "week",
    });
    expect(r[0].data[0].y).toBe(51);
  });

  it("getEventWagers returns an unpaginated array", async () => {
    const sdk = makeSdk();
    api()
      .get(`${PREFIX}/events/42/wagers/`)
      .query({ active: "true" })
      .reply(200, [{ id: 4401, status: "purchased" }]);
    const r = await sdk.getEventWagers(42, { active: true });
    expect(r[0].id).toBe(4401);
  });

  it("listWagers paginates", async () => {
    const sdk = makeSdk();
    api()
      .get(`${PREFIX}/wagers/`)
      .query({ active: "true", limit: "10" })
      .reply(200, {
        pagination: { ...PAGINATION, total: 1, page_size: 10 },
        results: [{ id: 1 }],
      });
    const r = await sdk.listWagers({ active: true, limit: 10 });
    expect(r.pagination.total).toBe(1);
  });

  it("getWager → GET /wagers/{id}/", async () => {
    const sdk = makeSdk();
    api().get(`${PREFIX}/wagers/77/`).reply(200, { id: 77 });
    const w = await sdk.getWager(77);
    expect(w.id).toBe(77);
  });

  it("getRebates → GET /wagers/rebates/", async () => {
    const sdk = makeSdk();
    api()
      .get(`${PREFIX}/wagers/rebates/`)
      .query({ date: "2026-06-25", event: "1023" })
      .reply(200, { rebated_fee_usd: 12.45 });
    const r = await sdk.getRebates({ date: "2026-06-25", event: 1023 });
    expect(r.rebated_fee_usd).toBe(12.45);
  });

  it("createOrder → POST /orders/", async () => {
    const sdk = makeSdk();
    api()
      .post(`${PREFIX}/orders/`, {
        market: 4567,
        side: "bid",
        currency: "USDC",
        price: 0.62,
        shares: 100,
        position: "long",
      })
      .reply(201, { id: 99, status: "open" });
    const o = await sdk.createOrder({
      market: 4567,
      side: "bid",
      currency: "USDC",
      price: 0.62,
      shares: 100,
      position: "long",
    });
    expect(o.id).toBe(99);
  });

  it("batchCreateOrders → POST /orders/batch/", async () => {
    const sdk = makeSdk();
    api()
      .post(`${PREFIX}/orders/batch/`)
      .reply(200, {
        results: [{ index: 0, success: true, order: { id: 10501 } }],
        cancelled_existing_order_ids: [],
      });
    const r = await sdk.batchCreateOrders({
      orders: [
        {
          market: 2231,
          side: "bid",
          position: "long",
          currency: "OOM",
          shares: "13",
          price: "0.43",
        },
      ],
    });
    expect(r.results[0].order?.id).toBe(10501);
  });

  it("batchUpdateOrders → POST /orders/batch-update/", async () => {
    const sdk = makeSdk();
    api()
      .post(`${PREFIX}/orders/batch-update/`)
      .reply(200, [{ index: 0, order_id: 100, success: true }]);
    const r = await sdk.batchUpdateOrders({
      orders: [{ id: 100, shares: "12", price: "0.48" }],
    });
    expect(r[0].success).toBe(true);
  });

  it("cancelOrder → PATCH /orders/{id}/cancel/", async () => {
    const sdk = makeSdk();
    const scope = api().patch(`${PREFIX}/orders/10482/cancel/`).reply(204);
    await expect(sdk.cancelOrder(10482)).resolves.toBeUndefined();
    expect(scope.isDone()).toBe(true);
  });

  it("batchCancelOrders → POST /orders/batch-cancel/", async () => {
    const sdk = makeSdk();
    api()
      .post(`${PREFIX}/orders/batch-cancel/`, { order_ids: [100, 101] })
      .reply(200, [
        { index: 0, order_id: 100, success: true },
        { index: 1, order_id: 101, success: false, error: "Order is filled." },
      ]);
    const r = await sdk.batchCancelOrders({ order_ids: [100, 101] });
    expect(r[1].error).toBe("Order is filled.");
  });

  it("cancelAllOrders defaults to an empty body", async () => {
    const sdk = makeSdk();
    api()
      .post(`${PREFIX}/orders/cancel-all/`, {})
      .reply(200, { canceled_order_ids: [100], processing_order_ids: [102] });
    const r = await sdk.cancelAllOrders();
    expect(r.processing_order_ids).toEqual([102]);
  });

  it("cancelAllOrders scopes to an event and market", async () => {
    const sdk = makeSdk();
    api()
      .post(`${PREFIX}/orders/cancel-all/`, { event: 873, market: 2231 })
      .reply(200, { canceled_order_ids: [], processing_order_ids: [] });
    const r = await sdk.cancelAllOrders({ event: 873, market: 2231 });
    expect(r.canceled_order_ids).toEqual([]);
  });

  it("pusherAuth → POST /pusher/auth/ as form data", async () => {
    const sdk = makeSdk();
    api()
      .post(
        `${PREFIX}/pusher/auth/`,
        "socket_id=1234.5678&channel_name=private-user-1",
      )
      .reply(200, { auth: "key:signature" });
    const r = await sdk.pusherAuth("1234.5678", "private-user-1");
    expect(r.auth).toBe("key:signature");
  });

  it("baseUrl override is honored", async () => {
    const sdk = new Futuur({
      publicKey: PUBLIC_KEY,
      privateKey: PRIVATE_KEY,
      baseUrl: "https://staging.futuur.com/v2.0",
    });
    nock("https://staging.futuur.com")
      .get("/v2.0/me/")
      .reply(200, { id: 2, username: "bob" });
    const me = await sdk.me();
    expect(me.username).toBe("bob");
  });
});
