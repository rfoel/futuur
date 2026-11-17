export type CurrencyMode = "play_money" | "real_money";
export type Currency = "USDC" | "USDT" | "USD" | "OOM" | string;
export type Position = "long" | "short";
export type OrderSide = "bid" | "ask";
/** `gtc` rests on the book; `ioc` fills what it can now and cancels the rest. */
export type TimeInForce = "gtc" | "ioc";
/** Decimal values can be sent as strings, which keeps the signed text exact. */
export type Decimal = number | string;

export interface PaginationParams {
  /** Number of results to return per page. */
  limit?: number;
  /** The initial index from which to return the results. */
  offset?: number;
}

export interface Pagination {
  /** Total number of records matching the query. */
  total: number;
  /** URL for the next page, or null on the last page. */
  next: string | null;
  /** URL for the previous page, or null on the first page. */
  previous: string | null;
  page_size: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  pagination: Pagination;
  results: T[];
}

/** Extra per-request options accepted by mutating endpoints. */
export interface RequestOptions {
  /**
   * Value for the `Idempotency-Key` header. Replaying the same request with the
   * same key and body returns the stored response instead of duplicating work.
   */
  idempotencyKey?: string;
}

/* ── Me ─────────────────────────────────────────────────────────────── */

export type KycStatus =
  | "no_need"
  | "requested"
  | "initialized"
  | "refused"
  | "approved"
  | "by_passed";

/** Balances keyed by currency code, as decimal strings. */
export type Wallet = Record<string, string>;

export interface MeResponse {
  id: number;
  username?: string;
  email: string;
  wallet: Wallet;
  email_confirmed: boolean;
  real_currency_enabled: boolean;
  kyc_status: KycStatus;
  date_joined?: string;
  /** `"true"` when the account was created through a wallet (Privy) signup. */
  is_wallet_user?: string;
}

export interface BalancesParams {
  /** Currency code to filter by. Matching is case-insensitive. */
  currency?: Currency;
}

export interface Balance {
  currency: Currency;
  /** Balance as a decimal string. */
  amount: string;
}

export type BalancesResponse = Balance[];

export interface RegisterSafeBody {
  /** Safe smart account address. */
  safe_address: string;
  /** Defaults to the active chain. Any other value is rejected. */
  chain_id?: number;
}

export interface RankingResponse {
  /** Current leaderboard position, returned as a string. */
  ranking: string;
}

/* ── Events ─────────────────────────────────────────────────────────── */

export type EventStatus =
  "open" | "stopped" | "resolved" | "cancelled" | "paused" | "reversed";

type EventOrderingField =
  | "relevance"
  | "created_on"
  | "bet_end_date"
  | "wagers_count"
  | "volume"
  | "open_date"
  | "resolve_date";

export type EventOrdering = EventOrderingField | `-${EventOrderingField}`;

export interface EventListParams extends PaginationParams {
  /** Category IDs. A root category includes its descendants. */
  categories?: number[];
  /**
   * Category slugs, as an alternative to `categories`. When both are set, an
   * event must match both.
   */
  category_slug?: string[];
  /** @default "play_money" */
  currency_mode?: CurrencyMode;
  /** @default false */
  hide_my_bets?: boolean;
  /** @default false */
  live?: boolean;
  /** @default false */
  only_markets_i_follow?: boolean;
  ordering?: EventOrdering;
  /** @default false */
  pending_resolution?: boolean;
  /** @default false */
  resolved_only?: boolean;
  /** @maxLength 100 */
  search?: string;
  /** Tag slugs or names, up to 10. An event matches any of them. */
  tag?: string | string[];
  /** Inclusive lower bound for `bet_end_date`, ISO 8601 with a timezone. */
  bet_end_date_after?: string;
  /** Inclusive upper bound for `bet_end_date`, ISO 8601 with a timezone. */
  bet_end_date_before?: string;
}

export interface Tag {
  name: string;
  slug: string;
}

