/**
 * Data Fetching Handlers
 * Business logic for fetching mentions, posts, comments, and DMs
 */

import {
  fetchFacebookMentions,
  fetchFacebookComments,
  fetchFacebookPosts,
  fetchFacebookConversations,
} from './facebookService';

import {
  fetchInstagramMentions,
  fetchInstagramComments,
  fetchInstagramPosts,
  fetchInstagramConversations,
} from './instagramService';

import {
  validateCredentials,
} from '../utils/validation';

import {
  getFacebookCredentials,
  getInstagramCredentials,
} from '../utils/storage';

import {
  formatMentions,
  formatPosts,
  formatConversations,
} from '../utils/formatting';

/**
 * Handler for fetching Facebook mentions
 * @param {Function} showToast - Toast notification function
 * @returns {Promise<Object>} - Result {success, data, error}
 */
export const handleFetchFacebookMentions = async (showToast) => {
  try {
    const { accessToken, pageId } = getFacebookCredentials();
    
    const credValidation = validateCredentials({
      accessToken,
      userId: pageId,
      platform: 'Facebook'
    });
    
    if (!credValidation.isValid) {
      showToast?.(credValidation.message, 'error');
      return { success: false, error: credValidation.message, data: [] };
    }
    
    const rawData = await fetchFacebookMentions(pageId, accessToken);
    const formattedData = formatMentions(rawData, 'facebook');
    
    return { success: true, data: formattedData };
    
  } catch (err) {
    console.error('❌ Fetch Facebook mentions error:', err);
    const errorMsg = err?.response?.data?.detail || err.message;
    showToast?.(`Failed to fetch mentions: ${errorMsg}`, 'error');
    return { success: false, error: errorMsg, data: [] };
  }
};

/**
 * Handler for fetching Facebook posts
 * @param {Function} showToast - Toast notification function
 * @returns {Promise<Object>} - Result {success, data, error}
 */
export const handleFetchFacebookPosts = async (showToast) => {
  try {
    const { accessToken, pageId } = getFacebookCredentials();
    
    const credValidation = validateCredentials({
      accessToken,
      userId: pageId,
      platform: 'Facebook'
    });
    
    if (!credValidation.isValid) {
      showToast?.(credValidation.message, 'error');
      return { success: false, error: credValidation.message, data: [] };
    }
    
    const rawData = await fetchFacebookPosts(pageId, accessToken);
    const formattedData = formatPosts(rawData, 'facebook');
    
    return { success: true, data: formattedData };
    
  } catch (err) {
    console.error('❌ Fetch Facebook posts error:', err);
    const errorMsg = err?.response?.data?.detail || err.message;
    showToast?.(`Failed to fetch posts: ${errorMsg}`, 'error');
    return { success: false, error: errorMsg, data: [] };
  }
};

/**
 * Handler for fetching Facebook conversations/DMs
 * @param {Function} showToast - Toast notification function
 * @returns {Promise<Object>} - Result {success, data, error}
 */
export const handleFetchFacebookConversations = async (showToast) => {
  try {
    const { accessToken, pageId } = getFacebookCredentials();
    
    const credValidation = validateCredentials({
      accessToken,
      userId: pageId,
      platform: 'Facebook'
    });
    
    if (!credValidation.isValid) {
      showToast?.(credValidation.message, 'error');
      return { success: false, error: credValidation.message, data: [] };
    }
    
    const rawData = await fetchFacebookConversations(pageId, accessToken);
    const formattedData = formatConversations(rawData, 'facebook');
    
    return { success: true, data: formattedData };
    
  } catch (err) {
    console.error('❌ Fetch Facebook conversations error:', err);
    const errorMsg = err?.response?.data?.detail || err.message;
    showToast?.(`Failed to fetch conversations: ${errorMsg}`, 'error');
    return { success: false, error: errorMsg, data: [] };
  }
};

/**
 * Handler for fetching Instagram mentions
 * @param {Function} showToast - Toast notification function
 * @returns {Promise<Object>} - Result {success, data, error}
 */
