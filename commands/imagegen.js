const axios = require('axios');
const fs = require('fs').promises;
const { createReadStream, unlinkSync } = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: 'imagegen',
  description: 'Generate images via prompt using Flux.',
  usage: '-imagegen [prompt]',
  author: 'coffee',

  execute: async (senderId, args, pageAccessToken) => {
    if (!args.length) {
      return sendMessage(senderId, { text: 'Please provide a prompt.' }, pageAccessToken);
    }

    const prompt = encodeURIComponent(args.join(' ').trim() + ', high definition.');
    const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?model=flux&width=1024&height=1024&nologo=true`;
    const tempFile = path.join(__dirname, `tmp_${Date.now()}.jpg`);

    // Send loading message
    await sendMessage(senderId, {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: [{
            title: '🎨🖌️ Generating your image...',
            subtitle: 'Please wait a moment.'
          }]
        }
      }
    }, pageAccessToken);

    try {
      // Download image
      const { data } = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      await fs.writeFile(tempFile, Buffer.from(data));

      // Upload to Facebook
      const form = new FormData();
      form.append('message', JSON.stringify({
        attachment: { type: 'image', payload: { is_reusable: true } }
      }));
      form.append('filedata', createReadStream(tempFile));

      const { data: uploadData } = await axios.post(
        `https://graph.facebook.com/v23.0/me/message_attachments?access_token=${pageAccessToken}`,
        form,
        { headers: form.getHeaders() }
      );

      // Send image to user
      await axios.post(
        `https://graph.facebook.com/v23.0/me/messages?access_token=${pageAccessToken}`,
        {
          recipient: { id: senderId },
          message: {
            attachment: {
              type: 'image',
              payload: { attachment_id: uploadData.attachment_id }
            }
          }
        }
      );

      // Cleanup
      unlinkSync(tempFile);

    } catch (error) {
      console.error('ImageGen Error:', error.message);

      // Cleanup on error
      try { unlinkSync(tempFile); } catch {}

      return sendMessage(senderId, { 
        text: '❎ | Failed to generate image. Please try again.' 
      }, pageAccessToken);
    }
  }
};