export interface Category {
  id: number;
  title: string;
  slug: string;
  parent: number | null;
  in_leaderboard: boolean;
  icon: string | null;
}

export interface Market {
  id: number;
  title: string;
  title_verbose?: string;
  /** Current probability per currency code, e.g. `{ OOM: 0.52, USDC: 0.5 }`. */
  price: Record<string, number>;
  long_label?: string;
  short_label?: string;
  status?: string;
  resolution?: string | null;
  resolution_display?: string | null;
  position_labels?: string;
  volume_play_money?: number;
  volume_real_money?: number;
  liquidity_play_money?: number;
  liquidity_real_money?: number;
  depth_play_money?: number;
  depth_real_money?: number;
  thumbnail?: string | null;
  long_thumbnail?: string | null;
  short_thumbnail?: string | null;
  order?: number;
  volume_24h_play_money?: number;
  volume_24h_real_money?: number;
  last_trade_at_play_money?: string | null;
  last_trade_at_real_money?: string | null;
}

export interface FuturEvent {
  id: number;
  title: string;
  slug: string;
  status: EventStatus;
  tags: Tag[];
  category: Category[];
  markets: Market[];
  description?: string;
  bet_end_date: string | null;
  event_start_date: string | null;
  event_end_date?: string | null;
  is_wagerable?: boolean;
  available_currencies?: Currency[];
  resolution?: string | null;
  resolve_date?: string | null;
  real_currency_available?: boolean;
  markets_correlation?: string;
  canonical_currency?: Currency;
  order_book_enabled?: boolean;
  thumbnail?: string | null;
  tax_play_money?: number | null;
  tax_real_money?: number | null;
  resolution_mode?: string;
  event_type?: string | null;
  is_live?: boolean;
  wagers_count_play_money?: number;
  wagers_count_real_money?: number;
  comment_count?: number;
  volume_play_money?: number;
  volume_real_money?: number;
  liquidity_play_money?: number;
  liquidity_real_money?: number;
  is_following?: boolean;
  is_new?: boolean;
  is_pinned?: boolean;
  hot?: boolean;
  relevance?: number;
}

export type EventListResponse = PaginatedResponse<FuturEvent>;
export type EventDetailResponse = FuturEvent;

export interface EventTaxResponse {
  /** Fee applied to play money trades, or null when untaxed. */
  tax_play_money: number | null;
  /** Fee applied to real money trades, or null when untaxed. */
  tax_real_money: number | null;
}

export interface RelatedEventMarket {
  id: number;
  title: string;
  probability: number;
  image?: string | null;
}

export interface RelatedEvent {
  id: number;
  title: string;
  wagers_count: number;
  wagers_count_canonical: number;
  volume_play_money: number | string;
  volume_real_money: number | string;
  liquidity_play_money?: number | string;
  liquidity_real_money?: number | string;
  bet_end_date: string | null;
  event_start_date: string | null;
  highest_market: RelatedEventMarket | string | null;
  highest_market_real_money: RelatedEventMarket | string | null;
}

export type RelatedEventsResponse = RelatedEvent[];

export interface EventActionsParams extends PaginationParams {
  /** @default true */
  aggregate_by_orders?: boolean;
  currency_mode?: CurrencyMode;
  /** @default false */
  following?: boolean;
  /** @default false */
  my_bets?: boolean;
  /** @maxLength 100 */
  search?: string;
}

export interface EventActionUser {
  id: number | null;
  username: string | null;
  picture: string | null;
}

export interface EventAction {
  id: number;
  event: Pick<FuturEvent, "id" | "title" | "slug" | "status"> &
    Record<string, unknown>;
  market: Market;
  user: EventActionUser;
  action: string;
  action_display: string;
  wager: number;
  price: number;
  shares: number;
  amount: number;
  profit: number | null;
  currency: Currency;
  position: Position;
  maker_rebate?: number;
  created: string;
}

export type EventActionsResponse = PaginatedResponse<EventAction>;

/* ── Markets ────────────────────────────────────────────────────────── */

