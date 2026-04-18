"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "./AuthProvider";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
    __s2sGoogleScriptLoading?: Promise<void>;
  }
}

const GIS_SRC = "https://accounts.google.com/gsi/client";

function loadGoogleScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (window.__s2sGoogleScriptLoading) return window.__s2sGoogleScriptLoading;
  window.__s2sGoogleScriptLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
  return window.__s2sGoogleScriptLoading;
}

export default function GoogleSignInButton({ redirectTo = "/dashboard" }: { redirectTo?: string }) {
  const { loginWithGoogle } = useAuth();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await api.publicConfig();
        if (!cfg.google_client_id) {
          if (!cancelled) setDisabled(true);
          return;
        }
        await loadGoogleScript();
        if (cancelled || !ref.current || !window.google) return;

        window.google.accounts.id.initialize({
          client_id: cfg.google_client_id,
          callback: async ({ credential }) => {
            try {
              await loginWithGoogle(credential);
              router.push(redirectTo);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Google sign-in failed");
            }
          },
        });

        window.google.accounts.id.renderButton(ref.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          logo_alignment: "left",
          width: 320,
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load Google sign-in");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loginWithGoogle, router, redirectTo]);

  if (disabled) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={ref} />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
