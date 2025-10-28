import axios from "axios";

const API_BASE_URL = "http://localhost:8000";

/**
 * Fetch Instagram Mentions
 * @param {string} igUserId - Instagram Business User ID
 * @param {string} accessToken - Facebook Page Access Token
 * @returns {Promise<Array>} - Array of Instagram mentions
 */
export const fetchInstagramMentions = async (igUserId, accessToken) => {
  try {
    if (!igUserId || !accessToken) {
      console.warn("⚠️ Missing igUserId or accessToken for Instagram mentions");
      return [];
    }

    console.log("🔑 Instagram Mentions Params:", {
      access_token: accessToken ? accessToken.slice(0, 10) + "..." : null,
      ig_user_id: igUserId,
    });

    const res = await axios.get(`${API_BASE_URL}/instagram/mentions`, {
      params: {
        access_token: accessToken,
        ig_user_id: igUserId,
      },
    });

    console.log("✅ Instagram mentions response:", res.data);

    const data = res.data?.data || [];
    const igMentions = data.map((item, i) => ({
      platform: "Instagram",
      id: item.id || `ig_m_${i}`,
      target_id: item.media_id || item.id || `ig_target_${i}`,
      message: item.caption || "",
      time: item.timestamp || new Date().toISOString(),
      username: item.username || "Instagram User",
      mediaUrl: item.media_url || "",
      permalink: item.permalink || "",
      replies: [],
    }));

    console.log("✅ Parsed Instagram mentions:", igMentions);
    return igMentions;
  } catch (err) {
    console.error("❌ Fetch Instagram Mentions error:", err);
    throw err;
  }
};

/**
 * Fetch Instagram Posts
 * @param {string} igUserId - Instagram Business User ID
 * @param {string} accessToken - Facebook Page Access Token
 * @returns {Promise<Array>} - Array of Instagram posts
 */
export const fetchInstagramPosts = async (igUserId, accessToken) => {
  try {
    if (!igUserId || !accessToken) {
      console.warn("⚠️ Missing Instagram User ID or Access Token");
      return [];
    }

    console.log("🔑 Fetching Instagram posts for:", igUserId);

    const res = await axios.get(`${API_BASE_URL}/instagram/posts`, {
      params: {
        ig_user_id: igUserId,
        access_token: accessToken,
      },
    });

    console.log("✅ Instagram posts fetched:", res.data);

    const data = res.data?.data || [];
    const postsFormatted = data.map((item, i) => ({
      id: item.id || `ig_post_${i}`,
      caption: item.caption || "",
      mediaType: item.media_type || "IMAGE",
      mediaUrl: item.media_url || "",
      timestamp: item.timestamp || new Date().toISOString(),
      permalink: item.permalink || "#",
    }));

    return postsFormatted;
  } catch (err) {
    console.error("❌ Fetch Instagram Posts error:", err);
    throw err;
  }
};

/**
 * Reply to Instagram Mention/Comment
 * @param {string} mediaId - Instagram Media ID
 * @param {string} commentText - Reply text
 * @param {string} accessToken - Facebook Page Access Token
 * @returns {Promise<Object>} - Response data
 */
export const replyToInstagramMention = async (mediaId, commentText, accessToken) => {
  try {
    if (!mediaId || !commentText || !accessToken) {
      throw new Error("Missing required parameters for Instagram reply");
    }

    const igUserId = localStorage.getItem("fbInstagramId");
    if (!igUserId) {
      throw new Error("Instagram User ID not found");
    }

    console.log("🔍 Sending Instagram reply with:", {
      media_id: mediaId,
      comment_text: commentText,
      access_token: accessToken ? accessToken.slice(0, 10) + "..." : null,
      ig_user_id: igUserId,
    });

    const response = await axios.post(
      `${API_BASE_URL}/instagram/reply-to-mentions`,
      null,
      {
        params: {
          media_id: mediaId,
          comment_text: commentText,
          access_token: accessToken,
          ig_user_id: igUserId,
        },
      }
    );

    console.log("✅ Instagram reply sent:", response.data);
    return response.data;
  } catch (err) {
    console.error("❌ Instagram reply error:", err);
    throw err;
  }
};

