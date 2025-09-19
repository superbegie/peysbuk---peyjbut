const { readdirSync } = require('fs');
const { join } = require('path');
const { sendMessage } = require('./sendMessage');

class MessageHandler {
  constructor() {
    this.commands = new Map();
    this.imageCache = new Map();
    this.prefix = '-';
    this.loadCommands();
  }

  // Efficient command loading with error handling
  loadCommands() {
    const commandsPath = join(__dirname, '../commands');

    try {
      const files = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

      for (const file of files) {
        try {
          // Clear require cache for hot reloading
          delete require.cache[require.resolve(`../commands/${file}`)];
          const command = require(`../commands/${file}`);

          // Handle both string and array command names
          const names = Array.isArray(command.name) ? command.name : [command.name];

          for (const name of names) {
            if (typeof name === 'string' && name.length > 0) {
              this.commands.set(name.toLowerCase(), command);
            }
          }

        } catch (error) {
          console.warn(`⚠️ Failed to load command ${file}:`, error.message);
        }
      }

      console.log(`📦 Loaded ${this.commands.size} command(s)`);

    } catch (error) {
      console.error('❌ Error loading commands directory:', error.message);
    }
  }

  // Enhanced image caching with TTL
  cacheImage(senderId, url) {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    this.imageCache.set(senderId, {
      url,
      timestamp: Date.now(),
      expires: Date.now() + maxAge
    });

    // Clean expired entries periodically
    if (this.imageCache.size % 50 === 0) {
      this.cleanExpiredCache();
    }
  }

  cleanExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.imageCache) {
      if (value.expires < now) {
        this.imageCache.delete(key);
      }
    }
  }

  // Parse command and arguments
  parseMessage(messageText) {
    if (!messageText?.trim()) return null;

    const isCommand = messageText.startsWith(this.prefix);
    const cleanText = isCommand ? messageText.slice(this.prefix.length) : messageText;
    const parts = cleanText.trim().split(/\s+/);
    const [commandName, ...args] = parts;

    return {
      commandName: commandName.toLowerCase(),
      args: args.filter(Boolean),
      isExplicitCommand: isCommand,
      originalText: messageText
    };
  }

  // Process attachments efficiently
  processAttachments(event) {
    const attachments = event?.message?.attachments || [];

    for (const attachment of attachments) {
      if (attachment.type === 'image' && attachment.payload?.url) {
        this.cacheImage(event.sender.id, attachment.payload.url);
        console.log(`📸 Cached image for ${event.sender.id}`);
      }
    }
  }

  // Execute command with proper error handling
  async executeCommand(command, senderId, args, token, event) {
    try {
      const context = {
        senderId,
        args,
        token,
        event,
        sendMessage,
        imageCache: this.imageCache
      };

      await command.execute(senderId, args, token, event, sendMessage, this.imageCache);

    } catch (error) {
      console.error(`❌ Command execution error:`, {
        command: command.name,
        user: senderId,
        error: error.message
      });

      const errorMsg = error.message?.length < 100 
        ? error.message 
        : '❌ An error occurred while processing your request.';

      await sendMessage(senderId, { text: errorMsg }, token);
    }
  }

  // Main message handling logic
  async handleMessage(event, token) {
    // Validate event structure
    const senderId = event?.sender?.id;
    if (!senderId) {
      console.error('❌ Invalid event: missing sender ID');
      return;
    }

    // Process attachments first
    this.processAttachments(event);

    // Parse message
    const messageData = this.parseMessage(event?.message?.text);
    if (!messageData) {
      console.log(`📝 No text message from ${senderId}`);
      return;
    }

    const { commandName, args, isExplicitCommand, originalText } = messageData;

    try {
      // Find and execute command
      const command = this.commands.get(commandName);

      if (command) {
        console.log(`⚡ Executing: ${commandName} | Args: ${args.length} | User: ${senderId}`);
        await this.executeCommand(command, senderId, args, token, event);

      } else if (isExplicitCommand) {
        // Explicit command not found
        await sendMessage(senderId, { 
          text: `❌ Unknown command: "${commandName}"\nType "help" for available commands.` 
        }, token);

      } else {
        // Try AI fallback for non-command messages
        const aiCommand = this.commands.get('ai');

        if (aiCommand) {
          console.log(`🤖 AI fallback for: ${originalText.slice(0, 50)}...`);
          await this.executeCommand(aiCommand, senderId, [originalText], token, event);
        } else {
          await sendMessage(senderId, { 
            text: 'I didn\'t understand that. Try using a command or check "help" for options.' 
          }, token);
        }
      }

    } catch (error) {
      console.error(`❌ Handler error:`, error.message);
      await sendMessage(senderId, { 
        text: '❌ Something went wrong. Please try again later.' 
      }, token);
    }
  }
}

// Create singleton instance
const messageHandler = new MessageHandler();

// Export the handler function
const handleMessage = (event, token) => messageHandler.handleMessage(event, token);

module.exports = { handleMessage };
