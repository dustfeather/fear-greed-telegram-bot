/**
 * Fear and Greed Index API Response
 */
export interface FearGreedIndexResponse {
  rating: string;
  score: number;
  timestamp?: number | string;
  previous_close?: number;
  previous_1_week?: number;
  previous_1_month?: number;
  previous_1_year?: number;
}

/**
 * Price data point
 */
export interface PriceData {
  date: number; // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Market data response from Yahoo Finance
 */
export interface MarketDataResponse {
  currentPrice: number;
  historicalData: PriceData[];
}
