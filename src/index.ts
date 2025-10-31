import type { ScheduledController, ExecutionContext } from '@cloudflare/workers-types';
import { sub, unsub } from './subs.js';
import { handleScheduled } from './sched.js';
import { sendHelpMessage, sendTelegramMessage } from './send.js';
import type { Env, TelegramUpdate } from './types.js';

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(null, env));
  },
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env);
  }
};

/**
 * Handle incoming HTTP request.
 * @param request - The incoming HTTP request
 * @param env - Environment variables
 * @returns Promise resolving to HTTP response
 */
async function handleRequest(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (request.method === 'POST') {
    const update = await request.json() as TelegramUpdate;
    
    // Debug: Log the incoming request structure
    const debugInfo: Record<string, unknown> = {
      requestInfo: {
        method: request.method,
        url: request.url,
        pathname: pathname,
        timestamp: new Date().toISOString()
      },
      incomingPayload: update
    };

    const message = update.message || update.edited_message;
    if (!message || !message.text) {
      debugInfo.error = 'No message or text found in payload';
      debugInfo.message = message;
      return new Response(JSON.stringify(debugInfo, null, 2), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    // Add command processing to debugInfo
    debugInfo.commandProcessing = {};

    if (text === '/start') {
      const subResult = await sub(chatId, env);
      const messageResult = await sendTelegramMessage(chatId, 'You\'ve subscribed to Fear and Greed Index alerts.', env);
      debugInfo.commandProcessing = {
        command: '/start',
        subscription: subResult,
        telegramResponse: messageResult,
        timestamp: new Date().toISOString()
      };
    } else if (text === '/stop') {
      const unsubResult = await unsub(chatId, env);
      const messageResult = await sendTelegramMessage(chatId, 'You\'ve unsubscribed from Fear and Greed Index alerts.', env);
      debugInfo.commandProcessing = {
        command: '/stop',
        unsubscription: unsubResult,
        telegramResponse: messageResult,
        timestamp: new Date().toISOString()
      };
    } else if (text === '/help') {
      const helpResult = await sendHelpMessage(chatId, env);
      debugInfo.commandProcessing = {
        command: '/help',
        telegramResponse: helpResult,
        timestamp: new Date().toISOString()
      };
    } else if (text === '/now') {
      await handleScheduled(chatId, env);
      debugInfo.commandProcessing = {
        command: '/now',
        message: 'Scheduled handler executed',
        timestamp: new Date().toISOString()
      };
    } else {
      debugInfo.commandProcessing = {
        command: 'unknown',
        message: 'Unknown command received',
        receivedText: text,
        timestamp: new Date().toISOString()
      };
    }

    // Add extracted message info
    debugInfo.extractedInfo = {
      chatId: chatId,
      text: text,
      messageId: message.message_id,
      from: message.from
    };

    // Return debug information as JSON response
    return new Response(JSON.stringify(debugInfo, null, 2), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } else {
    return new Response('Method not allowed', { status: 405 });
  }
}

