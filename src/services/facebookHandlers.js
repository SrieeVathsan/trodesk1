/**
 * Facebook Post Handlers
 * Combines validation, service calls, and error handling
 */

import {
  createFacebookPost,
  updateFacebookPost,
  deleteFacebookPost,
} from './facebookService';

import {
  validatePostContent,
  validateCredentials,
  validateFileUpload,
} from '../utils/validation';

import { getFacebookCredentials } from '../utils/storage';

/**
 * Handler for creating Facebook post
 * @param {Object} postData - Post data {message, photo, video}
 * @param {Function} showToast - Toast notification function
 * @returns {Promise<Object>} - Result {success, data, error}
 */
export const handleCreateFacebookPost = async (postData, showToast) => {
  try {
    const { message, photo, video } = postData;
    
    // Get credentials
    const credentials = getFacebookCredentials();
    const { accessToken, pageId } = credentials;
    
    // Validate credentials
    const credValidation = validateCredentials({
      accessToken,
      userId: pageId,
      platform: 'Facebook'
    });
    
    if (!credValidation.isValid) {
      showToast(credValidation.message, 'error');
      return { success: false, error: credValidation.message };
    }
    
    // Validate content
    if (!message && !photo && !video) {
      const errorMsg = 'Post must contain at least a message, photo, or video';
      showToast(errorMsg, 'error');
      return { success: false, error: errorMsg };
    }
    
    // Validate photo if present
    if (photo) {
      const fileValidation = validateFileUpload(photo);
      if (!fileValidation.isValid) {
        showToast(fileValidation.message, 'error');
        return { success: false, error: fileValidation.message };
      }
    }
    
    // Create post
    const result = await createFacebookPost(
      pageId,
      message,
      accessToken,
      photo,
      video
    );
    
    showToast('Facebook post created successfully!', 'success');
    return { success: true, data: result };
    
  } catch (err) {
    console.error('❌ Create Facebook post error:', err);
    const errorMsg = err?.response?.data?.detail || err.message || 'Failed to create post';
    showToast(`Failed to create Facebook post: ${errorMsg}`, 'error');
    return { success: false, error: errorMsg };
  }
};

/**
 * Handler for updating Facebook post
 * @param {string} postId - Post ID
 * @param {string} newMessage - Updated message
 * @param {Function} showToast - Toast notification function
 * @returns {Promise<Object>} - Result {success, data, error}
 */
export const handleUpdateFacebookPost = async (postId, newMessage, showToast) => {
  try {
    // Get credentials
    const { accessToken } = getFacebookCredentials();
    
    // Validate credentials
    const credValidation = validateCredentials({
      accessToken,
      platform: 'Facebook'
    });
    
    if (!credValidation.isValid) {
      showToast(credValidation.message, 'error');
      return { success: false, error: credValidation.message };
    }
    
    // Validate content
    const contentValidation = validatePostContent(newMessage, {
      required: true,
      allowEmpty: false
    });
    
    if (!contentValidation.isValid) {
      showToast(contentValidation.message, 'error');
      return { success: false, error: contentValidation.message };
    }
    
    // Update post
    const result = await updateFacebookPost(postId, newMessage, accessToken);
    
    showToast('Post updated successfully!', 'success');
    return { success: true, data: result };
    
  } catch (err) {
    console.error('❌ Update Facebook post error:', err);
    const errorMsg = err?.response?.data?.detail || err.message || 'Failed to update post';
    showToast(`Failed to update post: ${errorMsg}`, 'error');
    return { success: false, error: errorMsg };
  }
};

/**
 * Handler for deleting Facebook post
 * @param {string} postId - Post ID
 * @param {Function} showToast - Toast notification function
 * @param {Function} confirmFn - Confirmation function (returns boolean)
 * @returns {Promise<Object>} - Result {success, data, error}
 */
export const handleDeleteFacebookPost = async (postId, showToast, confirmFn) => {
  try {
    // Confirm deletion
    const confirmed = await confirmFn('Are you sure you want to delete this post?');
    if (!confirmed) {
      return { success: false, error: 'Deletion cancelled' };
    }
    
    // Get credentials
    const { accessToken } = getFacebookCredentials();
    
    // Validate credentials
    const credValidation = validateCredentials({
      accessToken,
      platform: 'Facebook'
    });
    
    if (!credValidation.isValid) {
      showToast(credValidation.message, 'error');
      return { success: false, error: credValidation.message };
    }
    
    // Delete post
    const result = await deleteFacebookPost(postId, accessToken);
    
    showToast('Post deleted successfully!', 'success');
    return { success: true, data: result };
    
  } catch (err) {
    console.error('❌ Delete Facebook post error:', err);
    
    const errorDetail = err?.response?.data?.detail || '';
    const errorStatus = err?.response?.status;
    
    // Handle special case: 500 error with JSON parsing issue (might still be successful)
    if (errorStatus === 500 && (
        errorDetail === '' || 
        errorDetail.includes('json') ||
        errorDetail.includes('JSON') ||
        errorDetail.includes('Expecting value')
    )) {
      showToast('Post deleted (checking...)', 'warning');
      return { success: true, data: {}, warning: 'unclear_response' };
    }
    
    const errorMsg = errorDetail || err.message || 'Failed to delete post';
    showToast(`Failed to delete post: ${errorMsg}`, 'error');
    return { success: false, error: errorMsg };
  }
};
