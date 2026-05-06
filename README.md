# Futuur SDK

[![npm version](https://img.shields.io/npm/v/futuur.svg)](https://www.npmjs.com/package/futuur)

TypeScript SDK for the [Futuur API](https://docs.futuur.com) (v2). Type-safe access to events, markets, orders, and wagers.

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
const me = await sdk.me();
const ranking = await sdk.ranking();
```

### Events

```typescript
const events = await sdk.listEvents({
  currency_mode: "play_money",
  live: true,
  limit: 20,
});

const event = await sdk.getEvent(1023);
const actions = await sdk.getEventActions(1023, { my_bets: true });

const book = await sdk.getOrderBook(1023, {
  currency_mode: "play_money",
  market: 4567,
  position: "l",
});

const history = await sdk.getPriceHistory(1023, {
  currency_mode: "play_money",
  time_interval: "week",
});

const eventWagers = await sdk.getEventWagers(1023, { active: true });
```

### Wagers

```typescript
const wagers = await sdk.listWagers({ active: true, limit: 50 });
const wager = await sdk.getWager(98765);
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
  position: "l",
});

// Market order (price = null)
const market = await sdk.createOrder({
  market: 4567,
  side: "bid",
  currency: "USDC",
  price: null,
  amount: 50,
});

await sdk.cancelOrder(10482);
```

## API Reference

### Constructor Options

| Option       | Type   | Required | Default                     |
| ------------ | ------ | -------- | --------------------------- |
| `publicKey`  | string | yes      | —                           |
| `privateKey` | string | yes      | —                           |
| `timeout`    | number | no       | `10000`                     |
| `baseUrl`    | string | no       | `https://api.futuur.com`    |

### Methods

| Method                              | Endpoint                            |
| ----------------------------------- | ----------------------------------- |
| `me()`                              | `GET /me/`                          |
| `ranking()`                         | `GET /me/ranking/`                  |
| `listEvents(params?)`               | `GET /events/`                      |
| `getEvent(id)`                      | `GET /events/{id}/`                 |
| `getEventActions(id, params?)`      | `GET /events/{id}/actions/`         |
| `getOrderBook(id, params)`          | `GET /events/{id}/order_book/`      |
| `getPriceHistory(id, params)`       | `GET /events/{id}/price_history/`   |
| `getEventWagers(id, params?)`       | `GET /events/{id}/wagers/`          |
| `listWagers(params?)`               | `GET /wagers/`                      |
| `getWager(id)`                      | `GET /wagers/{id}/`                 |
| `listOrders(params?)`               | `GET /orders/`                      |
| `createOrder(body)`                 | `POST /orders/`                     |
| `cancelOrder(id)`                   | `PATCH /orders/{id}/cancel/`        |

## Authentication

The SDK signs every request with HMAC-SHA512 using your private key. Request headers `Key`, `Timestamp`, `HMAC` are added automatically. Never commit your private key — load it from env vars or a secrets manager.

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

Common API errors: `UserNotEnoughBalance`, `MarketClosed`, `OrderBookConflictingOrders`, `InvalidShares`.

## Migration from v1

v2 is a breaking rewrite around the new resource model (events / markets / orders / wagers). Removed: `marketList`, `marketDetail`, `relatedMarkets`, `suggestMarket`, `categoryList`, `categoryDetail`, `rootCategories`, `rootCategoriesAndMainChildren`, `bettingList`, `betDetail`, `getPartialAmountOnSell`, `currentRates`, `purchase`, `sell`. Trading now goes through `createOrder` / `cancelOrder`; positions are read via `listWagers` / `getWager`.

## Development

```bash
npm run build
```

## License

MIT

## Disclaimer

Unofficial SDK. Not affiliated with Futuur.
