import { generatePieChart } from './chart.js';
import { sendTelegramMessage } from './send.js';
import type { Env, FearGreedIndexResponse } from './types.js';
import { API_URLS, HTTP_HEADERS, RATINGS } from './constants.js';
import { enhancedFetch } from './utils/fetch.js';
import { getCachedFearGreedIndex, cacheFearGreedIndex } from './utils/cache.js';
import { getChatIds } from './utils/kv.js';
import { getWatchlist, initializeWatchlistIfMissing } from './utils/watchlist.js';
import { toAppError, createApiError } from './utils/errors.js';
import { isValidFearGreedIndexResponse } from './utils/validation.js';
import { evaluateTradingSignal, formatTradingSignalMessage, createDataUnavailableSignal } from './trading-signal.js';

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
 * @param ticker - Ticker symbol (optional, used only for backward compatibility with /now command)
 * @returns Promise resolving to void
 */
export async function handleScheduled(chatId: number | string | null = null, env: Env, ticker?: string): Promise<void> {
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
    
    // Generate chart URL once (used for all messages)
    const chartUrl = await generatePieChart(score);
    const ratingText = rating.toUpperCase();
    const fearGreedMessage = `⚠️ The current [Fear and Greed Index](${chartUrl}) rating is ${score}% (*${ratingText}*).`;
    
    if (chatId) {
      // Specific user request - get their watchlist
      const watchlist = await getWatchlist(env.FEAR_GREED_KV, chatId);
      const tickersToProcess = ticker ? [ticker] : watchlist;
      
      // Send one message per ticker
      for (const tickerSymbol of tickersToProcess) {
        let tradingSignal;
        try {
          tradingSignal = await evaluateTradingSignal(env, data, tickerSymbol, chatId);
        } catch (error) {
          const errorDetails = error instanceof Error ? {
            message: error.message,
            stack: error.stack,
            name: error.name
          } : String(error);
          console.error(`Error evaluating trading signal for ${tickerSymbol}:`, JSON.stringify(errorDetails, null, 2));
          tradingSignal = createDataUnavailableSignal(data, tickerSymbol);
        }
        
        const tradingSignalMessage = formatTradingSignalMessage(tradingSignal, data, tickerSymbol);
        
        // Determine if we should include Fear & Greed Index message
        const shouldIncludeFearGreed = (rating === RATINGS.FEAR || rating === RATINGS.EXTREME_FEAR) || ticker !== undefined;
        
        if (shouldIncludeFearGreed) {
          const fullMessage = `${fearGreedMessage}\n\n${tradingSignalMessage}`;
          await sendTelegramMessage(chatId, fullMessage, env);
        } else {
          // Just send trading signal
          await sendTelegramMessage(chatId, tradingSignalMessage, env);
        }
      }
    } else {
      // Broadcast to all subscribers - iterate through each user's watchlist
      const chatIds = await getChatIds(env.FEAR_GREED_KV);
      const shouldSendToAll = (rating === RATINGS.FEAR || rating === RATINGS.EXTREME_FEAR);
      
      // Initialize watchlists for all existing users who don't have one
      // This happens on the first scheduled job run
      for (const userId of chatIds) {
        try {
          await initializeWatchlistIfMissing(env.FEAR_GREED_KV, userId);
        } catch (error) {
          console.error(`Error initializing watchlist for user ${userId}:`, error);
          // Continue with next user
        }
      }
      
      // Process each user's watchlist
      for (const userId of chatIds) {
        try {
          const watchlist = await getWatchlist(env.FEAR_GREED_KV, userId);
          
          // Send one message per ticker in watchlist
          for (const tickerSymbol of watchlist) {
            let tradingSignal;
            try {
              tradingSignal = await evaluateTradingSignal(env, data, tickerSymbol, userId);
            } catch (error) {
              const errorDetails = error instanceof Error ? {
                message: error.message,
                stack: error.stack,
                name: error.name
              } : String(error);
              console.error(`Error evaluating trading signal for ${tickerSymbol} (user ${userId}):`, JSON.stringify(errorDetails, null, 2));
              tradingSignal = createDataUnavailableSignal(data, tickerSymbol);
            }
            
            const tradingSignalMessage = formatTradingSignalMessage(tradingSignal, data, tickerSymbol);
            
            if (shouldSendToAll) {
              const fullMessage = `${fearGreedMessage}\n\n${tradingSignalMessage}`;
              await sendTelegramMessage(userId, fullMessage, env);
            }
            // Note: We only send during fear/extreme fear for broadcasts
          }
        } catch (userError) {
          console.error(`Error processing watchlist for user ${userId}:`, userError);
          // Continue with next user
        }
      }
    }
  } catch (error) {
    const appError = toAppError(error);
    const errorMessage = `An error occurred: ${appError.message}`;
    console.error(errorMessage, appError);
    
    // Even if Fear & Greed Index fetch fails, try to send a HOLD signal with data unavailability
    // This ensures users always receive a signal with reasoning
    if (chatId) {
      try {
        const watchlist = await getWatchlist(env.FEAR_GREED_KV, chatId);
        const tickersToProcess = ticker ? [ticker] : watchlist;
        
        for (const tickerSymbol of tickersToProcess) {
          const dataUnavailableSignal = createDataUnavailableSignal(undefined, tickerSymbol);
          const tradingSignalMessage = formatTradingSignalMessage(dataUnavailableSignal, undefined, tickerSymbol);
          await sendTelegramMessage(chatId, tradingSignalMessage, env);
        }
      } catch (signalError) {
        console.error('Failed to send data unavailable signal:', signalError);
      }
    }
    // Note: We don't broadcast to all subscribers on error to avoid spam
    
    // Notify admin if configured
    const adminChatId = env.ADMIN_CHAT_ID;
    if (adminChatId) {
      await sendTelegramMessage(adminChatId, errorMessage, env).catch(err => {
        console.error('Failed to notify admin:', err);
      });
    }
  }
}

