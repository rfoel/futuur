import axios, { AxiosHeaders, AxiosInstance } from "axios";
import CryptoJS from "crypto-js";

import {
  BalancesParams,
  BalancesResponse,
  BatchCancelOrdersBody,
  BatchCancelOrdersResponse,
  BatchCreateOrdersBody,
  BatchCreateOrdersResponse,
  BatchUpdateOrdersBody,
  BatchUpdateOrdersResponse,
  CancelAllOrdersBody,
  CancelAllOrdersResponse,
  CreateOrderBody,
  CreateOrderResponse,
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
  RelatedEventsResponse,
  RequestOptions,
  WagerDetailResponse,
  WagerListParams,
  WagerListResponse,
} from "./types";

export interface FutuurConfig {
  publicKey: string;
  privateKey: string;
  /** @default 10000 */
  timeout?: number;
  /** @default "https://api.futuur.com/v2.0" */
  baseUrl?: string;
}

export class Futuur {
  private client: AxiosInstance;
  private static readonly DEFAULT_BASE_URL = "https://api.futuur.com/v2.0";
  private readonly publicKey: string;
  private readonly privateKey: string;

  constructor(config: FutuurConfig) {
    this.publicKey = config.publicKey;
    this.privateKey = config.privateKey;

    this.client = axios.create({
      baseURL: config.baseUrl || Futuur.DEFAULT_BASE_URL,
      timeout: config.timeout || 10000,
      headers: new AxiosHeaders({ "Content-Type": "application/json" }),
      // The API reads repeated filters as a comma-joined list, and axios'
      // default `key[]=a&key[]=b` form is both ignored by the server and
      // signed under a different key name.
      paramsSerializer: (params) => this.serializeParams(params),
    });

    this.client.interceptors.request.use((req) => {
      const timestamp = Math.floor(Date.now() / 1000);
      const params: Record<string, unknown> = {
        Key: this.publicKey,
        Timestamp: timestamp,
      };

      if (req.params) {
        Object.assign(params, req.params);
      }
      if (req.data) {
        Object.assign(params, this.bodyParams(req.data));
      }

      const hmac = this.buildSignature(params);

      const headers = new AxiosHeaders(req.headers);
      headers.set("Key", this.publicKey);
      headers.set("Timestamp", timestamp.toString());
      headers.set("HMAC", hmac);
      req.headers = headers;
      return req;
    });
  }

  /** Build a query string that matches the parameter set used for signing. */
  private serializeParams(params: Record<string, unknown>): string {
    return Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(
        ([k, v]) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(this.signatureValue(v))}`,
      )
      .join("&");
  }

  /** Normalize a request body into the flat map of parameters that gets signed. */
  private bodyParams(data: unknown): Record<string, unknown> {
    if (data instanceof URLSearchParams) {
      const entries: Record<string, unknown> = {};
      data.forEach((value, key) => {
        entries[key] = value;
      });
      return entries;
    }
    if (typeof data === "string") {
      try {
        return JSON.parse(data) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return data as Record<string, unknown>;
  }

  private buildSignature(params: Record<string, unknown>): string {
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      flat[k] = this.signatureValue(v);
    }

    const paramString = Object.keys(flat)
      .sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(flat[k])}`)
      .join("&");

