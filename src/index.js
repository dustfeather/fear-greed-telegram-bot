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
			await subscribe(chatId);
			await sendTelegramMessage(chatId, 'You\'ve subscribed to Fear and Greed Index alerts.', env);
		} else if (text === '/stop') {
			await unsubscribe(chatId);
			await sendTelegramMessage(chatId, 'You\'ve unsubscribed from Fear and Greed Index alerts.', env);
		} else if (text === '/help') {
			await sendHelpMessage(chatId, env);
		} else if (text === '/now') {
			await handleScheduled(chatId, env);
		}

		return new Response('OK');
	} else {
		return new Response('Method not allowed', { status: 405 });
	}
}

/**
 * Subscribe user to Fear and Greed Index alerts.
 * @param chatId
 * @returns {Promise<void>}
 */
async function subscribe(chatId) {
	const chatIdsString = await FEAR_GREED_KV.get('chat_ids');
	const chatIds = chatIdsString ? JSON.parse(chatIdsString) : [];
	if (!chatIds.includes(chatId)) {
		chatIds.push(chatId);
		await FEAR_GREED_KV.put('chat_ids', JSON.stringify(chatIds));
	}
}

/**
 * Unsubscribe user from Fear and Greed Index alerts.
 * @param chatId
 * @returns {Promise<void>}
 */
async function unsubscribe(chatId) {
	const chatIdsString = await FEAR_GREED_KV.get('chat_ids');
	const chatIds = chatIdsString ? JSON.parse(chatIdsString) : [];
	const index = chatIds.indexOf(chatId);
	if (index !== -1) {
		chatIds.splice(index, 1);
		await FEAR_GREED_KV.put('chat_ids', JSON.stringify(chatIds));
	}
}
