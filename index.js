const express = require('express');
const { readFile, readdir, watch } = require('fs/promises');
const { join, resolve } = require('path');
const { handleMessage } = require('./handles/handleMessage');
const { handlePostback } = require('./handles/handlePostback');

const app = express();
const VERIFY_TOKEN = 'pagebot';
const COMMANDS_PATH = join(__dirname, 'commands');
const GRAPH_API = 'https://graph.facebook.com/v23.0/me';

let PAGE_ACCESS_TOKEN;

app.use(express.json({ limit: '10mb' }));

const loadToken = async () => PAGE_ACCESS_TOKEN = (await readFile('token.txt', 'utf8')).trim();

const apiCall = async (endpoint, data) => {
  const response = await fetch(`${GRAPH_API}${endpoint}?access_token=${PAGE_ACCESS_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error(`API Error: ${response.status}`);
  return response.json();
};

const loadCommands = async () => {
  const files = await readdir(COMMANDS_PATH);
  const commands = [];
  
  for (const file of files.filter(f => f.endsWith('.js'))) {
    try {
      delete require.cache[resolve(join(COMMANDS_PATH, file))];
      const command = require(join(COMMANDS_PATH, file));
      if (command.name && command.description) {
        const names = Array.isArray(command.name) ? command.name : [command.name];
        commands.push({ name: names[0], aliases: names.slice(1) });
      }
    } catch (e) {
      console.error(`Failed loading ${file}:`, e.message);
    }
  }
  
  return commands.sort((a, b) => a.name.localeCompare(b.name));
};

const createMenuItems = (commands) => {
  if (commands.length <= 3) {
    return commands.map(cmd => ({
      type: 'postback',
      title: cmd.name.charAt(0).toUpperCase() + cmd.name.slice(1),
      payload: `CMD_${cmd.name.toUpperCase()}`
    }));
  }

  const groups = commands.reduce((acc, cmd) => {
    const key = cmd.name.charAt(0).toUpperCase();
    (acc[key] ||= []).push(cmd);
    return acc;
  }, {});

  const groupNames = Object.keys(groups);
  
  if (groupNames.length <= 3) {
    return groupNames.map(group => {
      const cmds = groups[group];
      return cmds.length === 1 ? {
        type: 'postback',
        title: cmds[0].name.charAt(0).toUpperCase() + cmds[0].name.slice(1),
        payload: `CMD_${cmds[0].name.toUpperCase()}`
      } : {
        type: 'nested',
        title: group,
        call_to_actions: cmds.slice(0, 5).map(cmd => ({
          type: 'postback',
          title: cmd.name.charAt(0).toUpperCase() + cmd.name.slice(1),
          payload: `CMD_${cmd.name.toUpperCase()}`
        }))
      };
    });
  }

  return [{
    type: 'nested',
    title: 'All Commands',
    call_to_actions: commands.slice(0, 5).map(cmd => ({
      type: 'postback',
      title: cmd.name.charAt(0).toUpperCase() + cmd.name.slice(1),
      payload: `CMD_${cmd.name.toUpperCase()}`
    }))
  }];
};

const setupMenu = async () => {
  try {
    const commands = await loadCommands();
    const menuItems = createMenuItems(commands).slice(0, 3);
    
    await apiCall('/messenger_profile', {
      get_started: { payload: 'GET_STARTED' },
      persistent_menu: [{
        locale: 'default',
        composer_input_disabled: false,
        call_to_actions: menuItems
      }]
    });

    console.log(`✅ Menu: ${commands.length} commands loaded`);
  } catch (e) {
    console.error('❌ Menu setup failed:', e.message);
  }
};

const startWatcher = async () => {
  try {
    const watcher = watch(COMMANDS_PATH);
    for await (const { eventType, filename } of watcher) {
      if (eventType === 'change' && filename?.endsWith('.js')) setupMenu();
    }
  } catch (e) {
    console.error('Watcher error:', e.message);
  }
};

app.get('/webhook', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  return mode === 'subscribe' && token === VERIFY_TOKEN 
    ? (console.log('✅ Webhook verified'), res.status(200).send(challenge))
    : res.sendStatus(403);
});

app.post('/webhook', (req, res) => {
  if (req.body.object !== 'page') return res.sendStatus(404);
  
  req.body.entry?.forEach(entry => 
    entry.messaging?.forEach(event => {
      if (event.message) handleMessage(event, PAGE_ACCESS_TOKEN);
      else if (event.postback) handlePostback(event, PAGE_ACCESS_TOKEN);
    })
  );
  
  res.status(200).send('EVENT_RECEIVED');
});

const start = async () => {
  try {
    await loadToken();
    const PORT = process.env.PORT || 3000;
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      setupMenu();
      startWatcher();
    });
  } catch (e) {
    console.error('Startup failed:', e.message);
    process.exit(1);
  }
};

start();