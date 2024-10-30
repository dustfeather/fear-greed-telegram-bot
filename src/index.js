addEventListener('scheduled', event => {
	event.waitUntil(handleScheduled(event));
});

/**
 * Handle scheduled event.
 * @param event
 * @param chatId
 * @returns {Promise<void>}
 */
async function handleScheduled(event, chatId = null) {
	// Fetch Fear and Greed Index
	const url = 'https://production.dataviz.cnn.io/index/fearandgreed/current';
	try {
		// const response = await fetch(url);
		const data = JSON.parse('{"score": 57.8, "rating": "greed", "timestamp": "2024-10-30T19:59:59+00:00", "previous_close": 60.2285714285714, "previous_1_week": 62.2857142857143, "previous_1_month": 73.5142857142857, "previous_1_year": 29.2}');
		// const data = await response.json();
		const rating = data['rating'].toLowerCase();
		const score = (Math.round(data['score'] * 100) / 100).toFixed(2);
		const message = `⚠️ The current *Fear and Greed Index* rating is ${score}% (*${capitalize(rating)}*).`;

		if (rating === 'fear' || rating === 'extreme fear') {
			// Retrieve chat IDs from KV storage
			const chatIdsString = await FEAR_GREED_KV.get('chat_ids');
			const chatIds = chatIdsString ? JSON.parse(chatIdsString) : [];
			// Send message to all subscribers
			await Promise.all(chatIds.map(chatId => sendTelegramMessage(chatId, message)));
		} else if (chatId) {
			// Send message to a specific subscriber
			await sendTelegramMessage(chatId, message);
		}
	} catch (e) {
		console.error(`An error occurred: ${e}`);
	}
}

/**
 * Capitalize the first letter of a string.
 * @param str
 * @returns {string}
 */
function capitalize(str) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Send a message to a Telegram chat.
 * @param chatId
 * @param message
 * @returns {Promise<void>}
 */
async function sendTelegramMessage(chatId, message) {
	const TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN_SECRET;
	const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

	const payload = {
		chat_id: chatId, text: message, parse_mode: 'Markdown'
	};

	await fetch(url, {
		method: 'POST', headers: {
			'Content-Type': 'application/json'
		}, body: JSON.stringify(payload)
	});
}

// HTTP event listener to handle /start and /stop commands
addEventListener('fetch', event => {
	event.respondWith(handleRequest(event.request));
});

/**
 * Handle incoming HTTP requests.
 * @param request
 * @returns {Promise<Response>}
 */
async function handleRequest(request) {
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
			await sendTelegramMessage(chatId, 'You\'ve subscribed to Fear and Greed Index alerts.');
		} else if (text === '/stop') {
			await unsubscribe(chatId);
			await sendTelegramMessage(chatId, 'You\'ve unsubscribed from Fear and Greed Index alerts.');
		} else if (text === '/help') {
			await sendHelpMessage(chatId);
		} else if (text === '/now') {
			await handleNowCommand(chatId);
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

/**
 * Send help message to the user.
 * @param chatId
 * @returns {Promise<void>}
 */
async function sendHelpMessage(chatId) {
	const helpMessage = `
Available commands:
/start - Subscribe to Fear and Greed Index alerts.
/stop - Unsubscribe from Fear and Greed Index alerts.
/now - Get the current Fear and Greed Index rating.
/help - Show this help message.
 `;
	await sendTelegramMessage(chatId, helpMessage);
}

/**
 * Handle the /now command.
 * @param chatId
 * @returns {Promise<void>}
 */
async function handleNowCommand(chatId) {
	const event = {}; // Create a mock event object
	await handleScheduled(event, chatId);
}
