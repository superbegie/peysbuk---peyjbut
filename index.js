const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const { handleMessage } = require('./handles/handleMessage');
const { handlePostback } = require('./handles/handlePostback');

const app = express();
app.use(express.json());

const VERIFY_TOKEN = 'pagebot';
const PAGE_ACCESS_TOKEN = (await fs.readFile('token.txt', 'utf8')).trim();
const COMMANDS_PATH = path.join(__dirname, 'commands');

// Webhook verification
app.get('/webhook', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Main webhook handler
app.post('/webhook', (req, res) => {
  const { body } = req;
  
  if (body.object !== 'page') return res.sendStatus(404);
  
  body.entry?.forEach(entry => {
    entry.messaging?.forEach(event => {
      if (event.message) handleMessage(event, PAGE_ACCESS_TOKEN);
      else if (event.postback) handlePostback(event, PAGE_ACCESS_TOKEN);
    });
  });
  
  res.status(200).send('EVENT_RECEIVED');
});

// Messenger profile setup
const setMessengerProfile = async (data) => {
  const response = await fetch(`https://graph.facebook.com/v23.0/me/messenger_profile?access_token=${PAGE_ACCESS_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};

// Load commands and setup menu
const setupMenu = async () => {
  try {
    const files = await fs.readdir(COMMANDS_PATH);
    const commands = [];
    
    for (const file of files.filter(f => f.endsWith('.js'))) {
      const command = require(path.join(COMMANDS_PATH, file));
      if (command.name && command.description) {
        commands.push({ name: command.name, description: command.description });
      }
    }
    
    const menuItems = commands.slice(0, 3).map(cmd => ({
      type: 'postback',
      title: cmd.name.slice(0, 20),
      payload: `CMD_${cmd.name.toUpperCase()}`
    }));
    
    await setMessengerProfile({
      get_started: { payload: 'GET_STARTED' },
      persistent_menu: [{
        locale: 'default',
        composer_input_disabled: false,
        call_to_actions: menuItems
      }]
    });
    
    console.log('✅ Menu configured');
  } catch (error) {
    console.error('❌ Menu setup failed:', error.message);
  }
};

// Watch for command changes
const watcher = fs.watch(COMMANDS_PATH);
for await (const { eventType, filename } of watcher) {
  if (eventType === 'change' && filename?.endsWith('.js')) {
    setupMenu();
  }
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  setupMenu();
});