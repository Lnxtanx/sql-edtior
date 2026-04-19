import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App.tsx";
import "./index.css";
import { initErrorReporter } from "./lib/errorReporter";

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Safety check to prevent Google Login from crashing if Client ID is missing in environment
if (!clientId) {
    console.error("VITE_GOOGLE_CLIENT_ID is missing from environment variables.");
}

// Initialize custom error & traffic tracking
initErrorReporter();

createRoot(document.getElementById("root")!).render(
    clientId ? (
        <GoogleOAuthProvider clientId={clientId}>
            <App />
        </GoogleOAuthProvider>
    ) : (
        <App />
    )
);
