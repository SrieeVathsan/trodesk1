/**
 * Data formatting utility functions
 */

/**
 * Format timestamp to readable date
 * @param {string} timestamp - ISO timestamp
 * @returns {string} - Formatted date
 */
export const formatDate = (timestamp) => {
  if (!timestamp) return '';
  
  try {
    const date = new Date(timestamp);
    return date.toLocaleString();
  } catch (err) {
    return timestamp;
  }
};

/**
 * Format mentions for display
 * @param {Array} mentions - Array of mentions
 * @param {string} platform - Platform name
 * @returns {Array} - Formatted mentions
 */
export const formatMentions = (mentions, platform) => {
  if (!Array.isArray(mentions)) return [];
  
  return mentions.map((mention, index) => ({
    ...mention,
    platform: platform,
    displayTime: formatDate(mention.time || mention.timestamp),
    key: `${platform}-mention-${mention.id || index}`,
  }));
};

/**
 * Format posts for display
 * @param {Array} posts - Array of posts
 * @param {string} platform - Platform name
 * @returns {Array} - Formatted posts
 */
export const formatPosts = (posts, platform) => {
  if (!Array.isArray(posts)) return [];
  
  return posts.map((post, index) => ({
    ...post,
    platform: platform,
    displayTime: formatDate(post.timestamp || post.created_time),
    key: `${platform}-post-${post.id || index}`,
  }));
};

/**
 * Format conversations/DMs for display
 * @param {Array} conversations - Array of conversations
 * @param {string} platform - Platform name
 * @returns {Array} - Formatted conversations
 */
export const formatConversations = (conversations, platform) => {
  if (!Array.isArray(conversations)) return [];
  
  return conversations.map((conv, index) => ({
    ...conv,
    platform: platform,
    displayTime: formatDate(conv.time || conv.updated_time),
    key: `${platform}-dm-${conv.id || index}`,
  }));
};

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
export const truncateText = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Extract first line as caption
 * @param {string} content - Full content
 * @returns {string} - First line
 */
export const extractCaption = (content) => {
  if (!content) return '';
  return content.split('\n')[0] || content.substring(0, 100);
};
