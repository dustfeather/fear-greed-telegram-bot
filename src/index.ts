import type { ScheduledController, ExecutionContext } from '@cloudflare/workers-types';
import { sub, unsub } from './subs.js';
import { handleScheduled } from './sched.js';
import { sendHelpMessage, sendTelegramMessage, broadcastToAllSubscribers } from './send.js';
import type { Env, TelegramUpdate } from './types.js';
import { COMMANDS, MESSAGES } from './constants.js';
import { successResponse, errorResponse, unauthorizedResponse, badRequestResponse, methodNotAllowedResponse } from './utils/response.js';
import { isValidTicker } from './utils/validation.js';
import { recordExecution, getExecutionHistory, formatExecutionHistory, getLatestExecution } from './utils/executions.js';
import { getActivePosition, setActivePosition, clearActivePosition, canTrade, getMonthName } from './utils/trades.js';
import { getWatchlist, addTickerToWatchlist, removeTickerFromWatchlist, ensureTickerInWatchlist } from './utils/watchlist.js';

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    // Additional safeguard: only run on weekdays (Monday-Friday)
    // getDay() returns 0 (Sunday) through 6 (Saturday)
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    // Only proceed if it's a weekday (Monday = 1 through Friday = 5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      ctx.waitUntil(handleScheduled(null, env));
    } else {
      console.log(`Skipping scheduled execution - not a weekday (day: ${dayOfWeek})`);
    }
  },
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env);
  }
};

/**
 * Verify Telegram webhook secret token.
 * @param request - The incoming HTTP request
 * @param env - Environment variables
 * @returns true if token is valid, false otherwise
 */
function verifyWebhookSecret(request: Request, env: Env): boolean {
  const providedSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  return providedSecret !== null && providedSecret === env.TELEGRAM_WEBHOOK_SECRET;
}

/**
 * Validate Telegram update structure.
 * @param update - The Telegram update to validate
 * @returns true if valid, false otherwise
 */
function isValidTelegramUpdate(update: unknown): update is TelegramUpdate {
  if (!update || typeof update !== 'object') {
    return false;
  }
  
  const u = update as Record<string, unknown>;
  const message = u.message || u.edited_message;
  
  if (!message || typeof message !== 'object') {
    return false;
  }
  
  const msg = message as Record<string, unknown>;
  
  // Must have chat with id
  if (!msg.chat || typeof msg.chat !== 'object') {
    return false;
  }
  
  const chat = msg.chat as Record<string, unknown>;
  if (typeof chat.id !== 'number' && typeof chat.id !== 'string') {
    return false;
  }
  
  // Must have text for commands
  if (msg.text && typeof msg.text !== 'string') {
    return false;
  }
  
  return true;
}

/**
 * Handle incoming HTTP request.
 * @param request - The incoming HTTP request
 * @param env - Environment variables
 * @returns Promise resolving to HTTP response
 */