/**
 * Create Instagram Post with File Upload
 * @param {string} igUserId - Instagram Business User ID
 * @param {File} imageFile - Image file to upload
 * @param {string} caption - Post caption (optional)
 * @param {string} accessToken - Facebook Page Access Token
 * @param {Array<string>} usernames - Optional array of usernames to tag
 * @returns {Promise<Object>} - Response data
 */
export const createInstagramPostWithFile = async (igUserId, imageFile, caption, accessToken, usernames = []) => {
  try {
    if (!igUserId || !imageFile || !accessToken) {
      throw new Error("Missing required parameters for Instagram post");
    }

    console.log("📤 Creating Instagram post with file:", imageFile.name);
    console.log("📋 Details:", { igUserId, caption, usernames });

    // Create FormData for file upload
    const formData = new FormData();
    formData.append("photo", imageFile);
    formData.append("access_token", accessToken);
    formData.append("ig_user_id", igUserId);
    
    if (caption) {
      formData.append("caption", caption);
    }
    
    // Add usernames as JSON string if present
    if (usernames && usernames.length > 0) {
      formData.append("usernames", JSON.stringify(usernames));
    }

    console.log("📦 Uploading to Instagram...");

    const response = await axios.post(
      `${API_BASE_URL}/instagram/create-post`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    console.log("✅ Instagram post created:", response.data);
    return response.data;
  } catch (err) {
    console.error("❌ Create Instagram post error:", err);
    console.error("📥 Backend error response:", err?.response?.data);
    throw err;
  }
};

/**
 * Create Instagram Post with Image URL (Legacy method)
 * @param {string} igUserId - Instagram Business User ID
 * @param {string} imageUrl - Image URL to post
 * @param {string} caption - Post caption (optional)
 * @param {string} accessToken - Facebook Page Access Token
 * @param {Array<string>} usernames - Optional array of usernames to tag
 * @returns {Promise<Object>} - Response data
 */
export const createInstagramPost = async (igUserId, imageUrl, caption, accessToken, usernames = []) => {
  try {
    if (!igUserId || !imageUrl || !accessToken) {
      throw new Error("Missing required parameters for Instagram post");
    }

    console.log("📤 Creating Instagram post:", { igUserId, imageUrl, caption, usernames });

    // Build query params
    const params = {
      access_token: accessToken,
      ig_user_id: igUserId,
      image_url: imageUrl,
    };

    // Add optional caption
    if (caption) {
      params.caption = caption;
    }

    // Backend expects usernames as the ENTIRE body (not wrapped in object)
    // Body(default=None) means send array directly or null
    const requestBody = usernames && usernames.length > 0 ? usernames : null;

    // Send request with usernames as direct body
    const response = await axios.post(
      `${API_BASE_URL}/instagram/create-post`,
      requestBody,
      {
        params: params,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Instagram post created:", response.data);
    return response.data;
  } catch (err) {
    console.error("❌ Create Instagram post error:", err);
    console.error("📥 Backend error response:", err?.response?.data);
    throw err;
  }
};

/**
 * Get Instagram Conversations (DMs)
 * @param {string} igUserId - Instagram Business User ID
 * @param {string} accessToken - Facebook Page Access Token
 * @returns {Promise<Array>} - Array of conversations
 */
export const fetchInstagramConversations = async (igUserId, accessToken) => {
  try {
    if (!igUserId || !accessToken) {
      console.warn("⚠️ Missing Instagram User ID or Access Token for conversations");
      return [];
    }

    console.log("🔑 Fetching Instagram conversations for:", igUserId);

    const res = await axios.get(`${API_BASE_URL}/instagram/conversations`, {
      params: {
        ig_user_id: igUserId,
        access_token: accessToken,
      },
    });

    console.log("✅ Instagram conversations fetched:", res.data);
    return res.data?.conversations || [];
  } catch (err) {
    console.error("❌ Fetch Instagram conversations error:", err);
    throw err;
  }
};

/**
 * Delete Instagram Post
 * @param {string} postId - Instagram Post ID
 * @param {string} accessToken - Facebook Page Access Token
 * @returns {Promise<Object>} - Response data
 */
export const deleteInstagramPost = async (postId, accessToken) => {
  try {
    if (!postId || !accessToken) {
      throw new Error("Missing required parameters for deleting Instagram post");
    }

    console.log("🗑️ Deleting Instagram post:", postId);

    const response = await axios.delete(`${API_BASE_URL}/instagram/post/${postId}`, {
      params: {
        access_token: accessToken,
      },
    });

    console.log("✅ Instagram post deleted:", response.data);
    return response.data;
  } catch (err) {
    console.error("❌ Delete Instagram post error:", err);
    throw err;
  }
};

/**
 * Fetch Instagram Comments for a Post
 * @param {string} postId - Instagram Post/Media ID
 * @param {string} accessToken - Facebook Page Access Token
 * @returns {Promise<Array>} - Array of comments
 */
export const fetchInstagramComments = async (postId, accessToken) => {
  try {
    if (!postId || !accessToken) {
      console.warn("⚠️ Missing post ID or access token for Instagram comments");
      return [];
    }

    console.log("💬 Fetching Instagram comments for post:", postId);

    const res = await axios.get(`${API_BASE_URL}/instagram/post/comments/`, {
      params: {
        media_id: postId,
        access_token: accessToken,
      },
    });

    console.log("✅ Instagram comments fetched:", res.data);
    
    // Extract comments from success response
    if (res.data?.success) {
      return res.data?.data || [];
    }
    return res.data?.comments || [];
  } catch (err) {
    console.error("❌ Fetch Instagram comments error:", err);
    throw err;
  }
};

/**
 * Reply to Instagram Comment
 * @param {string} commentId - Instagram Comment ID
 * @param {string} replyText - Reply text
 * @param {string} accessToken - Facebook Page Access Token
 * @returns {Promise<Object>} - Response data
 */
export const replyToInstagramComment = async (commentId, replyText, accessToken) => {
  try {
    if (!commentId || !replyText || !accessToken) {
      throw new Error("Missing required parameters for Instagram comment reply");
    }

    console.log("💬 Replying to Instagram comment:", commentId);

    const response = await axios.post(
      `${API_BASE_URL}/instagram/post/comment/reply`,
      null,
      {
        params: {
          comment_id: commentId,
          message: replyText,
          access_token: accessToken,
        },
      }
    );

    console.log("✅ Instagram comment reply sent:", response.data);
    return response.data;
  } catch (err) {
    console.error("❌ Instagram comment reply error:", err);
    throw err;
  }
};

/**
 * Delete Instagram Comment
 * @param {string} commentId - Instagram Comment ID
 * @param {string} accessToken - Facebook Page Access Token
 * @returns {Promise<Object>} - Response data
 */
export const deleteInstagramComment = async (commentId, accessToken) => {
  try {
    if (!commentId || !accessToken) {
      throw new Error("Missing required parameters for Instagram comment deletion");
    }

    console.log("🗑️ Deleting Instagram comment:", commentId);

    const response = await axios.delete(
      `${API_BASE_URL}/instagram/comment/delete`,
      {
        params: {
          comment_id: commentId,
          access_token: accessToken,
        },
      }
    );

    console.log("✅ Instagram comment deleted:", response.data);
    return response.data;
  } catch (err) {
    console.error("❌ Instagram comment deletion error:", err);
    throw err;
  }
};

/**
 * Hide/Unhide Instagram Comment
 * @param {string} commentId - Instagram Comment ID
 * @param {boolean} hide - True to hide, false to unhide
 * @param {string} accessToken - Facebook Page Access Token
 * @returns {Promise<Object>} - Response data
 */
export const hideInstagramComment = async (commentId, hide, accessToken) => {
  try {
    if (!commentId || !accessToken || hide === undefined) {
      throw new Error("Missing required parameters for Instagram comment hide/unhide");
    }

    console.log(`${hide ? '🙈' : '👁️'} ${hide ? 'Hiding' : 'Unhiding'} Instagram comment:`, commentId);

    const response = await axios.post(
      `${API_BASE_URL}/instagram/comment/hide`,
      null,
      {
        params: {
          comment_id: commentId,
          hide: hide,
          access_token: accessToken,
        },
      }
    );

    console.log(`✅ Instagram comment ${hide ? 'hidden' : 'unhidden'}:`, response.data);
    return response.data;
  } catch (err) {
    console.error(`❌ Instagram comment ${hide ? 'hide' : 'unhide'} error:`, err);
    throw err;
  }
};
