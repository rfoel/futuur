import { FutuurError } from "./errors";
import {
  hmacSha512Hex,
  importHmacKey,
  pyStr,
  queryValue,
  quotePlus,
  signatureString,
} from "./signing";
import {
  BalancesParams,
  BalancesResponse,
  BatchCancelOrdersBody,
  BatchCancelOrdersResponse,
  BatchCreateOrdersBody,
  BatchCreateOrdersResponse,
  BatchUpdateOrdersBody,
  BatchUpdateOrdersResponse,
  BundlerRpcBody,
  BundlerRpcResponse,
  CancelAllOrdersBody,
  CancelAllOrdersResponse,
  ConfirmSafeDeployedBody,
  CreateOrderBody,
  CreateOrderResponse,
  DeriveApiKeyBody,
  DeriveApiKeyResponse,
  EnableTradingBody,
  EnableTradingResponse,
  EventActionsParams,
  EventActionsResponse,
  EventDetailResponse,
  EventListParams,
  EventListResponse,
  EventTaxResponse,
  EventWagersParams,
  EventWagersResponse,
  MeResponse,
  OrderBookParams,
  OrderBookResponse,
  OrderListParams,
  OrderListResponse,
  PriceHistoryParams,
  PriceHistoryResponse,
  PusherAuthResponse,
  RankingResponse,
  RebatesParams,
  RebatesResponse,
  RegisterSafeBody,
  RegisterSafeResponse,
  RelatedEventsResponse,
  RequestOptions,
  SafeTradingStatusParams,
  SafeTradingStatusResponse,
  SafeWallet,
  SafeWalletParams,
  SigningContextBody,
  SigningContextResponse,
  SubmitUserOperationResponse,
  TradingStatusResponse,
  UserOperationBody,
  WagerDetailResponse,
  WagerListParams,
  WagerListResponse,
} from "./types";

export const DEFAULT_BASE_URL = "https://api.futuur.com/v2.0";

/**
 * Base URL of the phase-one on-chain preview host (Base Sepolia). The Safe,
 * signing-context and derive endpoints only exist there.
 */
export const PREVIEW_BASE_URL =
  "https://web3-phase-01-preview.staging.cloud.futuur.com/v2.0";

export interface FutuurConfig {
  publicKey: string;
  privateKey: string;
  /** Request timeout in milliseconds. @default 10000 */
  timeout?: number;
  /** @default "https://api.futuur.com/v2.0" */
  baseUrl?: string;
  /** Custom `fetch` implementation. @default globalThis.fetch */
  fetch?: typeof fetch;
}

type Query = object | undefined;

interface RequestInit {
  query?: Query;
  /** JSON body. */
  json?: object;
  /** Form-encoded body. */
  form?: Record<string, string>;
  headers?: Record<string, string>;
}

interface Transport {
  baseUrl: string;
  timeout: number;
  fetch: typeof fetch;
}

export class Futuur {
  private readonly transport: Transport;
  private readonly publicKey: string;
  private readonly privateKey: string;
  private signingKey?: Promise<CryptoKey>;

  constructor(config: FutuurConfig) {
    this.publicKey = config.publicKey;
    this.privateKey = config.privateKey;
    this.transport = Futuur.transport(config);
  }

  private static transport(
    config: Pick<FutuurConfig, "baseUrl" | "timeout" | "fetch">,
  ): Transport {
    return {
      baseUrl: (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, ""),
      timeout: config.timeout || 10000,
      fetch: config.fetch ?? globalThis.fetch.bind(globalThis),
    };
  }

