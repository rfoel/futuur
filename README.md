# Futuur SDK

A TypeScript SDK for interacting with the Futuur API. This SDK provides a simple and type-safe way to interact with all Futuur API endpoints.

## Installation

```bash
npm install futuur
```

## Usage

### Initialize the SDK

```typescript
import { Futuur } from 'futuur-sdk';

const sdk = new Futuur({
  publicKey: 'your_public_key',
  privateKey: 'your_private_key',
  timeout: 10000 // optional, defaults to 10000ms
});
```

### Markets

Get list of markets:
```typescript
const markets = await sdk.marketList({
  page: 1,
  per_page: 20
});
```

Get specific market:
```typescript
const market = await sdk.marketDetail('market_id');
```

Get related markets:
```typescript
const relatedMarkets = await sdk.relatedMarkets('market_id');
```

Suggest a market:
```typescript
const suggestion = await sdk.suggestMarket({
  title: 'Market Title',
  description: 'Market Description'
});
```

### Categories

Get all categories:
```typescript
const categories = await sdk.categoryList();
```

Get specific category:
```typescript
const category = await sdk.categoryDetail('category_id');
```

Get root categories:
```typescript
const rootCategories = await sdk.rootCategories();
```

Get root categories with main children:
```typescript
const categoriesWithChildren = await sdk.rootCategoriesAndMainChildren();
```

### Betting

Place a bet:
```typescript
const bet = await sdk.purchase({
  outcome: 123456,
  shares: 100
});
```

Get betting list:
```typescript
const bets = await sdk.bettingList({
  page: 1,
  per_page: 20
});
```

Get specific bet:
```typescript
const bet = await sdk.betDetail('bet_id');
```

Get partial amount on sell:
```typescript
const amount = await sdk.getPartialAmountOnSell('bet_id', {
  shares: 50
});
```

Get current rates:
```typescript
const rates = await sdk.currentRates();
```

### User Information

Get user information:
```typescript
const userInfo = await sdk.me();
```

## Error Handling

The SDK throws errors with detailed information about the failed request. It's recommended to wrap API calls in try-catch blocks:

```typescript
try {
  const result = await sdk.purchase({
    outcome: 123456,
    shares: 100
  });
  console.log('Success:', result);
} catch (error) {
  console.error('Operation failed:', error);
}
```

## API Reference

### Constructor Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| publicKey | string | Yes | - | Your Futuur API public key |
| privateKey | string | Yes | - | Your Futuur API private key |
| timeout | number | No | 10000 | Request timeout in milliseconds |

### Available Methods

| Method | Description |
|--------|-------------|
| `me()` | Get user information |
| `categoryList(params?)` | Get list of categories |
| `categoryDetail(id)` | Get specific category details |
| `rootCategories()` | Get root categories |
| `rootCategoriesAndMainChildren(params?)` | Get root categories with main children |
| `marketList(params?)` | Get list of markets |
| `marketDetail(id)` | Get specific market details |
| `relatedMarkets(id)` | Get related markets |
| `suggestMarket(params)` | Suggest a new market |
| `bettingList(params)` | Get list of bets |
| `betDetail(id)` | Get specific bet details |
| `getPartialAmountOnSell(id, params?)` | Get partial amount on sell |
| `currentRates()` | Get current rates |
| `purchase(body)` | Place a bet |

## Authentication

The SDK automatically handles authentication using HMAC signatures. Each request is signed using your private key and includes:
- Your public key
- A timestamp
- An HMAC signature

## Development

### Building

```bash
npm run build
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

If you encounter any issues or have questions, please file an issue on the GitHub repository.

## Security

Never commit or share your private key. Always use environment variables or secure secret management systems to handle sensitive credentials.

## Disclaimer

This is an unofficial SDK and is not affiliated with, maintained by, or in any way officially connected with Futuur.
```
