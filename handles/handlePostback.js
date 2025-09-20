const { sendMessage } = require('./sendMessage');

const handlePostback = async (event, pageAccessToken) => {
  const senderId = event.sender?.id;
  const payload = event.postback?.payload;

  if (!senderId || !payload) return;

  try {
    if (payload === 'GET_STARTED') {
      return await sendMessage(senderId, {
        text: '✧(・ω<)╯Hi I’m Kohi! Your friendly AI buddy, here to help out with whatever—questions, tasks, you name it. I’m always learning and getting better. So, what’s up today?\n\n☕✨ For the best experience, simply tap "Help" to see all the things I can do for you.',
        quick_replies: [
          { content_type: 'text', title: 'Help', payload: 'CMD_HELP' }
        ]
      }, pageAccessToken);
    }

    if (payload.startsWith('CMD_')) {
      const command = payload.slice(4).toLowerCase();
      
      // Execute the command directly instead of just showing a message
      const { handleMessage } = require('./handleMessage');
      
      // Create a fake message event to trigger the command
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