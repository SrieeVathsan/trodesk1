import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageSquare,
  Home,
  FileText,
  Image,
  Settings,
  Sun,
  Moon,
  Send,
  Users,
  BarChart3,
  Mail,
  LogOut,
} from "lucide-react";
import { IoArrowBackCircleOutline } from "react-icons/io5";
import axios from "axios";
import logo from "../assets/logo.png";
// import "./App.css";

const FB_SDK_POLL_INTERVAL = 300; // ms
const FB_SDK_POLL_ATTEMPTS = 30;



const Dashboard = () => {
  const [mentions, setMentions] = useState([]);
  const [dms, setDms] = useState([]);
  const [posts, setPosts] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [selectedDm, setSelectedDm] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [dmText, setDmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("mentions");
  const [darkMode, setDarkMode] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showPostForm, setShowPostForm] = useState(false);
  const [selectedPage, setSelectedPage] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [postContent, setPostContent] = useState("");
  const [fbUser, setFbUser] = useState(null);
  const [igUserId, setIgUserId] = useState(null);
  const [fbReady, setFbReady] = useState(false);
  const [fbStatus, setFbStatus] = useState("unknown");
  const [saving, setSaving] = useState(false);
  const [pages, setPages] = useState([]);
  const messagesEndRef = useRef(null);
  const fbPollRef = useRef(0);

const [fbPageId, setFbPageId] = useState(null);
const [fbInstagramId, setFbInstagramId] = useState(null);
const [selectedPlatform, setSelectedPlatform] = useState(null); // "instagram" | "facebook" | null




  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedDm?.messages]);

  // ✅ Clear reply text when switching mentions
  useEffect(() => {
    setReplyText("");
  }, [selectedMessage]);

  const platformLabels = {
    Instagram: "Instagram User",
    Facebook: "Facebook User",
    X: "X (Twitter) User",
  };

  const fbStatusMessage = () => {
    if (!fbReady) return "Facebook SDK not ready.";
    if (fbStatus === "connected") return `Facebook: connected ${fbUser?.name ? `- ${fbUser.name}` : ''}`;
    if (fbStatus === "not_authorized") return "Facebook: not authorized";
    return "Facebook: not logged in";
  };

  // Theme init - read from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") setDarkMode(true);
    else setDarkMode(false);
  }, []);

  // ✅ Restore fbUser on mount if available
  useEffect(() => {
    const storedUser = localStorage.getItem("fbUser");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setFbUser(parsedUser);
        setFbStatus("connected"); // assume still connected
      } catch (err) {
        console.error("Failed to parse fbUser from storage:", err);
        localStorage.removeItem("fbUser");
      }
    }
  }, []);

  // Persist theme
  useEffect(() => {
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // Build FB SDK loader and login status checks
  useEffect(() => {
    if (window.FB && window.FB.init) {
      window.FB.getLoginStatus((resp) => {
        setFbStatus(resp?.status ?? "unknown");
        setFbReady(true);
      });
      return;
    }

    window.fbAsyncInit = function () {
      try {
        window.FB.init({
          appId: process.env.REACT_APP_FB_APP_ID || "",
          cookie: true,
          xfbml: false,
          version: "v23.0",
        });
        window.FB.getLoginStatus((resp) => {
          setFbStatus(resp?.status ?? "unknown");
          setFbReady(true);
        });
      } catch (err) {
        console.error("FB init error:", err);
      }
    };

    (function (d, s, id) {
      let js, fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) return;
      js = d.createElement(s);
      js.id = id;
      js.src = "https://connect.facebook.net/en_US/sdk.js";
      fjs.parentNode.insertBefore(js, fjs);
    })(document, "script", "facebook-jssdk");

    fbPollRef.current = 0;
    const poll = setInterval(() => {
      fbPollRef.current += 1;
      if (window.FB) {
        setFbReady(true);
        window.FB.getLoginStatus((resp) => setFbStatus(resp?.status ?? "unknown"));
        clearInterval(poll);
      } else if (fbPollRef.current > FB_SDK_POLL_ATTEMPTS) {
        clearInterval(poll);
        setFbReady(false);
      }
    }, FB_SDK_POLL_INTERVAL);

    return () => clearInterval(poll);
  }, [setFbReady, setFbStatus]);

  // Toggle theme helper
  const toggleTheme = () => setDarkMode((p) => !p);

  // Add this useEffect for better error handling
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use((config) => {
      setLoading(true);
      return config;
    });

    const responseInterceptor = axios.interceptors.response.use(
      (response) => {
        setLoading(false);
        return response;
      },
      (error) => {
        setLoading(false);
        if (error.code === 'NETWORK_ERROR' || error.message === 'Network Error') {
          alert('❌ Backend server is not running. Please start your backend server on port 8000.');
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  // Helper: clear selected message when switching away from mentions/DMs
  useEffect(() => {
    if (activeTab !== "mentions" && activeTab !== "dms") {
      setSelectedMessage(null);
      setSelectedDm(null);
    }
  }, [activeTab]);

  // ---------------- Backend API calls ----------------
  // ---------------- Fetch All Mentions ----------------
const fetchAllMentions = useCallback(async () => {
  const pageId = fbPageId || localStorage.getItem("fbPageId");
  const igUserId = fbInstagramId || localStorage.getItem("fbInstagramId");
  const pageAccessToken = localStorage.getItem("fbAccessToken");

  if (!fbUser) {
    alert("Please login first to view mentions");
    return;
  }

  if (!pageId || !pageAccessToken || !igUserId) {
    console.warn("⚠️ Missing pageId, accessToken, or igUserId for mentions fetch");
    return;
  }
    console.log("🔑 Params:", {
    access_token: pageAccessToken,
    page_id: pageId,
    ig_user_id: igUserId,
  });

  setLoading(true);
  try {
    const res = await axios.get("http://127.0.0.1:8000/all/mentions", {
     params: {
    access_token: pageAccessToken, // ✅ correct key
    page_id: pageId,
    ig_user_id: igUserId,
    },
    });

    const data = res.data || {};
    console.log("📥 Raw mentions response:", JSON.stringify(data, null, 2));

    const allMentions = [];

    // ✅ Facebook mentions - Updated structure
    if (data.facebook?.success && Array.isArray(data.facebook?.data)) {
      allMentions.push(
        ...data.facebook.data.map((item, i) => ({
          platform: "Facebook",
          id: item.id || `fb_m_${i}`,
          message: item.message || item.text || "",
          time: item.created_time || item.timestamp || new Date().toISOString(),
          username: item.from?.name || item.username || "Facebook User", // ✅ Use actual author name
          mediaUrl: item.full_picture || "",
          permalink: item.permalink_url || item.permalink || "",
          replies: item.replies || [],
          // ✅ Add author image for profile picture
          authorImage: item.from?.picture?.data?.url || "",
          profileUrl: item.permalink_url || item.permalink || "",
        }))
      );
    }

    // ✅ Instagram mentions - Updated structure
    if (data.instagram?.success && Array.isArray(data.instagram?.data)) {
      allMentions.push(
        ...data.instagram.data.map((item, i) => ({
          platform: "Instagram",
          id: item.id || `ig_m_${i}`,
          message: item.caption || "",
          time: item.timestamp || new Date().toISOString(),
          username: item.username || "Instagram User",
          mediaUrl: item.media_url || "",
          permalink: item.permalink || "",
          replies: [],
        }))
      );
    }

    // ✅ X/Twitter mentions
    if (Array.isArray(data.x?.data)) {
      allMentions.push(
        ...data.x.data.map((item, i) => ({
          platform: "X",
          id: item.id || `x_m_${i}`,
          message: item.text || "",
          time: item.created_at || new Date().toISOString(),
          username: item.author_id || "X User",
          mediaUrl: item.media_url || "",
          permalink: item.permalink || "",
          replies: [],
        }))
      );
    }

    console.log("✅ Parsed mentions:", allMentions);
    setMentions(allMentions);
  } catch (err) {
    console.error("❌ Fetch All Mentions error:", err);
    setMentions([]);
  } finally {
    setLoading(false);
  }
}, [fbUser, fbPageId, fbInstagramId]);

//-----------Mentions-----------------//

const fetchPlatformMentions = useCallback(
  async (platform) => {
    const pageId = fbPageId || localStorage.getItem("fbPageId");
    const igUserId = fbInstagramId || localStorage.getItem("fbInstagramId");
    const accessToken = localStorage.getItem("fbAccessToken");

    if (!fbUser) {
      alert("Please login first to view mentions");
      return;
    }

    if (!accessToken) {
      console.warn("⚠️ Missing access token");
      return;
    }

    setLoading(true);
    console.log(`🔍 Fetching ${platform} mentions...`);

    try {
      let res;
      if (platform === "facebook") {
        // 🟦 Facebook API
        res = await axios.get("http://127.0.0.1:8000/facebook/mentions", {
          params: { access_token: accessToken, page_id: pageId },
        });
      } else if (platform === "instagram") {
        // 🟣 Instagram API
        res = await axios.get("http://127.0.0.1:8000/instagram/mentions", {
          params: { access_token: accessToken, ig_user_id: igUserId },
        });
      } else {
        console.warn("❌ Unsupported platform:", platform);
        return;
      }

      const data = res.data || {};
      console.log(`📥 Raw ${platform} mentions:`, data);

      const formattedMentions = [];

      if (platform === "facebook" && Array.isArray(data.data)) {
        formattedMentions.push(
          ...data.data.map((item, i) => ({
            platform: "facebook",
            id: item.id || `fb_m_${i}`,
            message: item.message || item.text || "",
            time: item.created_time || new Date().toISOString(),
            username: item.from?.name || "Facebook User",
            avatar: item.from?.picture?.data?.url || "",
            permalink: item.permalink_url || "",
          }))
        );
      }

      if (platform === "instagram" && Array.isArray(data.data)) {
        formattedMentions.push(
          ...data.data.map((item, i) => ({
            platform: "instagram",
            id: item.id || `ig_m_${i}`,
            message: item.caption || "",
            time: item.timestamp || new Date().toISOString(),
            username: item.username || "Instagram User",
            avatar: item.profile_picture_url || "",
            permalink: item.permalink || "",
          }))
        );
      }

      console.log(`✅ Parsed ${platform} mentions:`, formattedMentions);
      setMentions(formattedMentions);
    } catch (err) {
      console.error(`❌ Fetch ${platform} mentions error:`, err);
      setMentions([]);
    } finally {
      setLoading(false);
    }
  },
  [fbUser, fbPageId, fbInstagramId]
);




  // ---------------- Fetch DMs ----------------
  const fetchDms = useCallback(async () => {
    const pageId = selectedPage?.id || localStorage.getItem("fbPageId");
    const pageAccessToken = selectedPage?.access_token || localStorage.getItem("fbAccessToken");

    console.log("🔍 Fetching DMs with:", {
      pageId: pageId,
      hasAccessToken: !!pageAccessToken,
      fbUser: !!fbUser
    });

    if (!fbUser) return alert("Please login first");
    if (!pageId || !pageAccessToken) {
      console.warn("⚠️ Missing Page ID or Access Token for DMs");
      alert("Missing Page ID or Page Access Token. Please login again.");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get("http://127.0.0.1:8000/facebook/conversations", {
        params: { page_id: pageId, access_token: pageAccessToken },
      });

      console.log("✅ DMs response:", res.data);

      const conversations = res.data?.conversations || [];
      const dmsFormatted = conversations.map((item) => {
        const participants = item.participants?.data || [];
        const firstUser = participants.find((p) => p.id !== pageId) || {};
        const lastMsg = (item.messages?.data || [])[0] || {};

        const formattedMessages = (item.messages?.data || [])
          .map((m) => ({
            id: m.id,
            text: m.message || "",
            time: m.created_time,
            sender: m.from?.name || "Unknown",
            isMe: m.from?.id === pageId,
          }))
          .reverse(); // ✅ Reverse to show oldest first, newest last

        // ✅ Generate proper avatar URL with access token for authentication
        let avatarUrl = null;
        if (firstUser.id) {
          avatarUrl = `https://graph.facebook.com/${firstUser.id}/picture?type=large&access_token=${pageAccessToken}`;
        }

        return {
          id: item.id,
          username: firstUser.name || "Unknown User",
          userId: firstUser.id || null,
          avatar: avatarUrl,
          lastMessage: lastMsg.message || "",
          time: lastMsg.created_time || item.updated_time,
          unread: 0,
          messages: formattedMessages,
        };
      });

      console.log("✅ Formatted DMs:", dmsFormatted);
      setDms(dmsFormatted);
    } catch (err) {
      console.error("❌ Fetch DMs error:", err.response?.data || err.message);
      alert(`❌ Failed to fetch DMs: ${err.response?.data?.detail || err.message}`);
      setDms([]);
    } finally {
      setLoading(false);
    }
  }, [fbUser, selectedPage]);

  useEffect(() => {
    if (selectedPage?.id) fetchDms();
  }, [selectedPage, fetchDms]);

  // ✅ Fetch DMs when DMs tab is clicked
  useEffect(() => {
    if (activeTab === "dms" && fbUser) {
      fetchDms();
    }
  }, [activeTab, fbUser, fetchDms]);




  // ---------------- Fetch IG Business Account ----------------
  // const fetchIgBusinessAccount = useCallback(async (pageId, pageAccessToken) => {
  //   try {
  //     const res = await axios.get("https://sunny-positively-thrush.ngrok-free.app/instagram/business-account", {
  //       params: {
  //         page_id: pageId,
  //         page_access_token: pageAccessToken,
  //       },
  //     });

  //     console.log("✅ IG Business Account:", res.data);

  //     if (res.data?.ig_user_id) {
  //       setIgUserId(res.data.ig_user_id); // ✅ Save IG User ID
  //     }

  //     return res.data;
  //   } catch (err) {
  //     console.error("❌ Fetch IG Business Account error:", err.response?.data || err.message);
  //     alert("Failed to fetch Instagram Business Account.");
  //     return null;
  //   }
  // }, []);

  // ---------------- Fetch IG Mentions ----------------
// const fetchIgMentions = useCallback(async () => {
//   const storedPageId = localStorage.getItem("fbPageId");
//   const storedAccessToken = localStorage.getItem("fbAccessToken");
//   const storedIgUserId = localStorage.getItem("fbInstagramId");

//   const pageId = storedPageId;
//   const accessToken = storedAccessToken;
//   const igUserId = storedIgUserId;

//   if (!pageId || !accessToken || !igUserId) {
//     console.warn("⚠️ Missing Page ID, IG User ID, or Access Token");
//     return null;
//   }

//   try {
//     const res = await axios.get("/api/instagram/mentions", {
//       params: {
//         page_id: pageId,          // ✅ Facebook Page ID
//         access_token: accessToken, // ✅ Page access token
//         ig_user_id: igUserId,     // ✅ Instagram Business User ID
//       },
//     });

//     console.log("✅ IG Mentions:", res.data);
//     return res.data;
//   } catch (err) {
//     console.error("❌ Fetch IG Mentions error:", err.response?.data || err.message);
//     return null;
//   }
// }, []);

//  useEffect(() => {
//     fetchIgMentions();

  
//     }, []);


  // ---------------- Fetch Posts ----------------
  const fetchPosts = useCallback(async () => {
    const pageId = localStorage.getItem("fbPageId");
    const pageAccessToken = localStorage.getItem("fbAccessToken");

    if (!fbUser) {
      alert("Please login first to view posts");
      return;
    }

    if (!pageId || !pageAccessToken) {
      console.warn("⚠️ Missing Page ID or Access Token");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get("http://127.0.0.1:8000/facebook/posts", {
        params: {
          page_id: pageId,
          access_token: pageAccessToken,
        },
      });

      console.log("✅ Posts fetched:", res.data);
      console.log("📥 Raw posts response structure:", JSON.stringify(res.data, null, 2));

      const data = res.data?.posts || res.data?.data || [];
      console.log("📊 Posts data array:", data);

      const postsFormatted = data.map((item, i) => {
        console.log(`📝 Post ${i} raw item:`, JSON.stringify(item, null, 2));
        
        // ✅ This is from tagged posts, so there's no post image (full_picture)
        // Only profile picture from 'from.picture.data.url'
        // Post images would need a different API endpoint like /{post-id}?fields=attachments
        
        // ✅ Get author info from the 'from' field
        const authorName = item.from?.name || "Unknown Author";
        const authorImage = item.from?.picture?.data?.url || "";
        const authorId = item.from?.id || "";

        console.log(`👤 Post ${i} author:`, authorName);
        console.log(`📸 Post ${i} author image:`, authorImage);

        return {
          id: item.id || `post_${i}`,
          caption: item.message?.split("\n")[0] || "(no caption)",
          content: item.message || "",
          page: authorName, // ✅ Use author name
          timestamp: item.created_time || new Date().toISOString(),
          mediaUrl:item.full_picture || "", // ✅ Tagged posts don't include post images by default
          permalink: item.permalink_url || "#",
          // ✅ Add author information
          authorName: authorName,
          authorImage: authorImage,
          authorId: authorId,
        };
      });

      setPosts(postsFormatted);
    } catch (err) {
      console.error("❌ Fetch Posts error:", err);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [fbUser]);

  // ✅ Fetch posts when posts tab is clicked
  // useEffect(() => {
  //   if (activeTab === "posts" && fbUser) {
  //     fetchPosts();
  //   }
  // }, [activeTab, fbUser, fetchPosts]);

  //------------------Post--------------//

  const fetchPlatformPosts = useCallback(
  async (platform) => {
    const pageId = fbPageId || localStorage.getItem("fbPageId");
    const igUserId = fbInstagramId || localStorage.getItem("fbInstagramId");
    const accessToken = localStorage.getItem("fbAccessToken");

    if (!fbUser) {
      alert("Please login first to view posts");
      return;
    }

    if (!accessToken) {
      console.warn("⚠️ Missing access token");
      return;
    }

    setLoading(true);
    console.log(`🔍 Fetching ${platform} posts...`);

    try {
      let res;
      if (platform === "facebook") {
        // 🟦 Facebook posts API
        res = await axios.get("http://127.0.0.1:8000/facebook/posts", {
          params: { access_token: accessToken, page_id: pageId },
        });
      } else if (platform === "instagram") {
        // 🟣 Instagram posts API
        res = await axios.get("http://127.0.0.1:8000/instagram/posts", {
          params: { access_token: accessToken, ig_user_id: igUserId },
        });
      } else {
        console.warn("❌ Unsupported platform:", platform);
        return;
      }

      const data = res.data?.data || res.data?.posts || [];
      console.log(`📥 Raw ${platform} posts:`, data);

      const formattedPosts = [];

      // 🟦 Facebook post formatting
      if (platform === "facebook" && Array.isArray(data)) {
        formattedPosts.push(
          ...data.map((item, i) => ({
            platform: "facebook",
            id: item.id || `fb_p_${i}`,
            caption: item.message?.split("\n")[0] || "(no caption)",
            content: item.message || "",
            time: item.created_time || new Date().toISOString(),
            username: item.from?.name || "Facebook User",
            avatar: item.from?.picture?.data?.url || "",
            mediaUrl: item.full_picture || "",
            permalink: item.permalink_url || "",
          }))
        );
      }

      // 🟣 Instagram post formatting
      if (platform === "instagram" && Array.isArray(data)) {
        formattedPosts.push(
          ...data.map((item, i) => ({
            platform: "instagram",
            id: item.id || `ig_p_${i}`,
            caption: item.caption?.split("\n")[0] || "(no caption)",
            content: item.caption || "",
            time: item.timestamp || new Date().toISOString(),
            username: item.username || "Instagram User",
            avatar: item.profile_picture_url || "", // optional, may not exist
            mediaUrl: item.media_url || "",
            permalink: item.permalink || "",
          }))
        );
      }

      console.log(`✅ Parsed ${platform} posts:`, formattedPosts);
      setPosts(formattedPosts);
    } catch (err) {
      console.error(`❌ Fetch ${platform} posts error:`, err);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  },
  [fbUser, fbPageId, fbInstagramId]
);

useEffect(() => {
  if (activeTab === "posts" && fbUser && selectedPlatform) {
    fetchPlatformPosts(selectedPlatform);
  }
}, [activeTab, fbUser, selectedPlatform, fetchPlatformPosts]);



  // --- fetch pages ---
 const fetchPages = useCallback(async () => {
    if (!fbUser?.accessToken) return;

    try {
      const res = await axios.get("https://graph.facebook.com/me/accounts", {
        params: { access_token: fbUser.accessToken },
      });

      const pagesData = res.data?.data || [];
      setPages(pagesData);

      if (pagesData.length > 0) {
        const firstPage = pagesData[0];
        localStorage.setItem("fbPageId", firstPage.id);
        localStorage.setItem("fbPageAccessToken", firstPage.access_token);
        setSelectedPage(firstPage);
      }

      console.log("✅ Pages fetched:", pagesData);
    } catch (err) {
      console.error("❌ Fetch Pages error:", err.response?.data || err.message);
      setPages([]);
    }
  }, [fbUser]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

useEffect(() => {
  const fetchUserPages = async () => {
    // The `fbUser` state should contain the User ID after the initial Facebook login.
    if (!fbUser || !fbUser.id) {
      console.warn("No user ID found, skipping fetchUserPages");
      return;
    }

    try {
      // ✅ CORRECT: Call your own backend endpoint, passing only the user's ID.
      const res = await axios.get(
        `/api/api/user-pages?userId=${fbUser.id}`
      );

      const pagesData = res.data?.pages || [];
      setPages(pagesData);
      console.log("✅ User Pages fetched securely:", pagesData);

      // ✅ CORRECT: Store only non-sensitive data in localStorage.
      if (pagesData.length > 0) {
        // --- FIX: Get the first element of the array ---
        const firstPage = pagesData[0];
        localStorage.setItem("fbPageId", firstPage.id);
        localStorage.setItem("fbPageName", firstPage.name);
        // Set the selected page state
        setSelectedPage(firstPage); 
      }
    } catch (err) {
      console.error(
        "❌ Failed to fetch Facebook pages from backend:",
        err.response?.data || err.message
      );
    }
  };

  // Only run the effect when the `fbUser` state is present and changes.
  if (fbUser) {
    fetchUserPages();
  }
}, [fbUser]); // Dependency array ensures the effect runs when `fbUser` changes




  // ---------------- Auto Fetch Data After Login ----------------

  // 1️⃣ Fetch pages right after Facebook login
useEffect(() => {
  const getPages = async () => {
    if (!fbUser) return;

    console.log("👤 fbUser set, fetching Facebook Pages...");
    await fetchPages(); // ⬅️ Call it here
  };

  getPages();
}, [fbUser, fetchPages]);

// useEffect(() => {
//   const loadData = async () => {
//     if (!fbUser || pages.length === 0) return;

//     console.log("👤 fbUser set, fetching data...");

//     const firstPage = pages[0];
//     if (!firstPage?.id || !firstPage?.access_token) {
//       console.warn("⚠️ Missing page id or token");
//       return;
//     }

//     try {
//       // ✅ 1️⃣ Fetch IG Business Account
//       const igAcc = await fetchIgBusinessAccount(firstPage.id, firstPage.access_token);
//       if (!igAcc?.ig_user_id) {
//         console.warn("⚠️ No IG user ID found for the page");
//         return;
//       }

//       // ✅ 2️⃣ Fetch all mentions (Facebook + IG + X)
//       await fetchAllMentions();

//       // ✅ 3️⃣ Fetch direct messages
//       await fetchDms();

//       // ✅ 4️⃣ Optionally fetch only Instagram mentions directly (if needed)
//       const igMentions = await fetchIgMentions(firstPage.access_token, igAcc.ig_user_id);
//       if (igMentions?.data) {
//         setMentions((prev) => [
//           ...prev,
//           ...igMentions.data.map((m, i) => ({
//             platform: "Instagram",
//             id: m.id || `ig_${i}`,
//             message: m.caption || "",
//             content: m.caption || "",
//             time: m.timestamp || new Date().toISOString(),
//             mediaId: m.id,
//             username: m.username || "Instagram User",
//             mediaUrl: m.media_url || "",
//             permalink: m.permalink || "",
//             replies: [],
//           })),
//         ]);
//       }
//     } catch (err) {
//       console.error("❌ Error fetching all data:", err);
//     }
//   };

//   loadData();
// }, [
//   fbUser,
//   pages,
//   fetchAllMentions,
//   fetchDms,
//   fetchIgBusinessAccount,
//   fetchIgMentions,
// ]);


  // ---------------- Reply to mention ----------------
const handleReply = async () => {
  if (!selectedMessage || !replyText.trim()) return;

  const accessToken = localStorage.getItem("fbAccessToken");

  if (!accessToken) {
    alert("⚠️ Access token not found. Please login again.");
    return;
  }

  // ✅ Optimistic UI: Show the reply immediately
  const newReply = {
    id: `r_${Date.now()}`,
    text: replyText.trim(),
    time: new Date().toISOString(),
    author: "You",
    isMe: true,
    sending: true,
  };

  const replyMessage = replyText.trim();
  setReplyText("");

  setMentions((prev) =>
    prev.map((m) =>
      m.id === selectedMessage.id
        ? { ...m, replies: [...(m.replies || []), newReply] }
        : m
    )
  );

  setSelectedMessage((prev) =>
    prev ? { ...prev, replies: [...(prev.replies || []), newReply] } : prev
  );

  try {
    let response;

    if (selectedMessage.platform === "Instagram") {
      console.log("🔍 Sending Instagram reply with:", {
        media_id: selectedMessage.id,
        comment_text: replyMessage,
        access_token: accessToken ? accessToken.slice(0, 10) + "..." : null,
      });

      // ✅ send JSON body + query param for token
      response = await axios.post(
        "http://127.0.0.1:8000/instagram/reply-to-mentions",
        {
          media_id: selectedMessage.id,
          comment_text: replyMessage,
        },
        {
          params: { access_token: accessToken },
        }
      );

      console.log("✅ Instagram reply sent:", response.data);
    } 
    else if (selectedMessage.platform === "Facebook") {
      console.log("🔍 Sending Facebook reply with:", {
        post_id: selectedMessage.id,
        message: replyMessage,
        access_token: accessToken ? accessToken.slice(0, 10) + "..." : null,
      });

      response = await axios.post(
        "http://127.0.0.1:8000/facebook/sent_private",
        {
          post_id: selectedMessage.id,
          message: replyMessage,
        },
        {
          params: { access_token: accessToken },
        }
      );

      console.log("✅ Facebook reply sent:", response.data);
    } 
    else if (selectedMessage.platform === "X") {
      alert("⚠️ X/Twitter reply feature coming soon!");
      throw new Error("X platform not implemented yet");
    }

    // ✅ SUCCESS — confirm UI
    if (response?.data?.success || response?.status === 200) {
      const confirmedReply = {
        ...newReply,
        sending: false,
        id:
          response.data?.response?.id ||
          response.data?.data?.id ||
          newReply.id,
      };

      setMentions((prev) =>
        prev.map((m) =>
          m.id === selectedMessage.id
            ? {
                ...m,
                replies: m.replies.map((r) =>
                  r.id === newReply.id ? confirmedReply : r
                ),
              }
            : m
        )
      );

      setSelectedMessage((prev) =>
        prev
          ? {
              ...prev,
              replies: prev.replies.map((r) =>
                r.id === newReply.id ? confirmedReply : r
              ),
            }
          : prev
      );

      console.log("✅ Reply confirmed and UI updated smoothly");
    } else {
      throw new Error(response?.data?.error || "Reply failed");
    }
  } catch (err) {
    console.error("❌ Error sending reply:", err);

    // ❌ revert optimistic update
    setMentions((prev) =>
      prev.map((m) =>
        m.id === selectedMessage.id
          ? {
              ...m,
              replies: m.replies.filter((r) => r.id !== newReply.id),
            }
          : m
      )
    );

    setSelectedMessage((prev) =>
      prev
        ? {
            ...prev,
            replies: prev.replies.filter((r) => r.id !== newReply.id),
          }
        : prev
    );

    setReplyText(replyMessage);
    const errorMsg = err.response?.data?.detail || err.message || "Failed to send reply";
    alert(`❌ Error: ${errorMsg}`);
  }
};


  // ---------------- Send DM ----------------
  const handleSendDm = async () => {
    if (!selectedDm || !dmText.trim()) return;

    const pageId = selectedPage?.id || localStorage.getItem("fbPageId");
    const pageAccessToken = selectedPage?.access_token || localStorage.getItem("fbPageAccessToken");
    const recipientId = selectedDm.userId;

    if (!pageId || !pageAccessToken) {
      alert("⚠️ Missing Page ID or Access Token. Please login again.");
      return;
    }

    if (!recipientId) {
      alert("⚠️ Recipient ID not found. Cannot send message.");
      return;
    }

    setLoading(true);

    // ✅ Optimistic UI update - Add message immediately
    const newMessage = {
      id: `dm_msg_${Date.now()}`,
      text: dmText.trim(),
      time: new Date().toISOString(),
      sender: "You",
      isMe: true,
    };

    const messageText = dmText.trim();
    const currentTime = new Date().toISOString();
    setDmText(""); // Clear input immediately

    // ✅ SMOOTH Update: Update both right panel AND left side list without visible reload
    setDms((prev) => {
      const updatedDms = prev.map((dm) =>
        dm.id === selectedDm.id
          ? {
              ...dm,
              messages: [...dm.messages, newMessage],
              lastMessage: messageText,
              time: currentTime,
            }
          : dm
      );
      
      // ✅ Move updated conversation to top of list smoothly
      const targetDm = updatedDms.find(dm => dm.id === selectedDm.id);
      const otherDms = updatedDms.filter(dm => dm.id !== selectedDm.id);
      return [targetDm, ...otherDms];
    });

    setSelectedDm((prev) =>
      prev
        ? {
            ...prev,
            messages: [...prev.messages, newMessage],
            lastMessage: messageText,
            time: currentTime,
          }
        : prev
    );

    // Scroll to bottom immediately
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }, 50);

try {
  // ✅ Prepare form data
  const formData = new FormData();
  formData.append("page_id", pageId);
  formData.append("access_token", pageAccessToken);
  formData.append("recipient_psid", recipientId); // must match backend param name!
  formData.append("message_text", messageText);

  // ✅ POST request
  const response = await axios.post(
    "http://127.0.0.1:8000/facebook/message/send",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  console.log("✅ Facebook DM sent:", response.data);


      if (response.data.success) {
        // ✅ Update the message ID with the real one from backend
        const realMessageId = response.data.response?.message_id;
        if (realMessageId) {
          setSelectedDm((prev) =>
            prev
              ? {
                  ...prev,
                  messages: prev.messages.map((msg) =>
                    msg.id === newMessage.id ? { ...msg, id: realMessageId } : msg
                  ),
                }
              : prev
          );
        }
        console.log("✅ Message confirmed by backend");
      } else {
        // ❌ Failed to send message - smoothly revert UI changes
        setDms((prev) => {
          const revertedDms = prev.map((dm) =>
            dm.id === selectedDm.id
              ? {
                  ...dm,
                  messages: dm.messages.filter((msg) => msg.id !== newMessage.id),
                  lastMessage: dm.messages.length > 1 ? dm.messages[dm.messages.length - 2].text : "",
                  time: dm.messages.length > 1 ? dm.messages[dm.messages.length - 2].time : dm.time,
                }
              : dm
          );
          
          // ✅ Re-sort by time without the failed message
          return revertedDms.sort((a, b) => new Date(b.time) - new Date(a.time));
        });

        setSelectedDm((prev) =>
          prev
            ? {
                ...prev,
                messages: prev.messages.filter((msg) => msg.id !== newMessage.id),
              }
            : prev
        );

        setDmText(messageText); // Restore the message text
        const errorMsg = response.data.error?.message || response.data.error || "Failed to send message";
        alert(`❌ Error: ${errorMsg}`);
      }
    } catch (err) {
      console.error("❌ Error sending DM:", err);
      
      // ❌ Failed to send message - smoothly revert UI changes
      setDms((prev) => {
        const revertedDms = prev.map((dm) =>
          dm.id === selectedDm.id
            ? {
                ...dm,
                messages: dm.messages.filter((msg) => msg.id !== newMessage.id),
                lastMessage: dm.messages.length > 1 ? dm.messages[dm.messages.length - 2].text : "",
                time: dm.messages.length > 1 ? dm.messages[dm.messages.length - 2].time : dm.time,
              }
            : dm
        );
        
        // ✅ Re-sort by time without the failed message
        return revertedDms.sort((a, b) => new Date(b.time) - new Date(a.time));
      });

      setSelectedDm((prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.filter((msg) => msg.id !== newMessage.id),
            }
          : prev
      );

      setDmText(messageText); // Restore the message text
      const errorMsg = err.response?.data?.detail || err.response?.data?.error || err.message || "Failed to send message";
      alert(`❌ Error: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDmClick = async (dm) => {
    setSelectedDm(dm);

    try {
      const res = await axios.get(`https://graph.facebook.com/v23.0/${dm.id}`, {
        params: {
          fields: "messages{message,from,created_time}",
          access_token: selectedPage.access_token, // ✅ Page token
        },
      });

      const fullMessages = (res.data?.messages?.data || [])
        .map((m) => ({
          id: m.id,
          text: m.message,
          time: m.created_time,
          sender: m.from?.name || "Unknown",
          isMe: m.from?.id === selectedPage.id, // ✅ match Page ID
        }))
        .reverse(); // ✅ Reverse to show oldest first, newest last

      setSelectedDm((prev) =>
        prev ? { ...prev, messages: fullMessages } : dm
      );
    } catch (err) {
      console.error("❌ Could not fetch conversation messages:", err.response?.data || err.message);
    }

    setDms((prev) =>
      prev.map((item) =>
        item.id === dm.id ? { ...item, unread: 0 } : item
      )
    );
  };

  //--------------------FB Post--------------------

const handleMakePost = async () => {
  if (saving) return;
  setSaving(true);

  if (!postContent.trim()) {
    alert("Please enter some text for your post");
    setSaving(false);
    return;
  }

  const pageId = localStorage.getItem("fbPageId");
  const pageAccessToken = localStorage.getItem("fbAccessToken");

  console.log("📌 Page ID:", pageId);
  console.log("🔑 Access Token:", pageAccessToken ? pageAccessToken.slice(0, 10) + "..." : null);

  if (!pageAccessToken || !pageId) {
    alert("⚠️ Missing Facebook credentials. Please log in again.");
    setSaving(false);
    return;
  }

  try {
    const formData = new FormData();
    formData.append("message", postContent);
    formData.append("page_id", pageId);
    formData.append("access_token", pageAccessToken);

    // --- Start of change ---
    // Always append photo_urls, providing an empty JSON list if no URLs are present.
    // This resolves the missing form field issue with FastAPI.
    formData.append("photo_urls", "[]");
    // --- End of change ---

    // Handle single or multiple photos
    if (selectedPhoto) {
      if (Array.isArray(selectedPhoto)) {
        selectedPhoto.forEach((file) => formData.append("image_files", file));
      } else {
        formData.append("image_files", selectedPhoto);
      }
    }

    // Debugging: show what we’re sending
    console.log("🚀 Sending POST request to backend:");
    for (let pair of formData.entries()) {
      console.log(`${pair[0]}:`, pair[1]);
    }

    // ✅ Make POST request
    const res = await axios.post(
      "http://127.0.0.1:8000/facebook/posts",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    console.log("✅ Post response:", res.data);

    if (res.data.success || res.status === 200) {
      alert("✅ Post created successfully!");
      
      // ✅ Clear form
      setPostContent("");
      setSelectedPhoto(null);
      setSelectedVideo(null);
      setShowPostForm(false);
      
      // ✅ Refresh posts to show the new post
      await fetchPosts();
    } else {
      alert("⚠️ Post creation response unclear. Check console.");
    }
  } catch (err) {
    console.error("❌ Create post error:", err);
    console.error("📥 Backend error response:", err?.response?.data);
    alert(`❌ Failed to create post: ${err?.response?.data?.detail || err.message}`);
  } finally {
    setSaving(false);
  }
};




  // ---------------- Facebook login ----------------
const handleFBLogin = () => {
  if (!window.FB || !fbReady) {
    alert("⚠️ Facebook SDK not ready yet, please wait a second.");
    return;
  }

  try {
    window.FB.login(
      (response) => {
        console.log("FB login response", response);
        setFbStatus(response?.status ?? "unknown");

        if (response.status === "connected") {
          const { userID, accessToken } = response.authResponse;

          // ✅ Fetch real user info from Graph API
          window.FB.api(
            "/me",
            { fields: "id,name,email,picture", access_token: accessToken },
            (userInfo) => {
              if (!userInfo || userInfo.error) {
                console.error("FB API error:", userInfo?.error);
                return;
              }

              // Combine user info
              const userData = {
                id: userInfo.id || userID,
                name: userInfo.name,
                email: userInfo.email,
                picture: userInfo.picture?.data?.url,
                accessToken,
              };

              setFbUser(userData);
              localStorage.setItem("fbUser", JSON.stringify(userData));

              // ✅ Send user info + token to backend
              axios.post("http://127.0.0.1:8000/facebook/auth", {
                access_token: accessToken,
                user_id: userInfo.id,
                name: userInfo.name,
                email: userInfo.email,
                picture: userInfo.picture?.data?.url,
              })
              .then((res) => {
                console.log("✅ Synced with backend", res.data);

                // ✅ Extract and store backend response (important!)
                const { page_id, instagram_business_id ,access_token} = res.data;
                localStorage.setItem("fbPageId", page_id || "");
                localStorage.setItem("fbInstagramId", instagram_business_id || "");
                localStorage.setItem("fbAccessToken", access_token || "");

                // Optional: update React state
                setFbPageId(page_id || null);
                setFbInstagramId(instagram_business_id || null);

                 fetchAllMentions();

                alert(`✅ Logged in successfully!`);  //-------------\nPage ID: ${page_id}\nInstagram ID: ${instagram_business_id ?? "N/A"}
              })
              .catch((err) => {
                console.error("❌ Backend sync error:", err);
                alert("⚠️ Backend sync failed. Check console for details.");
              });
            }
          );
        }
      },
      {
        scope: "public_profile,email,pages_read_engagement,pages_show_list,pages_manage_metadata,pages_read_user_content,pages_manage_posts,pages_messaging,instagram_basic,instagram_manage_comments,instagram_manage_messages,instagram_content_publish",
        return_scopes: true,
        auth_type: "rerequest"
      }
    );
  } catch (err) {
    console.error("FB.login error", err);
    alert("❌ FB login failed. Please refresh and try again.");
  }
};


  const handleLogout = () => {
    if (window.FB) {
      window.FB.logout(() => {
        console.log("Logged out from Facebook");
      });
    }
    setFbUser(null);
    setMentions([]);
    setDms([]);
    setPosts([]);
    setSelectedMessage(null);
    setSelectedDm(null);
    setFbStatus("unknown");

    // ✅ Remove from localStorage
    localStorage.removeItem("fbUser");
  };

    const navigate = useNavigate();

  const handleLogoutbutton = async () => {
    try {
      const res = await axios.post("http://127.0.0.1:8000/auth/logout", {}, {
        withCredentials: true, // Important: include cookies
      });
      if (res.data.success) {
        // Clear any frontend state if needed (like user context or localStorage)
        localStorage.removeItem("access_token"); // optional, if you store tokens
        navigate("/"); // Redirect to login page
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };



  // ---------------- Render ----------------
  return (
    <div className={`app-root ${darkMode ? "dark" : "light"}`} style={{ height: "100vh", display: "flex" }}>
      {/* Left Sidebar */}
      <aside className="nav-sidebar">
        <div className="nav-icon logo">
          <img src={logo} alt="logo" style={{ width: 28, height: 28 }} />
        </div>

        <button className={`nav-icon ${activeTab === "home" ? "active" : ""}`} onClick={() => setActiveTab("home")} title="Home">
          <Home style={{ width: 22, height: 22 }} />
        </button>

        <button className={`nav-icon ${activeTab === "mentions" ? "active" : ""}`} onClick={() => setActiveTab("mentions")} title="Mentions">
          <MessageSquare style={{ width: 22, height: 22 }} />
        </button>

        <button className={`nav-icon ${activeTab === "dms" ? "active" : ""}`} onClick={() => setActiveTab("dms")} title="Direct Messages">
          <Mail style={{ width: 22, height: 22 }} />
        </button>

        <button className={`nav-icon ${activeTab === "posts" ? "active" : ""}`} onClick={() => setActiveTab("posts")} title="Posts">
          <Image style={{ width: 22, height: 22 }} />
        </button>

        <button className={`nav-icon ${activeTab === "analytics" ? "active" : ""}`} onClick={() => setActiveTab("analytics")} title="Analytics">
          <BarChart3 style={{ width: 22, height: 22 }} />
        </button>

        <button className={`nav-icon ${activeTab === "reports" ? "active" : ""}`} onClick={() => setActiveTab("reports")} title="Reports">
          <FileText style={{ width: 22, height: 22 }} />
        </button>

        <button className={`nav-icon ${activeTab === "settings" ? "active" : ""}`} onClick={() => setActiveTab("settings")} title="Settings">
          <Settings style={{ width: 22, height: 22 }} />
        </button>

        <div style={{ marginTop: "auto", paddingBottom: 12 }}>
            <button
        className="theme-toggle"
        onClick={handleLogoutbutton}
        title="Logout"
      >
        <LogOut style={{ width: 18, height: 18 }} />
      </button>
          <button className="theme-toggle" onClick={() => toggleTheme()} title="Toggle theme">
            {darkMode ? <Sun style={{ width: 18, height: 18 }} /> : <Moon style={{ width: 18, height: 18 }} />}
          </button>
        </div>
      </aside>

      <main style={{ display: "flex", flex: 1, flexDirection: "column" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
            background: darkMode ? "#0f1720" : "#fff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>📲 Social Media Dashboard</h2>
            <span style={{ color: darkMode ? "#88a0c7" : "#4b5563", fontSize: 13 }}>
              {activeTab === "mentions" ? "Mentions" :
                activeTab === "dms" ? "Direct Messages" :
                  activeTab === "posts" ? "Posts" : ""}
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Status message */}
            <div style={{ fontSize: 13, color: darkMode ? "#cbd5e1" : "#374151", marginRight: 8 }}>
              {fbStatusMessage()}
            </div>

            {/* Login / Logout section */}
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {fbUser ? (
                <>
                  {/* ✅ Profile Picture + Name */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {fbUser.picture && (
                      <img
                        src={fbUser.picture}
                        alt={fbUser.name}
                        style={{ width: 32, height: 32, borderRadius: "50%" }}
                      />
                    )}
                    <div
                      style={{
                        fontSize: 13,
                        color: darkMode ? "#dbeafe" : "#1f2937",
                        fontWeight: 600,
                      }}
                    >
                      {fbUser.name}
                    </div>
                  </div>

                  {/* ✅ Logout button */}
                  <button
                    onClick={handleLogout}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: "#dc2626",
                      color: "#fff",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Logout
                  </button>
                </>
              ) : (
                <button
                  onClick={handleFBLogin}
                  disabled={!fbReady}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "none",
                    background: fbReady ? "#1877F2" : "#94a3b8",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: fbReady ? "pointer" : "not-allowed",
                  }}
                >
                  {fbReady ? "Login with Facebook" : "Loading..."}
                </button>
              )}
            </div>
          </div>
        </header>

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <section style={{ width: 320, borderRight: "1px solid rgba(0,0,0,0.06)", overflowY: "auto", padding: 16, background: darkMode ? "#071226" : "#f9fbff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>
                {activeTab === "mentions" ? "Mentions" :
                  activeTab === "dms" ? "Direct Messages" :
                    "Posts"}
              </h3>
              {/* <button
                onClick={() => {
                  // 🟦 Refresh only when user manually clicks the button
                  if (activeTab === "mentions") {
                    // 🔹 Only refresh if a platform is selected
                    if (selectedPlatform) {
                      fetchPlatformMentions(selectedPlatform);
                    } else {
                      alert("⚠️ Please select a platform first.");
                    }
                  } else if (activeTab === "dms") {
                    // 🔹 Refresh DMs only when Refresh button is clicked
                    fetchDms();
                  }
                }}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "none",
                  background: "#006CFC",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                {loading ? "Loading..." : "Refresh"}
              </button> */}

            </div>

            {/* ✅ Show IG User ID here */}
            {igUserId && (
              <div style={{ fontSize: 12, color: darkMode ? "#9aa7c7" : "#374151", marginBottom: 8 }}>
                ✅ Linked Instagram ID: <strong>{igUserId}</strong>
              </div>
            )}

            {/* {activeTab === "mentions" && (
              <>
                {!fbUser ? (
                  <div style={{ textAlign: "center", paddingTop: 30, color: darkMode ? "#9aa7c7" : "#6b7280" }}>
                    <MessageSquare style={{ width: 48, height: 48, margin: "0 auto 12px" }} />
                    <div>Please login to view mentions</div>
                    <div style={{ fontSize: 13, marginTop: 6 }}>Click the login button above</div>
                  </div>
                ) : mentions.length === 0 ? (
                  <div style={{ textAlign: "center", paddingTop: 30, color: darkMode ? "#9aa7c7" : "#6b7280" }}>
                    <MessageSquare style={{ width: 48, height: 48, margin: "0 auto 12px" }} />
                    <div>No mentions yet</div>
                    <div style={{ fontSize: 13, marginTop: 6 }}>{fbUser
                      ? "If you expected data, check Graph API permissions in backend."
                      : "Click Login to fetch mentions"}</div>
                  </div>
                ) : (
                  mentions.map((m) => (
                    <div
                      key={m.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMessage(m)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setSelectedMessage(m);
                        }
                      }}
                      style={{
                        display: "flex",
                        gap: 10,
                        padding: 12,
                        borderRadius: 10,
                        cursor: "pointer",
                        marginBottom: 10,
                        background: selectedMessage?.id === m.id ? "#006CFC" : darkMode ? "#0b1a2b" : "#eef7ff",
                        color: selectedMessage?.id === m.id ? "#fff" : darkMode ? "#e6eefc" : "#0b1c3a",
                      }}
                    >
                      {m.avatar ? (
                        <img
                          src={m.avatar}
                          alt={m.username}
                          style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }}
                        />
                      ) : (
                        <div style={{ width: 44, height: 44, borderRadius: 8, background: "#c7d9ff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                          {m.username ? m.username.charAt(0).toUpperCase() : "U"}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <strong>{m.username}<span style={{ fontSize: 12, opacity: 0.7 }}>({m.platform})</span></strong>
                          <small style={{ color: darkMode ? "#94a3b8" : "#6b7280", fontSize: 12 }}>
                            {m.time ? new Date(m.time).toLocaleString() : "Unknown time"}
                          </small>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 14, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{m.message || m.content || m.text || "(no text)"}</div>
                        {m.replies && m.replies.length > 0 && (
                          <div style={{ marginTop: 4, fontSize: 12, color: darkMode ? "#88a0c7" : "#4b5563", display: "flex", alignItems: "center", gap: 4 }}>
                            <MessageSquare size={12} /> {m.replies.length} {m.replies.length > 1 ? "replies" : "reply"}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </>
            )} */}

{activeTab === "mentions" && (
  <>
    {!selectedPlatform ? (
      // 🌐 Step 1: Platform Selector
      <div style={{ marginBottom: 16, textAlign: "center", marginTop: 30 }}>
        <div
          className="platform-select"
          style={{ display: "flex", gap: 12, justifyContent: "center" }}
        >
          {/* Instagram Button */}
          <button
            onClick={() => {
              setSelectedPlatform("instagram");
              fetchPlatformMentions("instagram"); // fetch mentions immediately
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: darkMode ? "#1f2937" : "#fff",
              color: darkMode ? "#f9fafb" : "#111827",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: "10px 16px",
              cursor: "pointer",
              boxShadow: darkMode
                ? "0 2px 6px rgba(0,0,0,0.3)"
                : "0 2px 6px rgba(0,0,0,0.1)",
              transition: "background 0.2s ease, transform 0.2s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = darkMode
                ? "#374151"
                : "#f3f4f6")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = darkMode
                ? "#1f2937"
                : "#fff")
            }
          >
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png"
              alt="Instagram"
              width={24}
              height={24}
            />
            Instagram
          </button>

          {/* Facebook Button */}
          <button
            onClick={() => {
              setSelectedPlatform("facebook");
              fetchPlatformMentions("facebook"); // fetch mentions immediately
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: darkMode ? "#1f2937" : "#fff",
              color: darkMode ? "#f9fafb" : "#111827",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: "10px 16px",
              cursor: "pointer",
              boxShadow: darkMode
                ? "0 2px 6px rgba(0,0,0,0.3)"
                : "0 2px 6px rgba(0,0,0,0.1)",
              transition: "background 0.2s ease, transform 0.2s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = darkMode
                ? "#374151"
                : "#f3f4f6")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = darkMode
                ? "#1f2937"
                : "#fff")
            }
          >
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/4/44/Facebook_Logo.png"
              alt="Facebook"
              width={24}
              height={24}
            />
            Facebook
          </button>
        </div>
      </div>
    ) : (
      // 🟢 Step 2: Show Mentions for Selected Platform
      <>
        {/* Top Bar with Back + Refresh */}
        <div
          style={{
            padding: "10px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <button
            onClick={() => setSelectedPlatform(null)}
            style={{
              background: "none",
              border: "none",
              color: darkMode ? "#9aa7c7" : "#0b1c3a",
              cursor: "pointer",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            ← Back
          </button>

          {/* ✅ Refresh button now inside platform section */}
          <button
            onClick={() => fetchPlatformMentions(selectedPlatform)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "none",
              background: "#006CFC",
              color: "#fff",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {/* Existing mention UI reused */}
        {!fbUser ? (
          <div
            style={{
              textAlign: "center",
              paddingTop: 30,
              color: darkMode ? "#9aa7c7" : "#6b7280",
            }}
          >
            <MessageSquare
              style={{ width: 48, height: 48, margin: "0 auto 12px" }}
            />
            <div>Please login to view {selectedPlatform} mentions</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>
              Click the login button above
            </div>
          </div>
        ) : loading ? (
          <div
            style={{
              textAlign: "center",
              paddingTop: 30,
              color: darkMode ? "#9aa7c7" : "#6b7280",
            }}
          >
            <MessageSquare
              style={{ width: 48, height: 48, margin: "0 auto 12px" }}
            />
            <div>Loading {selectedPlatform} mentions...</div>
          </div>
        ) : mentions.filter((m) => m.platform === selectedPlatform).length ===
          0 ? (
          <div
            style={{
              textAlign: "center",
              paddingTop: 30,
              color: darkMode ? "#9aa7c7" : "#6b7280",
            }}
          >
            <MessageSquare
              style={{ width: 48, height: 48, margin: "0 auto 12px" }}
            />
            <div>No {selectedPlatform} mentions yet</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>
              If you expected data, check Graph API permissions in backend.
            </div>
          </div>
        ) : (
          mentions
            .filter((m) => m.platform === selectedPlatform)
            .map((m) => (
              <div
                key={m.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedMessage(m)}
                onKeyDown={(e) =>
                  (e.key === "Enter" || e.key === " ") && setSelectedMessage(m)
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  borderRadius: 10,
                  cursor: "pointer",
                  marginBottom: 10,
                  background:
                    selectedMessage?.id === m.id
                      ? "#006CFC"
                      : darkMode
                      ? "#0b1a2b"
                      : "#eef7ff",
                  color:
                    selectedMessage?.id === m.id
                      ? "#fff"
                      : darkMode
                      ? "#e6eefc"
                      : "#0b1c3a",
                  transition: "background 0.2s ease",
                }}
              >
                {m.avatar ? (
                  <img
                    src={m.avatar}
                    alt={m.username}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: "#c7d9ff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                    }}
                  >
                    {m.username ? m.username.charAt(0).toUpperCase() : "U"}
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <strong
                      style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {m.username}
                    </strong>
                    <small
                      style={{
                        color: darkMode ? "#94a3b8" : "#6b7280",
                        fontSize: 12,
                        marginLeft: 8,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {m.time
                        ? new Date(m.time).toLocaleString()
                        : "Unknown"}
                    </small>
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 14,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {m.message || m.content || m.text || "(no text)"}
                  </div>
                </div>
              </div>
            ))
        )}
      </>
    )}
  </>
)}



{activeTab === "dms" && (
  <>
    {!selectedPlatform ? (
      // 🔹 PLATFORM SELECTION
      <div style={{ marginBottom: 16, textAlign: "center" }}>
        <div
          className="platform-select"
          style={{ display: "flex", gap: 12, justifyContent: "center" }}
        >
          <button
            onClick={() => setSelectedPlatform("instagram")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: darkMode ? "#1f2937" : "#fff",
              color: darkMode ? "#f9fafb" : "#111827",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: "10px 16px",
              cursor: "pointer",
            }}
          >
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png"
              alt="Instagram"
              width={24}
              height={24}
            />
            Instagram
          </button>

          <button
            onClick={() => setSelectedPlatform("facebook")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: darkMode ? "#1f2937" : "#fff",
              color: darkMode ? "#f9fafb" : "#111827",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: "10px 16px",
              cursor: "pointer",
            }}
          >
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/4/44/Facebook_Logo.png"
              alt="Facebook"
              width={24}
              height={24}
            />
            Facebook
          </button>
        </div>
      </div>
    ) : (
      // 🔹 PLATFORM VIEW (Facebook or Instagram)
      <div>
        {/* 🔙 BACK + REFRESH BUTTONS */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => {
                setSelectedPlatform(null);
                setSelectedDm(null);
                // retain selectedPage and token
              }}
              style={{
                background: "none",
                border: "none",
                color: darkMode ? "#60a5fa" : "#2563eb",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <IoArrowBackCircleOutline />
              Back
            </button>

            <h3
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginLeft: 8,
                marginBottom: 0,
              }}
            >
              {selectedPlatform === "facebook" ? (
                <>
                  <img
                    src="https://img.icons8.com/?size=96&id=20419&format=png"
                    alt="Messenger"
                    width={24}
                    height={24}
                  />
                  Messenger
                </>
              ) : (
                <>
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg"
                    alt="Instagram"
                    width={24}
                    height={24}
                  />
                  Instagram Messages
                </>
              )}
            </h3>
          </div>

          {/* ✅ Refresh Button */}
          <button
            onClick={() => fetchDms()}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "none",
              background: "#006CFC",
              color: "#fff",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {/* 🔽 PAGE SELECTOR */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
            Select Page: *
          </label>
          <select
            value={selectedPage?.id || ""}
            onChange={(e) => {
              const page = pages.find((p) => p.id === e.target.value);
              if (page) {
                localStorage.setItem(`page_token_${page.id}`, page.access_token);
                setSelectedPage(page);
              }
            }}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              background: darkMode ? "#374151" : "#fff",
              color: darkMode ? "#f3f4f6" : "#111827",
            }}
          >
            <option value="">-- Select Page --</option>
            {pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.name}
              </option>
            ))}
          </select>
        </div>

        {/* 🔽 MESSAGE LIST */}
        {!fbUser ? (
          <div
            style={{
              textAlign: "center",
              paddingTop: 30,
              color: darkMode ? "#9aa7c7" : "#6b7280",
            }}
          >
            <Mail style={{ width: 48, height: 48, margin: "0 auto 12px" }} />
            <div>Please login to view messages</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>
              Click the login button above
            </div>
          </div>
        ) : dms.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              paddingTop: 30,
              color: darkMode ? "#9aa7c7" : "#6b7280",
            }}
          >
            <Mail style={{ width: 48, height: 48, margin: "0 auto 12px" }} />
            <div>No messages yet</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>
              Select a page and click Refresh
            </div>
          </div>
        ) : (
          dms.map((dm) => (
            <div
              key={dm.id}
              onClick={() => handleDmClick(dm)}
              style={{
                display: "flex",
                gap: 10,
                padding: 12,
                borderRadius: 10,
                cursor: "pointer",
                marginBottom: 10,
                background:
                  selectedDm?.id === dm.id
                    ? "#006CFC"
                    : darkMode
                    ? "#0b1a2b"
                    : "#eef7ff",
                color:
                  selectedDm?.id === dm.id
                    ? "#fff"
                    : darkMode
                    ? "#e6eefc"
                    : "#0b1c3a",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  backgroundColor: darkMode ? "#1e3a5f" : "#e0e7ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                {dm.avatar ? (
                  <img
                    src={dm.avatar}
                    alt={dm.username}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.parentElement.innerHTML = `<div style="color: ${
                        darkMode ? "#fff" : "#4f46e5"
                      }; font-weight: 600; font-size: 18px;">${
                        dm.username?.charAt(0)?.toUpperCase() || "?"
                      }</div>`;
                    }}
                  />
                ) : (
                  <div
                    style={{
                      color: darkMode ? "#fff" : "#4f46e5",
                      fontWeight: 600,
                      fontSize: 18,
                    }}
                  >
                    {dm.username?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <strong>{dm.username}</strong>
                  {dm.unread > 0 && (
                    <span
                      style={{
                        background: "#ef4444",
                        color: "white",
                        borderRadius: "50%",
                        width: 20,
                        height: 20,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                      }}
                    >
                      {dm.unread}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 14,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {dm.lastMessage || "(no message)"}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color: darkMode ? "#94a3b8" : "#6b7280",
                  }}
                >
                  {new Date(dm.time).toLocaleString()}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    )}
  </>
)}


{activeTab === "posts" && (
  <div style={{ padding: 16 }}>
    {!fbUser ? (
      // 🔹 Show login message if not logged in
      <div style={{ textAlign: "center", paddingTop: 30, color: darkMode ? "#9aa7c7" : "#6b7280" }}>
        <Image style={{ width: 48, height: 48, margin: "0 auto 12px" }} />
        <div>Please login to view and create posts</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>Click the login button above</div>
      </div>
    ) : (
      <>
        {/* 🔹 STEP 1 — Select Platform (only shown initially) */}
        {!selectedPlatform && (
          <div style={{ textAlign: "center", marginTop: 40 }}>
            <h3>Select a Platform to Manage Posts</h3>
            <div style={{ display: "flex", flexDirection:"column", gap: 12, justifyContent: "center" }}>

              {/* Instagram */}
              <button
                onClick={() => {
                  setSelectedPlatform("instagram");
                  fetchPlatformPosts("instagram");
                }}
               style={{
                 display: "flex",
                 alignItems: "center",
                 gap: 8,
                 background: darkMode ? "#1f2937" : "#fff",
                 color: darkMode ? "#f9fafb" : "#111827",
                 border: "1px solid #d1d5db",
                 borderRadius: 8,
                 padding: "10px 16px",
                 cursor: "pointer",
                }}
              >
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png"
                  alt="Instagram"
                  width={24}
                  height={24}
                />
                  Instagram
              </button>

              {/* Facebook */}
              <button
                onClick={() => {
                  setSelectedPlatform("facebook");
                  fetchPlatformPosts("facebook");
                }}
               style={{
                 display: "flex",
                 alignItems: "center",
                 gap: 8,
                 background: darkMode ? "#1f2937" : "#fff",
                 color: darkMode ? "#f9fafb" : "#111827",
                 border: "1px solid #d1d5db",
                 borderRadius: 8,
                 padding: "10px 16px",
                 cursor: "pointer",
                }}
              >
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/4/44/Facebook_Logo.png"
                  alt="Facebook"
                  width={24}
                  height={24}
                />
                  Facebook  
              </button>
            </div>
          </div>
        )}

        {/* 🔹 STEP 2 — Show Posts and Create Form when a platform is selected */}
        {selectedPlatform && (
          <>
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >

              <div style={{ display: "flex", gap: 8 }}>
                {/* Back Button */}
                <button
                  onClick={() => setSelectedPlatform(null)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "none",
                    background: "#6b7280",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  ← Back
                </button>
                
                  <h3 style={{ margin: 0 }}>
                    {selectedPlatform === "instagram" ? "Instagram Posts" : "Facebook Posts"}
                  </h3>

                {/* Create Post Button */}
                <button
                  onClick={() => setShowPostForm(!showPostForm)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "none",
                    background: showPostForm ? "#dc2626" : "#006CFC",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  {showPostForm ? "Cancel" : "+ Create Post"}
                </button>

                {/* Refresh Button */}
                <button
                  onClick={() => fetchPlatformPosts(selectedPlatform)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "none",
                    background: "#006CFC",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  {loading ? "Loading..." : "Refresh"}
                </button>
              </div>
            </div>

            {/* Post Creation Form */}
            {showPostForm && (
              <div
                style={{
                  background: darkMode ? "#1f2937" : "#f9fafb",
                  padding: 20,
                  borderRadius: 12,
                  marginBottom: 20,
                }}
              >
                                       <h4 style={{ marginBottom: 16 }}>Create New Post</h4>

                        <div style={{ marginBottom: 16 }}>
                          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                            Write Post: *
                          </label>
                          <textarea
                            value={postContent}
                            onChange={(e) => setPostContent(e.target.value)}
                            placeholder="Write your post content here..."
                            rows={4}
                            style={{
                              width: '100%',
                              padding: '12px',
                              borderRadius: '8px',
                              border: '1px solid #d1d5db',
                              background: darkMode ? '#374151' : '#fff',
                              color: darkMode ? '#f3f4f6' : '#111827',
                              resize: 'vertical'
                            }}
                          />
                        </div>

                        <div style={{ marginBottom: 16 }}>
                          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                            Select Page: *
                          </label>
                          <select
                            value={selectedPage?.id || ""}
                            onChange={(e) => {
                              const page = pages.find((p) => p.id === e.target.value);
                              setSelectedPage(page || null); // store the whole object
                              setDms([]);
                            }}
                            style={{
                              width: '100%',
                              padding: '12px',
                              borderRadius: '8px',
                              border: '1px solid #d1d5db',
                              background: darkMode ? '#374151' : '#fff',
                              color: darkMode ? '#f3f4f6' : '#111827'
                            }}
                          >
                            <option value="">-- Select Page --</option>
                            {pages.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                            Upload Media (optional):
                          </label>
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <label style={{
                              padding: '10px 16px',
                              border: selectedPhoto ? '2px solid #10b981' : '1px solid #d1d5db',
                              borderRadius: '8px',
                              background: darkMode ? '#4b5563' : '#e5e7eb',
                              cursor: selectedVideo ? 'not-allowed' : 'pointer',
                              display: 'inline-block'
                            }}>
                              <input
                                type="file"
                                accept="image/*"
                                disabled={!!selectedVideo}
                                onChange={(e) => setSelectedPhoto(e.target.files[0])}
                                style={{ display: 'none' }}
                              />
                              {selectedPhoto ? '✓ Photo Selected' : 'Upload Photo'}
                            </label>

                            <label style={{
                              padding: '10px 16px',
                              border: selectedVideo ? '2px solid #10b981' : '1px solid #d1d5db',
                              borderRadius: '8px',
                              background: darkMode ? '#4b5563' : '#e5e7eb',
                              cursor: selectedPhoto ? 'not-allowed' : 'pointer',
                              display: 'inline-block'
                            }}>
                              <input
                                type="file"
                                accept="video/*"
                                disabled={!!selectedPhoto}
                                onChange={(e) => setSelectedVideo(e.target.files[0])}
                                style={{ display: 'none' }}
                              />
                              {selectedVideo ? '✓ Video Selected' : 'Upload Video'}
                            </label>
                          </div>
                          {/* <small style={{ color: darkMode ? '#94a3b8' : '#6b7280', marginTop: 4, display: 'block' }}>
                            * Required: Please upload either a photo or video
                          </small> */}
                        </div>

                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <button
                            onClick={handleMakePost}
                            disabled={saving}
                            style={{
                              padding: '12px 20px',
                              border: 'none',
                              borderRadius: '8px',
                              background: saving ? '#6b7280' : '#10b981',
                              color: 'white',
                              cursor: saving ? 'not-allowed' : 'pointer',
                              opacity: saving ? 0.7 : 1
                            }}
                          >
                            {saving ? "Posting..." : "Save Post"}
                          </button>

                          <button
                            onClick={() => setShowPostForm(false)}
                            disabled={saving}
                            style={{
                              padding: '12px 20px',
                              border: '1px solid #d1d5db',
                              borderRadius: '8px',
                              background: darkMode ? '#374151' : '#f9fafb',
                              cursor: saving ? 'not-allowed' : 'pointer',
                              opacity: saving ? 0.7 : 1
                            }}
                          >
                            Cancel
                          </button>
                        </div>
              </div>
            )}

            {/* Posts Display */}
            {!showPostForm && (
              posts.length === 0 ? (
                <div style={{ textAlign: "center", paddingTop: 30, color: darkMode ? "#9aa7c7" : "#6b7280" }}>
                  <Image style={{ width: 48, height: 48, margin: "0 auto 12px" }} />
                  <div>No posts found</div>
                  <div style={{ fontSize: 13, marginTop: 6 }}>
                    Click "Refresh" or "Create Post" to get started
                  </div>
                </div>
              ) : (
                <div>
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      onClick={() => setSelectedPost(post)}
                      style={{
                        padding: 16,
                        borderRadius: 10,
                        marginBottom: 12,
                        background: darkMode ? "#1f2937" : "#fff",
                        border: "1px solid " + (darkMode ? "#374151" : "#e5e7eb"),
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {post.authorImage && (
                            <img
                              src={post.authorImage}
                              alt={post.authorName}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                objectFit: "cover",
                              }}
                            />
                          )}
                          <div>
                            <strong style={{ fontSize: 16 }}>
                              {post.caption || post.content.slice(0, 30)}
                            </strong>
                            <div
                              style={{
                                fontSize: 12,
                                color: darkMode ? "#94a3b8" : "#6b7280",
                                marginTop: 4,
                              }}
                            >
                              Posted by: {post.authorName || post.page}
                            </div>
                          </div>
                        </div>
                        <small
                          style={{
                            color: darkMode ? "#94a3b8" : "#6b7280",
                            fontSize: 12,
                          }}
                        >
                          {new Date(post.timestamp).toLocaleDateString()}
                        </small>
                      </div>

                      <p
                        style={{
                          marginBottom: 12,
                          color: darkMode ? "#d1d5db" : "#374151",
                        }}
                      >
                        {post.content.length > 150
                          ? post.content.slice(0, 150) + "..."
                          : post.content}
                      </p>

                      {post.mediaUrl && (
                        <img
                          src={post.mediaUrl}
                          alt="Post"
                          style={{
                            width: "100%",
                            maxHeight: 300,
                            objectFit: "cover",
                            borderRadius: 8,
                            marginTop: 8,
                          }}
                          onError={(e) => {
                            console.log("Image load error for:", post.mediaUrl);
                            e.target.style.display = "none";
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </>
        )}
      </>
    )}
  </div>
)}


          </section>

          {/* Chat / message viewer */}
          <section style={{ flex: 1, display: "flex", flexDirection: "column", padding: 20, overflow: "hidden" }}>
            {activeTab === "posts" && selectedPost ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {/* ✅ Show author avatar or default */}
                    <div 
                      style={{ 
                        width: 48, 
                        height: 48, 
                        borderRadius: 10, 
                        background: selectedPost.authorImage ? "transparent" : "#c7d9ff", 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center", 
                        fontWeight: 700,
                        overflow: "hidden"
                      }}
                    >
                      {selectedPost.authorImage ? (
                        <img
                          src={selectedPost.authorImage}
                          alt={selectedPost.authorName}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        selectedPost.authorName?.charAt(0)?.toUpperCase() || "P"
                      )}
                    </div>
                    <div>
                        <div style={{ fontWeight: 700 }}>
                          {selectedPost.authorName || "Your Post"}
                        </div>
                        <div style={{ fontSize: 13, color: darkMode ? "#9aa7c7" : "#6b7280" }}>
                          {selectedPost.platform
                            ? selectedPost.platform === "facebook"
                              ? "Facebook"
                              : "Instagram"
                            : "Unknown Platform"}
                        </div>
                    </div>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 12, borderRadius: 10, background: darkMode ? '#071226' : '#fff', marginBottom: 12 }}>
                  <div style={{ marginBottom: 20 }}>
                    <h3>{selectedPost.caption}</h3>
                    <p style={{ marginBottom: 16 }}>{selectedPost.content}</p>
                    {selectedPost.mediaUrl && (
                      <img
                        src={selectedPost.mediaUrl}
                        alt="Post"
                        style={{
                          maxWidth: '100%',
                          maxHeight: 300,
                          borderRadius: 12,
                          objectFit: 'cover',
                          border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`
                        }}
                      />
                    )}
                    <div style={{ marginTop: 12, fontSize: 12, color: darkMode ? '#94a3b8' : '#64748b' }}>
                      Posted on: {new Date(selectedPost.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              </>
            ) : activeTab === "mentions" && selectedMessage ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    {selectedMessage.avatar ? (
                      <img
                        src={selectedMessage.avatar}
                        alt={selectedMessage.username}
                        style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: 8, background: "#c7d9ff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                        {selectedMessage.username ? selectedMessage.username.charAt(0).toUpperCase() : "U"}
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 700 }}>{selectedMessage.username}</div>
                      <div style={{ fontSize: 13, color: darkMode ? "#9aa7c7" : "#6b7280" }}>
                        {selectedMessage.platform || "Social Media"}
                      </div>

                      {/* ✅ View Profile Button */}
                      <a href={selectedMessage.profileUrl} target="_blank" rel="noopener noreferrer">
                        <button
                          style={{
                            marginTop: 6,
                            padding: "4px 10px",
                            fontSize: 12,
                            borderRadius: 6,
                            border: "1px solid rgba(0,0,0,0.1)",
                            background: "#006CFC",
                            color: "#fff",
                            cursor: "pointer"
                          }}
                        >
                          View Profile
                        </button>
                      </a>
                    </div>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: 12, borderRadius: 10, background: darkMode ? "#071226" : "#fff", marginBottom: 12 }}>
                  {/* Original message from user (left side) */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "flex-start" }}>
                      <div style={{
                        maxWidth: "70%",
                        padding: "12px 16px",
                        borderRadius: "18px 18px 18px 4px",
                        background: darkMode ? "#1e293b" : "#f1f5f9",
                        color: darkMode ? "#e2e8f0" : "#334155"
                      }}>
                        <div style={{ marginBottom: 8, fontSize: 15 }}>{selectedMessage.message}</div>
                        {selectedMessage.mediaUrl && (
                          <div style={{ margin: "10px 0", textAlign: "center" }}>
                            <img
                              src={selectedMessage.mediaUrl}
                              alt="mention"
                              style={{
                                maxWidth: "100%",
                                maxHeight: 200,
                                borderRadius: 12,
                                objectFit: "cover",
                                border: `1px solid ${darkMode ? "#334155" : "#e2e8f0"}`
                              }}
                            />
                          </div>
                        )}
                        <div style={{ marginTop: 12, fontSize: 12, color: darkMode ? "#94a3b8" : "#64748b", textAlign: "right" }}>
                          {selectedMessage.time
                            ? new Date(selectedMessage.time).toLocaleString()
                            : "Unknown time"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Replies list (right side for user replies) */}
                  {(selectedMessage.replies || []).length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8, paddingLeft: 8 }}>Replies</div>
                      {(selectedMessage.replies || []).map((r) => (
                        <div key={r.id} style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "flex-start" }}>
                          {/* Avatar Circle */}
                          <div style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: "#006CFC",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 700
                          }}>
                            {r.author ? r.author.charAt(0).toUpperCase() : "Y"}
                          </div>

                          {/* Reply Bubble */}
                          <div style={{
                            maxWidth: "70%",
                            padding: "12px 16px",
                            borderRadius: "18px 18px 4px 18px",
                            background: "#006CFC",
                            color: "#fff"
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{r.author}</div>
                            <div style={{ fontSize: 14 }}>{r.text}</div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", textAlign: "right", marginTop: 6 }}>
                              {r.time ? new Date(r.time).toLocaleString() : "Unknown time"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <textarea
                      aria-label="Reply to mention"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleReply();
                        }
                      }}
                      placeholder="Type your reply and press Enter"
                      style={{
                        flex: 1,
                        padding: 12,
                        borderRadius: 8,
                        border: "1px solid rgba(0,0,0,0.08)",
                        minHeight: 48,
                        resize: "vertical",
                        background: darkMode ? "#0b1a2b" : "#fff",
                        color: darkMode ? "#e6eefc" : "#0b1c3a",
                      }}
                    />
                    <button
                      aria-label="Send reply"
                      onClick={handleReply}
                      disabled={!replyText.trim()}
                      style={{
                        background: "#006CFC",
                        color: "#fff",
                        border: "none",
                        padding: "10px 12px",
                        borderRadius: 8,
                        cursor: replyText.trim() ? "pointer" : "not-allowed",
                      }}
                    >
                      <Send style={{ width: 16, height: 16 }} />
                    </button>
                  </div>
                  <small style={{ fontSize: 12, color: darkMode ? "#94a3b8" : "#64748b" }}>
                    Press Enter to send, Shift+Enter for new line
                  </small>
                </div>
              </>
            ) : activeTab === "dms" && selectedDm ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 10,
                        backgroundColor: darkMode ? "#1e3a5f" : "#e0e7ff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        flexShrink: 0,
                      }}
                    >
                      {selectedDm.avatar ? (
                        <img
                          src={selectedDm.avatar}
                          alt={selectedDm.username}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.parentElement.innerHTML = `<div style="color: ${darkMode ? '#fff' : '#4f46e5'}; font-weight: 600; font-size: 20px;">${selectedDm.username?.charAt(0)?.toUpperCase() || '?'}</div>`;
                          }}
                        />
                      ) : (
                        <div style={{ color: darkMode ? "#fff" : "#4f46e5", fontWeight: 600, fontSize: 20 }}>
                          {selectedDm.username?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{selectedDm.username}</div>
                      <div style={{ fontSize: 13, color: darkMode ? "#9aa7c7" : "#6b7280" }}>{selectedDm.fullName}</div>
                    </div>
                  </div>
                </div>

                <div className="chat-messages">
                  {selectedDm.messages.map((msg) => (
                    <div 
                      key={msg.id} 
                      className={`message ${msg.isMe ? 'outgoing' : 'incoming'}`}
                    >
                      <div className="message-content">
                        {!msg.isMe && (
                          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{msg.sender}</div>
                        )}
                        <p>{msg.text}</p>
                      </div>
                      <div className="message-time">
                        {new Date(msg.time).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} /> {/* 👈 auto-scroll target */}
                </div>

                <div className="chat-input">
                  <div className="input-container">
                    <textarea
                      value={dmText}
                      onChange={(e) => setDmText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendDm();
                        }
                      }}
                      placeholder="Type your message and press Enter"
                      className="message-input"
                    />
                    <button
                      type="button"
                      onClick={handleSendDm}
                      disabled={!dmText.trim()}
                      className="send-button"
                      style={{
                        background: dmText.trim() ? "#006CFC" : "#9ca3af",
                        borderRadius: "8px",
                        cursor: dmText.trim() ? "pointer" : "not-allowed",
                      }}
                    >
                      <Send style={{ width: 16, height: 16 }} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", margin: "auto", color: darkMode ? "#9aa7c7" : "#6b7280" }}>
                {activeTab === "mentions" ? (
                  <>
                    <MessageSquare style={{ width: 72, height: 72, margin: "0 auto 12px" }} />
                    <div style={{ fontSize: 18, fontWeight: 600 }}>
                      {fbUser ? "Select a mention to view" : "Login to view mentions"}
                    </div>
                    <div style={{ marginTop: 8, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
                      {fbUser
                        ? "Choose a message from the left to start viewing and replying. Use the Refresh button to fetch latest mentions."
                        : "Please login using the button in the header to view and reply to mentions."
                      }
                    </div>
                  </>
                ) : activeTab === "dms" ? (
                  <>
                    <Mail style={{ width: 72, height: 72, margin: "0 auto 12px" }} />
                    <div style={{ fontSize: 18, fontWeight: 600 }}>
                      {fbUser ? "Select a conversation to view" : "Login to view messages"}
                    </div>
                    <div style={{ marginTop: 8, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
                      {fbUser
                        ? "Choose a conversation from the left to start messaging."
                        : "Please login using the button in the header to view and send messages."
                      }
                    </div>
                  </>
                ) : (
                  <>
                    <Image style={{ width: 72, height: 72, margin: "0 auto 12px" }} />
                    <div style={{ fontSize: 18, fontWeight: 600 }}>Posts Overview</div>
                    <div style={{ marginTop: 8, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
                      View your Instagram posts and their performance metrics.
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      </main >
    </div >
  );
};

export default Dashboard;