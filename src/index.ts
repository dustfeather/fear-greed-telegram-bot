import type { ScheduledController, ExecutionContext } from '@cloudflare/workers-types';
import { sub, unsub } from './subs.js';
import { handleScheduled } from './sched.js';
import { sendHelpMessage, sendTelegramMessage, broadcastToAllSubscribers } from './send.js';
import type { Env, TelegramUpdate } from './types.js';
import { COMMANDS, MESSAGES, TRADING_CONFIG } from './constants.js';
import { successResponse, errorResponse, unauthorizedResponse, badRequestResponse, methodNotAllowedResponse } from './utils/response.js';
import { isValidTicker } from './utils/validation.js';

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
        let ticker: string = TRADING_CONFIG.SYMBOL; // Default to SPY
        
        const parts = text.trim().split(/\s+/);
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
        
        await handleScheduled(chatId, env, ticker);
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

