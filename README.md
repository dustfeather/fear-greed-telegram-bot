# Fear and Greed Telegram Bot

This project is a Telegram bot that provides updates on the Fear and Greed Index. Users can subscribe to receive alerts when the index indicates fear or extreme fear.

## Features

- Subscribe to Fear and Greed Index alerts
- Unsubscribe from alerts
- Get the current Fear and Greed Index rating
- Help command to show available commands

## Commands

- `/start` - Subscribe to Fear and Greed Index alerts.
- `/stop` - Unsubscribe from Fear and Greed Index alerts.
- `/now` - Get the current Fear and Greed Index rating.
- `/help` - Show help message.

## Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/yourusername/fear-greed-telegram-bot.git
    cd fear-greed-telegram-bot
    ```

2. Install dependencies:
    ```sh
    npm install
    ```

3. Set up environment variables:
	- `TELEGRAM_BOT_TOKEN_SECRET`: Your Telegram bot token.
	- `FEAR_GREED_KV`: Key-value storage for chat IDs.

## Usage

1. Start the bot:
    ```sh
    npm start
    ```

2. Interact with the bot on Telegram using the commands listed above.

## Todo:

1. Generates a pie chart of the current Fear and Greed Index score.
2. Add the pie chart to the chat message.
