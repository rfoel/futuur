export interface FutuurConfig {
  apiKey?: string;
  timeout?: number;
}

export interface User {
  wallet: {
    OOM: number;
    USDC: number;
  };
  username: string;
  api_version: string;
  date_joined: string;
  active_country: string;
  public_api_real_money_enabled: boolean;
  wagers_count_play_money: number;
  wagers_count_real_money: number;
  residence_country: string;
}

export type MeResponse = User;

export interface Category {
  id: number;
  title: string;
  slug: string;
  parent: Category | number | null;
  in_leaderboard: boolean;
  icon: string | null;
}

export interface Pagination {
  total: number;
  next: string | null;
  previous: string | null;
  page_size: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  pagination: Pagination;
  results: T[];
}

export interface PaginationParams {
  /**
   * Number of results to return per page. Optional.
   */
  limit?: number;
  /**
   * The initial index from which to return the results. Optional.
   */
  offset?: number;
}

interface Seo {
  seo_title_en: string;
  seo_title_pt_br: string;
  seo_description_en: string;
  seo_description_pt_br: string;
  seo_image: string | null;
  seo_image_alt_en: string | null;
  seo_image_alt_pt_br: string | null;
}

export type CategoryListResponse = PaginatedResponse<Category>;

export type CategoryDetailResponse = Category & {
  tree: Category[];
  children: Category[];
  seo: Seo;
};

export type RootCategoriesResponse = Category[];

export type RootCategoriesAndMainChildrenParams = {
  /**
   * @enum ["play_money", "real_money"]
   */
  currency_mode: "play_money" | "real_money";
};

export type RootCategoriesAndMainChildrenResponse = Category &
  {
    children: Category & {
      wagers_total: number;
    };
  }[];

export interface MarketListParams {
  categories?: number[];

  /**
   * @default "play_money"
   * @enum ["play_money", "real_money"]
   */
  currency_mode?: "play_money" | "real_money";

  /**
   * @default false
   */
  hide_my_bets?: boolean;

  /**
   * Number of results to return per page.
   */
  limit?: number;

  /**
   * @default false
   */
  live?: boolean;

  /**
   * The initial index from which to return the results.
   */
  offset?: number;

  /**
   * @default false
   */
  only_markets_i_follow?: boolean;

  /**
   * @enum ["relevance", "-created_on", "bet_end_date", "-wagers_count", "-volume"]
   */
  ordering?:
    | "relevance"
    | "-created_on"
    | "bet_end_date"
    | "-wagers_count"
    | "-volume";

  /**
   * @default false
   */
  resolved_only?: boolean;

  /**
   * @maxLength 100
   */
  search?: string;

  /**
   * @maxLength 100
   */
  tag?: string;
}

interface Price {
  OOM: number;
  BTC: number;
}

interface Outcome {
  id: number;
  title: string;
  disabled: boolean;
  price: Price;
}

interface Tag {
  id: number;
  name: string;
  slug: string;
}

interface Market {
  id: number;
  title: string;
  slug: string;
  status: string;
  status_display: string;
  tags: Tag[];
  bet_end_date: string;
  event_start_date: string | null;
  event_end_date: string | null;
  resolution: string | null;
  resolve_date: string | null;
  real_currency_available: boolean;
  is_binary: boolean;
  wagers_count: number;
  wagers_count_canonical: number;
  volume_play_money: number;
  volume_real_money: number;
  is_following: boolean;
  category: Category;
  outcomes: Outcome[];
  last_wager_real_money: number;
  last_wager_play_money: number;
  relevance: number | null;
  hot: boolean;
}

export interface MarketListResponse {
  pagination: Pagination;
  results: Market[];
}

export type MarketDetailResponse = Market & { description: string };

interface RelatedMarket {
  id: number;
  title: string;
  wagers_count: number;
  wagers_count_canonical: number;
  volume_play_money: number;
  volume_real_money: number;
  bet_end_date: string;
  event_start_date: string | null;
}

export type RelatedMarketsResponse = RelatedMarket[];

interface SuggestOutcome {
  /**
   * @maxLength 150
   */
  title: string;

  /**
   * @minimum 0.01
   * @maximum 0.99
   */
  price: number;
}

export interface SuggestMarketParams {
  /**
   * @maxLength 75
   */
  category: string;

  /**
   * @maxLength 800
   */
  description: string;

  /**
   * ISO 8601 date-time string
   */
  end_bet_date: string;

  /**
   * @minItems 2
   */
  outcomes: SuggestOutcome[];

  /**
   * @maxLength 150
   */
  title: string;
}

export type SuggestMarketResponse = {};

export interface BettingListParams {
  /**
   * Filter by active wagers (wagers with status purchased).
   */
  active?: boolean | null;

  /**

   * @enum ["play_money", "real_money"]
   */
  currency_mode?: "play_money" | "real_money";

  /**
   * Filter by bets made by users I follow.
   */
  following?: boolean | null;

  /**
   * Number of results to return per page.
   */
  limit?: number;
  /**
   * The initial index from which to return the results.
   */
  offset?: number;
  /**
   * Filter by not active wagers (wagers with status sold, won, lost, disabled)
   */
  past_bets?: boolean | null;
  question?: number;
  user?: number;
  status?: string;
}

interface Purchase {
  price: number;
  action: string;
  amount: number;
  shares: number;
  created: string;
  currency: string;
  position: string;
}

interface LastAction {
  price: number;
  action: string;
  amount: number;
  shares: number;
  created: string;
  currency: string;
  position: string;
}

interface Bet {
  id: number;
  status: string;
  status_display: string;
  user: User;
  question: Market & { description: string };
  position: string;
  active_purchases: Purchase[];
  last_action: LastAction;
  outcome: Outcome;
}

export interface BettingListResponse {
  pagination: Pagination;
  results: Bet[];
}

export type BetDetailResponse = Bet;

export interface GetPartialAmountOnSellParams {
  amount?: number;
  shares?: number;
}

export interface GetPartialAmountOnSellResponse {
  amount: number;
  shares: number;
  price: number;
}

interface CurrencyRates {
  BCH: number;
  BNB: number;
  BRL: number;
  BTC: number;
  ETH: number;
  EUR: number;
  LTC: number;
  MXN: number;
  SOL: number;
  TRX: number;
  USD: number;
  XMR: number;
  BUSD: number;
  DOGE: number;
  USDC: number;
  USDT: number;
}

interface CurrencyData {
  rates: CurrencyRates;
  currency: string;
  last_update: string;
}

export type CurrentRatesResponse = CurrencyData[];

export interface PurchaseBody {
  outcome: number;
  /**
   * @minimum -10000000000
   * @maximum 10000000000
   */
  amount?: number;
  /**
   * @minimum -10000000000
   * @maximum 10000000000
   */
  shares: number;
  /**
   * @maxLength 11
   */
  currency?: string;
  /**
   * Select 'long' (l) to bet in favor of the outcome, or 'short' (s) to bet against it.
   * @default "l"
   * @enum ["l", "s"]
   */
  position?: "l" | "s";
}

export type PurchaseResponse = Bet;

export interface SellBody {
  amount?: number;
  shares?: number;
}

export interface SellResponse {
  amount: number;
  shares: number;
}
