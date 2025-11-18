import { generatePieChart } from './chart.js';
import { sendTelegramMessage } from './send.js';
import type { Env, FearGreedIndexResponse } from './types.js';
import { API_URLS, HTTP_HEADERS, RATINGS } from './constants.js';
import { enhancedFetch } from './utils/fetch.js';
import { getCachedFearGreedIndex, cacheFearGreedIndex } from './utils/cache.js';
import { getChatIds } from './utils/kv.js';
import { toAppError, createApiError } from './utils/errors.js';
import { isValidFearGreedIndexResponse } from './utils/validation.js';
import { evaluateTradingSignal, formatTradingSignalMessage } from './trading-signal.js';

/**
 * Fetch Fear & Greed Index from API
 */
async function fetchFearGreedIndex(): Promise<FearGreedIndexResponse> {
  const response = await enhancedFetch(API_URLS.FEAR_GREED_INDEX, {
    method: 'GET',
    headers: HTTP_HEADERS.CHROME_HEADERS
  });

  if (!response.ok) {
    throw createApiError(
      `Failed to fetch Fear & Greed Index: ${response.status} ${response.statusText}`,
      undefined,
      response.status
    );
  }

  const data = await response.json();
  
  if (!isValidFearGreedIndexResponse(data)) {
    // Log the actual response structure for debugging
    console.error('Invalid Fear & Greed Index response structure. Received:', JSON.stringify(data, null, 2));
    throw createApiError('Invalid Fear & Greed Index response structure', data);
  }

  // Normalize the response (handle string scores and string timestamps)
  const obj = data as unknown as Record<string, unknown>;
  const normalized: FearGreedIndexResponse = {
    rating: obj.rating as string,
    score: typeof obj.score === 'string' 
      ? parseFloat(obj.score)
      : obj.score as number,
    timestamp: obj.timestamp as number | string | undefined,
    // Include optional additional fields if present
    ...(obj.previous_close !== undefined && { previous_close: typeof obj.previous_close === 'string' ? parseFloat(obj.previous_close) : obj.previous_close as number }),
    ...(obj.previous_1_week !== undefined && { previous_1_week: typeof obj.previous_1_week === 'string' ? parseFloat(obj.previous_1_week) : obj.previous_1_week as number }),
    ...(obj.previous_1_month !== undefined && { previous_1_month: typeof obj.previous_1_month === 'string' ? parseFloat(obj.previous_1_month) : obj.previous_1_month as number }),
    ...(obj.previous_1_year !== undefined && { previous_1_year: typeof obj.previous_1_year === 'string' ? parseFloat(obj.previous_1_year) : obj.previous_1_year as number })
  };

  return normalized;
}

/**
 * Handle scheduled event.
 * @param chatId - Optional specific chat ID to send to, or null to send to all subscribers
 * @param env - Environment variables
 * @returns Promise resolving to void
 */
export async function handleScheduled(chatId: number | string | null = null, env: Env): Promise<void> {
  try {
    // Try to get cached data first
    let data = await getCachedFearGreedIndex(env.FEAR_GREED_KV);
    
    // If no cache or cache expired, fetch fresh data
    if (!data) {
      data = await fetchFearGreedIndex();
      // Cache the fresh data (non-blocking)
      cacheFearGreedIndex(env.FEAR_GREED_KV, data).catch(err => {
        console.error('Failed to cache Fear & Greed Index:', err);
      });
    }

    const rating = data.rating.toLowerCase();
    const score = (Math.round(data.score * 100) / 100).toFixed(2);
    
    // Evaluate trading signal only if all data sources are successfully accessed
    // This requires both CNN (Fear & Greed Index) and Yahoo Finance (price data) to be available
    let tradingSignalMessage = '';
    try {
      const tradingSignal = await evaluateTradingSignal(env, data);
      tradingSignalMessage = formatTradingSignalMessage(tradingSignal, data);
    } catch (error) {
      console.error('Error evaluating trading signal (data sources may be unavailable):', error);
      // Do not send trading signal if any data source failed
      // Only send Fear & Greed Index message if trading signal evaluation fails
      tradingSignalMessage = '';
    }
    
    // Determine if we need to send message
    const shouldSendToAll = (rating === RATINGS.FEAR || rating === RATINGS.EXTREME_FEAR) && !chatId;
    const shouldSendToSpecific = !!chatId;
    
    // Only generate chart if we're actually going to send a message
    if (shouldSendToAll || shouldSendToSpecific) {
      // Generate chart and build message in parallel
      const chartUrlPromise = generatePieChart(score);
      
      // Build message template (can be done in parallel with chart generation)
      const ratingText = rating.toUpperCase();
      let messageTemplate = `⚠️ The current [Fear and Greed Index](${await chartUrlPromise}) rating is ${score}% (*${ratingText}*).`;
      
      // Append trading signal if available
      if (tradingSignalMessage) {
        messageTemplate += `\n\n${tradingSignalMessage}`;
      }
      
      // Send messages based on conditions
      if (shouldSendToAll) {
        // Retrieve chat IDs from KV storage
        const chatIds = await getChatIds(env.FEAR_GREED_KV);
        // Send message to all subscribers (using rate-limited broadcast would be better, but keeping simple for now)
        await Promise.all(chatIds.map(id => sendTelegramMessage(id, messageTemplate, env)));
      } else if (shouldSendToSpecific) {
        // Send message to a specific subscriber
        await sendTelegramMessage(chatId, messageTemplate, env);
      }
    } else if (chatId) {
      // If specific chat requested but conditions not met, still send trading signal
      // Only send if trading signal was successfully generated (all data sources available)
      if (tradingSignalMessage) {
        await sendTelegramMessage(chatId, tradingSignalMessage, env);
      } else {
        // If trading signal failed (data sources unavailable), send Fear & Greed Index only
        const chartUrlPromise = generatePieChart(score);
        const ratingText = rating.toUpperCase();
        const messageTemplate = `⚠️ The current [Fear and Greed Index](${await chartUrlPromise}) rating is ${score}% (*${ratingText}*).`;
        await sendTelegramMessage(chatId, messageTemplate, env);
      }
    }
  } catch (error) {
    const appError = toAppError(error);
    const errorMessage = `An error occurred: ${appError.message}`;
    console.error(errorMessage, appError);
    
    // Notify admin if configured
    const adminChatId = env.ADMIN_CHAT_ID;
    if (adminChatId) {
      await sendTelegramMessage(adminChatId, errorMessage, env).catch(err => {
        console.error('Failed to notify admin:', err);
      });
    }
  }
}