    return CryptoJS.HmacSHA512(paramString, this.privateKey).toString(
      CryptoJS.enc.Hex,
    );
  }

  private signatureValue(value: unknown): string {
    if (Array.isArray(value)) {
      // Arrays of primitives (currencies, categories, order IDs) sign as a
      // comma-joined list; nested structures fall back to JSON.
      return value.every((v) => v === null || typeof v !== "object")
        ? value.join(",")
        : JSON.stringify(value);
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  }

  private idempotencyHeaders(
    options?: RequestOptions,
  ): Record<string, string> | undefined {
    return options?.idempotencyKey
      ? { "Idempotency-Key": options.idempotencyKey }
      : undefined;
  }

  /* ── Me ───────────────────────────────────────────────────────────── */

  /** Authenticated account details and wallet balances. */
  async me(): Promise<MeResponse> {
    const { data } = await this.client.get("/me/");
    return data;
  }

  /** Ledger balances, one row per currency. */
  async balances(params?: BalancesParams): Promise<BalancesResponse> {
    const { data } = await this.client.get("/me/balances/", { params });
    return data;
  }

  /** Associate a Safe smart account with the authenticated user. */
  async registerSafe(body: RegisterSafeBody): Promise<MeResponse> {
    const { data } = await this.client.post("/me/safe/", body);
    return data;
  }

  /** Current leaderboard ranking position. */
  async ranking(): Promise<RankingResponse> {
    const { data } = await this.client.get("/me/ranking/");
    return data;
  }

  /* ── Events ───────────────────────────────────────────────────────── */

  /** Paginated list of prediction market events. */
  async listEvents(params?: EventListParams): Promise<EventListResponse> {
    const { data } = await this.client.get("/events/", { params });
    return data;
  }

  /** Detailed information for a single event. */
  async getEvent(id: string | number): Promise<EventDetailResponse> {
    const { data } = await this.client.get(`/events/${id}/`);
    return data;
  }

  /** Trade activity feed for an event. */
  async getEventActions(
    id: string | number,
    params?: EventActionsParams,
  ): Promise<EventActionsResponse> {
    const { data } = await this.client.get(`/events/${id}/actions/`, {
      params,
    });
    return data;
  }

  /** Fee structure applied to trades on an event. */
  async getEventTax(id: string | number): Promise<EventTaxResponse> {
    const { data } = await this.client.get(`/events/${id}/get_tax/`);
    return data;
  }

  /** Events related by topic, category and recent activity. */
  async getRelatedEvents(id: string | number): Promise<RelatedEventsResponse> {
    const { data } = await this.client.get(`/events/${id}/related_events/`);
    return data;
  }

  /** Historical price data for an event over a time interval. */
  async getPriceHistory(
    id: string | number,
    params: PriceHistoryParams,
  ): Promise<PriceHistoryResponse> {
    const { data } = await this.client.get(`/events/${id}/price_history/`, {
      params,
    });
    return data;
  }

  /** Wagers placed on a specific event. Returned unpaginated. */
  async getEventWagers(
    id: string | number,
    params?: EventWagersParams,
  ): Promise<EventWagersResponse> {
    const { data } = await this.client.get(`/events/${id}/wagers/`, {
      params,
    });
    return data;
  }

  /* ── Markets ──────────────────────────────────────────────────────── */

  /**
   * Aggregated order book for a market (outcome).
   * `id` is the market ID, not the event ID.
   */
  async getOrderBook(
    id: string | number,
    params: OrderBookParams,
  ): Promise<OrderBookResponse> {
    const { data } = await this.client.get(`/markets/${id}/book/`, {
      params,
    });
    return data;
  }

  /* ── Wagers ───────────────────────────────────────────────────────── */

  /** Paginated wagers with user and activity filters. */
  async listWagers(params?: WagerListParams): Promise<WagerListResponse> {
    const { data } = await this.client.get("/wagers/", { params });
    return data;
  }

  /** Detailed wager information by ID. */
  async getWager(id: string | number): Promise<WagerDetailResponse> {
    const { data } = await this.client.get(`/wagers/${id}/`);
    return data;
  }

  /** Rebated maker fees for the authenticated user. */
  async getRebates(params?: RebatesParams): Promise<RebatesResponse> {
    const { data } = await this.client.get("/wagers/rebates/", { params });
    return data;
  }

  /* ── Orders ───────────────────────────────────────────────────────── */

  /** Paginated limit orders. */
  async listOrders(params?: OrderListParams): Promise<OrderListResponse> {
    const { data } = await this.client.get("/orders/", { params });
    return data;
  }

  /** Place a limit (price 0–1) or market (price null) order. */
  async createOrder(
    body: CreateOrderBody,
    options?: RequestOptions,
  ): Promise<CreateOrderResponse> {
    const { data } = await this.client.post("/orders/", body, {
      headers: this.idempotencyHeaders(options),
    });
    return data;
  }

  /**
   * Create between 1 and 20 orders in one request.
   * Each order is validated independently, so partial failures are expected.
   */
  async batchCreateOrders(
    body: BatchCreateOrdersBody,
    options?: RequestOptions,
  ): Promise<BatchCreateOrdersResponse> {
    const { data } = await this.client.post("/orders/batch/", body, {
      headers: this.idempotencyHeaders(options),
    });
    return data;
  }

  /**
   * Update between 1 and 20 open orders in one request.
   * Each update cancels the existing order and creates a replacement.
   */
  async batchUpdateOrders(
    body: BatchUpdateOrdersBody,
    options?: RequestOptions,
  ): Promise<BatchUpdateOrdersResponse> {
    const { data } = await this.client.post("/orders/batch-update/", body, {
      headers: this.idempotencyHeaders(options),
    });
    return data;
  }

  /**
   * Cancel an open limit order.
   * Only `open` or `partial_filled` orders can be canceled.
   * Returns 204 No Content on success.
   */
  async cancelOrder(id: string | number): Promise<void> {
    await this.client.patch(`/orders/${id}/cancel/`);
  }

  /** Cancel several open orders by ID. Each cancellation is independent. */
  async batchCancelOrders(
    body: BatchCancelOrdersBody,
  ): Promise<BatchCancelOrdersResponse> {
    const { data } = await this.client.post("/orders/batch-cancel/", body);
    return data;
  }

  /**
   * Cancel every active order, optionally scoped to one event or market.
   * Orders returned in `processing_order_ids` were mid-fill and must be
   * retried through {@link batchCancelOrders}.
   */
  async cancelAllOrders(
    body: CancelAllOrdersBody = {},
  ): Promise<CancelAllOrdersResponse> {
    const { data } = await this.client.post("/orders/cancel-all/", body);
    return data;
  }

  /* ── WebSocket ────────────────────────────────────────────────────── */

  /**
   * Authorize a private Pusher channel subscription.
   * Pass the result straight to the pusher-js `channelAuthorization` handler.
   */
  async pusherAuth(
    socketId: string,
    channelName: string,
  ): Promise<PusherAuthResponse> {
    const { data } = await this.client.post(
      "/pusher/auth/",
      new URLSearchParams({
        socket_id: socketId,
        channel_name: channelName,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );
    return data;
  }
}
