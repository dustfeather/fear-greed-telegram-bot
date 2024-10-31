/**
 * Send a message to a Telegram chat.
 * @param chatId
 * @param message
 * @param env
 * @returns {Promise<void>}
 */
async function sendTelegramMessage(chatId, message, env) {
  const TELEGRAM_BOT_TOKEN = env.TELEGRAM_BOT_TOKEN_SECRET;
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

/**
 * Send help message to the user.
 * @param chatId
 * @param env
 * @returns {Promise<void>}
 */
async function sendHelpMessage(chatId, env) {
  const helpMessage = `
Available commands:
/start - Subscribe to Fear and Greed Index alerts.
/stop - Unsubscribe from Fear and Greed Index alerts.
/now - Get the current Fear and Greed Index rating.
/help - Show this help message.
 `;
  await sendTelegramMessage(chatId, helpMessage, env);
}

export { sendHelpMessage, sendTelegramMessage };
