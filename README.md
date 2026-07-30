# Futuur SDK

[![npm version](https://img.shields.io/npm/v/futuur.svg)](https://www.npmjs.com/package/futuur)

TypeScript SDK for the [Futuur API](https://docs.futuur.com) (v2.0). Type-safe access to events, markets, orders, and wagers.

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

// Limit order
const limit = await sdk.createOrder({
  market: 4567,
  side: "bid",
  currency: "USDC",
  price: 0.62,
  shares: 100,
  position: "long",
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

`shares` is required on both forms. A body that carries only `amount` is rejected with
`KeyError: 'shares'`, so size the order yourself — walk `getOrderBook` if you want to
convert a budget into shares at a price you know will fill.

Pass an idempotency key to make a retry safe:

```typescript
await sdk.createOrder(body, { idempotencyKey: crypto.randomUUID() });
```

### Batch orders

Batch endpoints accept 1–20 items and validate each one independently, so partial failures are normal — always inspect the per-item `success` flag.

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

## API Reference

### Constructor Options

| Option       | Type   | Required | Default                         |
| ------------ | ------ | -------- | ------------------------------- |
| `publicKey`  | string | yes      | —                               |
| `privateKey` | string | yes      | —                               |
| `timeout`    | number | no       | `10000`                         |
| `baseUrl`    | string | no       | `https://api.futuur.com/v2.0`   |

### Methods

| Method                                 | Endpoint                          |
| -------------------------------------- | --------------------------------- |
| `me()`                                 | `GET /me/`                        |
| `balances(params?)`                    | `GET /me/balances/`               |
| `registerSafe(body)`                   | `POST /me/safe/`                  |
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
| `pusherAuth(socketId, channelName)`    | `POST /pusher/auth/`              |

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

Query params (GET) and body params (POST) are folded into the signed parameter set, sorted alphabetically and URL-encoded. Nested bodies — the `orders` array on the batch endpoints — are serialized as JSON before signing.

The encoding has to match the API's, which is Python's `urlencode`, so a space signs as `+` and `!'()*` are escaped. Null handling differs by location: a null query param never reaches the wire and is left out of the signature, while a null body param does reach the wire and signs as `None`. Getting either wrong yields `authentication_failed` — a 401 that reads like a credential problem but is really a signature one. `me()` takes no params, so if it succeeds while a parameterised call fails, the credentials are fine.

Rate limits are 2,000 requests/minute and 30,000/day per account; identical POSTs within 1 second are rejected as duplicates.

## Error Handling

```typescript
try {
  await sdk.createOrder({
    market: 4567,
    side: "bid",
    currency: "USDC",
    price: 0.62,
    shares: 100,
  });
} catch (err) {
  // axios error — inspect err.response?.data for API error code
  console.error(err);
}
```

Common API errors: `UserNotEnoughBalance`, `MarketClosed`, `OrderBookConflictingOrders`, `InvalidShares`, `InvalidHMACSignature`.

## Migration from v1

v2 is a breaking rewrite around the new resource model (events / markets / orders / wagers). Removed: `marketList`, `marketDetail`, `relatedMarkets`, `suggestMarket`, `categoryList`, `categoryDetail`, `rootCategories`, `rootCategoriesAndMainChildren`, `bettingList`, `betDetail`, `getPartialAmountOnSell`, `currentRates`, `purchase`, `sell`. Trading now goes through `createOrder` / `cancelOrder`; positions are read via `listWagers` / `getWager`.

## Development

```bash
npm run build
npm test
```

## License

MIT

## Disclaimer

Unofficial SDK. Not affiliated with Futuur.
