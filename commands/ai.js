const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

function makeBold(text) {
  return text.replace(/\*\*(.+?)\*\*/g, (match, word) => {
    let boldText = '';
    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      if (char >= 'a' && char <= 'z') {
        boldText += String.fromCharCode(char.charCodeAt(0) + 0x1D41A - 97);
      } else if (char >= 'A' && char <= 'Z') {
        boldText += String.fromCharCode(char.charCodeAt(0) + 0x1D400 - 65);
      } else if (char >= '0' && char <= '9') {
        boldText += String.fromCharCode(char.charCodeAt(0) + 0x1D7CE - 48);
      } else {
        boldText += char;
      }
    }
    return boldText;
  });
}

function splitMessage(text) {
  const maxLength = 1900;
  const chunks = [];

  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.slice(i, i + maxLength));
  }

  return chunks;
}

module.exports = {
  name: 'ai',
  description: 'Chat with Grok AI',
  usage: 'grok [message]',
  author: 'coffee',

  async execute(senderId, args, token) {
    const message = args.join(' ') || 'Hello';
    const header = '💬 | 𝙶𝚛𝚘𝚔 𝙰𝚒\n・────────────・\n';
    const footer = '\n・──── >ᴗ< ─────・';

    try {
      const response = await axios.get('https://rapido.zetsu.xyz/api/grok', {
        params: { query: message }
      });

      if (!response.data || !response.data.status) {
        throw new Error('API error');
      }

      let aiResponse = response.data.response;

      aiResponse = aiResponse.trim();
      aiResponse = makeBold(aiResponse);

      const chunks = splitMessage(aiResponse);

      for (let i = 0; i < chunks.length; i++) {
        const isFirst = i === 0;
        const isLast = i === chunks.length - 1;

        let fullMessage = chunks[i];
        if (isFirst) fullMessage = header + fullMessage;
        if (isLast) fullMessage = fullMessage + footer;

        await sendMessage(senderId, { text: fullMessage }, token);
      }

    } catch (error) {
      await sendMessage(senderId, {
        text: header + '❌ Something went wrong. Please try again.' + footer
      }, token);
    }
  }
};