export interface OrderBookParams {
  currency_mode: CurrencyMode;
  /** @default "long" */
  position?: Position;
}

export interface OrderBookLevel {
  /** Price per share at this level (0–1). */
  price: number;
  total_shares: number;
  total_amount: number;
  total_fees: number;
  cumulative_shares: number;
  cumulative_amount: number;
  cumulative_fees: number;
  /** Shares at this level belonging to you. Present when authenticated. */
  total_user_shares?: number;
  /** Requested but unfilled shares of yours. Present when authenticated. */
  total_user_shares_requested?: number;
}

export interface OrderBookResponse {
  /** Bid levels, highest price first. */
  bid: OrderBookLevel[];
  /** Ask levels, lowest price first. */
  ask: OrderBookLevel[];
}

export type TimeInterval = "day" | "week" | "month" | "year" | "all_time";

export interface PriceHistoryParams {
  /** @default "play_money" */
  currency_mode?: CurrencyMode;
  time_interval?: TimeInterval;
}

export interface PriceHistoryPoint {
  /** ISO 8601 timestamp. */
  x: string;
  /** Probability at that timestamp, expressed as a percentage. */
  y: number;
}

export interface PriceHistorySeries {
  /** Market (outcome) title. */
  name: string;
  data: PriceHistoryPoint[];
}

/** One series per market in the event. */
export type PriceHistoryResponse = PriceHistorySeries[];

/* ── Wagers ─────────────────────────────────────────────────────────── */

export type WagerStatus =
  "purchased" | "sold" | "won" | "lost" | "cancelled" | "disabled";

export interface Wager {
  id: number;
  status: WagerStatus;
  status_display: string;
  /** User resource URL. */
  user: string;
  /** Event resource URL. */
  event: string;
  /** Market resource URL. */
  market: string;
  position: Position;
  position_display: string;
  currency?: Currency;
  shares: number;
  shares_in_canonical: number;
  total_amount: string;
  purchases_amount?: number;
  active_purchases_amount: string;
  active_purchases?: unknown;
  roi: string;
  earnings: string;
  amount_on_win: string;
  amount_on_sell: string;
  last_profit: number | null;
  last_sell_amount?: number | null;
  last_purchase: string;
  last_update: string;
  last_action?: unknown;
  actions_count?: number;
}

export interface EventWagersParams {
  active?: boolean;
  /** @default "play_money" */
  currency_mode?: CurrencyMode;
  past_bets?: boolean;
}

/** Event wagers are returned unpaginated. */
export type EventWagersResponse = Wager[];

export interface WagerListParams extends PaginationParams {
  active?: boolean;
  past_bets?: boolean;
  event?: number;
  user?: number;
  following?: boolean;
  /** Empty string returns every currency mode. */
  currency_mode?: CurrencyMode | "";
}

export type WagerListResponse = PaginatedResponse<Wager>;

export type WagerDetailResponse = Wager & {
  /** Wager action history resource URL. */
  actions: string;
};

export interface RebatesParams {
  /** Calendar date in `YYYY-MM-DD` format. */
  date?: string;
  event?: number;
}

export interface RebatesResponse {
  /** Total rebated maker fees in USD for the selected scope. */
  rebated_fee_usd: number;
}

/* ── Orders ─────────────────────────────────────────────────────────── */

export type OrderStatus =
  | "processing"
  | "open"
  | "filled"
  | "partial_filled"
  | "partial_filled_cancelled"
  | "canceled";

export interface OrderListParams extends PaginationParams {
  /**
   * `open` (the default) also returns `processing` orders on open events.
   * @default "open"
   */
  status?: OrderStatus;
  side?: OrderSide;
  /** Outcome ID */
  market?: number;
  /** When set, `event` and `market` in each result are plain IDs. */
  event?: number;
  /** @maxLength 4 */
  currency?: Currency;
  currency_mode?: CurrencyMode;
  currencies?: Currency[];
  categories?: number[];
  /** @maxLength 255 */
  search?: string;
  /** `created`, `price`, `market_title`, `expiration_date` or `total`; prefix `-` to descend. */
  ordering?: string;
}

