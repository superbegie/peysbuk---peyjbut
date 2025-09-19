const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: 'pinterest',
  description: 'Search for images from Pinterest',
  usage: 'pinterest <search term> [number]',
  author: 'kape',

  async execute(senderId, args, token) {
    if (args.length === 0) {
      return sendMessage(senderId, { text: 'Please provide a search term!' }, token);
    }

    let searchTerm = '';
    let imageCount = 5;

    const lastArg = args[args.length - 1];
    if (!isNaN(lastArg) && lastArg > 0) {
      imageCount = parseInt(lastArg);
      searchTerm = args.slice(0, -1).join(' ');
    } else {
      searchTerm = args.join(' ');
    }

    if (imageCount > 15) imageCount = 15;
    if (imageCount < 1) imageCount = 1;

    try {
      const response = await axios.get('https://hiroshi-api.onrender.com/image/pinterest', {
        params: { search: searchTerm }
      });

      const imageList = response.data?.data || [];

      if (imageList.length === 0) {
        return sendMessage(senderId, { text: 'Sorry, no images found for that search!' }, token);
      }

      const uniqueImages = [...new Set(imageList)];
      const shuffledImages = uniqueImages.sort(() => Math.random() - 0.5);
      const selectedImages = shuffledImages.slice(0, imageCount);

      for (let i = 0; i < selectedImages.length; i++) {
        const imageUrl = selectedImages[i];
        if (imageUrl) {
          await sendMessage(senderId, {
            attachment: {
              type: 'image',
              payload: { url: imageUrl }
            }
          }, token);
        }
      }

    } catch (error) {
      console.log('Pinterest API error:', error.message);
      sendMessage(senderId, { text: 'Oops! Something went wrong while getting images.' }, token);
    }
  }
};
