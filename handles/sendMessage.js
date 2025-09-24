const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const API_URL = 'https://graph.facebook.com/v23.0/me/messages';
const UPLOAD_URL = 'https://graph.facebook.com/v23.0/me/message_attachments';

const apiRequest = async (url, options, pageAccessToken) => {
  const response = await fetch(`${url}?access_token=${pageAccessToken}`, options);
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }
  
  return response.json();
};

// Set typing indicator
const setTyping = (senderId, action, pageAccessToken) => 
  apiRequest(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: senderId },
      sender_action: action
    })
  }, pageAccessToken);

// Upload file attachment
const uploadAttachment = async (filePath, type, pageAccessToken) => {
  const formData = new FormData();
  formData.append('message', JSON.stringify({
    attachment: { type, payload: { is_reusable: true } }
  }));
  formData.append('filedata', fs.createReadStream(filePath));
  
  const response = await fetch(`${UPLOAD_URL}?access_token=${pageAccessToken}`, {
    method: 'POST',
    body: formData,
    headers: formData.getHeaders()
  });
  
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }
  
  const result = await response.json();
  return result.attachment_id;
};

const sendMessage = async (senderId, message, pageAccessToken) => {
  const { text = '', attachment = null, quick_replies = [], buttons = [] } = message;
  
  if (!text && !attachment) return;
  
  try {
    await setTyping(senderId, 'typing_on', pageAccessToken);
    
    let messagePayload = { recipient: { id: senderId }, message: {} };
    
    // Button template
    if (buttons.length) {
      messagePayload.message.attachment = {
        type: 'template',
        payload: {
          template_type: 'button',
          text: text || 'Choose an option:',
          buttons: buttons.map(btn => ({
            type: 'postback',
            title: btn.title,
            payload: btn.payload
          }))
        }
      };
    }
    // Text with quick replies
    else if (text) {
      messagePayload.message.text = text;
      
      if (quick_replies.length) {
        messagePayload.message.quick_replies = quick_replies.map(qr => ({
          content_type: 'text',
          title: qr.title,
          payload: qr.payload
        }));
      }
    }
    
    // Handle attachments
    if (attachment) {
      // Direct file upload
      if (attachment.filePath) {
        const formData = new FormData();
        formData.append('recipient', JSON.stringify({ id: senderId }));
        formData.append('message', JSON.stringify({
          attachment: { type: attachment.type, payload: {} }
        }));
        formData.append('filedata', fs.createReadStream(attachment.filePath));
        
        const response = await fetch(`${API_URL}?access_token=${pageAccessToken}`, {
          method: 'POST',
          body: formData,
          headers: formData.getHeaders()
        });
        
        if (!response.ok) {
          throw new Error(`File upload failed: ${response.status}`);
        }
        
        await setTyping(senderId, 'typing_off', pageAccessToken);
        return;
      }
      
      // Template or URL attachment
      if (attachment.type === 'template') {
        messagePayload.message.attachment = {
          type: 'template',
          payload: attachment.payload
        };
      } else {
        messagePayload.message.attachment = {
          type: attachment.type,
          payload: attachment.payload || {}
        };
      }
    }
    
    await apiRequest(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messagePayload)
    }, pageAccessToken);
    
    await setTyping(senderId, 'typing_off', pageAccessToken);
    
  } catch (error) {
    console.error('Send message error:', error.message);
    throw error;
  }
};

module.exports = { sendMessage };