/**
 * /stats handler
 * View user performance statistics
 */

function handleStats(msg) {
  const chatId = msg.chat.id;
  msg.bot.sendMessage(chatId, `
*📊 Your Stats*
🔄 This feature is coming soon!

Track your P&L, win rate, and bet history:
📊 https://alexbet-lite.netlify.app
  `, { parse_mode: 'Markdown' });
}

module.exports = { handleStats };
