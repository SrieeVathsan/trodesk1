import { useState, useEffect, useRef, useCallback } from "react";
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
} from "lucide-react";
import axios from "axios";
import logo from "./assets/logo.png";
import "./App.css";

const FB_SDK_POLL_INTERVAL = 300; // ms
const FB_SDK_POLL_ATTEMPTS = 30;

const App = () => {
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
    if (!fbUser) {
      alert("Please login first to view mentions");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get("http://localhost:8000/all/mentions");

      const data = res.data || {};
      console.log("📥 Raw mentions response:", JSON.stringify(data, null, 2));

      const allMentions = [];

      // Facebook
      if (Array.isArray(data.facebook)) {
        allMentions.push(
          ...data.facebook.map((item, i) => ({
            platform: "Facebook",
            id: item.id || `fb_m_${i}`,
            message: item.text || item.message || "",
            content: item.caption || "",
            time: item.timestamp || new Date().toISOString(),
            mediaId: item.media_id || item.id || `fb_media_${i}`,
            username: item.username || "Facebook User",
            mediaUrl: item.media_url || "",
            permalink: item.permalink || "",
            replies: item.replies || [],
            avatar: item.avatar || null,
            followers: item.followers || "N/A",
            messages: item.messages || 0,
            lastActive: item.last_active || "Unknown",
            profileUrl: item.profile_url || item.permalink || "#",
          }))
        );
      }

      // Instagram
      if (Array.isArray(data.instagram?.data)) {
        allMentions.push(
          ...data.instagram.data.map((item, i) => ({
            platform: "Instagram",
            id: item.id || `ig_m_${i}`,
            message: item.caption || "",
            content: item.caption || "",
            time: item.timestamp || new Date().toISOString(),
            mediaId: item.id || `ig_media_${i}`,
            username: item.username || "Instagram User",
            mediaUrl: item.media_url || "",
            permalink: item.permalink || "",
            replies: [],
            avatar: item.avatar || null,
            followers: item.followers || "N/A",
            messages: item.messages || 0,
            lastActive: item.last_active || "Unknown",
            profileUrl: item.profile_url || item.permalink || "#",
          }))
        );
      }

      // X (Twitter)
      if (Array.isArray(data.x?.data)) {
        allMentions.push(
          ...data.x.data.map((item, i) => ({
            platform: "X",
            id: item.id || `x_m_${i}`,
            message: item.text || "",
            content: item.text || "",
            time: item.created_at || new Date().toISOString(),
            username: item.author_id || "X User",   // replace with actual author lookup if backend provides it
            mediaId: item.id || `x_media_${i}`,
            mediaUrl: item.media_url || "",
            permalink: item.permalink || "",
            replies: [],
            avatar: item.avatar || null,
            followers: item.followers || "N/A",
            messages: item.messages || 0,
            lastActive: item.last_active || "Unknown",
            profileUrl: item.profile_url || `https://x.com/${item.username || item.author_id}`,
          }))
        );
      }

      // ✅ Final log before updating state
      console.log("✅ Parsed mentions:", allMentions);

      if (data.x?.error) {
        console.warn("❌ X API error:", data.x);
        alert(`Twitter API error: ${data.x.message || "Unknown error"}`);
      }
      if (Array.isArray(data.facebook) && data.facebook.length === 0) {
        console.warn("⚠️ No Facebook mentions. Token may lack permissions.");
      }
      if (Array.isArray(data.instagram?.data) && data.instagram.data.length === 0) {
        console.warn("⚠️ No Instagram mentions (tags) found.");
      }

      setMentions(allMentions);
    } catch (err) {
      console.error("Fetch All Mentions error:", err);
      setMentions([]);
    } finally {
      setLoading(false);
    }
  }, [fbUser]);

  // ---------------- Fetch DMs ----------------
  const fetchDms = useCallback(async () => {
    if (!fbUser) {
      alert("Please login first to view DMs");
      return;
    }
    if (!selectedPage?.access_token) {
      alert("Please select a Facebook Page first.");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get("http://localhost:8000/facebook/conversations", {
        params: {
          page_id: selectedPage.id,
          access_token: selectedPage.access_token, // ✅ Page token
        },
      });

      const conversations = res.data?.conversations || [];

      const dmsFormatted = conversations.map((item) => {
        const participants = item.participants?.data || [];
        const firstUser = participants[0] || {};
        const lastMsg = (item.messages?.data || [])[0] || {};

        const formattedMessages = (item.messages?.data || []).map((m) => ({
          id: m.id || `msg_${Date.now()}`,
          text: m.message || "",
          time: m.created_time || new Date().toISOString(),
          sender: m.from?.name || "Unknown",
          isMe: m.from?.id === selectedPage.id, // ✅ check against Page ID
        }));

        return {
          id: item.id,
          username: firstUser.name || "Unknown",
          fullName: firstUser.name || "",
          avatar: firstUser.id
            ? `https://graph.facebook.com/${firstUser.id}/picture?type=normal&access_token=${selectedPage.access_token}`
            : "/default-avatar.png",
          lastMessage: lastMsg.message || "",
          time: lastMsg.created_time || item.updated_time,
          unread: 0,
          userId: item.id,
          messages: formattedMessages,
        };
      });

      setDms(dmsFormatted);
    } catch (err) {
      console.error("Fetch DMs error:", err.response?.data || err.message);
      setDms([]);
    } finally {
      setLoading(false);
    }
  }, [fbUser, selectedPage]);

  useEffect(() => {
    if (selectedPage?.access_token) {
      fetchDms(); // auto-fetch when page changes
    }
  }, [selectedPage, fetchDms]);


  // ---------------- Fetch IG Business Account ----------------
  const fetchIgBusinessAccount = useCallback(async (pageId, pageAccessToken) => {
    try {
      const res = await axios.get("http://localhost:8000/instagram/business-account", {
        params: {
          page_id: pageId,
          page_access_token: pageAccessToken,
        },
      });

      console.log("✅ IG Business Account:", res.data);

      if (res.data?.ig_user_id) {
        setIgUserId(res.data.ig_user_id); // ✅ Save IG User ID
      }

      return res.data;
    } catch (err) {
      console.error("❌ Fetch IG Business Account error:", err.response?.data || err.message);
      alert("Failed to fetch Instagram Business Account.");
      return null;
    }
  }, []);

  // ---------------- Fetch IG Mentions ----------------
  const fetchIgMentions = useCallback(async (accessToken, userId) => {
    if (!accessToken || !userId) {
      console.warn("⚠️ Missing IG access token or user ID");
      return;
    }

    try {
      const res = await axios.get("http://localhost:8000/instagram/mentions", {
        params: {
          access_token: accessToken,
          ig_user_id: userId,
        },
      });

      console.log("✅ IG Mentions:", res.data);
      return res.data;
    } catch (err) {
      console.error("❌ Fetch IG Mentions error:", err.response?.data || err.message);
      return null;
    }
  }, []);

  // // ---------------- Fetch Posts ----------------
  // const fetchPosts = useCallback(async () => {
  //   if (!fbUser?.accessToken) {
  //     alert("Please login first to view posts");
  //     return;
  //   }

  //   setLoading(true);
  //   try {
  //     const res = await axios.get(
  //       `https://graph.facebook.com/v23.0/${process.env.REACT_APP_FB_PAGE_ID}/posts`,
  //       {
  //         params: {
  //           fields: "id,message,created_time,full_picture,permalink_url",
  //           access_token: fbUser.accessToken,
  //         },
  //       }
  //     );

  //     const data = res.data?.data || [];
  //     const postsFormatted = data.map((item, i) => ({
  //       id: item.id || `post_${i}`,
  //       caption: item.message?.split("\n")[0] || "(no caption)",
  //       content: item.message || "",
  //       page: "Facebook Page",
  //       timestamp: item.created_time || new Date().toISOString(),
  //       mediaUrl: item.full_picture || "",
  //       permalink: item.permalink_url || "#",
  //     }));

  //     setPosts(postsFormatted);
  //   } catch (err) {
  //     console.error("❌ Fetch Posts error:", err);
  //     setPosts([]);
  //   } finally {
  //     setLoading(false);
  //   }
  // }, [fbUser]);

  // --- fetch pages ---
  const fetchPages = useCallback(async () => {
    try {
      const res = await axios.get(
        `https://graph.facebook.com/v23.0/me/accounts?access_token=${fbUser.accessToken}`
      );

      console.log("✅ Raw pages response:", res.data);
      console.log("✅ Extracted pages list:", res.data?.data || []);

      setPages(res.data?.data || []); // each item has {id, name, access_token}
    } catch (err) {
      console.error("❌ Fetch Pages error:", err);
      setPages([]);
    }
  }, [fbUser]);

  // ---------------- Auto Fetch Data After Login ----------------
  useEffect(() => {
    if (fbUser && pages.length > 0) {
      console.log("👤 fbUser set, fetching data...");
      fetchAllMentions();
      fetchDms();
      fetchPages();

      // ✅ Auto-fetch IG Business Account + Mentions for first Page
      const firstPage = pages[0];
      if (firstPage?.id && firstPage?.access_token) {
        fetchIgBusinessAccount(firstPage.id, firstPage.access_token).then((igAcc) => {
          if (igAcc?.ig_user_id) {
            fetchIgMentions(firstPage.access_token, igAcc.ig_user_id).then((mentions) => {
              if (mentions?.data) {
                setMentions((prev) => [
                  ...prev,
                  ...mentions.data.map((m, i) => ({
                    platform: "Instagram",
                    id: m.id || `ig_${i}`,
                    message: m.caption || "",
                    content: m.caption || "",
                    time: m.timestamp || new Date().toISOString(),
                    mediaId: m.id,
                    username: m.username || "Instagram User",
                    mediaUrl: m.media_url || "",
                    permalink: m.permalink || "",
                    replies: [],
                  })),
                ]);
              }
            });
          }
        });
      }
    }
  }, [
    fbUser,
    pages,
    fetchAllMentions,
    fetchPages,
    fetchDms,
    fetchIgBusinessAccount,
    fetchIgMentions,
  ]);

  // ---------------- Reply to mention ----------------
  const handleReply = () => {
    if (!selectedMessage || !replyText.trim()) return;

    const newReply = {
      id: `r_${Date.now()}`,
      text: replyText.trim(),
      time: new Date().toISOString(),
      author: "You", // just like sender in DMs
      isMe: true,    // optional flag for styling consistency
    };

    // Update mentions list
    setMentions((prev) =>
      prev.map((m) =>
        m.id === selectedMessage.id
          ? {
            ...m,
            replies: [...(m.replies || []), newReply],
          }
          : m
      )
    );

    // Update currently open mention
    setSelectedMessage((prev) =>
      prev
        ? {
          ...prev,
          replies: [...(prev.replies || []), newReply],
        }
        : prev
    );

    setReplyText(""); // clear input
  };

  // ---------------- Send DM ----------------
  const handleSendDm = () => {
    if (!selectedDm || !dmText.trim()) return;

    const newMessage = {
      id: `dm_msg_${Date.now()}`,
      text: dmText.trim(),
      time: new Date().toISOString(),
      sender: "You",
      isMe: true,
    };

    // Update the DM list
    setDms((prev) =>
      prev.map((dm) =>
        dm.id === selectedDm.id
          ? {
            ...dm,
            messages: [...dm.messages, newMessage],
            lastMessage: dmText.trim(),
            time: new Date().toISOString(),
          }
          : dm
      )
    );

    // Update the currently open DM
    setSelectedDm((prev) =>
      prev
        ? {
          ...prev,
          messages: [...prev.messages, newMessage],
          lastMessage: dmText.trim(),
          time: new Date().toISOString(),
        }
        : prev
    );

    setDmText("");
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

      const fullMessages = (res.data?.messages?.data || []).map((m) => ({
        id: m.id,
        text: m.message,
        time: m.created_time,
        sender: m.from?.name || "Unknown",
        isMe: m.from?.id === selectedPage.id, // ✅ match Page ID
      }));

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

  const handleMakePost = async () => {
    if (saving) return; // prevent duplicate clicks
    setSaving(true);

    if (!postContent.trim()) {
      alert("Please enter some text for your post");
      setSaving(false);
      return;
    }

    if (!fbUser?.accessToken) {
      alert("Facebook access token missing. Please log in again.");
      setSaving(false);
      return;
    }

    if (!selectedPage?.access_token) {
      alert("Please select a page before posting.");
      setSaving(false);
      return;
    }

    // if (selectedPhoto && selectedVideo) {
    //   alert("Please upload only one media type (photo OR video).");
    //   setSaving(false);
    //   return;
    // }

    try {
      const formData = new FormData();
      formData.append("message", postContent);
      formData.append("access_token", selectedPage.access_token); // ✅ Page token
      formData.append("page_id", selectedPage.id); // ✅ Page ID

      if (selectedPhoto) {
        formData.append("image_files", selectedPhoto);
      }

      if (selectedVideo) {
        formData.append("video_file", selectedVideo);
      }

      const res = await axios.post(
        "http://localhost:8000/facebook/posts",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      console.log("✅ Post response:", res.data);

      // --- Add to UI immediately ---
      const newPost = {
        id: res.data.id || `temp_${Date.now()}`,
        caption: postContent.split("\n")[0] || "(no caption)",
        content: postContent,
        page: selectedPage?.name || "Facebook Page",
        timestamp: new Date().toISOString(),
        mediaUrl: selectedPhoto ? URL.createObjectURL(selectedPhoto) : "",
        permalink: res.data.permalink || "#",
      };

      setPosts((prev) => [newPost, ...prev]);

      // Reset form
      setShowPostForm(false);
      setPostContent("");
      setSelectedPage(null);
      setSelectedPhoto(null);
      setSelectedVideo(null);

      alert("✅ Post created successfully!");
    } catch (err) {
      console.error("❌ Create post error:", err);
      alert("❌ Failed to create post.");
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

                // Update frontend state with real user data
                const userData = {
                  id: userInfo.id || userID,
                  name: userInfo.name,
                  email: userInfo.email,
                  picture: userInfo.picture?.data?.url,
                  accessToken,
                };

                setFbUser(userData);

                // ✅ Save to localStorage so it persists after refresh
                localStorage.setItem("fbUser", JSON.stringify(userData));


                // ✅ Send user info + token to backend
                axios.post("http://localhost:8000/facebook/auth", {
                  access_token: accessToken,
                  user_id: userInfo.id,
                  name: userInfo.name,
                  email: userInfo.email,
                  picture: userInfo.picture?.data?.url,
                })
                  .then(() => console.log("✅ Synced with backend"))
                  .catch((err) => console.error("❌ Backend sync error:", err));

                alert("✅ Logged in successfully");
              }
            );
          }
        },
        {
          scope: "public_profile,email,pages_read_engagement,pages_show_list,pages_manage_metadata,pages_read_user_content,instagram_basic,instagram_manage_comments,instagram_manage_messages",
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
              <button
                onClick={() => {
                  if (activeTab === "mentions") fetchAllMentions();
                  // else if (activeTab === "posts") fetchPosts();
                  else if (activeTab === "dms") fetchDms();
                  // else fetchPosts();
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
              </button>
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
                {!fbUser ? (
                  // 🚫 Login required
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
                    <div>Please login to view mentions</div>
                    <div style={{ fontSize: 13, marginTop: 6 }}>
                      Click the login button above
                    </div>
                  </div>
                ) : loading ? (
                  // ⏳ While fetching
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
                    <div>Loading mentions...</div>
                  </div>
                ) : mentions.length === 0 ? (
                  // 🟢 Logged in but no mentions
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
                    <div>No mentions yet</div>
                    <div style={{ fontSize: 13, marginTop: 6 }}>
                      If you expected data, check Graph API permissions in backend.
                    </div>
                  </div>
                ) : (
                  // ✅ Logged in and mentions available
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
                      {/* ✅ Avatar */}
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

                      {/* ✅ Text section */}
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
                            {m.time ? new Date(m.time).toLocaleString() : "Unknown"}
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

            {activeTab === "dms" && (
              <>
                {/* 🔽 Page Selector for DMs */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                    Select Page: *
                  </label>
                  <select
                    value={selectedPage?.id || ""}
                    onChange={(e) => {
                      const page = pages.find((p) => p.id === e.target.value);
                      setSelectedPage(page || null); // update state
                      setDms([]); // clear old DMs
                      if (page) fetchDms();
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
                    {pages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 🔽 Messages Section */}
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
                      <img
                        src={dm.avatar}
                        alt={dm.username}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 8,
                          objectFit: "cover",
                        }}
                      />
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
              </>
            )}


            {activeTab === "posts" && (
              <div style={{ padding: 16 }}>
                {!fbUser ? (
                  <div style={{ textAlign: 'center', paddingTop: 30, color: darkMode ? '#9aa7c7' : '#6b7280' }}>
                    <Image style={{ width: 48, height: 48, margin: "0 auto 12px" }} />
                    <div>Please login to view and create posts</div>
                    <div style={{ fontSize: 13, marginTop: 6 }}>Click the login button above</div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <h3 style={{ margin: 0 }}>Your Posts</h3>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => setShowPostForm(!showPostForm)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: 'none',
                            background: showPostForm ? '#dc2626' : '#006CFC',
                            color: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          {showPostForm ? 'Cancel' : '+ Create Post'}
                        </button>
                      </div>
                    </div>

                    {/* Post Creation Form - Shows when Create Post is clicked */}
                    {showPostForm && (
                      <div style={{
                        background: darkMode ? '#1f2937' : '#f9fafb',
                        padding: 20,
                        borderRadius: 12,
                        marginBottom: 20
                      }}>
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

                    {/* Posts List - Shows when no form is active or after creating posts */}
                    {!showPostForm && (
                      posts.length === 0 ? (
                        <div style={{ textAlign: 'center', paddingTop: 30, color: darkMode ? '#9aa7c7' : '#6b7280' }}>
                          <Image style={{ width: 48, height: 48, margin: "0 auto 12px" }} />
                          <div>No posts yet</div>
                          <div style={{ fontSize: 13, marginTop: 6 }}>Click "Create Post" to get started</div>
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
                                background: darkMode ? '#1f2937' : '#fff',
                                border: '1px solid ' + (darkMode ? '#374151' : '#e5e7eb'),
                                cursor: "pointer"
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <div>
                                  <strong style={{ fontSize: 16 }}>{post.caption || post.content.slice(0, 30)}</strong>
                                  <div style={{ fontSize: 12, color: darkMode ? '#94a3b8' : '#6b7280', marginTop: 4 }}>
                                    Posted to: {post.page}
                                  </div>
                                </div>
                                <small style={{ color: darkMode ? '#94a3b8' : '#6b7280', fontSize: 12 }}>
                                  {new Date(post.timestamp).toLocaleDateString()}
                                </small>
                              </div>
                              <p style={{ marginBottom: 12, color: darkMode ? '#d1d5db' : '#374151' }}>{post.content}</p>
                              {post.mediaUrl && (
                                <img
                                  src={post.mediaUrl}
                                  alt="Post"
                                  style={{
                                    width: 100,
                                    height: 100,
                                    objectFit: 'cover',
                                    borderRadius: 8
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
              </div>
            )}
          </section>

          {/* Chat / message viewer */}
          <section style={{ flex: 1, display: "flex", flexDirection: "column", padding: 20, overflow: "hidden" }}>
            {activeTab === "posts" && selectedPost ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 10, background: "#c7d9ff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                      P
                    </div>
                    <div>
                      <div style={{ fontWeight: 700 }}>Your Post</div>
                      <div style={{ fontSize: 13, color: darkMode ? "#9aa7c7" : "#6b7280" }}>
                        {platformLabels[selectedMessage.platform]}
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
                      <div style={{ fontSize: 13, color: darkMode ? "#9aa7c7" : "#6b7280" }}>Instagram</div>

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
                    <img
                      src={selectedDm.avatar}
                      alt={selectedDm.username}
                      style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover" }}
                    />
                    <div>
                      <div style={{ fontWeight: 700 }}>{selectedDm.username}</div>
                      <div style={{ fontSize: 13, color: darkMode ? "#9aa7c7" : "#6b7280" }}>{selectedDm.fullName}</div>
                    </div>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: 12, borderRadius: 10, background: darkMode ? "#071226" : "#fff", marginBottom: 12 }}>
                  {selectedDm.messages.map((msg) => (
                    <div key={msg.id} style={{ marginBottom: 12, display: "flex", justifyContent: msg.isMe ? "flex-end" : "flex-start" }}>
                      <div style={{
                        maxWidth: "70%",
                        padding: "12px 16px",
                        borderRadius: msg.isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                        background: msg.isMe ? "#006CFC" : (darkMode ? "#1e293b" : "#f1f5f9"),
                        color: msg.isMe ? "#fff" : (darkMode ? "#e2e8f0" : "#334155")
                      }}>
                        {!msg.isMe && (
                          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{msg.sender}</div>
                        )}
                        <div style={{ fontSize: 14 }}>{msg.text}</div>
                        <div style={{
                          fontSize: 11,
                          textAlign: "right",
                          marginTop: 6,
                          color: msg.isMe ? "rgba(255,255,255,0.7)" : (darkMode ? "#94a3b8" : "#64748b")
                        }}>
                          {new Date(msg.time).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} /> {/* 👈 auto-scroll target */}
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
                    onClick={handleSendDm}
                    disabled={!dmText.trim()}
                    style={{
                      background: dmText.trim() ? "#006CFC" : "#9ca3af",
                      color: "#fff",
                      border: "none",
                      padding: "10px 12px",
                      borderRadius: 8,
                      cursor: dmText.trim() ? "pointer" : "not-allowed",
                    }}
                  >
                    <Send style={{ width: 16, height: 16 }} />
                  </button>
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

export default App;