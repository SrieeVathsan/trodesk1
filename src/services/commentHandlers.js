/**
 * Comment and Reply Handlers
 * Business logic for commenting and replying on posts
 */

import {
  fetchFacebookComments,
  replyToFacebookComment,
} from './facebookService';

import {
  fetchInstagramComments as getInstagramComments,
  replyToInstagramComment,
  deleteInstagramComment,
  hideInstagramComment,
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
 * Handler for fetching Facebook post comments
 * @param {string} postId - Post ID
 * @param {Function} showToast - Toast notification function
 * @returns {Promise<Object>} - Result {success, data, error}
 */
export const handleFetchFacebookComments = async (postId, showToast) => {
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
    
    const comments = await fetchFacebookComments(postId, accessToken);
    return { success: true, data: comments };
    
  } catch (err) {
    console.error('❌ Fetch comments error:', err);
    const errorMsg = err?.response?.data?.detail || err.message;
    showToast(`Failed to fetch comments: ${errorMsg}`, 'error');
    return { success: false, error: errorMsg };
  }
};

/**
 * Handler for replying to Facebook comment
 * @param {string} commentId - Comment ID
 * @param {string} postId - Post ID
 * @param {string} replyText - Reply text
 * @param {Function} showToast - Toast notification function
 * @returns {Promise<Object>} - Result {success, data, error}
 */
export const handleReplyToFacebookComment = async (commentId, postId, replyText, showToast) => {
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
    
    const contentValidation = validatePostContent(replyText, {
      required: true,
      allowEmpty: false,
      maxLength: 1000
    });
    
    if (!contentValidation.isValid) {
      showToast(contentValidation.message, 'error');
      return { success: false, error: contentValidation.message };
    }
    
    const result = await replyToFacebookComment(commentId, replyText, accessToken);
    showToast('Reply posted successfully!', 'success');
    return { success: true, data: result };
    
  } catch (err) {
    console.error('❌ Reply to comment error:', err);
    const errorMsg = err?.response?.data?.detail || err.message;
    showToast(`Failed to post reply: ${errorMsg}`, 'error');
    return { success: false, error: errorMsg };
  }
};

/**
 * Handler for fetching Instagram comments
 * @param {string} mediaId - Media/Post ID
 * @param {Function} showToast - Toast notification function
 * @returns {Promise<Object>} - Result {success, data, error}
 */
export const handleFetchInstagramComments = async (mediaId, showToast) => {
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
    
    const comments = await getInstagramComments(mediaId, accessToken);
    return { success: true, data: comments };
    
  } catch (err) {
    console.error('❌ Fetch Instagram comments error:', err);
    const errorMsg = err?.response?.data?.detail || err.message;
    showToast(`Failed to fetch comments: ${errorMsg}`, 'error');
    return { success: false, error: errorMsg };
  }
};

/**
 * Handler for replying to Instagram comment
 * @param {string} commentId - Comment ID
 * @param {string} mediaId - Media ID
 * @param {string} replyText - Reply text
 * @param {Function} showToast - Toast notification function
 * @returns {Promise<Object>} - Result {success, data, error}
 */
export const handleReplyToInstagramComment = async (commentId, mediaId, replyText, showToast) => {
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
    
    const contentValidation = validatePostContent(replyText, {
      required: true,
      allowEmpty: false,
      maxLength: 1000
    });
    
    if (!contentValidation.isValid) {
      showToast(contentValidation.message, 'error');
      return { success: false, error: contentValidation.message };
    }
    
    const result = await replyToInstagramComment(
      commentId,
      replyText,
      accessToken
    );
    
    showToast('Reply sent successfully!', 'success');
    return { success: true, data: result };
    
  } catch (err) {
    console.error('❌ Reply to Instagram comment error:', err);
    const errorMsg = err?.response?.data?.detail || err.message;
    showToast(`Failed to post reply: ${errorMsg}`, 'error');
    return { success: false, error: errorMsg };
  }
};

/**
 * Handler for deleting Instagram comment
 * @param {string} commentId - Comment ID
 * @param {Function} showToast - Toast notification function
 * @param {Function} confirmFn - Confirmation function
 * @returns {Promise<Object>} - Result {success, data, error}
 */
export const handleDeleteInstagramComment = async (commentId, showToast, confirmFn) => {
  try {
    const confirmed = await confirmFn('Are you sure you want to delete this comment?');
    if (!confirmed) {
      return { success: false, error: 'Deletion cancelled' };
    }
    
    const { accessToken } = getInstagramCredentials();
    
    const credValidation = validateCredentials({
      accessToken,
      platform: 'Instagram'
    });
    
    if (!credValidation.isValid) {
      showToast(credValidation.message, 'error');
      return { success: false, error: credValidation.message };
    }
    
    const result = await deleteInstagramComment(commentId, accessToken);
    showToast('Comment deleted successfully!', 'success');
    return { success: true, data: result };
    
  } catch (err) {
    console.error('❌ Delete Instagram comment error:', err);
    const errorMsg = err?.response?.data?.detail || err.message;
    showToast(`Failed to delete comment: ${errorMsg}`, 'error');
    return { success: false, error: errorMsg };
  }
};

/**
 * Handler for hiding/unhiding Instagram comment
 * @param {string} commentId - Comment ID
 * @param {boolean} hide - True to hide, false to unhide
 * @param {Function} showToast - Toast notification function
 * @returns {Promise<Object>} - Result {success, data, error}
 */
export const handleHideInstagramComment = async (commentId, hide, showToast) => {
  try {
    const { accessToken } = getInstagramCredentials();
    
    const credValidation = validateCredentials({
      accessToken,
      platform: 'Instagram'
    });
    
    if (!credValidation.isValid) {
      showToast(credValidation.message, 'error');
      return { success: false, error: credValidation.message };
    }
    
    const result = await hideInstagramComment(commentId, hide, accessToken);
    showToast(`Comment ${hide ? 'hidden' : 'unhidden'} successfully!`, 'success');
    return { success: true, data: result };
    
  } catch (err) {
    console.error(`❌ ${hide ? 'Hide' : 'Unhide'} Instagram comment error:`, err);
    const errorMsg = err?.response?.data?.detail || err.message;
    showToast(`Failed to ${hide ? 'hide' : 'unhide'} comment: ${errorMsg}`, 'error');
    return { success: false, error: errorMsg };
  }
};
