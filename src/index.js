import { sub, unsub } from './subs.js';
import { handleScheduled } from './sched.js';
import { sendHelpMessage, sendTelegramMessage } from './send.js';

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(null, env));
  },
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  }
};

/**
 * Handle incoming HTTP request.
 * @param request
 * @param env
 * @returns {Promise<Response>}
 */
async function handleRequest(request, env) {
  const { pathname } = new URL(request.url);

  if (request.method === 'POST') {
    const update = await request.json();
    const message = update.message || update.edited_message;
    if (!message || !message.text) {
      return new Response('OK');
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    if (text === '/start') {
      await sub(chatId);
      await sendTelegramMessage(chatId, 'You\'ve subscribed to Fear and Greed Index alerts.', env);
    } else if (text === '/stop') {
      await unsub(chatId);
      await sendTelegramMessage(chatId, 'You\'ve unsubscribed from Fear and Greed Index alerts.', env);
    } else if (text === '/help') {
      await sendHelpMessage(chatId, env);
    } else if (text === '/now') {
      await handleScheduled(chatId, env);
    }

    return new Response('OK', { status: 200 });
  } else {
    return new Response('Method not allowed', { status: 405 });
  }
}
