import axios, { AxiosHeaders, AxiosInstance, AxiosRequestConfig } from "axios";
import CryptoJS from "crypto-js";

import {
  BetDetailResponse,
  BettingListParams,
  BettingListResponse,
  CategoryDetailResponse,
  CategoryListResponse,
  CurrentRatesResponse,
  GetPartialAmountOnSellParams,
  GetPartialAmountOnSellResponse,
  MarketDetailResponse,
  MarketListParams,
  MarketListResponse,
  MeResponse,
  PaginationParams,
  PurchaseBody,
  PurchaseResponse,
  RelatedMarketsResponse,
  RootCategoriesAndMainChildrenParams,
  RootCategoriesAndMainChildrenResponse,
  RootCategoriesResponse,
  SellBody,
  SellResponse,
  SuggestMarketParams,
  SuggestMarketResponse,
} from "./types";

export class Futuur {
  private client: AxiosInstance;
  private static readonly BASE_URL = "https://api.futuur.com/api/v1";
  private readonly publicKey: string;
  private readonly privateKey: string;

  constructor(config: {
    publicKey: string;
    privateKey: string;
    timeout?: number;
  }) {
    const { publicKey, privateKey, timeout } = config;
    this.publicKey = publicKey;
    this.privateKey = privateKey;

    this.client = axios.create({
      baseURL: Futuur.BASE_URL,
      timeout: timeout || 10000,
      headers: new AxiosHeaders({
        "Content-Type": "application/json",
      }),
    });

    this.client.interceptors.request.use((config) => {
      const timestamp = Math.floor(Date.now() / 1000);

      // Combine parameters
      const params: Record<string, any> = {
        Key: this.publicKey,
        Timestamp: timestamp,
      };

      // Add query parameters if present
      if (config.params) {
        Object.assign(params, config.params);
      }

      // Add body parameters if present
      if (config.data) {
        const bodyParams =
          typeof config.data === "string"
            ? JSON.parse(config.data)
            : config.data;
        Object.assign(params, bodyParams);
      }

      // Get signature data
      const signatureData = this.buildSignature(params);

      // Set headers
      const newHeaders = new AxiosHeaders(config.headers);
      newHeaders.set("Key", this.publicKey);
      newHeaders.set("Timestamp", signatureData.Timestamp.toString());
      newHeaders.set("HMAC", signatureData.hmac);

      config.headers = newHeaders;
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error("Request failed:", {
          config: error.config,
          response: error.response?.data,
        });
        return Promise.reject(error);
      },
    );
  }

  private buildSignature(params: Record<string, any>): {
    hmac: string;
    Timestamp: number;
  } {
    // Convert all values to strings and remove undefined/null
    const stringParams = Object.entries(params).reduce(
      (acc, [key, value]) => {
        if (value !== undefined && value !== null) {
          acc[key] = value.toString();
        }
        return acc;
      },
      {} as Record<string, string>,
    );

    // Sort parameters alphabetically
    const sortedParams = Object.keys(stringParams)
      .sort()
      .reduce(
        (acc, key) => {
          acc[key] = stringParams[key];
          return acc;
        },
        {} as Record<string, string>,
      );

    // Create parameter string with URL encoding
    const paramString = Object.entries(sortedParams)
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
      )
      .join("&");

    // Create HMAC signature
    const hmac = CryptoJS.HmacSHA512(paramString, this.privateKey).toString(
      CryptoJS.enc.Hex,
    );

    return {
      hmac,
      Timestamp: params.Timestamp,
    };
  }

  /**
   * The endpoint returns information about a user.
   */
  async me(): Promise<MeResponse> {
    const { data } = await this.client.get("/me");
    return data;
  }

  /**
   * Return list of categories.
   */
  async categoryList(params?: PaginationParams): Promise<CategoryListResponse> {
    const { data } = await this.client.get("/categories", { params });
    return data;
  }

  /**
   * Return category detail.
   */
  async categoryDetail(
    /**
     * A unique integer value identifying this category.
     */
    id: string | number,
  ): Promise<CategoryDetailResponse> {
    const { data } = await this.client.get(`/categories/${id}`);
    return data;
  }

  /**
   * Return root categories
   */
  async rootCategories(): Promise<RootCategoriesResponse> {
    const { data } = await this.client.get("/categories/root");
    return data;
  }

  /**
   * Return root categories
   */
  async rootCategoriesAndMainChildren(
    params?: RootCategoriesAndMainChildrenParams,
  ): Promise<RootCategoriesAndMainChildrenResponse> {
    const { data } = await this.client.get(
      "/categories/root_and_main_children",
      { params },
    );
    return data;
  }

  /**
   * Return list of markets.
   */
  async marketList(params?: MarketListParams): Promise<MarketListResponse> {
    const { data } = await this.client.get("/markets", { params });
    return data;
  }

  /**
   * Return market information from its ID.
   */
  async marketDetail(
    /**
     * A unique integer value identifying this market.
     */
    id: string | number,
  ): Promise<MarketDetailResponse> {
    const { data } = await this.client.get(`/markets/${id}`);
    return data;
  }

  /**
   * Return related markets of a market.
   */
  async relatedMarkets(
    /**
     * A unique integer value identifying this market.
     */
    id: string | number,
  ): Promise<RelatedMarketsResponse> {
    const { data } = await this.client.get(`/markets/${id}/related_markets`);
    return data;
  }

  /**
   * Suggest a market.
   */
  async suggestMarket(
    params: SuggestMarketParams,
  ): Promise<SuggestMarketResponse> {
    const { data } = await this.client.post(
      "/markets/suggest_market",
      undefined,
      { params },
    );
    return data;
  }

  /**
   * Return a list of all your bets.
   */
  async bettingList(params: BettingListParams): Promise<BettingListResponse> {
    const { data } = await this.client.get("/bets", { params });
    return data;
  }

  /**
   * Return information on your bet, on a given market, for an outcome and currency.
   */
  async betDetail(
    /**
     * A unique integer value identifying this wager.
     */
    id: string | number,
  ): Promise<BetDetailResponse> {
    const { data } = await this.client.get(`/bets/${id}`);
    return data;
  }

  /**
   * Return information on your bet, on a given market, for an outcome and currency.
   */
  async getPartialAmountOnSell(
    /**
     * A unique integer value identifying this wager.
     */
    id: string | number,
    params?: GetPartialAmountOnSellParams,
  ): Promise<GetPartialAmountOnSellResponse> {
    const { data } = await this.client.get(
      `/bets/${id}/get_partial_amount_on_sell`,
      { params },
    );
    return data;
  }

  /**
   * Returns a dict with latest rates. Each dict gives rates for currency field.
   */
  async currentRates(): Promise<CurrentRatesResponse> {
    const { data } = await this.client.get("/bets/rates");
    return data;
  }

  /**
   * Bet on a market by purchasing an outcome position.
   */
  async purchase(body: PurchaseBody): Promise<PurchaseResponse> {
    const { data } = await this.client.post("/bets/", body);
    return data;
  }

  /**
   * Sell your entire position (previously purchased) on an outcome for a given currency.
   */
  async sell(
    /**
     * A unique integer value identifying this wager.
     */
    id: string | number,
    body?: SellBody,
  ): Promise<SellResponse> {
    const { data } = await this.client.patch(`/bets/${id}`, body);
    return data;
  }
}
