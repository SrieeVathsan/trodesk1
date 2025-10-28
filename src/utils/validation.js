/**
 * Validation utility functions
 */

/**
 * Validate if required credentials exist
 * @param {Object} credentials - Object containing access token and other credentials
 * @returns {Object} - {isValid: boolean, message: string}
 */
export const validateCredentials = (credentials) => {
  const { accessToken, userId, platform } = credentials;
  
  if (!accessToken) {
    return {
      isValid: false,
      message: `Missing ${platform || 'social media'} access token. Please login again.`
    };
  }
  
  if (userId !== undefined && !userId) {
    return {
      isValid: false,
      message: `Missing ${platform || 'social media'} user ID. Please login again.`
    };
  }
  
  return { isValid: true, message: '' };
};

/**
 * Validate post content
 * @param {string} content - Post content
 * @param {Object} options - Validation options
 * @returns {Object} - {isValid: boolean, message: string}
 */
export const validatePostContent = (content, options = {}) => {
  const { 
    required = true, 
    minLength = 0, 
    maxLength = 5000,
    allowEmpty = false 
  } = options;
  
  if (required && !content) {
    return {
      isValid: false,
      message: 'Post content is required'
    };
  }
  
  if (!allowEmpty && content && !content.trim()) {
    return {
      isValid: false,
      message: 'Post content cannot be empty'
    };
  }
  
  if (content && content.length < minLength) {
    return {
      isValid: false,
      message: `Content must be at least ${minLength} characters`
    };
  }
  
  if (content && content.length > maxLength) {
    return {
      isValid: false,
      message: `Content must not exceed ${maxLength} characters`
    };
  }
  
  return { isValid: true, message: '' };
};

/**
 * Validate image URL
 * @param {string} url - Image URL
 * @returns {Object} - {isValid: boolean, message: string}
 */
export const validateImageUrl = (url) => {
  if (!url || !url.trim()) {
    return {
      isValid: false,
      message: 'Image URL is required'
    };
  }
  
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return {
        isValid: false,
        message: 'URL must start with http:// or https://'
      };
    }
  } catch (err) {
    return {
      isValid: false,
      message: 'Invalid URL format'
    };
  }
  
  return { isValid: true, message: '' };
};

/**
 * Validate file upload
 * @param {File} file - File object
 * @param {Object} options - Validation options
 * @returns {Object} - {isValid: boolean, message: string}
 */
export const validateFileUpload = (file, options = {}) => {
  const {
    allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
    maxSize = 8 * 1024 * 1024, // 8MB default
  } = options;
  
  if (!file) {
    return {
      isValid: false,
      message: 'Please select a file'
    };
  }
  
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      message: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`
    };
  }
  
  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
    return {
      isValid: false,
      message: `File size must be less than ${maxSizeMB}MB`
    };
  }
  
  return { isValid: true, message: '' };
};

/**
 * Parse comma-separated usernames
 * @param {string} usernamesString - Comma-separated usernames
 * @returns {Array<string>} - Array of trimmed usernames
 */
export const parseUsernames = (usernamesString) => {
  if (!usernamesString || typeof usernamesString !== 'string') {
    return [];
  }
  
  return usernamesString
    .split(',')
    .map(u => u.trim())
    .filter(u => u.length > 0);
};
