# Futuur SDK

[![npm version](https://img.shields.io/npm/v/futuur.svg)](https://www.npmjs.com/package/futuur)

TypeScript SDK for the [Futuur API](https://docs.futuur.com) (v2.0). Type-safe access to events, markets, orders, and wagers.

Zero runtime dependencies: requests go through the built-in `fetch` and are signed with Web Crypto, so it runs on Node.js 22+, Bun, Deno, and edge runtimes.

Full API reference: [docs.futuur.com](https://docs.futuur.com).

## Installation

```bash
npm install futuur
```

## Usage

### Initialize

```typescript
import { Futuur } from "futuur";

const sdk = new Futuur({
  publicKey: process.env.FUTUUR_PUBLIC_KEY!,
  privateKey: process.env.FUTUUR_PRIVATE_KEY!,
  timeout: 10000, // optional, default 10000ms
  // fetch: customFetch, // optional, defaults to globalThis.fetch
});
```

### Account

```typescript
const me = await sdk.me(); // { wallet: { USDC: "100.00", ... }, kyc_status, ... }
const balances = await sdk.balances({ currency: "USDC" });
const ranking = await sdk.ranking();

await sdk.registerSafe({ safe_address: "0xAbC…123", chain_id: 137 });
```

### Events

```typescript
const events = await sdk.listEvents({
  currency_mode: "play_money",
  live: true,
  limit: 20,
});
console.log(events.pagination.total, events.results);

const event = await sdk.getEvent(1023);
const actions = await sdk.getEventActions(1023, { my_bets: true });
const tax = await sdk.getEventTax(1023);
const related = await sdk.getRelatedEvents(1023);

const history = await sdk.getPriceHistory(1023, {
  currency_mode: "play_money",
  time_interval: "week",
});

const eventWagers = await sdk.getEventWagers(1023, { active: true });
```

### Markets

`getOrderBook` takes a **market (outcome) ID**, not an event ID.

```typescript
const book = await sdk.getOrderBook(4567, {
  currency_mode: "play_money",
  position: "long",
});

book.bid; // highest price first
book.ask; // lowest price first
```

### Wagers

```typescript
const wagers = await sdk.listWagers({ active: true, limit: 50 });
const wager = await sdk.getWager(98765);
const rebates = await sdk.getRebates({ date: "2026-06-25" });
```

### Orders

```typescript
const open = await sdk.listOrders({ status: "open", side: "bid" });

// Limit order: rests on the book until filled or canceled (time_in_force "gtc")
const limit = await sdk.createOrder({
  market: 4567,
  side: "bid",
  currency: "USDC",
  price: "0.62",
  shares: "100",
  position: "long",
});

// Immediate-or-cancel: fills at 0.62 or better now, cancels the rest
const ioc = await sdk.createOrder({
  market: 4567,
  side: "bid",
  currency: "USDC",
  price: "0.62",
  shares: "100",
  time_in_force: "ioc",
});

// Sell everything you hold on that market and position
await sdk.createOrder({
  market: 4567,
  side: "ask",
  currency: "USDC",
  price: "0.60",
  shares: "max",
});

// Market order (price = null)
const market = await sdk.createOrder({
  market: 4567,
  side: "bid",
  currency: "USDC",
  price: null,
  shares: 60,
});

await sdk.cancelOrder(10482);
```

`shares` is required on every order; `amount` is only an optional cross-check and does not
size the order. To turn a budget into shares, walk `getOrderBook` for a price you know will fill.

A new order usually comes back as `processing`: matching runs after the response. There is no
endpoint for a single order, so read the final `status`, `shares_filled`, `average_price` and
`proceeds` from `listOrders`. Only `open` orders can be canceled.

Pass an idempotency key to make a retry safe:

```typescript
await sdk.createOrder(body, { idempotencyKey: crypto.randomUUID() });
```

### Batch orders

Batch endpoints accept 1–20 items and validate each one independently, so partial failures are normal — always inspect the per-item `success` flag.

`batchCreateOrders` **replaces your quotes**: before the first item on a market is created, every open order you have on that event, market and currency is canceled, and the IDs come back in `cancelled_existing_order_ids`. `batchUpdateOrders` replaces each order with a new one that has a new `id`.

```typescript
const created = await sdk.batchCreateOrders({
  orders: [
    { market: 2231, side: "bid", position: "long", currency: "OOM", shares: "13", price: "0.43" },
    { market: 2231, side: "bid", position: "short", currency: "OOM", shares: "5", price: "0.44" },
  ],
});
created.results.filter((r) => !r.success); // items that failed validation

await sdk.batchUpdateOrders({
  orders: [{ id: 100, shares: "12", price: "0.48" }],
});

await sdk.batchCancelOrders({ order_ids: [100, 101] });

// Cancel everything, or scope to one event/market
const { canceled_order_ids, processing_order_ids } = await sdk.cancelAllOrders({
  event: 873,
});
// processing_order_ids were mid-fill — retry them with batchCancelOrders
```

### Real-time updates

Futuur streams market data over [Pusher](https://pusher.com). Public channels (`event`, `event-{event_id}`) need no authorization; private channels do, and `pusherAuth` signs that handshake.

```typescript
import Pusher from "pusher-js";

const pusher = new Pusher("9011f7eac38e825792d5", {
  cluster: "us2",
  channelAuthorization: {
    customHandler: ({ socketId, channelName }, callback) => {
      sdk
        .pusherAuth(socketId, channelName)
        .then((auth) => callback(null, auth))
        .catch((err) => callback(err, null));
    },
  },
});

pusher.subscribe("private-user-1");
```

### On-chain trading (preview host)

Futuur is moving collateral on-chain. Phase one runs on a preview host on Base Sepolia, where every `OOM` or `USDC` order must also carry an EIP-712 `LimitOrderIntent` signed by your Safe's owner wallet. Production does not accept these fields yet. See [Environment](https://docs.futuur.com/environment.md) and [Place an on-chain order](https://docs.futuur.com/guides/on-chain-first-order.md).

The SDK does not hold your wallet key; sign the typed data with the library of your choice (viem shown here):

```typescript
import { Futuur, PREVIEW_BASE_URL } from "futuur";
import { privateKeyToAccount } from "viem/accounts";

const owner = privateKeyToAccount(process.env.OWNER_KEY as `0x${string}`);
const sdk = new Futuur({ publicKey, privateKey, baseUrl: PREVIEW_BASE_URL });

const status = await sdk.getSafeTradingStatus({ currency: "OOM" });
if (!status.enabled) throw new Error("Enable trading for OOM first");

// Run signing context → sign → create one order at a time per Safe.
const order = {
  market: "3801",
  side: "bid",
  position: "long",
  price: "0.42",
  shares: "3",
  currency: "OOM",
} as const;
const ctx = await sdk.signingContext(order);
const signature = await owner.signTypedData(ctx.eip712 as any);

await sdk.createOrder({
  ...order,
  time_in_force: "ioc",
  order_intent_signature: signature,
  order_intent_expiry: ctx.expiry,
  order_intent_nonce: ctx.nonce,
  max_usdc_raw: ctx.maxUsdcRaw,
});
```

HMAC keys can also be derived from the owner wallet with `Futuur.deriveApiKey(...)`, which is unauthenticated and defaults to the preview host. Market orders (`price: null`) and `shares: "max"` cannot be signed; use `time_in_force: "ioc"` with a price and an explicit share count.

## API Reference

### Constructor Options

| Option       | Type   | Required | Default                         |
| ------------ | ------ | -------- | ------------------------------- |
| `publicKey`  | string | yes      | —                               |
| `privateKey` | string | yes      | —                               |
| `timeout`    | number | no       | `10000`                         |
| `baseUrl`    | string | no       | `https://api.futuur.com/v2.0`   |
| `fetch`      | function | no     | `globalThis.fetch`              |

### Methods

| Method                                 | Endpoint                          |
| -------------------------------------- | --------------------------------- |
| `me()`                                 | `GET /me/`                        |
| `balances(params?)`                    | `GET /me/balances/`               |
| `ranking()`                            | `GET /me/ranking/`                |
| `listEvents(params?)`                  | `GET /events/`                    |
| `getEvent(id)`                         | `GET /events/{id}/`               |
| `getEventActions(id, params?)`         | `GET /events/{id}/actions/`       |
| `getEventTax(id)`                      | `GET /events/{id}/get_tax/`       |
| `getRelatedEvents(id)`                 | `GET /events/{id}/related_events/`|
| `getPriceHistory(id, params)`          | `GET /events/{id}/price_history/` |
| `getEventWagers(id, params?)`          | `GET /events/{id}/wagers/`        |
| `getOrderBook(marketId, params)`       | `GET /markets/{id}/book/`         |
| `listWagers(params?)`                  | `GET /wagers/`                    |
| `getWager(id)`                         | `GET /wagers/{id}/`               |
| `getRebates(params?)`                  | `GET /wagers/rebates/`            |
| `listOrders(params?)`                  | `GET /orders/`                    |
| `createOrder(body, options?)`          | `POST /orders/`                   |
| `batchCreateOrders(body, options?)`    | `POST /orders/batch/`             |
| `batchUpdateOrders(body, options?)`    | `POST /orders/batch-update/`      |
| `cancelOrder(id)`                      | `PATCH /orders/{id}/cancel/`      |
| `batchCancelOrders(body)`              | `POST /orders/batch-cancel/`      |
| `cancelAllOrders(body?)`               | `POST /orders/cancel-all/`        |
| `tradingStatus()`                      | `GET /trading-status/`            |
| `pusherAuth(socketId, channelName)`    | `POST /pusher/auth/`              |

On-chain trading, phase-one preview host only:

| Method                                 | Endpoint                                |
| -------------------------------------- | --------------------------------------- |
| `signingContext(body)`                 | `POST /orders/signing-context/`         |
| `Futuur.deriveApiKey(body, config?)`   | `POST /api-keys/derive/`                |
| `registerSafe(body)`                   | `POST /me/safe/` (wallet session only)  |
| `getSafeWallet(params?)`               | `GET /me/safe-wallet/`                  |
| `confirmSafeDeployed(body?)`           | `POST /me/safe/deployed/`               |
| `getSafeTradingStatus(params?)`        | `GET /me/safe/trading-status/`          |
| `enableTrading(body)`                  | `POST /me/safe/enable-trading/`         |
| `sponsorUserOperation(body)`           | `POST /me/safe/sponsor-user-operation/` |
| `submitUserOperation(body)`            | `POST /me/safe/submit-user-operation/`  |
| `getUserOperationReceipt(hash, chain?)`| `GET /me/safe/user-operation-receipt/`  |
| `bundlerRpc(body)`                     | `POST /me/safe/pimlico-rpc/`            |

### Pagination

List endpoints return `{ pagination, results }`:

```typescript
const { pagination, results } = await sdk.listOrders({ limit: 20 });
pagination.total; // total records matching the query
pagination.next; // URL of the next page, or null
```

`getEventWagers` and `getRelatedEvents` are the exceptions — they return plain arrays.

## Authentication

The SDK signs every request with HMAC-SHA512 using your private key. Request headers `Key`, `Timestamp`, `HMAC` are added automatically. Never commit your private key — load it from env vars or a secrets manager.

Query params and top-level body fields are folded into the signed parameter set, sorted by name in code-point order and URL-encoded. The server signs what it _parsed_, as Python renders it, and the SDK mirrors that:

- Query values sign as the strings sent; arrays go out as a comma-joined list. A null query param is left off the wire and out of the signature.
- JSON body values sign as Python's `str()`: `true` → `True`, `null` → `None`, `0.50` → `0.5`, and nested objects and arrays (the batch `orders`, `order_ids`, `user_operation`) as their Python `repr`, e.g. `[100, 101]`.
- Encoding follows Python's `urlencode`: a space signs as `+`, and `!'()*` are escaped.

Getting any of this wrong yields `authentication_failed` — a 401 that reads like a credential problem but is really a signature one. `me()` takes no params, so if it succeeds while a parameterised call fails, the credentials are fine. Sending decimals as strings (`price: "0.42"`) keeps the signed text exactly what you typed.

Rate limits are 2,000 requests/minute and 1,000,000/day per account. Order creation (`createOrder`, `batchCreateOrders`, `batchUpdateOrders` combined) is limited to 30 requests/minute. See [Rate limits](https://docs.futuur.com/rate-limits.md).

## Error Handling

Every non-2xx response throws a `FutuurError`:

```typescript
import { FutuurError } from "futuur";

try {
  await sdk.createOrder({
    market: 4567,
    side: "bid",
    currency: "USDC",
    price: "0.62",
    shares: "100",
  });
} catch (err) {
  if (err instanceof FutuurError) {
    err.status; // 403
    err.code; // "MarketClosed"
    err.errors; // [{ code, detail, attr }]
    err.body; // raw response body
  }
  throw err;
}
```

For on-chain order errors, which the API reports as a two-entry `400`, `code` is the specific code (for example `order_intent_nonce_stale`). Timeouts reject with the runtime's `TimeoutError`.

Common codes: `UserNotEnoughBalance`, `MarketClosed`, `OrderBookConflictingOrders`, `InvalidShares`, `LimitOrderBeingProcessing`, `authentication_failed`, `throttled`, `trading_halted`. The full list is in [Errors](https://docs.futuur.com/errors.md).

## Migration from v2

v3 drops axios and crypto-js and has no runtime dependencies.

- Errors are `FutuurError` instead of `AxiosError`: read `err.status`, `err.code` and `err.body` instead of `err.response`.
- Node.js 22 or newer is required (or any runtime with `fetch` and Web Crypto).
- JSON bodies are signed with Python's rendering, so booleans and the arrays on `batchCancelOrders` and the batch endpoints now sign correctly.
- `Order` matches the current API: `created` (not `created_at`), no `amount`, plus `shares_cancelled`, `average_price`, `proceeds`, `time_in_force` and settlement fields; `event` and `market` are nested objects unless the list is filtered by `event`.
- `shares` is required on `createOrder`; `registerSafe` now returns the Safe wallet and only works from a wallet session.

## Migration from v1

v2 is a breaking rewrite around the new resource model (events / markets / orders / wagers). Removed: `marketList`, `marketDetail`, `relatedMarkets`, `suggestMarket`, `categoryList`, `categoryDetail`, `rootCategories`, `rootCategoriesAndMainChildren`, `bettingList`, `betDetail`, `getPartialAmountOnSell`, `currentRates`, `purchase`, `sell`. Trading now goes through `createOrder` / `cancelOrder`; positions are read via `listWagers` / `getWager`.

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## License

MIT

## Disclaimer

Unofficial SDK. Not affiliated with Futuur.