/** On-chain settlement state of an order. Empty or `none` for ledger orders. */
export type SettlementStatus =
  | "ready"
  | "approval_pending"
  | "settling"
  | "settled"
  | "failed"
  | "none"
  | "";

export type OrderEvent = Pick<
  FuturEvent,
  | "id"
  | "title"
  | "slug"
  | "status"
  | "is_wagerable"
  | "resolve_date"
  | "bet_end_date"
  | "order_book_enabled"
  | "resolution_mode"
> & { markets_count?: number };

export interface Order {
  id: number;
  /** Nested event, or a plain event ID when the list was filtered by `event`. */
  event: OrderEvent | number;
  /** Nested market, or a plain market ID when the list was filtered by `event`. */
  market: Market | number;
  side: OrderSide;
  position: Position;
  currency: Currency;
  /** Limit price (0.01–0.99); null for market orders. */
  price: number | null;
  /** Shares still unfilled. */
  shares: number;
  /** Shares the order was created with. */
  shares_requested: number;
  /** Shares filled so far. */
  shares_filled: number;
  /** For a finished `ioc` order, the shares that were canceled; 0 otherwise. */
  shares_cancelled: number;
  /** Average fill price, or null before any fill. */
  average_price: number | null;
  /**
   * Net cash of the fills where this order was the taker, after the fee: what a
   * bid paid or an ask received. Null without a taker fill.
   */
  proceeds: number | null;
  time_in_force: TimeInForce;
  status: OrderStatus;
  expired_at: string | null;
  created: string;
  /** `onchain` for signed orders, otherwise `ledger` or empty. */
  settlement_mode: "onchain" | "ledger" | "";
  settlement_status: SettlementStatus;
  /** Chain of an on-chain order, or null. */
  chain_id: number | null;
}

export type OrderListResponse = PaginatedResponse<Order>;

/**
 * Fields of a signed `LimitOrderIntent`, required for `OOM` and `USDC` orders on
 * the on-chain preview host. Take them from {@link SigningContextResponse} and
 * the owner's signature over its `eip712` payload.
 */
export interface OrderIntentFields {
  /** Hex EIP-712 signature of the `LimitOrderIntent`, by the Safe owner EOA. */
  order_intent_signature?: string;
  /** The `expiry` you signed (Unix seconds). */
  order_intent_expiry?: number | string;
  /** The `nonce` you signed. */
  order_intent_nonce?: number | string;
  /** The `maxUsdcRaw` you signed, in raw token units. `0` for asks. */
  max_usdc_raw?: number | string;
  /** Defaults to the active chain. */
  chain_id?: number | string;
}

export interface CreateOrderBody extends OrderIntentFields {
  /** Market (outcome) ID */
  market: number | string;
  side: OrderSide;
  currency: Currency;
  /**
   * Shares to buy or sell; must be greater than 0.02. On an ask, `"max"` sells
   * every share not reserved by your open asks.
   */
  shares: Decimal | "max";
  /** Only valid with `shares: "max"`: caps how many shares are sold. */
  max_shares?: Decimal;
  /** Limit price 0.01–0.99 in steps of 0.01; null for a market order. */
  price?: Decimal | null;
  /** @default "long" */
  position?: Position;
  /** @default "gtc" */
  time_in_force?: TimeInForce;
  /** ISO 8601 expiration; null for no expiry. */
  expired_at?: string | null;
  /** @default false */
  cancel_conflicting_orders?: boolean;
  /**
   * Optional cross-check of the total. It does not size the order; the create
   * fails if it no longer matches the book.
   */
  amount?: Decimal;
}

export type CreateOrderResponse = Order;

export interface BatchCreateOrderItem extends CreateOrderBody {
  /** When set, the API verifies the market belongs to this event. */
  event?: number;
  position: Position;
}

