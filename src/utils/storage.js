/**
 * LocalStorage utility functions
 */

/**
 * Get all social media credentials from localStorage
 * @returns {Object} - Object containing all credentials
 */
export const getCredentials = () => {
  return {
    fbAccessToken: localStorage.getItem('fbAccessToken'),
    fbPageId: localStorage.getItem('fbPageId'),
    fbInstagramId: localStorage.getItem('fbInstagramId'),
    fbPageAccessToken: localStorage.getItem('fbPageAccessToken'),
    userId: localStorage.getItem('userId'),
  };
};

/**
 * Get Facebook credentials
 * @returns {Object} - Facebook credentials
 */
export const getFacebookCredentials = () => {
  return {
    accessToken: localStorage.getItem('fbAccessToken'),
    pageId: localStorage.getItem('fbPageId'),
    pageAccessToken: localStorage.getItem('fbPageAccessToken'),
  };
};

/**
 * Get Instagram credentials
 * @returns {Object} - Instagram credentials
 */
export const getInstagramCredentials = () => {
  return {
    accessToken: localStorage.getItem('fbAccessToken'),
    igUserId: localStorage.getItem('fbInstagramId'),
  };
};

/**
 * Clear all credentials from localStorage
 */
export const clearCredentials = () => {
  localStorage.removeItem('fbAccessToken');
  localStorage.removeItem('fbPageId');
  localStorage.removeItem('fbInstagramId');
  localStorage.removeItem('fbPageAccessToken');
  localStorage.removeItem('userId');
};

/**
 * Save credentials to localStorage
 * @param {Object} credentials - Credentials object
 */
export const saveCredentials = (credentials) => {
  Object.entries(credentials).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      localStorage.setItem(key, value);
    }
  });
};
