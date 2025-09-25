import React, { useState, useEffect, useRef } from "react";
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
  const [fbUser, setFbUser] = useState(null);
  const [fbReady, setFbReady] = useState(false);
  const [fbStatus, setFbStatus] = useState("unknown");
  const fbPollRef = useRef(0);

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
        setFbReady(false);
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
  async function fetchAllMentions() {
    if (!fbUser) {
      alert("Please login first to view mentions");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get("http://localhost:8000/all/mentions", {
        headers: { Authorization: `Bearer ${fbUser.accessToken}` },
        params: { user_id: fbUser.id },
      });

      const data = res.data || {};
      const allMentions = [];

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
            avatar: item.avatar || `https://picsum.photos/seed/fb_${i}/100/100`,
          }))
        );
      }

      if (Array.isArray(data.instagram)) {
        allMentions.push(
          ...data.instagram.map((item, i) => ({
            platform: "Instagram",
            id: item.id || `ig_m_${i}`,
            message: item.text || item.caption || "",
            content: item.caption || "",
            time: item.timestamp || new Date().toISOString(),
            mediaId: item.media_id || item.id || `ig_media_${i}`,
            username: item.username || "Instagram User",
            mediaUrl: item.media_url || "",
            permalink: item.permalink || "",
            replies: item.replies || [],
            avatar: item.avatar || `https://picsum.photos/seed/ig_${i}/100/100`,
          }))
        );
      }

      if (Array.isArray(data.x)) {
        allMentions.push(
          ...data.x.map((item, i) => ({
            platform: "X",
            id: item.id || `x_m_${i}`,
            message: item.text || "",
            content: item.text || "",
            time: item.timestamp || new Date().toISOString(),
            mediaId: item.media_id || item.id || `x_media_${i}`,
            username: item.username || "X User",
            mediaUrl: item.media_url || "",
            permalink: item.permalink || "",
            replies: item.replies || [],
            avatar: item.avatar || `https://picsum.photos/seed/x_${i}/100/100`,
          }))
        );
      }

      setMentions(allMentions);
    } catch (err) {
      console.error("Fetch All Mentions error:", err);
      setMentions([]);
    } finally {
      setLoading(false);
    }
  }

  // ---------------- Fetch DMs ----------------
  async function fetchDms() {
    if (!fbUser) {
      alert("Please login first to view DMs");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get("http://localhost:8000/instagram/dms", {
        headers: { Authorization: `Bearer ${fbUser.accessToken}` },
        params: { user_id: fbUser.id },
      });

      const data = res.data?.data || [];
      const dmsFormatted = data.map((item, i) => ({
        id: item.id || `dm_${i}`,
        username: item.username || "Unknown",
        fullName: item.full_name || "",
        avatar: item.avatar || `https://picsum.photos/seed/dm_${i}/100/100`,
        lastMessage: item.last_message || "",
        time: item.timestamp || new Date().toISOString(),
        unread: item.unread || 0,
        userId: item.user_id,
        messages: item.messages || [],
      }));

      setDms(dmsFormatted);
    } catch (err) {
      console.error("Fetch DMs error:", err);
      setDms([]);
    } finally {
      setLoading(false);
    }
  }

  // ---------------- Fetch Posts ----------------
  async function fetchPosts() {
    if (!fbUser) {
      alert("Please login first to view posts");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get("http://localhost:8000/instagram/posts", {
        headers: { Authorization: `Bearer ${fbUser.accessToken}` },
        params: { user_id: fbUser.id },
      });

      const data = res.data?.data || [];
      const postsFormatted = data.map((item, i) => ({
        id: item.id || `post_${i}`,
        caption: item.caption || "(no caption)",
        content: item.content || "",
        page: item.page || "Unknown",
        timestamp: item.timestamp || new Date().toISOString(),
        mediaUrl: item.media_url || "",
      }));

      setPosts(postsFormatted);
    } catch (err) {
      console.error("Fetch Posts error:", err);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }

  // ---------------- Reply to mention ----------------
  const handleReply = async () => {
    if (!selectedMessage || !replyText.trim()) return;

    try {
      const form = new FormData();
      form.append("media_id", selectedMessage.mediaId);
      form.append("comment_text", replyText.trim());

      await axios.post("http://localhost:8000/instagram/reply-to-mentions", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Update local state
      const reply = {
        id: `r_${Date.now()}`,
        text: replyText.trim(),
        time: new Date().toISOString(),
        author: "You" // 👈 backend can later send actual author
      };

      setMentions((prev) => prev.map((m) => (m.id === selectedMessage.id ? { ...m, replies: [...(m.replies || []), reply] } : m)));
      setSelectedMessage((prev) => (prev ? { ...prev, replies: [...(prev.replies || []), reply] } : prev));
      setReplyText("");

      alert("✅ Reply sent");
    } catch (err) {
      console.error("Reply error:", err);
      alert("❌ Failed to send reply.");
    }
  };

  // ---------------- Send DM ----------------
  const handleSendDm = async () => {
    if (!selectedDm || !dmText.trim()) return;

    try {
      await axios.post("http://localhost:8000/instagram/send-message", {
        recipient_id: selectedDm.userId,
        message: dmText.trim()
      });

      const newMessage = {
        id: `dm_msg_${Date.now()}`,
        text: dmText.trim(),
        time: new Date().toISOString(),
        sender: "You",
        isMe: true
      };

      setDms((prev) => prev.map((dm) =>
        dm.id === selectedDm.id
          ? {
            ...dm,
            messages: [...dm.messages, newMessage],
            lastMessage: dmText.trim(),
            time: new Date().toISOString()
          }
          : dm
      ));

      setSelectedDm((prev) =>
        prev
          ? {
            ...prev,
            messages: [...prev.messages, newMessage],
            lastMessage: dmText.trim(),
            time: new Date().toISOString()
          }
          : prev
      );

      setDmText("");
      alert("✅ Message sent");
    } catch (err) {
      console.error("Send DM error:", err);
      alert("❌ Failed to send message.");
    }
  };

  const handleDmClick = async (dm) => {
    setSelectedDm(dm);

    // Mark as read via backend if endpoint exists
    try {
      await axios.patch(`http://localhost:8000/instagram/messages/${dm.id}/read`);

      // Update local state to mark as read
      setDms(prev => prev.map(item =>
        item.id === dm.id ? { ...item, unread: 0 } : item
      ));
    } catch (err) {
      console.warn("Could not mark message as read:", err);
      // Still update local state even if backend call fails
      setDms(prev => prev.map(item =>
        item.id === dm.id ? { ...item, unread: 0 } : item
      ));
    }
  };

  const handleMakePost = async () => {
    const titleInput = document.querySelector('input[type="text"]');
    const contentTextarea = document.querySelector('textarea');

    const title = titleInput?.value || '';
    const content = contentTextarea?.value || '';

    if (!title.trim() || !content.trim()) {
      alert('Please add both a title and content for your post');
      return;
    }

    if (!selectedPage) {
      alert('Please select a page to post to');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('caption', title);
      formData.append('message', content);
      formData.append('page_id', selectedPage);
      if (selectedPhoto) formData.append('media', selectedPhoto);
      if (selectedVideo) formData.append('media', selectedVideo);

      await axios.post("http://localhost:8000/instagram/create-post", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Refresh posts
      fetchPosts();

      // Reset form
      setShowPostForm(false);
      setSelectedPage("");
      setSelectedPhoto(null);
      setSelectedVideo(null);
      if (titleInput) titleInput.value = '';
      if (contentTextarea) contentTextarea.value = '';

      alert('✅ Post created successfully!');
    } catch (err) {
      console.error("Create post error:", err);
      alert('❌ Failed to create post.');
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
                setFbUser({
                  id: userInfo.id || userID,
                  name: userInfo.name,
                  email: userInfo.email,
                  picture: userInfo.picture?.data?.url,
                  accessToken,
                });

                // ✅ Send user info + token to backend
                axios.post("http://localhost:8000/facebook/auth", {
                  access_token: accessToken || userID,
                  user_id: userInfo.id,
                  name: userInfo.name,
                  email: userInfo.email,
                  picture: userInfo.picture?.data?.url,
                })
                  .then(() => console.log("✅ Synced with backend"))
                  .catch((err) => console.error("❌ Backend sync error:", err));

                // Auto-fetch data after login
                setTimeout(() => {
                  fetchAllMentions();
                  fetchDms();
                  fetchPosts();
                }, 1000);

                alert("✅ Logged in successfully");
              }
            );
          }
        },
        {
          scope: "public_profile,email,pages_read_engagement,pages_show_list,instagram_basic",
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
    setFbStatus(null);
  };

  // const fbStatusMessage = () => {
  //   if (!fbReady) return "Facebook SDK not ready.";
  //   if (fbStatus === "connected") return `Facebook: connected ${fbUser?.name ? `- ${fbUser.name}` : ''}`;
  //   if (fbStatus === "not_authorized") return "Facebook: not authorized";
  //   return "Facebook: not logged in";
  // };

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
                  else if (activeTab === "dms") fetchDms();
                  else fetchPosts();
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

            {activeTab === "mentions" && (
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
                    <div style={{ fontSize: 13, marginTop: 6 }}>Click Refresh to load</div>
                  </div>
                ) : (
                  mentions.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMessage(m)}
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
                          <strong>{m.username}</strong>
                          <small style={{ color: darkMode ? "#94a3b8" : "#6b7280", fontSize: 12 }}>{new Date(m.time).toLocaleString()}</small>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 14, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{m.message || "(no message)"}</div>
                        {m.replies && m.replies.length > 0 && (
                          <div style={{ marginTop: 4, fontSize: 12, color: darkMode ? "#88a0c7" : "#4b5563", display: "flex", alignItems: "center", gap: 4 }}>
                            <MessageSquare size={12} /> {m.replies.length} reply
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {activeTab === "dms" && (
              <>
                {!fbUser ? (
                  <div style={{ textAlign: "center", paddingTop: 30, color: darkMode ? "#9aa7c7" : "#6b7280" }}>
                    <Mail style={{ width: 48, height: 48, margin: "0 auto 12px" }} />
                    <div>Please login to view messages</div>
                    <div style={{ fontSize: 13, marginTop: 6 }}>Click the login button above</div>
                  </div>
                ) : dms.length === 0 ? (
                  <div style={{ textAlign: "center", paddingTop: 30, color: darkMode ? "#9aa7c7" : "#6b7280" }}>
                    <Mail style={{ width: 48, height: 48, margin: "0 auto 12px" }} />
                    <div>No messages yet</div>
                    <div style={{ fontSize: 13, marginTop: 6 }}>Click Refresh to load</div>
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
                        background: selectedDm?.id === dm.id ? "#006CFC" : darkMode ? "#0b1a2b" : "#eef7ff",
                        color: selectedDm?.id === dm.id ? "#fff" : darkMode ? "#e6eefc" : "#0b1c3a",
                      }}
                    >
                      <img
                        src={dm.avatar}
                        alt={dm.username}
                        style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <strong>{dm.username}</strong>
                          {dm.unread > 0 && (
                            <span style={{
                              background: "#ef4444",
                              color: "white",
                              borderRadius: "50%",
                              width: 20,
                              height: 20,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 12
                            }}>
                              {dm.unread}
                            </span>
                          )}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 14, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {dm.message || "(no message)"}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12, color: darkMode ? "#94a3b8" : "#6b7280" }}>
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
                            Add post title: *
                          </label>
                          <input
                            type="text"
                            placeholder="Enter your post title here..."
                            style={{
                              width: '100%',
                              padding: '12px',
                              borderRadius: '8px',
                              border: '1px solid #d1d5db',
                              background: darkMode ? '#374151' : '#fff',
                              color: darkMode ? '#f3f4f6' : '#111827'
                            }}
                          />
                        </div>

                        <div style={{ marginBottom: 16 }}>
                          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                            Write Post: *
                          </label>
                          <textarea
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
                            value={selectedPage}
                            onChange={(e) => setSelectedPage(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '12px',
                              borderRadius: '8px',
                              border: '1px solid #d1d5db',
                              background: darkMode ? '#374151' : '#fff',
                              color: darkMode ? '#f3f4f6' : '#111827'
                            }}
                          >
                            <option value="">Select Page</option>
                            <option value="java">Java</option>
                            <option value="html">Html</option>
                            <option value="css">Css</option>
                            <option value="javascript">Javascript</option>
                          </select>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                            Upload Media: *
                          </label>
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <label style={{
                              padding: '10px 16px',
                              border: selectedPhoto ? '2px solid #10b981' : '1px solid #d1d5db',
                              borderRadius: '8px',
                              background: darkMode ? '#4b5563' : '#e5e7eb',
                              cursor: 'pointer',
                              display: 'inline-block'
                            }}>
                              <input
                                type="file"
                                accept="image/*"
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
                              cursor: 'pointer',
                              display: 'inline-block'
                            }}>
                              <input
                                type="file"
                                accept="video/*"
                                onChange={(e) => setSelectedVideo(e.target.files[0])}
                                style={{ display: 'none' }}
                              />
                              {selectedVideo ? '✓ Video Selected' : 'Upload Video'}
                            </label>
                          </div>
                          <small style={{ color: darkMode ? '#94a3b8' : '#6b7280', marginTop: 4, display: 'block' }}>
                            * Required: Please upload either a photo or video
                          </small>
                        </div>

                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <button
                            onClick={handleMakePost}
                            style={{
                              padding: '12px 20px',
                              border: 'none',
                              borderRadius: '8px',
                              background: '#10b981',
                              color: 'white',
                              cursor: 'pointer'
                            }}
                          >
                            Save Post
                          </button>
                          <button
                            onClick={() => setShowPostForm(false)}
                            style={{
                              padding: '12px 20px',
                              border: '1px solid #d1d5db',
                              borderRadius: '8px',
                              background: darkMode ? '#374151' : '#f9fafb',
                              cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Posts List - Shows when no form is active or after creating posts */}
                    {posts.length === 0 ? (
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
                            onClick={() => setSelectedPost(post)}   // 👈 added
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
                                <strong style={{ fontSize: 16 }}>{post.caption}</strong>
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
                      <div style={{ fontSize: 13, color: darkMode ? '#9aa7c7' : '#6b7280' }}>Instagram</div>
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
                          {new Date(selectedMessage.time).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Replies list (right side for user replies) */}
                  {(selectedMessage.replies || []).length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8, paddingLeft: 8 }}>Replies</div>
                      {(selectedMessage.replies || []).map((r) => (
                        <div key={r.id} style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}>
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
                              {new Date(r.time).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <textarea
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
                  {/* DM messages */}
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
                      background: "#006CFC",
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

          {/* Right profile / meta sidebar */}
          <aside style={{ width: 320, borderLeft: "1px solid rgba(0,0,0,0.06)", padding: 16, overflowY: "auto", background: darkMode ? "#06102a" : "#fff" }}>
            {activeTab === "mentions" && selectedMessage ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 88, height: 88, borderRadius: 14, background: "#c7d9ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800 }}>
                    {selectedMessage.username?.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedMessage.username}</div>
                  <div style={{ color: darkMode ? "#9aa7c7" : "#6b7280" }}>Instagram User</div>
                </div>

                <div style={{ marginTop: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontWeight: 700 }}>Followers</div>
                    <div>1.2K</div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontWeight: 700 }}>Messages</div>
                    <div>24</div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontWeight: 700 }}>Last Active</div>
                    <div>Today</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: "#006CFC", color: "#fff", cursor: "pointer" }}>View Profile</button>
                  <button style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid rgba(0,0,0,0.06)", background: "transparent", cursor: "pointer" }}>Block</button>
                </div>
              </>
            ) : activeTab === "dms" && selectedDm ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <img
                    src={selectedDm.avatar}
                    alt={selectedDm.username}
                    style={{ width: 88, height: 88, borderRadius: 14, objectFit: "cover" }}
                  />
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedDm.username}</div>
                  <div style={{ color: darkMode ? "#9aa7c7" : "#6b7280" }}>{selectedDm.fullName}</div>
                </div>

                <div style={{ marginTop: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontWeight: 700 }}>Followers</div>
                    <div>3.5K</div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontWeight: 700 }}>Following</div>
                    <div>892</div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontWeight: 700 }}>Posts</div>
                    <div>127</div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontWeight: 700 }}>Last Active</div>
                    <div>30 min ago</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: "#006CFC", color: "#fff", cursor: "pointer" }}>View Profile</button>
                  <button style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid rgba(0,0,0,0.06)", background: "transparent", cursor: "pointer" }}>Block</button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", color: darkMode ? "#9aa7c7" : "#6b7280" }}>
                <Users style={{ width: 48, height: 48, margin: "0 auto 12px" }} />
                <div style={{ fontWeight: 700 }}>No selection</div>
                <div style={{ marginTop: 6 }}>
                  {activeTab === "mentions"
                    ? "Select a mention to view profile & stats"
                    : activeTab === "dms"
                      ? "Select a conversation to view profile & stats"
                      : "Select an item to view details"
                  }
                </div>
              </div>
            )}
          </aside>
        </div>
      </main >
    </div >
  );
};

export default App;