export interface BatchCreateOrdersBody {
  /** Between 1 and 20 orders. */
  orders: BatchCreateOrderItem[];
}

export interface BatchCreateOrderResult {
  /** Zero-based position of this order in the request payload. */
  index: number;
  success: boolean;
  /** Present when `success` is true. */
  order?: Order;
  /** Present when `success` is false. */
  errors?: unknown;
}

export interface BatchCreateOrdersResponse {
  results: BatchCreateOrderResult[];
  /** Orders canceled because `cancel_conflicting_orders` was set. */
  cancelled_existing_order_ids: number[];
}

export interface BatchCancelOrdersBody {
  /** Order IDs to cancel. Must contain at least one ID. */
  order_ids: number[];
}

export interface BatchCancelOrderResult {
  index: number;
  order_id: number;
  success: boolean;
  /** Present when `success` is false. */
  error?: string;
}

export type BatchCancelOrdersResponse = BatchCancelOrderResult[];

export interface BatchUpdateOrderItem {
  /** ID of the open order to update. At least one other field is required. */
  id: number;
  shares?: Decimal;
  /** Updated limit price between 0 and 1. */
  price?: Decimal;
  /** Updated ISO 8601 expiration; null removes it. */
  expired_at?: string | null;
  /** Keeps the existing value when omitted. */
  time_in_force?: TimeInForce;
  market?: number;
  side?: OrderSide;
  position?: Position;
  currency?: Currency;
}

export interface BatchUpdateOrdersBody {
  /** Between 1 and 20 updates. */
  orders: BatchUpdateOrderItem[];
}

export interface BatchUpdateOrderResult {
  index: number;
  order_id?: number;
  success: boolean;
  /** Replacement order, with a new `id`. Present when `success` is true. */
  order?: Order;
  /** Present when `success` is false. */
  errors?: unknown;
}

export type BatchUpdateOrdersResponse = BatchUpdateOrderResult[];

export interface CancelAllOrdersBody {
  /** Restrict cancellation to one event (question) ID. */
  event?: number;
  /** Restrict cancellation to one market (outcome) ID. */
  market?: number;
}

export interface CancelAllOrdersResponse {
  canceled_order_ids: number[];
  /** Orders mid-fill that must be retried through batch cancel. */
  processing_order_ids: number[];
}

/* ── WebSocket ──────────────────────────────────────────────────────── */

export interface PusherAuthResponse {
  auth: string;
  channel_data?: string;
  shared_secret?: string;
}

/* ── Trading status ─────────────────────────────────────────────────── */

export interface TradingStatusResponse {
  /** When true, order creation is paused for everyone. */
  trading_halted: boolean;
  [key: string]: unknown;
}

/* ── On-chain trading (phase-one preview host) ──────────────────────── */

export interface SigningContextBody {
  /** Market (outcome) ID */
  market: number | string;
  /** 0.01–0.99, at most two decimals. */
  price: Decimal;
  /** Greater than 0.02, at most two decimals. */
  shares: Decimal;
  currency: "OOM" | "USDC";
  position: Position;
  side: OrderSide;
  /** Defaults to your Safe's chain. */
  chain_id?: number | string;
}

export interface Eip712TypedData {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, unknown>;
}

export interface SigningContextResponse {
  /**
   * Typed data to sign with the Safe owner EOA. `types` holds only
   * `LimitOrderIntent`; add `EIP712Domain` if your library needs it.
   */
  eip712: Eip712TypedData;
  chainId: number;
  safeAddress: string;
  /** EOA that must sign. */
  ownerAddress: string;
  poolAddress: string;
  currency: string;
  collateralToken: string;
  usdcToken?: string;
  /** The Safe's next order nonce. Send back as `order_intent_nonce`. */
  nonce: number;
  /** Unix seconds, 30 days ahead. Send back as `order_intent_expiry`. */
  expiry: number;
  /** Bid cap in raw token units (6 decimals); `"0"` for an ask. Send back as `max_usdc_raw`. */
  maxUsdcRaw: string;
  allowanceRaw: string;
  /** True when this is a bid and the pool allowance is too low: enable trading first. */
  needsApproval: boolean;
}

