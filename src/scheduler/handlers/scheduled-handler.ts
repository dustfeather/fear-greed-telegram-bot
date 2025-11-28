import { generatePieChart } from '../../market-data/services/chart-service.js';
import { sendTelegramMessage } from '../../telegram/services/message-service.js';
import type { Env } from '../../core/types/index.js';
import { RATINGS } from '../../core/constants/index.js';
import { getFearGreedIndex } from '../../market-data/services/fear-greed-service.js';
import { getChatIds } from '../../user-management/repositories/subscription-repository.js';
import { getWatchlist, initializeWatchlistIfMissing } from '../../user-management/services/watchlist-service.js';
import { toAppError } from '../../core/utils/errors.js';
import { evaluateTradingSignal, formatTradingSignalMessage, createDataUnavailableSignal } from '../../trading/services/signal-service.js';
import { isBankHoliday } from '../../trading/utils/holidays.js';

/**
 * Handle scheduled event.
 * @param chatId - Optional specific chat ID to send to, or null to send to all subscribers
 * @param env - Environment variables
 * @param ticker - Ticker symbol (optional, used only for backward compatibility with /now command)
 * @returns Promise resolving to void
 */
export async function handleScheduled(chatId: number | string | null = null, env: Env, ticker?: string): Promise<void> {
  try {
    // Check if today is a bank holiday (only for scheduled broadcasts, not manual requests)
    if (chatId === null) {
      const today = new Date();
      const holiday = isBankHoliday(today);

      if (holiday) {
        console.log(`Scheduled execution skipped: ${holiday.name} (${holiday.date.toISOString().split('T')[0]})`);
        return;
      }
    }

    // Get Fear & Greed Index (with caching)
    const data = await getFearGreedIndex(env.FEAR_GREED_KV);

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

