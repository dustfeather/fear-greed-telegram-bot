import { generatePieChart } from './chart.js';
import { sendTelegramMessage } from './send.js';

/**
 * Handle scheduled event.
 * @param chatId
 * @param env
 * @returns {Promise<void>}
 */
async function handleScheduled(chatId = null, env) {
  // Fetch Fear and Greed Index
  const url = 'https://production.dataviz.cnn.io/index/fearandgreed/current';
  const options = {
    method: 'GET',
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Dnt': '1',
      'Pragma': 'no-cache',
      'Priority': 'u=0, i',
      'Sec-Ch-Ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
    }
  };
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    const rating = data['rating'].toLowerCase();
    const score = (Math.round(data['score'] * 100) / 100).toFixed(2);
    let message = '';
    await generatePieChart(score).then(url => {
      message = `⚠️ The current [Fear and Greed Index](${url}) rating is ${score}% (*${rating.toUpperCase()}*).`;
    });
    if (rating === 'fear' || rating === 'extreme fear') {
      // Retrieve chat IDs from KV storage
      const chatIdsString = await env.FEAR_GREED_KV.get('chat_ids');
      const chatIds = chatIdsString ? JSON.parse(chatIdsString) : [];
      // Send message to all subscribers
      await Promise.all(chatIds.map(chatId => sendTelegramMessage(chatId, message, env)));
    } else if (chatId) {
      // Send message to a specific subscriber
      await sendTelegramMessage(chatId, message, env);
    }
  } catch (e) {
    let message = `An error occurred: ${e}`;
    console.error(message);
    await sendTelegramMessage(540063619, message, env);
  }
}

export { handleScheduled };
