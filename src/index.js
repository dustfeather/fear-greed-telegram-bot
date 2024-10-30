addEventListener('scheduled', event => {
	event.waitUntil(handleScheduled(event));
});

async function handleScheduled(event) {
	// Fetch Fear and Greed Index
	const url = 'https://production.dataviz.cnn.io/index/fearandgreed/current';
	try {
		const response = await fetch(url);
		const data = await response.json();
		const rating = data['rating'].toLowerCase();

		if (rating === 'fear' || rating === 'extreme fear') {
			const message = `🔔 Alert: The current Fear and Greed Index rating is *${capitalize(rating)}*.`;

			// Retrieve chat IDs from KV storage
			const chatIdsString = await FEAR_GREED_KV.get('chat_ids');
			const chatIds = chatIdsString ? JSON.parse(chatIdsString) : [];

			// Send message to all subscribers
			await Promise.all(chatIds.map(chatId => sendTelegramMessage(chatId, message)));
		}
	} catch (e) {
		console.error(`An error occurred: ${e}`);
	}
}

function capitalize(str) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

async function sendTelegramMessage(chatId, message) {
	const TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN_SECRET;
	const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

	const payload = {
		chat_id: chatId,
		text: message,
		parse_mode: 'Markdown'
	};

	await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(payload)
	});
}

// HTTP event listener to handle /start and /stop commands
addEventListener('fetch', event => {
	event.respondWith(handleRequest(event.request));
});

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
		}

		return new Response('OK');
	} else {
		return new Response('Method not allowed', { status: 405 });
	}
}

async function subscribe(chatId) {
	const chatIdsString = await FEAR_GREED_KV.get('chat_ids');
	const chatIds = chatIdsString ? JSON.parse(chatIdsString) : [];
	if (!chatIds.includes(chatId)) {
		chatIds.push(chatId);
		await FEAR_GREED_KV.put('chat_ids', JSON.stringify(chatIds));
	}
}

async function unsubscribe(chatId) {
	const chatIdsString = await FEAR_GREED_KV.get('chat_ids');
	const chatIds = chatIdsString ? JSON.parse(chatIdsString) : [];
	const index = chatIds.indexOf(chatId);
	if (index !== -1) {
		chatIds.splice(index, 1);
		await FEAR_GREED_KV.put('chat_ids', JSON.stringify(chatIds));
	}
}
