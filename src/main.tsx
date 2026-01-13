import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from 'virtual:pwa-register';

import { toast } from "sonner";

// Register service worker for PWA
registerSW({
    immediate: true,
    onRegistered(r) {
        console.log('SW Registered:', r);
    },
    onRegisterError(error) {
        console.log('SW Registration Error:', error);
        if (error?.toString().includes('disallowed')) {
            toast.error("Service Worker blocked", {
                description: "Your browser is blocking background workers. This may affect offline features.",
            });
        }
    }
});

createRoot(document.getElementById("root")!).render(<App />);

