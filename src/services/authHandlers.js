/**
 * Authentication Handlers
 * Business logic for Facebook and Instagram login/logout
 */

import {
  validateCredentials,
} from '../utils/validation';

import {
  saveCredentials,
  clearCredentials,
} from '../utils/storage';

/**
 * Handler for Facebook login
 * @param {string} accessToken - Facebook access token
 * @param {string} pageId - Facebook page ID
 * @param {Function} showToast - Toast notification function
 * @param {Function} navigate - Navigation function
 * @returns {Promise<Object>} - Result {success, error}
 */
export const handleFacebookLogin = async (accessToken, pageId, showToast, navigate) => {
  try {
    const credValidation = validateCredentials({
      accessToken,
      userId: pageId,
      platform: 'Facebook'
    });
    
    if (!credValidation.isValid) {
      showToast(credValidation.message, 'error');
      return { success: false, error: credValidation.message };
    }
    
    // Save credentials to localStorage
    saveCredentials({
      platform: 'facebook',
      accessToken,
      pageId,
    });
    
    showToast('Facebook login successful!', 'success');
    
    // Navigate to dashboard if navigate function provided
    if (navigate) {
      navigate('/dashboard');
    }
    
    return { success: true };
    
  } catch (err) {
    console.error('❌ Facebook login error:', err);
    const errorMsg = err.message || 'Login failed';
    showToast(`Login failed: ${errorMsg}`, 'error');
    return { success: false, error: errorMsg };
  }
};

/**
 * Handler for Instagram login
 * @param {string} accessToken - Instagram access token
 * @param {string} igUserId - Instagram user ID
 * @param {Function} showToast - Toast notification function
 * @param {Function} navigate - Navigation function
 * @returns {Promise<Object>} - Result {success, error}
 */
export const handleInstagramLogin = async (accessToken, igUserId, showToast, navigate) => {
  try {
    const credValidation = validateCredentials({
      accessToken,
      userId: igUserId,
      platform: 'Instagram'
    });
    
    if (!credValidation.isValid) {
      showToast(credValidation.message, 'error');
      return { success: false, error: credValidation.message };
    }
    
    // Save credentials to localStorage
    saveCredentials({
      platform: 'instagram',
      accessToken,
      igUserId,
    });
    
    showToast('Instagram login successful!', 'success');
    
    // Navigate to dashboard if navigate function provided
    if (navigate) {
      navigate('/dashboard');
    }
    
    return { success: true };
    
  } catch (err) {
    console.error('❌ Instagram login error:', err);
    const errorMsg = err.message || 'Login failed';
    showToast(`Login failed: ${errorMsg}`, 'error');
    return { success: false, error: errorMsg };
  }
};

/**
 * Handler for logout
 * @param {string} platform - 'facebook' or 'instagram' or 'all'
 * @param {Function} showToast - Toast notification function
 * @param {Function} navigate - Navigation function
 * @returns {Object} - Result {success}
 */
export const handleLogout = (platform = 'all', showToast, navigate) => {
  try {
    clearCredentials(platform);
    
    const platformName = platform === 'all' 
      ? 'All platforms' 
      : platform.charAt(0).toUpperCase() + platform.slice(1);
    
    showToast?.(`${platformName} logout successful!`, 'success');
    
    // Navigate to login if navigate function provided
    if (navigate) {
      navigate('/login');
    }
    
    return { success: true };
    
  } catch (err) {
    console.error('❌ Logout error:', err);
    const errorMsg = err.message || 'Logout failed';
    showToast?.(`Logout failed: ${errorMsg}`, 'error');
    return { success: false, error: errorMsg };
  }
};

/**
 * Check if user is authenticated for a platform
 * @param {string} platform - 'facebook' or 'instagram'
 * @returns {boolean} - True if authenticated
 */
export const isAuthenticated = (platform) => {
  try {
    const credentials = localStorage.getItem(
      platform === 'facebook' ? 'facebookCredentials' : 'instagramCredentials'
    );
    
    if (!credentials) return false;
    
    const parsed = JSON.parse(credentials);
    
    if (platform === 'facebook') {
      return !!(parsed.accessToken && parsed.pageId);
    } else {
      return !!(parsed.accessToken && parsed.igUserId);
    }
    
  } catch (err) {
    console.error('❌ Auth check error:', err);
    return false;
  }
};

/**
 * Get current user authentication status
 * @returns {Object} - {facebook: boolean, instagram: boolean}
 */
export const getAuthStatus = () => {
  return {
    facebook: isAuthenticated('facebook'),
    instagram: isAuthenticated('instagram'),
  };
};
