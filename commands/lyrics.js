const axios = require('axios');

module.exports = {
  name: 'lyrics',
  description: 'Searches and Fetches Song Lyrics.',
  usage: '-lyrics [song name]',
  author: 'kohi',

  async execute(senderId, args, token, event, sendMessage) {
    const query = args.join(' ');
    if (!query) return sendMessage(senderId, { text: '❌ Please provide a song name.' }, token);

    try {
      const { data } = await axios.get(
        `https://betadash-api-swordslush-production.up.railway.app/lyrics-finder?title=${encodeURIComponent(query)}`
      );

      if (!data || data.status !== 200 || !data.response) {
        return sendMessage(senderId, { text: '⚠️ No lyrics found.' }, token);
      }

      // Send song info card
      await sendMessage(senderId, {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: [
              {
                title: `🎧 • ${data.Title}`,
                image_url: data.Thumbnail,
                subtitle: `By ${data.author || 'Unknown'}`
              }
            ]
          }
        }
      }, token);

      // Split long lyrics into chunks
      const chunk = (str, size = 1900) => str.match(new RegExp(`.{1,${size}}`, 'gs')) ?? [];
      for (const part of chunk(data.response)) {
        await sendMessage(senderId, { text: part.trim() }, token);
      }

    } catch (err) {
      console.error('Lyrics Error:', err);
      sendMessage(senderId, { text: '❎ Failed to fetch lyrics. Try again later.' }, token);
    }
  }
};
