import axios, { AxiosHeaders, AxiosInstance } from "axios";
import CryptoJS from "crypto-js";

import {
  CreateOrderBody,
  CreateOrderResponse,
  EventActionsParams,
  EventActionsResponse,
  EventDetailResponse,
  EventListParams,
  EventListResponse,
  EventWagersParams,
  EventWagersResponse,
  MeResponse,
  OrderBookParams,
  OrderBookResponse,
  OrderListParams,
  OrderListResponse,
  PriceHistoryParams,
  PriceHistoryResponse,
  RankingResponse,
  WagerDetailResponse,
  WagerListParams,
  WagerListResponse,
} from "./types";

export interface FutuurConfig {
  publicKey: string;
  privateKey: string;
  /** @default 10000 */
  timeout?: number;
  /** @default "https://api.futuur.com" */
  baseUrl?: string;
}

export class Futuur {
  private client: AxiosInstance;
  private static readonly DEFAULT_BASE_URL = "https://api.futuur.com";
  private readonly publicKey: string;
  private readonly privateKey: string;

  constructor(config: FutuurConfig) {
    this.publicKey = config.publicKey;
    this.privateKey = config.privateKey;

    this.client = axios.create({
      baseURL: config.baseUrl || Futuur.DEFAULT_BASE_URL,
      timeout: config.timeout || 10000,
      headers: new AxiosHeaders({ "Content-Type": "application/json" }),
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
        const body =
          typeof req.data === "string" ? JSON.parse(req.data) : req.data;
        Object.assign(params, body);
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

  private buildSignature(params: Record<string, unknown>): string {
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      flat[k] = Array.isArray(v) ? v.join(",") : String(v);
    }

    const paramString = Object.keys(flat)
      .sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(flat[k])}`)
      .join("&");

    return CryptoJS.HmacSHA512(paramString, this.privateKey).toString(
      CryptoJS.enc.Hex,
    );
  }

  /* ── Me ───────────────────────────────────────────────────────────── */

  /** Authenticated account details and balances. */
  async me(): Promise<MeResponse> {
    const { data } = await this.client.get("/me/");
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

  /** Bet activity feed for an event. */
  async getEventActions(
    id: string | number,
    params?: EventActionsParams,
  ): Promise<EventActionsResponse> {
    const { data } = await this.client.get(`/events/${id}/actions/`, {
      params,
    });
    return data;
  }

  /** Aggregated order book (bids/asks) for an event's market. */
  async getOrderBook(
    id: string | number,
    params: OrderBookParams,
  ): Promise<OrderBookResponse> {
    const { data } = await this.client.get(`/events/${id}/order_book/`, {
      params,
    });
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

  /** Wagers placed on a specific event. */
  async getEventWagers(
    id: string | number,
    params?: EventWagersParams,
  ): Promise<EventWagersResponse> {
    const { data } = await this.client.get(`/events/${id}/wagers/`, {
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

  /* ── Orders ───────────────────────────────────────────────────────── */

  /** Paginated limit orders. */
  async listOrders(params?: OrderListParams): Promise<OrderListResponse> {
    const { data } = await this.client.get("/orders/", { params });
    return data;
  }

  /** Place a limit (price 0–1) or market (price null) order. */
  async createOrder(body: CreateOrderBody): Promise<CreateOrderResponse> {
    const { data } = await this.client.post("/orders/", body);
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
}
