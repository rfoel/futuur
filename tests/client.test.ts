import CryptoJS from "crypto-js";
import nock from "nock";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Futuur } from "../src/client";

const BASE = "https://api.futuur.com";
const PUBLIC_KEY = "test_public";
const PRIVATE_KEY = "test_private";

function expectedHmac(params: Record<string, unknown>): string {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    flat[k] = Array.isArray(v) ? v.join(",") : String(v);
  }
  const paramString = Object.keys(flat)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(flat[k])}`)
    .join("&");
  return CryptoJS.HmacSHA512(paramString, PRIVATE_KEY).toString(
    CryptoJS.enc.Hex,
  );
}

function makeSdk() {
  return new Futuur({ publicKey: PUBLIC_KEY, privateKey: PRIVATE_KEY });
}

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

    nock(BASE)
      .get("/me/")
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

    nock(BASE)
      .get("/events/")
      .query({ currency_mode: "play_money", live: "true", limit: "5" })
      .reply(function () {
        capturedHeaders = this.req.headers as Record<string, string>;
        return [200, { count: 0, next: null, previous: null, results: [] }];
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

    nock(BASE)
      .post("/orders/", body)
      .reply(function () {
        capturedHeaders = this.req.headers as Record<string, string>;
        return [201, { id: 1, ...body, position: "l", status: "open" }];
      });

    await sdk.createOrder(body);

    const ts = capturedHeaders.timestamp;
    expect(capturedHeaders.hmac).toBe(
      expectedHmac({ Key: PUBLIC_KEY, Timestamp: ts, ...body }),
    );
  });

  it("joins array params with comma in signature", async () => {
    const sdk = makeSdk();
    let capturedHeaders: Record<string, string> = {};

    nock(BASE)
      .get("/orders/")
      .query(true)
      .reply(function () {
        capturedHeaders = this.req.headers as Record<string, string>;
        return [200, { count: 0, next: null, previous: null, results: [] }];
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
});

describe("Futuur endpoints", () => {
  it("me() → GET /me/", async () => {
    const sdk = makeSdk();
    nock(BASE)
      .get("/me/")
      .reply(200, { id: 1, username: "alice", email: "a@b.com" });
    const me = await sdk.me();
    expect(me.username).toBe("alice");
  });

  it("ranking() → GET /me/ranking/", async () => {
    const sdk = makeSdk();
    nock(BASE)
      .get("/me/ranking/")
      .reply(200, { rank: 7, score: 1234, total_users: 999 });
    const r = await sdk.ranking();
    expect(r.rank).toBe(7);
  });

  it("getEvent(id) → GET /events/{id}/", async () => {
    const sdk = makeSdk();
    nock(BASE).get("/events/42/").reply(200, { id: 42, title: "X" });
    const e = await sdk.getEvent(42);
    expect(e.id).toBe(42);
  });

  it("getEventActions passes filters", async () => {
    const sdk = makeSdk();
    nock(BASE)
      .get("/events/42/actions/")
      .query({ my_bets: "true", currency_mode: "real_money" })
      .reply(200, { results: [] });
    const r = await sdk.getEventActions(42, {
      my_bets: true,
      currency_mode: "real_money",
    });
    expect(r.results).toEqual([]);
  });

  it("getOrderBook requires params and hits correct path", async () => {
    const sdk = makeSdk();
    nock(BASE)
      .get("/events/42/order_book/")
      .query({ currency_mode: "play_money", market: "5", position: "l" })
      .reply(200, { bids: [], asks: [] });
    const r = await sdk.getOrderBook(42, {
      currency_mode: "play_money",
      market: 5,
      position: "l",
    });
    expect(r.bids).toEqual([]);
  });

  it("getPriceHistory hits correct path", async () => {
    const sdk = makeSdk();
    nock(BASE)
      .get("/events/42/price_history/")
      .query({ currency_mode: "play_money", time_interval: "week" })
      .reply(200, {
        currency_mode: "play_money",
        time_interval: "week",
        history: [],
      });
    const r = await sdk.getPriceHistory(42, {
      currency_mode: "play_money",
      time_interval: "week",
    });
    expect(r.time_interval).toBe("week");
  });

  it("listWagers paginates", async () => {
    const sdk = makeSdk();
    nock(BASE)
      .get("/wagers/")
      .query({ active: "true", limit: "10" })
      .reply(200, {
        count: 1,
        next: null,
        previous: null,
        results: [{ id: 1 }],
      });
    const r = await sdk.listWagers({ active: true, limit: 10 });
    expect(r.count).toBe(1);
  });

  it("getWager → GET /wagers/{id}/", async () => {
    const sdk = makeSdk();
    nock(BASE).get("/wagers/77/").reply(200, { id: 77 });
    const w = await sdk.getWager(77);
    expect(w.id).toBe(77);
  });

  it("createOrder → POST /orders/", async () => {
    const sdk = makeSdk();
    nock(BASE)
      .post("/orders/", {
        market: 4567,
        side: "bid",
        currency: "USDC",
        price: 0.62,
        shares: 100,
      })
      .reply(201, { id: 99, status: "open" });
    const o = await sdk.createOrder({
      market: 4567,
      side: "bid",
      currency: "USDC",
      price: 0.62,
      shares: 100,
    });
    expect(o.id).toBe(99);
  });

  it("cancelOrder → PATCH /orders/{id}/cancel/", async () => {
    const sdk = makeSdk();
    const scope = nock(BASE).patch("/orders/10482/cancel/").reply(204);
    await expect(sdk.cancelOrder(10482)).resolves.toBeUndefined();
    expect(scope.isDone()).toBe(true);
  });

  it("baseUrl override is honored", async () => {
    const sdk = new Futuur({
      publicKey: PUBLIC_KEY,
      privateKey: PRIVATE_KEY,
      baseUrl: "https://staging.futuur.com",
    });
    nock("https://staging.futuur.com")
      .get("/me/")
      .reply(200, { id: 2, username: "bob" });
    const me = await sdk.me();
    expect(me.username).toBe("bob");
  });
});
