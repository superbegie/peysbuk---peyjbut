const https = require('https');
const { createReadStream, statSync } = require('fs');
const { basename } = require('path');

// Reusable HTTPS agent with modern settings
const httpsAgent = new https.Agent({
  family: 4,
  keepAlive: true,
  maxSockets: 50,
  timeout: 30000
});

// Modern fetch-like wrapper for HTTP requests
const sendRequest = async ({ method = 'POST', endpoint, data, token, isFormData = false }) => {
  const url = `https://graph.facebook.com/v23.0${endpoint}${endpoint.includes('?') ? '&' : '?'}access_token=${token}`;

  const options = {
    method,
    headers: isFormData ? {} : { 'Content-Type': 'application/json' },
    agent: httpsAgent,
    timeout: 30000
  };

  return new Promise((resolve, reject) => {
    const request = https.request(url, options, response => {
      let responseData = '';

      response.on('data', chunk => responseData += chunk);
      response.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          response.statusCode >= 400 ? reject(new Error(parsed.error?.message || responseData)) : resolve(parsed);
        } catch (err) {
          reject(new Error(`Invalid JSON: ${responseData}`));
        }
      });
    });

    request.on('error', reject);
    request.on('timeout', () => reject(new Error('Request timeout')));

    if (data && !isFormData) {
      request.write(typeof data === 'string' ? data : JSON.stringify(data));
    }

    if (isFormData && data) {
      data.pipe(request);
    } else {
      request.end();
    }
  });
};

// File upload with multipart/form-data
const uploadFile = async (senderId, filePath, type, token) => {
  const FormData = require('form-data');
  const form = new FormData();

  try {
    const stats = statSync(filePath);
    if (stats.size > 25 * 1024 * 1024) throw new Error('File too large (max 25MB)');

    form.append('recipient', JSON.stringify({ id: senderId }));
    form.append('message', JSON.stringify({
      attachment: { type, payload: { is_reusable: true } }
    }));
    form.append('filedata', createReadStream(filePath), basename(filePath));

    const response = await sendRequest({
      endpoint: '/me/messages',
      data: form,
      token,
      isFormData: true
    });

    return response;
  } catch (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }
};

// Typing indicator control
const setTyping = (senderId, action, token) => 
  sendRequest({
    endpoint: '/me/messages',
    data: { recipient: { id: senderId }, sender_action: action },
    token
  }).catch(() => {}); // Ignore typing errors

// Main message sending function
const sendMessage = async (senderId, messageData, token) => {
  if (!senderId || !token) throw new Error('Missing senderId or token');

  const { text, attachment, quick_replies = [], buttons = [] } = messageData;

  if (!text && !attachment) return;

  try {
    // Start typing indicator
    await setTyping(senderId, 'typing_on', token);

    // Handle file uploads
    if (attachment?.filePath) {
      const result = await uploadFile(senderId, attachment.filePath, attachment.type || 'file', token);
      await setTyping(senderId, 'typing_off', token);
      return result;
    }

    // Build message payload
    const message = {};

    // Button template
    if (buttons.length > 0) {
      message.attachment = {
        type: 'template',
        payload: {
          template_type: 'button',
          text: text || 'Choose an option:',
          buttons: buttons.slice(0, 3).map(btn => ({
            type: btn.type || 'postback',
            title: btn.title,
            payload: btn.payload,
            ...(btn.url && { url: btn.url })
          }))
        }
      };
    } else {
      // Text message with optional quick replies
      if (text) {
        message.text = text.length > 2000 ? text.slice(0, 2000) + '...' : text;

        if (quick_replies.length > 0) {
          message.quick_replies = quick_replies.slice(0, 13).map(q => ({
            content_type: 'text',
            title: q.title.slice(0, 20),
            payload: q.payload
          }));
        }
      }

      // Attachment handling
      if (attachment) {
        if (attachment.type === 'template') {
          message.attachment = {
            type: 'template',
            payload: attachment.payload
          };
        } else {
          message.attachment = {
            type: attachment.type,
            payload: attachment.payload || {}
          };
        }
      }
    }

    // Send message
    const response = await sendRequest({
      endpoint: '/me/messages',
      data: { recipient: { id: senderId }, message },
      token
    });

    // Stop typing
    await setTyping(senderId, 'typing_off', token);

    console.log(`✅ Message sent to ${senderId}`);
    return response;

  } catch (error) {
    await setTyping(senderId, 'typing_off', token);
    console.error(`❌ Send error:`, error.message);
    throw error;
  }
};

module.exports = { sendMessage, sendRequest, uploadFile };
