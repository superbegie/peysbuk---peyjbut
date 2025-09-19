const { sendMessage } = require('./sendMessage');
const { readdirSync } = require('fs');
const { join } = require('path');

class PostbackHandler {
  constructor() {
    this.commands = new Map();
    this.loadCommands();
  }

  loadCommands() {
    try {
      const commandsPath = join(__dirname, '../commands');
      const files = readdirSync(commandsPath).filter(file => file.endsWith('.js'));
      for (const file of files) {
        try {
          const command = require(`../commands/${file}`);
          if (command.name) {
            const names = Array.isArray(command.name) ? command.name : [command.name];
            names.forEach(name => {
              if (typeof name === 'string') {
                this.commands.set(name.toLowerCase(), command);
              }
            });
          }
        } catch (error) {
          console.warn(`⚠️ Failed to load command for postback: ${file}`);
        }
      }
    } catch (error) {
      console.error('❌ Error loading commands for postbacks:', error.message);
    }
  }

  async executeCommandFromPostback(senderId, commandName, token) {
    const command = this.commands.get(commandName);
    if (command) {
      try {
        const mockEvent = {
          sender: { id: senderId },
          message: { text: commandName }
        };
        console.log(`🎯 Executing command "${commandName}" from postback`);
        await command.execute(senderId, [], token, mockEvent, sendMessage, new Map());
      } catch (error) {
        console.error(`❌ Postback command error (${commandName}):`, error.message);
        await sendMessage(senderId, {
          text: `❌ Error executing "${commandName}". Please try again.`
        }, token);
      }
    } else {
      await sendMessage(senderId, {
        text: `Command "${commandName}" is not available right now.`,
        quick_replies: [{ title: 'Show Help', payload: 'CMD_HELP' }]
      }, token);
    }
  }

  async showCommandHelp(senderId, token) {
    const command = this.commands.get('help');
    if (command) {
      try {
        const mockEvent = {
          sender: { id: senderId },
          message: { text: 'help' }
        };
        await command.execute(senderId, [], token, mockEvent, sendMessage, new Map());
      } catch (error) {
        console.error('❌ Help command error:', error.message);
        await sendMessage(senderId, {
          text: '❌ Error loading help. Please try typing "help" directly.'
        }, token);
      }
    } else {
      await sendMessage(senderId, {
        text: 'Help command is not available. Please check available commands by typing messages.'
      }, token);
    }
  }

  async handlePostback(event, token) {
    const senderId = event?.sender?.id;
    const payload = event?.postback?.payload;
    if (!senderId || !payload) {
      console.error('❌ Invalid postback event:', { senderId, payload });
      return;
    }
    console.log(`📬 Postback from ${senderId}: ${payload}`);
    try {
      switch (true) {
        case payload.startsWith('CMD_'):
          const commandName = payload.slice(4).toLowerCase();
          if (commandName === 'help') {
            await this.showCommandHelp(senderId, token);
          } else {
            await this.executeCommandFromPostback(senderId, commandName, token);
          }
          break;
        default:
          await sendMessage(senderId, {
            text: `Unknown payload: ${payload}`,
            quick_replies: [{ title: 'Help', payload: 'CMD_HELP' }]
          }, token);
      }
    } catch (error) {
      console.error('❌ Postback handler error:', error.message);
      await sendMessage(senderId, {
        text: '❌ Something went wrong. Please try again.',
        quick_replies: [{ title: 'Help', payload: 'CMD_HELP' }]
      }, token);
    }
  }
}

const postbackHandler = new PostbackHandler();
const handlePostback = (event, token) => postbackHandler.handlePostback(event, token);

module.exports = { handlePostback };
