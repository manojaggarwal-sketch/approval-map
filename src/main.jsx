import React from "react";
import { createRoot } from "react-dom/client";
import "./storage.js"; // Installs window.storage adapter (must run before App loads).
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(<App />);
