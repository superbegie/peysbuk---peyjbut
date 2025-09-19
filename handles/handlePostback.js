const { sendMessage } = require('./sendMessage');

const handlePostback = async (event, pageAccessToken) => {
  const senderId = event.sender?.id;
  const payload = event.postback?.payload;
  
  if (!senderId || !payload) return;
  
  try {
    // Welcome message
    if (payload === 'GET_STARTED') {
      return await sendMessage(senderId, {
        text: '👋 Welcome! Choose an option to get started:',
        quick_replies: [
          { content_type: 'text', title: 'Show Help', payload: 'CMD_HELP' },
          { content_type: 'text', title: 'Try AI Chat', payload: 'CMD_AI' },
          { content_type: 'text', title: 'All Commands', payload: 'CMD_MENU' }
        ]
      }, pageAccessToken);
    }
    
    // Command shortcuts
    if (payload.startsWith('CMD_')) {
      const command = payload.slice(4).toLowerCase();
      return await sendMessage(senderId, {
        text: `📋 ${command.charAt(0).toUpperCase() + command.slice(1)} command selected. Type "-${command}" to use it.`
      }, pageAccessToken);
    }
    
    // Generic postback response
    await sendMessage(senderId, {
      text: `Received postback: ${payload}`
    }, pageAccessToken);
    
  } catch (error) {
    console.error('Postback error:', error.message);
  }
};

module.exports = { handlePostback };