async function handleRequest(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);

  // Handle deployment notification endpoint
  if (pathname === '/deploy-notify' && request.method === 'POST') {
    return await handleDeployNotify(request, env);
  }

  // Handle Telegram webhook
  if (request.method === 'POST' && pathname === '/') {
    // Verify webhook secret token
    if (!verifyWebhookSecret(request, env)) {
      return unauthorizedResponse();
    }

    let update: TelegramUpdate;
    try {
      update = await request.json() as TelegramUpdate;
    } catch (error) {
      return badRequestResponse('Invalid JSON');
    }

    // Validate Telegram update structure
    if (!isValidTelegramUpdate(update)) {
      // Return OK for invalid update structures to acknowledge webhook request
      return successResponse();
    }

    const message = update.message || update.edited_message;
    if (!message || !message.text) {
      // Return OK for updates without text (e.g., photos, stickers)
      return successResponse();
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    try {
      if (text === COMMANDS.START) {
        await sub(chatId, env);
        await sendTelegramMessage(chatId, MESSAGES.SUBSCRIBED, env);
        return successResponse();
      } else if (text === COMMANDS.STOP) {
        await unsub(chatId, env);
        await sendTelegramMessage(chatId, MESSAGES.UNSUBSCRIBED, env);
        return successResponse();
      } else if (text === COMMANDS.HELP) {
        await sendHelpMessage(chatId, env);
        return successResponse();
      } else if (text.startsWith(COMMANDS.NOW)) {
        // Parse optional ticker parameter
        const parts = text.trim().split(/\s+/);
        let ticker: string | undefined;
        
        if (parts.length > 1) {
          const tickerInput = parts[1];
          const validation = isValidTicker(tickerInput);
          
          if (!validation.isValid) {
            await sendTelegramMessage(
              chatId,
              `❌ Invalid ticker symbol: "${tickerInput}". Please use a valid ticker (1-10 alphanumeric characters).`,
              env
            );
            return successResponse();
          }
          
          ticker = validation.ticker;
        }
        
        // If no ticker specified, use watchlist (handleScheduled will handle it)
        // If ticker specified, use that ticker only (backward compatible)
        await handleScheduled(chatId, env, ticker);
        return successResponse();
      } else if (text.startsWith(COMMANDS.EXECUTE)) {
        // Parse /execute TICKER PRICE [DATE] command
        const parts = text.trim().split(/\s+/);
        if (parts.length < 3) {
          await sendTelegramMessage(
            chatId,
            '❌ Invalid format. Use: /execute TICKER PRICE [DATE]\nExample: /execute SPY 400.50\nExample: /execute SPY 400.50 2024-01-15',
            env
          );
          return successResponse();
        }
        
        const tickerInput = parts[1];
        const priceInput = parts[2];
        const dateInput = parts[3]; // Optional date parameter
        
        // Validate ticker
        const tickerValidation = isValidTicker(tickerInput);
        if (!tickerValidation.isValid) {
          await sendTelegramMessage(
            chatId,
            `❌ Invalid ticker symbol: "${tickerInput}". Please use a valid ticker (1-10 alphanumeric characters).`,
            env
          );
          return successResponse();
        }
        const ticker = tickerValidation.ticker;
        
        // Validate price
        const executionPrice = parseFloat(priceInput);
        if (isNaN(executionPrice) || executionPrice <= 0) {
          await sendTelegramMessage(
            chatId,
            `❌ Invalid price: "${priceInput}". Please provide a positive number.`,
            env
          );
          return successResponse();
        }
        
        // Parse and validate optional date parameter (YYYY-MM-DD format)
        let executionDate: number | undefined;
        if (dateInput) {
          // Validate date format (YYYY-MM-DD)
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(dateInput)) {
            await sendTelegramMessage(
              chatId,
              `❌ Invalid date format: "${dateInput}". Please use YYYY-MM-DD format (e.g., 2024-01-15).`,
              env
            );
            return successResponse();
          }
          
          // Parse the date and convert to timestamp (start of day UTC)
          const dateParts = dateInput.split('-');
          const year = parseInt(dateParts[0], 10);
          const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
          const day = parseInt(dateParts[2], 10);
          
          const date = new Date(Date.UTC(year, month, day));
          
          // Validate the date is valid (e.g., not Feb 30)
          if (date.getUTCFullYear() !== year || 
              date.getUTCMonth() !== month || 
              date.getUTCDate() !== day) {
            await sendTelegramMessage(
              chatId,
              `❌ Invalid date: "${dateInput}". Please provide a valid date.`,
              env
            );
            return successResponse();
          }
          
          executionDate = date.getTime();
        }
        
        // Check if user can execute (once per calendar month limit)
        const tradingAllowed = await canTrade(env.FEAR_GREED_KV, chatId);
        if (!tradingAllowed) {
          const lastExec = await getLatestExecution(env.FEAR_GREED_KV, chatId);
          if (lastExec) {
            const lastExecMonth = getMonthName(lastExec.executionDate);
            // Calculate next month
            const now = new Date();
            const nextMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
            const nextMonthName = getMonthName(nextMonth);
            await sendTelegramMessage(
              chatId,
              `❌ Trading frequency limit: You already executed a signal in ${lastExecMonth}. You can execute again in ${nextMonthName} (once per calendar month).`,
              env
            );
          } else {
            await sendTelegramMessage(
              chatId,
              '❌ Trading frequency limit: You can only execute once per calendar month.',
              env
            );
          }
          return successResponse();
        }
        
        // Get user's active position for this ticker
        const activePosition = await getActivePosition(env.FEAR_GREED_KV, chatId);
        const hasActivePosition = activePosition && activePosition.ticker.toUpperCase() === ticker.toUpperCase();
        
        // Determine signal type
        const signalType = hasActivePosition ? 'SELL' : 'BUY';
        
        // Record execution
        try {
          await recordExecution(env.FEAR_GREED_KV, chatId, signalType, ticker, executionPrice, undefined, executionDate);
          
          // Update active position
          if (signalType === 'BUY') {
            await setActivePosition(env.FEAR_GREED_KV, chatId, ticker, executionPrice);
            // Automatically add ticker to watchlist when opening position
            await ensureTickerInWatchlist(env.FEAR_GREED_KV, chatId, ticker);
          } else if (signalType === 'SELL') {
            // SELL execution closes ALL open positions for this ticker
            await clearActivePosition(env.FEAR_GREED_KV, chatId);
          }
          
          const signalEmoji = signalType === 'BUY' ? '🟢' : '🔴';
          let executionMessage = `${signalEmoji} *Execution Recorded*\n\n*Signal:* ${signalType}\n*Ticker:* ${ticker}\n*Price:* $${executionPrice.toFixed(2)}`;
          
          if (signalType === 'SELL') {
            executionMessage += `\n\n✅ All open positions for ${ticker} have been closed.`;
          }
          
          executionMessage += `\n\nExecution has been recorded in your history.`;
          
          await sendTelegramMessage(chatId, executionMessage, env);
        } catch (error) {
          console.error('Error recording execution:', error);
          await sendTelegramMessage(
            chatId,
            '❌ Failed to record execution. Please try again.',
            env
          );
        }
        
        return successResponse();
      } else if (text.startsWith(COMMANDS.EXECUTIONS)) {
        // Parse /executions [TICKER] command
        const parts = text.trim().split(/\s+/);
        let ticker: string | undefined;
        
        if (parts.length > 1) {
          const tickerInput = parts[1];
          const validation = isValidTicker(tickerInput);
          
          if (!validation.isValid) {
            await sendTelegramMessage(
              chatId,
              `❌ Invalid ticker symbol: "${tickerInput}". Please use a valid ticker (1-10 alphanumeric characters).`,
              env
            );
            return successResponse();
          }
          
          ticker = validation.ticker;
        }
        
        // Get execution history
        try {
          const history = await getExecutionHistory(env.FEAR_GREED_KV, chatId, ticker);
          const formatted = formatExecutionHistory(history);
          
          if (ticker) {
            await sendTelegramMessage(
              chatId,
              `*Execution History for ${ticker}:*\n\n${formatted}`,
              env
            );
          } else {
            await sendTelegramMessage(
              chatId,
              `*Your Execution History:*\n\n${formatted}`,
              env
            );
          }
        } catch (error) {
          console.error('Error retrieving execution history:', error);
          await sendTelegramMessage(
            chatId,
            '❌ Failed to retrieve execution history. Please try again.',
            env
          );
        }
        
        return successResponse();
      } else if (text.startsWith(COMMANDS.WATCHLIST)) {
        // Parse /watchlist command
        const parts = text.trim().split(/\s+/);
        
        if (parts.length === 1) {
          // /watchlist - Show current watchlist
          try {
            const watchlist = await getWatchlist(env.FEAR_GREED_KV, chatId);
            const watchlistText = watchlist.length > 0
              ? watchlist.map(t => `• $${t}`).join('\n')
              : '• $SPY (default)';
            
            await sendTelegramMessage(
              chatId,
              `*Your Watchlist:*\n\n${watchlistText}\n\nUse /watchlist add TICKER to add a ticker.\nUse /watchlist remove TICKER to remove a ticker.`,
              env
            );
          } catch (error) {
            console.error('Error retrieving watchlist:', error);
            await sendTelegramMessage(
              chatId,
              '❌ Failed to retrieve watchlist. Please try again.',
              env
            );
          }
        } else if (parts.length === 3 && parts[1].toLowerCase() === 'add') {
          // /watchlist add TICKER
          const tickerInput = parts[2];
          const result = await addTickerToWatchlist(env.FEAR_GREED_KV, chatId, tickerInput);
          
          if (result.success) {
            await sendTelegramMessage(chatId, `✅ ${result.message}`, env);
          } else {
            await sendTelegramMessage(chatId, `❌ ${result.message}`, env);
          }
        } else if (parts.length === 3 && parts[1].toLowerCase() === 'remove') {
          // /watchlist remove TICKER
          const tickerInput = parts[2];
          const result = await removeTickerFromWatchlist(env.FEAR_GREED_KV, chatId, tickerInput);
          
          if (result.success) {
            await sendTelegramMessage(chatId, `✅ ${result.message}`, env);
          } else {
            await sendTelegramMessage(chatId, `❌ ${result.message}`, env);
          }
        } else {
          // Invalid format
          await sendTelegramMessage(
            chatId,
            '❌ Invalid format. Use:\n/watchlist - View your watchlist\n/watchlist add TICKER - Add ticker to watchlist\n/watchlist remove TICKER - Remove ticker from watchlist',
            env
          );
        }
        
        return successResponse();
      } else {
        // Unknown command - still return OK to Telegram
        return successResponse();
      }
    } catch (error) {
      // Log error but don't expose details
      console.error('Error processing command:', error);
      return errorResponse('Internal server error', 500);
    }
  } else {
    return methodNotAllowedResponse();
  }
}

