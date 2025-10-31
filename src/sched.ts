import { generatePieChart } from './chart.js';
import { sendTelegramMessage } from './send.js';
import type { Env, FearGreedIndexResponse } from './types.js';

/**
 * Handle scheduled event.
 * @param chatId - Optional specific chat ID to send to, or null to send to all subscribers
 * @param env - Environment variables
 * @returns Promise resolving to void
 */
export async function handleScheduled(chatId: number | string | null = null, env: Env): Promise<void> {
  // Fetch Fear and Greed Index
  const url = 'https://production.dataviz.cnn.io/index/fearandgreed/current';
  const options: RequestInit = {
    method: 'GET',
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Accept-Language': 'en-US,en;q=0.9,ro;q=0.8',
      'Cache-Control': 'max-age=0',
      'Dnt': '1',
      'Priority': 'u=0, i',
      'Sec-Ch-Ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
    }
  };
  try {
    const response = await fetch(url, options);
    const data = await response.json() as FearGreedIndexResponse;
    const rating = data.rating.toLowerCase();
    const score = (Math.round(data.score * 100) / 100).toFixed(2);
    let message = '';
    await generatePieChart(score).then(url => {
      message = `⚠️ The current [Fear and Greed Index](${url}) rating is ${score}% (*${rating.toUpperCase()}*).`;
    });
    if (rating === 'fear' || rating === 'extreme fear') {
      // Retrieve chat IDs from KV storage
      const chatIdsString = await env.FEAR_GREED_KV.get('chat_ids');
      const chatIds: (number | string)[] = chatIdsString ? JSON.parse(chatIdsString) : [];
      // Send message to all subscribers
      await Promise.all(chatIds.map(id => sendTelegramMessage(id, message, env)));
    } else if (chatId) {
      // Send message to a specific subscriber
      await sendTelegramMessage(chatId, message, env);
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    const message = `An error occurred: ${errorMessage}`;
    console.error(message);
    const adminChatId = env.ADMIN_CHAT_ID;
    if (adminChatId) {
      await sendTelegramMessage(adminChatId, message, env);
    }
  }
}

