export type CurrencyMode = "play_money" | "real_money";
export type Currency = "USDC" | "USDT" | "USD" | "OOM" | string;
export type Position = "l" | "s";
export type OrderSide = "bid" | "ask";

export interface PaginationParams {
  /** Number of results to return per page. */
  limit?: number;
  /** The initial index from which to return the results. */
  offset?: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/* ── Me ─────────────────────────────────────────────────────────────── */

export interface MeResponse {
  id: number;
  username: string;
  email: string;
  oom_balance: string;
  usdc_balance: string;
  usdt_balance: string;
  usd_balance: string;
  is_email_confirmed: boolean;
}

export interface RankingResponse {
  rank: number;
  score: number;
  total_users: number;
}

/* ── Events ─────────────────────────────────────────────────────────── */

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

export interface Outcome {
  id: number;
  name: string;
  price: number;
}

export interface Market {
  id: number;
  title?: string;
  outcomes: Outcome[];
}

export interface FuturEvent {
  id: number;
  title: string;
  description?: string;
  category: number;
  currency_mode: CurrencyMode;
  resolved: boolean;
  resolution?: string | null;
  pending_resolution: boolean;
  live: boolean;
  tags: string[];
  created_at: string;
  closes_at: string;
  resolved_at?: string | null;
  markets?: Market[];
}

export type EventListResponse = PaginatedResponse<FuturEvent>;
export type EventDetailResponse = FuturEvent & { markets: Market[] };

export interface EventActionsParams {
  currency_mode?: CurrencyMode;
  my_bets?: boolean;
  following?: boolean;
  /** @maxLength 100 */
  search?: string;
}

export interface EventAction {
  id: number;
  type: string;
  timestamp: string;
  market: number;
  outcome: number;
  shares: number;
  amount: number;
  price: number;
  user?: { id: number; username: string } | null;
}

export interface EventActionsResponse {
  results: EventAction[];
}

export interface OrderBookParams {
  currency_mode: CurrencyMode;
  market: number;
  /** @default "l" */
  position?: Position;
}

export interface OrderBookLevel {
  price: number;
  shares: number;
  amount: number;
  cumulative_shares: number;
  cumulative_amount: number;
  user_shares?: number;
  user_pending_shares?: number;
}

export interface OrderBookResponse {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

export type TimeInterval = "day" | "week" | "month" | "year" | "all_time";

export interface PriceHistoryParams {
  currency_mode: CurrencyMode;
  time_interval?: TimeInterval;
}

export interface PriceHistoryPoint {
  timestamp: string;
  outcomes: { outcome_id: number; name: string; price: number }[];
}

export interface PriceHistoryResponse {
  currency_mode: CurrencyMode;
  time_interval: TimeInterval;
  history: PriceHistoryPoint[];
}

export interface EventWagersParams {
  active?: boolean;
  /** @default "play_money" */
  currency_mode?: CurrencyMode;
  past_bets?: boolean;
}

export interface Wager {
  id: number;
  user?: number;
  market: number;
  event: number;
  outcome?: number;
  outcome_name?: string;
  currency: Currency;
  currency_mode: CurrencyMode;
  shares: number;
  amount: number;
  amount_spent?: number;
  avg_price?: number;
  average_price?: number;
  current_value?: number;
  payout?: number;
  status: string;
  position: Position;
  active?: boolean;
  settled?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface EventWagersResponse {
  results: Wager[];
}

/* ── Wagers ─────────────────────────────────────────────────────────── */

export interface WagerListParams extends PaginationParams {
  active?: boolean;
  past_bets?: boolean;
  event?: number;
  user?: number;
  following?: boolean;
  currency_mode?: CurrencyMode | "all";
}

export type WagerListResponse = PaginatedResponse<Wager>;

export type WagerDetailResponse = Wager & {
  market_detail?: { id: number; title: string; probability: number };
  event_detail?: { id: number; title: string; closes_at: string };
};

/* ── Orders ─────────────────────────────────────────────────────────── */

export type OrderStatus =
  | "open"
  | "partial_filled"
  | "filled"
  | "canceled"
  | "processing"
  | string;

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
  market: number;
  side: OrderSide;
  currency: Currency;
  /** Probability 0–1 for limit orders; null for market orders. */
  price: number | null;
  shares: number;
  amount: number;
  position: Position;
  status: OrderStatus;
  expired_at: string | null;
  created_at: string;
}

export type OrderListResponse = PaginatedResponse<Order>;

export interface CreateOrderBody {
  /** Market outcome ID */
  market: number;
  side: OrderSide;
  currency: Currency;
  /** Probability 0–1 for limit order; null for market order. */
  price?: number | null;
  shares?: number;
  amount?: number;
  /** @default "l" */
  position?: Position;
  /** ISO 8601 expiration; null for no expiry. */
  expired_at?: string | null;
  /** @default false */
  cancel_conflicting_orders?: boolean;
}

export type CreateOrderResponse = Order;
