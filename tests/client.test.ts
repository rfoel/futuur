import { createHmac } from "node:crypto";

import nock from "nock";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Futuur, FutuurError } from "../src";
import { pyStr } from "../src/signing";

const BASE = "https://api.futuur.com";
const PREFIX = "/v2.0";
const PUBLIC_KEY = "test_public";
const PRIVATE_KEY = "test_private";

/**
 * HMAC of the parameters the server signs, given as the exact text it renders
 * for each value. Spelling the text out keeps these tests independent of the
 * SDK's own conversion rules.
 */
function expectedHmac(params: Record<string, string>): string {
  const message = new URLSearchParams(
    Object.keys(params)
      .sort()
      .map((k) => [k, params[k]]),
  )
    .toString()
    // Python's urlencode escapes `*` and keeps `~`; URLSearchParams does the reverse.
    .replace(/\*/g, "%2A")
    .replace(/%7E/g, "~");
  return createHmac("sha512", PRIVATE_KEY).update(message).digest("hex");
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

/** Capture the request headers nock saw and reply with `body`. */
function capture(status: number, body: unknown = {}) {
  const seen: { headers: Record<string, string> } = { headers: {} };
  // nock 15 hands reply functions the intercepted Fetch `Request`.
  const reply = (req: Request) => {
    seen.headers = Object.fromEntries(req.headers);
    return [status, body] as [number, unknown];
  };
  return { seen, reply };
}

describe("Futuur auth headers", () => {
  it("attaches Key, Timestamp and HMAC headers", async () => {
    const { seen, reply } = capture(200, { id: 1 });
    api().get(`${PREFIX}/me/`).reply(reply);

    await makeSdk().me();

    expect(seen.headers.key).toBe(PUBLIC_KEY);
    expect(seen.headers.timestamp).toMatch(/^\d+$/);
    expect(seen.headers.hmac).toBe(
      expectedHmac({ Key: PUBLIC_KEY, Timestamp: seen.headers.timestamp }),
    );
  });

  it("signs query params as the strings sent", async () => {
    const { seen, reply } = capture(200, {
      pagination: PAGINATION,
      results: [],
    });
    api()
      .get(`${PREFIX}/events/`)
      .query({ currency_mode: "play_money", live: "true", limit: "5" })
      .reply(reply);

    await makeSdk().listEvents({
      currency_mode: "play_money",
      live: true,
      limit: 5,
    });

    expect(seen.headers.hmac).toBe(
      expectedHmac({
        Key: PUBLIC_KEY,
        Timestamp: seen.headers.timestamp,
        currency_mode: "play_money",
        live: "true",
        limit: "5",
      }),
    );
  });

  it("signs JSON body values the way Python's str() renders them", async () => {
    const body = {
      market: 4567,
      side: "bid" as const,
      currency: "USDC",
      price: 0.5,
      shares: "100",
      cancel_conflicting_orders: true,
      expired_at: null,
    };
    const { seen, reply } = capture(201, { id: 1 });
    api().post(`${PREFIX}/orders/`, body).reply(reply);

    await makeSdk().createOrder(body);

    expect(seen.headers.hmac).toBe(
      expectedHmac({
        Key: PUBLIC_KEY,
        Timestamp: seen.headers.timestamp,
        market: "4567",
        side: "bid",
        currency: "USDC",
        price: "0.5",
        shares: "100",
        cancel_conflicting_orders: "True",
        expired_at: "None",
      }),
    );
  });

  it("signs a space as + rather than %20", async () => {
    const { seen, reply } = capture(200, {
      pagination: PAGINATION,
      results: [],
    });
    api()
      .get(`${PREFIX}/events/`)
      .query({ search: "bitcoin hourly", limit: "5" })
      .reply(reply);

    await makeSdk().listEvents({ search: "bitcoin hourly", limit: 5 });

    expect(seen.headers.hmac).toBe(
      expectedHmac({
        Key: PUBLIC_KEY,
        Timestamp: seen.headers.timestamp,
        search: "bitcoin hourly",
        limit: "5",
      }),
    );
  });

  it("leaves a null query param out of the request and the signature", async () => {
    const { seen, reply } = capture(200, {
      pagination: PAGINATION,
      results: [],
    });
    api().get(`${PREFIX}/events/`).query({ limit: "5" }).reply(reply);

    await makeSdk().listEvents({
      limit: 5,
      search: null as unknown as string,
    });

    expect(seen.headers.hmac).toBe(
      expectedHmac({
        Key: PUBLIC_KEY,
        Timestamp: seen.headers.timestamp,
        limit: "5",
      }),
    );
  });

  it("sends and signs array query params as a comma-joined list", async () => {
    const { seen, reply } = capture(200, {
      pagination: PAGINATION,
      results: [],
    });
    api()
      .get(`${PREFIX}/orders/`)
      .query({ currencies: "USDC,USDT" })
      .reply(reply);

    await makeSdk().listOrders({ currencies: ["USDC", "USDT"] });

    expect(seen.headers.hmac).toBe(
      expectedHmac({
        Key: PUBLIC_KEY,
        Timestamp: seen.headers.timestamp,
        currencies: "USDC,USDT",
      }),
    );
  });

  it("signs a body array as its Python repr", async () => {
    const { seen, reply } = capture(200, []);
    api()
      .post(`${PREFIX}/orders/batch-cancel/`, { order_ids: [100, 101, 102] })
      .reply(reply);

    await makeSdk().batchCancelOrders({ order_ids: [100, 101, 102] });

    expect(seen.headers.hmac).toBe(
      expectedHmac({
        Key: PUBLIC_KEY,
        Timestamp: seen.headers.timestamp,
        order_ids: "[100, 101, 102]",
      }),
    );
  });

  it("signs nested body objects as their Python repr", async () => {
    const orders = [
      {
        market: 2231,
        side: "bid" as const,
        position: "long" as const,
        currency: "OOM",
        shares: "13",
        price: "0.43",
        expired_at: null,
        cancel_conflicting_orders: false,
      },
    ];
    const { seen, reply } = capture(200, {
      results: [],
      cancelled_existing_order_ids: [],
    });
    api().post(`${PREFIX}/orders/batch/`, { orders }).reply(reply);

    await makeSdk().batchCreateOrders({ orders });

    expect(seen.headers.hmac).toBe(
      expectedHmac({
        Key: PUBLIC_KEY,
        Timestamp: seen.headers.timestamp,
        orders:
          "[{'market': 2231, 'side': 'bid', 'position': 'long', 'currency': 'OOM', " +
          "'shares': '13', 'price': '0.43', 'expired_at': None, " +
          "'cancel_conflicting_orders': False}]",
      }),
    );
  });

  it("signs form-encoded bodies as sent", async () => {
    const { seen, reply } = capture(200, { auth: "key:sig" });
    api().post(`${PREFIX}/pusher/auth/`).reply(reply);

    await makeSdk().pusherAuth("1234.5678", "private-user-1");

    expect(seen.headers.hmac).toBe(
      expectedHmac({
        Key: PUBLIC_KEY,
        Timestamp: seen.headers.timestamp,
        socket_id: "1234.5678",
        channel_name: "private-user-1",
      }),
    );
  });

  it("sends Idempotency-Key when provided", async () => {
    const { seen, reply } = capture(201, { id: 1 });
    api().post(`${PREFIX}/orders/`).reply(reply);

    await makeSdk().createOrder(
      { market: 1, side: "bid", currency: "OOM", shares: 1 },
      { idempotencyKey: "abc-123" },
    );

    expect(seen.headers["idempotency-key"]).toBe("abc-123");
  });
});

describe("pyStr", () => {
  it.each([
    ["0.42", "0.42"],
    [3, "3"],
    [0.5, "0.5"],
    [true, "True"],
    [false, "False"],
    [null, "None"],
    [1e-5, "1e-05"],
    [0.0001, "0.0001"],
    [1.5e-7, "1.5e-07"],
    [1e21, "1e+21"],
    [1e16, "10000000000000000"],
    [{ a: 1, b: [true, "x"] }, "{'a': 1, 'b': [True, 'x']}"],
    [["it's"], `["it's"]`],
    [[`it's "q"`], `['it\\'s "q"']`],
    [["a\\b\n\t"], "['a\\\\b\\n\\t']"],
    [["\u00a0\u2028\u0007"], "['\\xa0\\u2028\\x07']"],
    [["ação 🎲"], "['ação 🎲']"],
    [[], "[]"],
    [{}, "{}"],
  ])("renders %j as %s", (value, text) => {
    expect(pyStr(value)).toBe(text);
  });
});

describe("errors", () => {
  it("throws FutuurError with the code from the standard envelope", async () => {
    api()
      .post(`${PREFIX}/orders/`)
      .reply(403, {
        type: "client_error",
        errors: [
          {
            code: "MarketClosed",
            detail: "Market is closed for trading.",
            attr: null,
          },
        ],
      });

    const err = await makeSdk()
      .createOrder({ market: 1, side: "bid", currency: "OOM", shares: 1 })
      .catch((e) => e);

    expect(err).toBeInstanceOf(FutuurError);
    expect(err.status).toBe(403);
    expect(err.code).toBe("MarketClosed");
    expect(err.message).toContain("Market is closed for trading.");
  });

  it("reads the code of an on-chain order error from the attr=code entry", async () => {
    api()
      .post(`${PREFIX}/orders/`)
      .reply(400, {
        type: "validation_error",
        errors: [
          { code: "invalid", detail: "Nonce already used.", attr: "detail" },
          { code: "invalid", detail: "order_intent_nonce_stale", attr: "code" },
        ],
      });

    const err = await makeSdk()
      .createOrder({ market: 1, side: "bid", currency: "OOM", shares: 1 })
      .catch((e) => e);

    expect(err.code).toBe("order_intent_nonce_stale");
    expect(err.message).toContain("Nonce already used.");
    expect(err.errors).toHaveLength(2);
  });

  it("keeps a plain detail body", async () => {
    api().post(`${PREFIX}/pusher/auth/`).reply(403, { detail: "Forbidden." });

    const err = await makeSdk()
      .pusherAuth("1.2", "private-user-9")
      .catch((e) => e);

    expect(err.status).toBe(403);
    expect(err.code).toBeUndefined();
    expect(err.body).toEqual({ detail: "Forbidden." });
    expect(err.message).toContain("Forbidden.");
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
    const body = { safe_address: "0xAbC123", chain_id: 84532 };
    api()
      .post(`${PREFIX}/me/safe/`, body)
      .reply(200, { address: "0xAbC123", deploy_status: "not_deployed" });
    const safe = await sdk.registerSafe(body);
    expect(safe.address).toBe("0xAbC123");
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

  it("tradingStatus → GET /trading-status/", async () => {
    api()
      .get(`${PREFIX}/trading-status/`)
      .reply(200, { trading_halted: false });
    const r = await makeSdk().tradingStatus();
    expect(r.trading_halted).toBe(false);
  });

  it("signingContext → POST /orders/signing-context/", async () => {
    const body = {
      market: "3801",
      price: "0.42",
      shares: "3",
      currency: "OOM" as const,
      position: "long" as const,
      side: "bid" as const,
    };
    api()
      .post(`${PREFIX}/orders/signing-context/`, body)
      .reply(200, { nonce: 17, expiry: 1715126400, maxUsdcRaw: "1296540" });
    const r = await makeSdk().signingContext(body);
    expect(r.nonce).toBe(17);
  });

  it("getSafeWallet sends refresh=1", async () => {
    api()
      .get(`${PREFIX}/me/safe-wallet/`)
      .query({ refresh: "1" })
      .reply(200, { address: "0xSafe", deploy_status: "deployed" });
    const r = await makeSdk().getSafeWallet({ refresh: true });
    expect(r.deploy_status).toBe("deployed");
  });

  it("getSafeTradingStatus → GET /me/safe/trading-status/", async () => {
    api()
      .get(`${PREFIX}/me/safe/trading-status/`)
      .query({ currency: "OOM" })
      .reply(200, { enabled: true });
    const r = await makeSdk().getSafeTradingStatus({ currency: "OOM" });
    expect(r.enabled).toBe(true);
  });

  it("getUserOperationReceipt passes the hash", async () => {
    api()
      .get(`${PREFIX}/me/safe/user-operation-receipt/`)
      .query({ user_operation_hash: "0xabc" })
      .reply(200, {});
    await expect(makeSdk().getUserOperationReceipt("0xabc")).resolves.toEqual(
      {},
    );
  });

  it("deriveApiKey posts to the preview host without HMAC headers", async () => {
    const { seen, reply } = capture(200, {
      id: 12,
      public_key: "pub",
      private_key: "priv",
      user_id: 42,
    });
    nock("https://web3-phase-01-preview.staging.cloud.futuur.com")
      .post("/v2.0/api-keys/derive/")
      .reply(reply);
    const r = await Futuur.deriveApiKey({
      address: "0xOwner",
      timestamp: 1712500000,
      nonce: 0,
      signature: "0xsig",
    });
    expect(r.public_key).toBe("pub");
    expect(seen.headers.hmac).toBeUndefined();
  });

  it("baseUrl with a trailing slash is normalized", async () => {
    const sdk = new Futuur({
      publicKey: PUBLIC_KEY,
      privateKey: PRIVATE_KEY,
      baseUrl: "https://api.futuur.com/v2.0/",
    });
    api().get(`${PREFIX}/me/`).reply(200, { id: 3 });
    const me = await sdk.me();
    expect(me.id).toBe(3);
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
