const fs = require('fs');
const path = require('path');
const { sendMessage } = require('../handles/sendMessage');

const commandCategories = {
  "📖 | 𝙴𝚍𝚞𝚌𝚊𝚝𝚒𝚘𝚗": ['ai'],
  "🖼 | 𝙸𝚖𝚊𝚐𝚎": ['imagegen', 'pinterest'],
  "🎧 | 𝙼𝚞𝚜𝚒𝚌": ['lyrics'],
  "👥 | 𝙾𝚝𝚑𝚎𝚛𝚜": ['help']
};

module.exports = {
  name: 'help',
  description: 'Show available commands',
  usage: 'help\nhelp [command name]',
  author: 'Coffee',

  execute(senderId, args, pageAccessToken) {
    const commandsDir = path.join(__dirname, '../commands');
    const commandFiles = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));

    const loadCommand = file => {
      try {
        return require(path.join(commandsDir, file));
      } catch {
        return null;
      }
    };

    // If user asked for specific command
    if (args.length) {
      const name = args[0].toLowerCase();
      const command = commandFiles.map(loadCommand).find(c => c?.name.toLowerCase() === name);

      return sendMessage(
        senderId,
        {
          text: command
            ? `━━━━━━━━━━━━━━
𝙲𝚘𝚖𝚖𝚊𝚗𝚍 𝙽𝚊𝚖𝚎: ${command.name}
𝙳𝚎𝚜𝚌𝚛𝚒𝚙𝚝𝚒𝚘𝚗: ${command.description}
𝚄𝚜𝚊𝚐𝚎: ${command.usage}
━━━━━━━━━━━━━━`
            : `Command "${name}" not found.`
        },
        pageAccessToken
      );
    }

    // Grouped help message by categories
    const categorizedMessage = Object.entries(commandCategories)
      .map(([category, commands]) => {
        const listed = commands
          .filter(cmd => commandFiles.includes(`${cmd}.js`))
          .map(cmd => `│ - ${cmd}`)
          .join('\n');
        return `╭─╼━━━━━━━━╾─╮\n│ ${category}\n${listed}\n╰─━━━━━━━━━╾─╯`;
      })
      .join('\n');

    sendMessage(
      senderId,
      {
        text: `━━━━━━━━━━━━━━
𝙰𝚟𝚊𝚒𝚕𝚊𝚋𝚕𝚎 𝙲𝚘𝚖𝚖𝚊𝚗𝚍𝚜:
${categorizedMessage}
Chat -help [name]   
to see command details.
━━━━━━━━━━━━━━`
      },
      pageAccessToken
    );
  }
};
