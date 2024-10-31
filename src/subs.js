/**
 * Subscribe user to Fear and Greed Index alerts.
 * @param chatId
 * @returns {Promise<void>}
 */
async function sub(chatId) {
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
async function unsub(chatId) {
	const chatIdsString = await FEAR_GREED_KV.get('chat_ids');
	const chatIds = chatIdsString ? JSON.parse(chatIdsString) : [];
	const index = chatIds.indexOf(chatId);
	if (index !== -1) {
		chatIds.splice(index, 1);
		await FEAR_GREED_KV.put('chat_ids', JSON.stringify(chatIds));
	}
}

export { sub, unsub };