export const handleFetchInstagramMentions = async (showToast) => {
  try {
    const { accessToken, igUserId } = getInstagramCredentials();
    
    const credValidation = validateCredentials({
      accessToken,
      userId: igUserId,
      platform: 'Instagram'
    });
    
    if (!credValidation.isValid) {
      showToast?.(credValidation.message, 'error');
      return { success: false, error: credValidation.message, data: [] };
    }
    
    const rawData = await fetchInstagramMentions(igUserId, accessToken);
    const formattedData = formatMentions(rawData, 'instagram');
    
    return { success: true, data: formattedData };
    
  } catch (err) {
    console.error('❌ Fetch Instagram mentions error:', err);
    const errorMsg = err?.response?.data?.detail || err.message;
    showToast?.(`Failed to fetch mentions: ${errorMsg}`, 'error');
    return { success: false, error: errorMsg, data: [] };
  }
};

/**
 * Handler for fetching Instagram posts
 * @param {Function} showToast - Toast notification function
 * @returns {Promise<Object>} - Result {success, data, error}
 */
export const handleFetchInstagramPosts = async (showToast) => {
  try {
    const { accessToken, igUserId } = getInstagramCredentials();
    
    const credValidation = validateCredentials({
      accessToken,
      userId: igUserId,
      platform: 'Instagram'
    });
    
    if (!credValidation.isValid) {
      showToast?.(credValidation.message, 'error');
      return { success: false, error: credValidation.message, data: [] };
    }
    
    const rawData = await fetchInstagramPosts(igUserId, accessToken);
    const formattedData = formatPosts(rawData, 'instagram');
    
    return { success: true, data: formattedData };
    
  } catch (err) {
    console.error('❌ Fetch Instagram posts error:', err);
    const errorMsg = err?.response?.data?.detail || err.message;
    showToast?.(`Failed to fetch posts: ${errorMsg}`, 'error');
    return { success: false, error: errorMsg, data: [] };
  }
};

/**
 * Handler for fetching Instagram conversations/DMs
 * @param {Function} showToast - Toast notification function
 * @returns {Promise<Object>} - Result {success, data, error}
 */
export const handleFetchInstagramConversations = async (showToast) => {
  try {
    const { accessToken, igUserId } = getInstagramCredentials();
    
    const credValidation = validateCredentials({
      accessToken,
      userId: igUserId,
      platform: 'Instagram'
    });
    
    if (!credValidation.isValid) {
      showToast?.(credValidation.message, 'error');
      return { success: false, error: credValidation.message, data: [] };
    }
    
    const rawData = await fetchInstagramConversations(igUserId, accessToken);
    const formattedData = formatConversations(rawData, 'instagram');
    
    return { success: true, data: formattedData };
    
  } catch (err) {
    console.error('❌ Fetch Instagram conversations error:', err);
    const errorMsg = err?.response?.data?.detail || err.message;
    showToast?.(`Failed to fetch conversations: ${errorMsg}`, 'error');
    return { success: false, error: errorMsg, data: [] };
  }
};

/**
 * Combined handler to fetch all Facebook data
 * @param {Function} showToast - Toast notification function
 * @returns {Promise<Object>} - Result {mentions, posts, conversations}
 */
export const handleFetchAllFacebookData = async (showToast) => {
  const [mentions, posts, conversations] = await Promise.allSettled([
    handleFetchFacebookMentions(showToast),
    handleFetchFacebookPosts(showToast),
    handleFetchFacebookConversations(showToast),
  ]);
  
  return {
    mentions: mentions.status === 'fulfilled' ? mentions.value.data : [],
    posts: posts.status === 'fulfilled' ? posts.value.data : [],
    conversations: conversations.status === 'fulfilled' ? conversations.value.data : [],
  };
};

/**
 * Combined handler to fetch all Instagram data
 * @param {Function} showToast - Toast notification function
 * @returns {Promise<Object>} - Result {mentions, posts, conversations}
 */
export const handleFetchAllInstagramData = async (showToast) => {
  const [mentions, posts, conversations] = await Promise.allSettled([
    handleFetchInstagramMentions(showToast),
    handleFetchInstagramPosts(showToast),
    handleFetchInstagramConversations(showToast),
  ]);
  
  return {
    mentions: mentions.status === 'fulfilled' ? mentions.value.data : [],
    posts: posts.status === 'fulfilled' ? posts.value.data : [],
    conversations: conversations.status === 'fulfilled' ? conversations.value.data : [],
  };
};
