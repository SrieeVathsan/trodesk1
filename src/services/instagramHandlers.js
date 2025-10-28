/**
 * Instagram Post Handlers
 * Combines validation, service calls, and error handling
 */

import { createInstagramPost } from './instagramService';

import {
  validateImageUrl,
  validateCredentials,
  parseUsernames,
} from '../utils/validation';

import { getInstagramCredentials } from '../utils/storage';

/**
 * Handler for creating Instagram post
 * @param {Object} postData - Post data {imageUrl, caption, usernames}
 * @param {Function} showToast - Toast notification function
 * @returns {Promise<Object>} - Result {success, data, error}
 */
export const handleCreateInstagramPost = async (postData, showToast) => {
  try {
    const { imageUrl, caption, usernames } = postData;
    
    // Get credentials
    const credentials = getInstagramCredentials();
    const { accessToken, igUserId } = credentials;
    
    // Validate credentials
    const credValidation = validateCredentials({
      accessToken,
      userId: igUserId,
      platform: 'Instagram'
    });
    
    if (!credValidation.isValid) {
      showToast(credValidation.message, 'error');
      return { success: false, error: credValidation.message };
    }
    
    // Validate image URL
    const urlValidation = validateImageUrl(imageUrl);
    if (!urlValidation.isValid) {
      showToast(urlValidation.message, 'error');
      return { success: false, error: urlValidation.message };
    }
    
    // Parse usernames
    const usernameArray = parseUsernames(usernames);
    
    console.log('🚀 Creating Instagram post:', {
      imageUrl,
      caption,
      usernames: usernameArray
    });
    
    // Create post
    const result = await createInstagramPost(
      igUserId,
      imageUrl,
      caption || null,
      accessToken,
      usernameArray
    );
    
    console.log('✅ Instagram post response:', result);
    
    if (result.id || result.success) {
      showToast('Instagram post created successfully!', 'success');
      return { success: true, data: result };
    } else {
      showToast('Instagram post creation response unclear. Check console.', 'error');
      return { success: false, error: 'Unclear response' };
    }
    
  } catch (err) {
    console.error('❌ Create Instagram post error:', err);
    console.error('📥 Backend error response:', err?.response?.data);
    const errorMsg = err?.response?.data?.detail || err.message || 'Failed to create post';
    showToast(`Failed to create Instagram post: ${errorMsg}`, 'error');
    return { success: false, error: errorMsg };
  }
};
