const express = require('express');
const { readFileSync, readdirSync, watch } = require('fs');
const { join } = require('path');
const { handleMessage } = require('./handles/handleMessage');
const { handlePostback } = require('./handles/handlePostback');
const { sendRequest } = require('./handles/sendMessage');

const app = express();
app.use(express.json({ limit: '10mb' }));

// Configuration
const CONFIG = {
  VERIFY_TOKEN: 'pagebot',
  PAGE_ACCESS_TOKEN: readFileSync('token.txt', 'utf8').trim(),
  COMMANDS_PATH: join(__dirname, 'commands'),
  PORT: process.env.PORT || 3000
};

// Webhook verification
app.get('/webhook', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;

  if (mode === 'subscribe' && token === CONFIG.VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    return res.status(200).send(challenge);
  }

  res.sendStatus(mode && token ? 403 : 400);
});

// Webhook event handler
app.post('/webhook', (req, res) => {
  const { body } = req;

  if (body?.object !== 'page') return res.sendStatus(404);

  // Process all events asynchronously
  body.entry?.forEach(entry => {
    entry.messaging?.forEach(event => {
      if (event.message) {
        handleMessage(event, CONFIG.PAGE_ACCESS_TOKEN).catch(console.error);
      } else if (event.postback) {
        handlePostback(event, CONFIG.PAGE_ACCESS_TOKEN).catch(console.error);
      }
    });
  });

  res.status(200).send('EVENT_RECEIVED');
});

// Messenger Profile Management
const updateMessengerProfile = async (method, endpoint, data = null) => {
  try {
    return await sendRequest({
      method,
      endpoint: `/me/messenger_profile${endpoint}`,
      data,
      token: CONFIG.PAGE_ACCESS_TOKEN
    });
  } catch (error) {
    console.error(`❌ Profile ${method} error:`, error.message);
    throw error;
  }
};

// Command loading and menu setup
const loadCommands = () => {
  try {
    return readdirSync(CONFIG.COMMANDS_PATH)
      .filter(file => file.endsWith('.js'))
      .map(file => {
        try {
          const command = require(join(CONFIG.COMMANDS_PATH, file));
          return command.name && command.description 
            ? { name: command.name, description: command.description }
            : null;
        } catch (err) {
          console.warn(`⚠️ Failed to load command: ${file}`);
          return null;
        }
      })
      .filter(Boolean);
  } catch (error) {
    console.error('❌ Error loading commands:', error.message);
    return [];
  }
};

const setupPersistentMenu = async (isReload = false) => {
  const commands = loadCommands();

  if (isReload) {
    await updateMessengerProfile('DELETE', '?fields=persistent_menu');
    console.log('🗑️ Menu cleared');
  }

  const menuItems = commands.slice(0, 3).map(cmd => ({
    type: 'postback',
    title: cmd.name.slice(0, 20),
    payload: `CMD_${cmd.name.toUpperCase()}`
  }));

  const profileData = {
    persistent_menu: [{
      locale: 'default',
      composer_input_disabled: false,
      call_to_actions: menuItems
    }]
  };

  await updateMessengerProfile('POST', '', profileData);
  console.log('✅ Persistent menu updated');
};

// File watcher for command changes
let watchTimeout;
watch(CONFIG.COMMANDS_PATH, (eventType, filename) => {
  if (!['change', 'rename'].includes(eventType) || !filename?.endsWith('.js')) return;

  // Debounce multiple rapid changes
  clearTimeout(watchTimeout);
  watchTimeout = setTimeout(() => {
    console.log(`🔄 Reloading menu (${filename} ${eventType})`);
    setupPersistentMenu(true).catch(error => {
      console.error('❌ Menu reload failed:', error.message);
    });
  }, 1000);
});

// Server startup
app.listen(CONFIG.PORT, async () => {
  console.log(`🚀 Server running on port ${CONFIG.PORT}`);

  try {
    await setupPersistentMenu();
  } catch (error) {
    console.error('❌ Initial menu setup failed:', error.message);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});
