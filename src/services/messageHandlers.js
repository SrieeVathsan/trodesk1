/**
 * Direct Message (DM) Handlers
 * Business logic for sending and managing direct messages
 */

import {
  replyToFacebookMention,
  sendFacebookMessage,
} from './facebookService';

import {
  replyToInstagramMention,
} from './instagramService';

import {
  validateCredentials,
  validatePostContent,
} from '../utils/validation';

import {
  getFacebookCredentials,
  getInstagramCredentials,
} from '../utils/storage';

/**
 * Handler for replying to Facebook mention/post
 * @param {string} postId - Post ID
 * @param {string} message - Reply message
 * @param {Function} showToast - Toast notification function
 * @returns {Promise<Object>} - Result {success, data, error}
 */
export const handleReplyToFacebookMention = async (postId, message, showToast) => {
  try {
    const { accessToken } = getFacebookCredentials();
    
    const credValidation = validateCredentials({
      accessToken,
      platform: 'Facebook'
    });
    
    if (!credValidation.isValid) {
      showToast(credValidation.message, 'error');
      return { success: false, error: credValidation.message };
    }
    
    const contentValidation = validatePostContent(message, {
      required: true,
      allowEmpty: false,
      maxLength: 2000
    });
    
    if (!contentValidation.isValid) {
      showToast(contentValidation.message, 'error');
      return { success: false, error: contentValidation.message };
    }
    
    const result = await replyToFacebookMention(postId, message, accessToken);
    showToast('Reply sent successfully!', 'success');
    return { success: true, data: result };
    
  } catch (err) {
    console.error('❌ Reply to Facebook mention error:', err);
    const errorMsg = err?.response?.data?.detail || err.message;
    showToast(`Failed to send reply: ${errorMsg}`, 'error');
    return { success: false, error: errorMsg };
  }
};

/**
 * Handler for sending Facebook direct message
 * @param {string} recipientId - Recipient user ID
 * @param {string} message - Message text
 * @param {Function} showToast - Toast notification function
 * @returns {Promise<Object>} - Result {success, data, error}
 */
export const handleSendFacebookDM = async (recipientId, message, showToast) => {
  try {
    const { accessToken, pageId } = getFacebookCredentials();
    
    const credValidation = validateCredentials({
      accessToken,
      userId: pageId,
      platform: 'Facebook'
    });
    
    if (!credValidation.isValid) {
      showToast(credValidation.message, 'error');
      return { success: false, error: credValidation.message };
    }
    
    const contentValidation = validatePostContent(message, {
      required: true,
      allowEmpty: false,
      maxLength: 2000
    });
    
    if (!contentValidation.isValid) {
      showToast(contentValidation.message, 'error');
      return { success: false, error: contentValidation.message };
    }
    
    const result = await sendFacebookMessage(pageId, recipientId, message, accessToken);
    showToast('Message sent successfully!', 'success');
    return { success: true, data: result };
    
  } catch (err) {
    console.error('❌ Send Facebook DM error:', err);
    const errorMsg = err?.response?.data?.detail || err.message;
    showToast(`Failed to send message: ${errorMsg}`, 'error');
    return { success: false, error: errorMsg };
  }
};

/**
 * Handler for replying to Instagram mention
 * @param {string} mediaId - Media ID
 * @param {string} commentText - Comment/reply text
 * @param {Function} showToast - Toast notification function
 * @returns {Promise<Object>} - Result {success, data, error}
 */
export const handleReplyToInstagramMention = async (mediaId, commentText, showToast) => {
  try {
    const { accessToken, igUserId } = getInstagramCredentials();
    
    const credValidation = validateCredentials({
      accessToken,
      userId: igUserId,
      platform: 'Instagram'
    });
    
    if (!credValidation.isValid) {
      showToast(credValidation.message, 'error');
      return { success: false, error: credValidation.message };
    }
    
    const contentValidation = validatePostContent(commentText, {
      required: true,
      allowEmpty: false,
      maxLength: 2200
    });
    
    if (!contentValidation.isValid) {
      showToast(contentValidation.message, 'error');
      return { success: false, error: contentValidation.message };
    }
    
    const result = await replyToInstagramMention(
      mediaId,
      commentText,
      accessToken,
      igUserId
    );
    
    showToast('Reply sent successfully!', 'success');
    return { success: true, data: result };
    
  } catch (err) {
    console.error('❌ Reply to Instagram mention error:', err);
    const errorMsg = err?.response?.data?.detail || err.message;
    showToast(`Failed to send reply: ${errorMsg}`, 'error');
    return { success: false, error: errorMsg };
  }
};

/**
 * Handler for sending Instagram direct message
 * @param {string} recipientId - Instagram user ID
 * @param {string} message - Message text
 * @param {Function} showToast - Toast notification function
 * @returns {Promise<Object>} - Result {success, data, error}
 */
export const handleSendInstagramDM = async (recipientId, message, showToast) => {
  try {
    const { accessToken, igUserId } = getInstagramCredentials();
    
    const credValidation = validateCredentials({
      accessToken,
      userId: igUserId,
      platform: 'Instagram'
    });
    
    if (!credValidation.isValid) {
      showToast(credValidation.message, 'error');
      return { success: false, error: credValidation.message };
    }
    
    const contentValidation = validatePostContent(message, {
      required: true,
      allowEmpty: false,
      maxLength: 1000
    });
    
    if (!contentValidation.isValid) {
      showToast(contentValidation.message, 'error');
      return { success: false, error: contentValidation.message };
    }
    
    // Note: Instagram DM API implementation depends on your backend
    // This is a placeholder - adjust based on your actual API
    showToast('Instagram DM functionality needs backend implementation', 'warning');
    return { success: false, error: 'Not implemented' };
    
  } catch (err) {
    console.error('❌ Send Instagram DM error:', err);
    const errorMsg = err?.response?.data?.detail || err.message;
    showToast(`Failed to send message: ${errorMsg}`, 'error');
    return { success: false, error: errorMsg };
  }
};
