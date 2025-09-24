const { sendMessage } = require('./sendMessage');

const handlePostback = async (event, pageAccessToken) => {
  const senderId = event.sender?.id;
  const payload = event.postback?.payload;

  if (!senderId || !payload) return;

  try {
    if (payload === 'GET_STARTED') {
      return await sendMessage(senderId, {
        text: 'yo, welcome.\nask me whatever.\ntap 𝐇𝐞𝐥𝐩 if you’re curious what else i can do.',
        quick_replies: [
          { content_type: 'text', title: 'Help', payload: 'CMD_HELP' }
        ]
      }, pageAccessToken);
    }

    if (payload.startsWith('CMD_')) {
      const command = payload.slice(4).toLowerCase();
      
      const { handleMessage } = require('./handleMessage');
      
      const fakeEvent = {
        sender: { id: senderId },
        message: { text: `-${command}` }
      };
      
      return await handleMessage(fakeEvent, pageAccessToken);
    }

    await sendMessage(senderId, {
      text: `Received postback: ${payload}`
    }, pageAccessToken);

  } catch (error) {
    console.error('Postback error:', error.message);
  }
};

module.exports = { handlePostback };