export type CurrencyMode = "play_money" | "real_money";
export type Currency = "USDC" | "USDT" | "USD" | "OOM" | string;
export type Position = "long" | "short";
export type OrderSide = "bid" | "ask";

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
  /** Chain ID where the Safe is deployed (1 = Ethereum, 137 = Polygon). */
  chain_id: number;
}

export interface RankingResponse {
  /** Current leaderboard position, returned as a string. */
  ranking: string;
}

/* ── Events ─────────────────────────────────────────────────────────── */

export type EventStatus =
  "open" | "stopped" | "resolved" | "cancelled" | "paused" | "reversed";

export type EventOrdering =
  | "relevance"
  | "-created_on"
  | "bet_end_date"
  | "-wagers_count"
  | "-volume"
  | string;

export interface EventListParams extends PaginationParams {
  categories?: number[];
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
  /** @maxLength 100 */
  tag?: string;
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
  order?: number;
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
  currency_mode: CurrencyMode;
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
  "open" | "partial_filled" | "filled" | "canceled" | "processing";

export interface OrderListParams extends PaginationParams {
  /** @default "open" */
  status?: OrderStatus;
  side?: OrderSide;
  /** Outcome ID */
  market?: number;
  event?: number;
  /** @maxLength 4 */
  currency?: Currency;
  currency_mode?: CurrencyMode;
  currencies?: Currency[];
  categories?: number[];
  /** @maxLength 255 */
  search?: string;
  ordering?: string;
}

export interface Order {
  id: number;
  market: number | string;
  event?: number | string;
  side: OrderSide;
  currency: Currency;
  /** Probability 0–1 for limit orders; null for market orders. */
  price: number | null;
  shares: number;
  shares_requested?: number;
  shares_filled?: string | number;
  amount?: number;
  position: Position;
  status: OrderStatus;
  expired_at: string | null;
  created_at?: string;
  /** Batch endpoints return the creation timestamp as `created`. */
  created?: string;
}

export type OrderListResponse = PaginatedResponse<Order>;

export interface CreateOrderBody {
  /** Market (outcome) ID */
  market: number;
  side: OrderSide;
  currency: Currency;
  /** Probability 0–1 for a limit order; null for a market order. */
  price?: number | string | null;
  shares?: number | string;
  amount?: number | string;
  position?: Position;
  /** ISO 8601 expiration; null for no expiry. */
  expired_at?: string | null;
  /** @default false */
  cancel_conflicting_orders?: boolean;
}

export type CreateOrderResponse = Order;

export interface BatchCreateOrderItem extends CreateOrderBody {
  /** When set, the API verifies the market belongs to this event. */
  event?: number;
  position: Position;
  shares: number | string;
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
  /** ID of the open order to update. */
  id: number;
  shares?: number | string;
  /** Updated limit price between 0 and 1. */
  price?: number | string;
  /** Updated ISO 8601 expiration; null removes it. */
  expired_at?: string | null;
}

export interface BatchUpdateOrdersBody {
  /** Between 1 and 20 updates. */
  orders: BatchUpdateOrderItem[];
}

export interface BatchUpdateOrderResult {
  index: number;
  order_id?: number;
  success: boolean;
  /** Replacement order. Present when `success` is true. */
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
