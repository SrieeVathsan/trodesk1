import React from "react";

const FacebookBusinessLogin = () => {
  const handleFBLogin = () => {
    if (!window.FB) {
      console.error("Facebook SDK not loaded yet!");
      return;
    }

    window.FB.login(
      function (response) {
        console.log("Login response:", response);
        if (response.status === "connected") {
          const auth = response.authResponse;
          console.log("✅ AccessToken:", auth.accessToken);
          console.log("✅ UserID:", auth.userID);
        } else {
          console.warn("❌ User not logged in or permission denied");
        }
      },
      {
        scope: "ads_read,ads_management,pages_read_engagement",
        config_id: process.env.REACT_APP_FB_CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        auth_type: "rerequest",
      }
    );
  };

  return (
    <button onClick={handleFBLogin} className="fb-login-btn">
      Login with Facebook Business
    </button>
  );
};

export default FacebookBusinessLogin;