  /** Build a query string that matches the parameter set used for signing. */
  private static queryParams(query: Query): [string, string][] {
    return Object.entries(query ?? {})
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => [k, queryValue(v)]);
  }

  /**
   * The parameters the server signs: top-level body fields as Python renders
   * them, then the query string, whose values win on a duplicate name.
   */
  private static signedParams(init: RequestInit): Record<string, string> {
    const signed: Record<string, string> = {};
    if (init.json) {
      // Sign what the server will parse, not the object we were given: the round
      // trip drops `undefined`, applies `toJSON` and turns NaN into null.
      const parsed = JSON.parse(JSON.stringify(init.json)) as Record<
        string,
        unknown
      >;
      for (const [key, value] of Object.entries(parsed)) {
        signed[key] = pyStr(value);
      }
    }
    if (init.form) Object.assign(signed, init.form);
    for (const [key, value] of Futuur.queryParams(init.query)) {
      signed[key] = value;
    }
    return signed;
  }

  private static async send<T>(
    transport: Transport,
    method: string,
    path: string,
    init: RequestInit,
  ): Promise<T> {
    const qs = Futuur.queryParams(init.query)
      .map(([k, v]) => `${quotePlus(k)}=${quotePlus(v)}`)
      .join("&");
    const url = `${transport.baseUrl}${path}${qs ? `?${qs}` : ""}`;

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...init.headers,
    };
    let body: string | undefined;
    if (init.json) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(init.json);
    } else if (init.form) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = new URLSearchParams(init.form).toString();
    }

    const response = await transport.fetch(url, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(transport.timeout),
    });

    const text = await response.text();
    let data: unknown = text || undefined;
    if (text && response.headers.get("content-type")?.includes("json")) {
      data = JSON.parse(text);
    }

    if (!response.ok) {
      throw new FutuurError(response.status, data, method, url);
    }
    return data as T;
  }

  private async request<T>(
    method: string,
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    this.signingKey ??= importHmacKey(this.privateKey);
    const hmac = await hmacSha512Hex(
      await this.signingKey,
      signatureString({
        ...Futuur.signedParams(init),
        Key: this.publicKey,
        Timestamp: timestamp,
      }),
    );

    return Futuur.send<T>(this.transport, method, path, {
      ...init,
      headers: {
        ...init.headers,
        Key: this.publicKey,
        Timestamp: timestamp,
        HMAC: hmac,
      },
    });
  }

  private static idempotencyHeaders(
    options?: RequestOptions,
  ): Record<string, string> | undefined {
    return options?.idempotencyKey
      ? { "Idempotency-Key": options.idempotencyKey }
      : undefined;
  }

  /* ── Me ───────────────────────────────────────────────────────────── */

  /** Authenticated account details and wallet balances. */
  me(): Promise<MeResponse> {
    return this.request("GET", "/me/");
  }

  /** Ledger balances, one row per currency. */
  balances(params?: BalancesParams): Promise<BalancesResponse> {
    return this.request("GET", "/me/balances/", { query: params });
  }

  /** Current leaderboard ranking position. */
  ranking(): Promise<RankingResponse> {
    return this.request("GET", "/me/ranking/");
  }

  /* ── Events ───────────────────────────────────────────────────────── */

  /** Paginated list of prediction market events. */
  listEvents(params?: EventListParams): Promise<EventListResponse> {
    return this.request("GET", "/events/", { query: params });
  }

  /** Detailed information for a single event. */
  getEvent(id: string | number): Promise<EventDetailResponse> {
    return this.request("GET", `/events/${id}/`);
  }

  /** Trade activity feed for an event. */
  getEventActions(
    id: string | number,
    params?: EventActionsParams,
  ): Promise<EventActionsResponse> {
    return this.request("GET", `/events/${id}/actions/`, { query: params });
  }

  /** Fee structure applied to trades on an event. */
  getEventTax(id: string | number): Promise<EventTaxResponse> {
    return this.request("GET", `/events/${id}/get_tax/`);
  }

  /** Events related by topic, category and recent activity. */
  getRelatedEvents(id: string | number): Promise<RelatedEventsResponse> {
    return this.request("GET", `/events/${id}/related_events/`);
  }

  /** Historical price data for an event over a time interval. */
  getPriceHistory(
    id: string | number,
    params?: PriceHistoryParams,
  ): Promise<PriceHistoryResponse> {
    return this.request("GET", `/events/${id}/price_history/`, {
      query: params,
    });
  }

  /** Wagers placed on a specific event. Returned unpaginated. */
  getEventWagers(
    id: string | number,
    params?: EventWagersParams,
  ): Promise<EventWagersResponse> {
    return this.request("GET", `/events/${id}/wagers/`, { query: params });
  }

  /* ── Markets ──────────────────────────────────────────────────────── */

  /**
   * Aggregated order book for a market (outcome).
   * `id` is the market ID, not the event ID.
   */
  getOrderBook(
    id: string | number,
    params: OrderBookParams,
  ): Promise<OrderBookResponse> {
    return this.request("GET", `/markets/${id}/book/`, { query: params });
  }

  /* ── Wagers ───────────────────────────────────────────────────────── */

  /** Paginated wagers with user and activity filters. */
  listWagers(params?: WagerListParams): Promise<WagerListResponse> {
    return this.request("GET", "/wagers/", { query: params });
  }

  /** Detailed wager information by ID. */
  getWager(id: string | number): Promise<WagerDetailResponse> {
    return this.request("GET", `/wagers/${id}/`);
  }

  /** Rebated maker fees for the authenticated user. */
  getRebates(params?: RebatesParams): Promise<RebatesResponse> {
    return this.request("GET", "/wagers/rebates/", { query: params });
  }

  /* ── Orders ───────────────────────────────────────────────────────── */

  /**
   * Paginated limit orders. There is no endpoint for a single order, so this is
   * also how to read an order's fills.
   */
  listOrders(params?: OrderListParams): Promise<OrderListResponse> {
    return this.request("GET", "/orders/", { query: params });
  }

  /**
   * Place an order. A `gtc` order rests on the book; an `ioc` order fills what
   * it can at `price` or better and cancels the rest; `price: null` makes a
   * market order. The response usually reads `processing`: read the final
   * state from {@link listOrders}.
   */
  createOrder(
    body: CreateOrderBody,
    options?: RequestOptions,
  ): Promise<CreateOrderResponse> {
    return this.request("POST", "/orders/", {
      json: body,
      headers: Futuur.idempotencyHeaders(options),
    });
  }

  /**
   * Create between 1 and 20 orders in one request.
   * Each order is validated independently, so partial failures are expected.
   * Before the first item on a market is created, every open order you have on
   * that event, market and currency is canceled.
   */
  batchCreateOrders(
    body: BatchCreateOrdersBody,
    options?: RequestOptions,
  ): Promise<BatchCreateOrdersResponse> {
    return this.request("POST", "/orders/batch/", {
      json: body,
      headers: Futuur.idempotencyHeaders(options),
    });
  }

  /**
   * Update between 1 and 20 open orders in one request.
   * Each update cancels the existing order and creates a replacement with a new
   * ID.
   */
  batchUpdateOrders(
    body: BatchUpdateOrdersBody,
    options?: RequestOptions,
  ): Promise<BatchUpdateOrdersResponse> {
    return this.request("POST", "/orders/batch-update/", {
      json: body,
      headers: Futuur.idempotencyHeaders(options),
    });
  }

  /**
   * Cancel an open limit order. Only `open` orders can be canceled: a
   * `processing` one fails with `LimitOrderBeingProcessing`, and a finished one
   * with `404 not_found`.
   */
  async cancelOrder(id: string | number): Promise<void> {
    await this.request("PATCH", `/orders/${id}/cancel/`);
  }

  /** Cancel several open orders by ID. Each cancellation is independent. */
  batchCancelOrders(
    body: BatchCancelOrdersBody,
  ): Promise<BatchCancelOrdersResponse> {
    return this.request("POST", "/orders/batch-cancel/", { json: body });
  }

  /**
   * Cancel every active order, optionally scoped to one event or market.
   * Orders returned in `processing_order_ids` were mid-fill and must be
   * retried through {@link batchCancelOrders}.
   */
  cancelAllOrders(
    body: CancelAllOrdersBody = {},
  ): Promise<CancelAllOrdersResponse> {
    return this.request("POST", "/orders/cancel-all/", { json: body });
  }

  /** Whether trading is paused platform-wide. Needs no authentication. */
  tradingStatus(): Promise<TradingStatusResponse> {
    return this.request("GET", "/trading-status/");
  }

  /* ── On-chain trading (preview host) ──────────────────────────────── */

  /**
   * Fetch the EIP-712 `LimitOrderIntent` to sign for an `OOM` or `USDC` order.
   * Call it once per order, right before signing, and run context → sign →
   * create strictly one at a time per Safe: the nonce is not reserved.
   */
  signingContext(body: SigningContextBody): Promise<SigningContextResponse> {
    return this.request("POST", "/orders/signing-context/", { json: body });
  }

  /**
   * Exchange an EIP-712 `DeriveApiKey` signature from the owner wallet for an
   * HMAC key pair. Unauthenticated: the signature is the credential. Returns the
   * existing active pair, or creates one.
   */
  static deriveApiKey(
    body: DeriveApiKeyBody,
    config: Pick<FutuurConfig, "baseUrl" | "timeout" | "fetch"> = {
      baseUrl: PREVIEW_BASE_URL,
    },
  ): Promise<DeriveApiKeyResponse> {
    return Futuur.send(Futuur.transport(config), "POST", "/api-keys/derive/", {
      json: body,
    });
  }

  /**
   * Register a Safe smart account. The API only accepts this from a wallet
   * sign-in session: an HMAC API key gets `403 permission_denied`.
   */
  registerSafe(body: RegisterSafeBody): Promise<RegisterSafeResponse> {
    return this.request("POST", "/me/safe/", { json: body });
  }

  /** Read the Safe's deploy state and balance. */
  getSafeWallet(params?: SafeWalletParams): Promise<SafeWallet> {
    const { refresh, ...rest } = params ?? {};
    return this.request("GET", "/me/safe-wallet/", {
      query: { ...rest, refresh: refresh ? "1" : undefined },
    });
  }

  /** Tell the API that the Safe now has code on-chain. */
  confirmSafeDeployed(body: ConfirmSafeDeployedBody = {}): Promise<SafeWallet> {
    return this.request("POST", "/me/safe/deployed/", { json: body });
  }

  /** Whether the pool has a standing allowance on the Safe for one currency. */
  getSafeTradingStatus(
    params?: SafeTradingStatusParams,
  ): Promise<SafeTradingStatusResponse> {
    return this.request("GET", "/me/safe/trading-status/", { query: params });
  }

  /**
   * Submit the signed `approve(pool, amount)` UserOperation and wait (up to
   * about 20 seconds) for the allowance. Needed once per currency.
   */
  enableTrading(body: EnableTradingBody): Promise<EnableTradingResponse> {
    return this.request("POST", "/me/safe/enable-trading/", { json: body });
  }

  /** Paymaster data for an unsigned UserOperation, as the paymaster returned it. */
  sponsorUserOperation(
    body: UserOperationBody,
  ): Promise<Record<string, unknown>> {
    return this.request("POST", "/me/safe/sponsor-user-operation/", {
      json: body,
    });
  }

  /** Send a signed UserOperation through the Futuur relay. */
  submitUserOperation(
    body: UserOperationBody,
  ): Promise<SubmitUserOperationResponse> {
    return this.request("POST", "/me/safe/submit-user-operation/", {
      json: body,
    });
  }

  /** The bundler's receipt, or `{}` while the UserOperation is not included. */
  getUserOperationReceipt(
    userOperationHash: string,
    chainId?: number,
  ): Promise<Record<string, unknown>> {
    return this.request("GET", "/me/safe/user-operation-receipt/", {
      query: { user_operation_hash: userOperationHash, chain_id: chainId },
    });
  }

  /** Allowlisted bundler JSON-RPC pass-through for smart-account libraries. */
  bundlerRpc(body: BundlerRpcBody): Promise<BundlerRpcResponse> {
    return this.request("POST", "/me/safe/pimlico-rpc/", { json: body });
  }

  /* ── WebSocket ────────────────────────────────────────────────────── */

  /**
   * Authorize a private Pusher channel subscription.
   * Pass the result straight to the pusher-js `channelAuthorization` handler.
   */
  pusherAuth(
    socketId: string,
    channelName: string,
  ): Promise<PusherAuthResponse> {
    return this.request("POST", "/pusher/auth/", {
      form: { socket_id: socketId, channel_name: channelName },
    });
  }
}