/**
 * Handle deployment notification request.
 * @param request - The incoming HTTP request
 * @param env - Environment variables
 * @returns Promise resolving to HTTP response
 */
async function handleDeployNotify(request: Request, env: Env): Promise<Response> {
  try {
    // Parse request body once (can only be read once)
    const body = await request.json() as { token?: string; commitHash?: string; commitMessage?: string; commitUrl?: string; timestamp?: string };
    
    // Get token from Authorization header or request body
    const authHeader = request.headers.get('Authorization');
    let providedToken: string | null = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      providedToken = authHeader.substring(7);
    } else {
      providedToken = body.token || null;
    }
    
    // Validate token
    if (!providedToken || providedToken !== env.TELEGRAM_BOT_TOKEN_SECRET) {
      return unauthorizedResponse('Invalid token');
    }
    
    // Extract commit information
    const { commitHash, commitMessage, commitUrl } = body;
    
    if (!commitHash || !commitMessage || !commitUrl) {
      return badRequestResponse('Missing required fields: commitHash, commitMessage, commitUrl');
    }
    
    // Format deployment notification message
    const message = `🚀 New version deployed!

Commit: \`${commitHash}\`
Message: ${commitMessage.split('\n')[0]}

🔗 [View on GitHub](${commitUrl})`;
    
    // Broadcast to all subscribers
    const broadcastResult = await broadcastToAllSubscribers(message, env);
    
    return successResponse({
      success: true,
      broadcast: broadcastResult
    });
  } catch (error) {
    // Log full error details server-side for debugging (not exposed to client)
    console.error('Error in handleDeployNotify:', error);
    // Return generic error message to client (no internal details exposed)
    return errorResponse('Internal server error', 500);
  }
}

