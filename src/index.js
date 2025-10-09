import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./Context/AuthContext";  // ✅ import AuthProvider
import App from "./App";  // or MainRouter.jsx if you’re using routes

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>       {/* ✅ Wrap the whole app here */}
        <App />            {/* This includes LoginForm and all routes */}
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