export interface DeriveApiKeyBody {
  /** Owner EOA (checksum or lowercase). */
  address: string;
  /** Unix seconds, within ±120 s of the server clock. */
  timestamp: number;
  /** Change it when retrying within the same second. */
  nonce: number;
  /** Hex EIP-712 `DeriveApiKey` signature. */
  signature: string;
  /** Must be the chain ID you signed. Defaults to the active chain. */
  chain_id?: number;
}

export interface DeriveApiKeyResponse {
  id: number;
  public_key: string;
  private_key: string;
  user_id: number;
}

export type SafeDeployStatus =
  "not_deployed" | "not_required" | "deploying" | "deployed" | "failed";

export interface SafeWallet {
  address: string;
  chain_id: number;
  /** Orders need `deployed`. */
  deploy_status: SafeDeployStatus;
  deployed_at: string | null;
  deploy_tx: string | null;
  deploy_error: string | null;
  last_balance: number | null;
  last_balance_check_at: string | null;
  migration_status: "none" | "pending" | "done" | "failed";
  migration_tx: string | null;
  migrated_at: string | null;
  migration_error: string | null;
  onchain_settlement_enabled: boolean;
  play_money_onchain_settlement_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface SafeWalletParams {
  chain_id?: number;
  /** Re-read the balance from the chain instead of the cached value. */
  refresh?: boolean;
}

export interface ConfirmSafeDeployedBody {
  chain_id?: number;
  transaction_hash?: string;
  user_operation_hash?: string;
}

export interface RegisterSafeResponse extends SafeWallet {
  /** Result of the legacy-balance migration check, including a `reason`. */
  migration: Record<string, unknown>;
}

export interface SafeTradingStatusParams {
  /** @default "USDC" */
  currency?: "USDC" | "OOM";
  chain_id?: number;
}

export interface SafeTradingStatusResponse {
  /** True when the Safe is deployed and the pool allowance is in place. */
  enabled: boolean;
  chainId: number;
  currency: string;
  safeAddress: string | null;
  ownerAddress: string | null;
  /** The `approve` spender. */
  poolAddress: string | null;
  collateralToken: string | null;
  usdcToken?: string | null;
  allowanceRaw: string;
  /** Amount to approve: the maximum uint256. */
  approveAmountRaw: string;
  deployed: boolean;
  /** Why trading is not enabled, when it is not. */
  detail: string | null;
}

/** An ERC-4337 EntryPoint v0.7 UserOperation. */
export type UserOperation = Record<string, unknown> & { sender: string };

export interface EnableTradingBody {
  /** Signed UserOperation calling `approve(pool, amount)` on the collateral token. */
  user_operation: UserOperation;
  /** @default "USDC" */
  currency?: "USDC" | "OOM";
  chain_id?: number;
}

export interface EnableTradingResponse extends SafeTradingStatusResponse {
  alreadyEnabled: boolean;
  userOperationHash: string | null;
  confirmedAt?: string;
}

export interface UserOperationBody {
  user_operation: UserOperation;
  chain_id?: number;
  /** Must be the supported EntryPoint when set. */
  entry_point?: string;
}

export interface SubmitUserOperationResponse {
  userOperationHash: string;
}

export type BundlerRpcMethod =
  | "pm_sponsorUserOperation"
  | "eth_sendUserOperation"
  | "eth_estimateUserOperationGas"
  | "eth_getUserOperationReceipt"
  | "pimlico_getUserOperationGasPrice";

export interface BundlerRpcBody {
  method: BundlerRpcMethod;
  params: unknown[];
  chain_id?: number;
}

/** A bundler error is also returned with status 200, as `error`. */
export interface BundlerRpcResponse {
  result?: unknown;
  error?: { message: string; code: number; data?: unknown };
}
