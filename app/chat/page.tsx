"use client";

import { useEffect, useRef, useState } from "react";
import { HIVE_CONFIG } from "@/config/app.config";
import { useTranslations } from '@/lib/i18n/hooks';

declare const StWidget: any;

// Utility: Load external script only if not present
const loadExternalScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
};

// Utility: Clean only corrupted localStorage keys
const cleanCorruptedLocalStorage = () => {
  if (
    typeof localStorage === "undefined" ||
    typeof localStorage.getItem !== "function" ||
    typeof localStorage.key !== "function" ||
    typeof localStorage.removeItem !== "function"
  ) {
    return;
  }

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const value = localStorage.getItem(key);
    if (value && (value.startsWith("#") || value.includes('#{"keys":'))) {
      keysToRemove.push(key);
    } else {
      try {
        JSON.parse(value!);
      } catch {
        if (value && (value.includes("{") || value.includes("["))) {
          keysToRemove.push(key);
        }
      }
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
};

// Widget options (configurable)
const widgetOptions = {
  allow_resize: true,
  use_dark_mode: true,
  defaultTheme: "Dark",
  "--appMessageFontFamily": "'Roboto'",
  onlyPrependCommunities: true,
};

export default function ChatPage() {
  const t = useTranslations('chat');
  const chatRef = useRef<HTMLDivElement | null>(null);
  const [debug, setDebug] = useState<string[]>([]);
  const widgetRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const [isLoading, setIsLoading] = useState(true);
  const [widgetReady, setWidgetReady] = useState(false);

  const log = (msg: string) => {
    console.log(msg);
    if (mountedRef.current) {
      setDebug((d) => [...d, msg]);
    }
  };

  useEffect(() => {
    cleanCorruptedLocalStorage();
    const container = chatRef.current;
    if (!container) return;
    if (container.children.length > 0 && container.querySelector("iframe"))
      return;

    let isMounted = true;
    let fallbackTimeout: NodeJS.Timeout;

    const initializeWidget = () => {
      if (!isMounted) return;
      if (typeof StWidget === "function" && container) {
        container.innerHTML = "";
        widgetRef.current = new StWidget(
          `https://chat.peakd.com/t/${HIVE_CONFIG.COMMUNITY_TAG}/0`
        );
        widgetRef.current.setProperties(widgetOptions);
        const element = widgetRef.current.createElement(
          "100%",
          "80vh",
          false,
          false
        );
        container.appendChild(element);
        setWidgetReady(true);
        setIsLoading(false);
      }
    };

    const loadWidgetScripts = async () => {
      try {
        await loadExternalScript("https://chat.peakd.com/stlib.js");
        await loadExternalScript("https://chat.peakd.com/stwidget.js");
        setTimeout(initializeWidget, 500);
      } catch (err) {
        setIsLoading(false);
        setDebug((d) => [...d, `Widget script load error: ${err}`]);
      }
    };

    if (typeof StWidget === "function") {
      initializeWidget();
    } else {
      loadWidgetScripts();
    }

    fallbackTimeout = setTimeout(() => {
      if (isMounted) {
        setIsLoading(false);
        setDebug((d) => [...d, "Widget load fallback timeout reached"]);
      }
    }, 10000);

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimeout);
      if (process.env.NODE_ENV !== "development") {
        if (container) container.innerHTML = "";
        if (widgetRef.current) {
          try {
            widgetRef.current.cleanup?.();
            widgetRef.current.destroy?.();
          } catch {}
          widgetRef.current = null;
        }
      }
    };
  }, []);

  // Set mounted ref to false on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return (
    <div className="p-4 max-w-full">
      <h1 className="text-2xl font-bold mb-4">{t('title')}</h1>

      {isLoading && (
        <div
          className="w-full border rounded-lg bg-gray-50 shadow-lg flex items-center justify-center"
          style={{ minHeight: "600px" }}
        >
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">{t('loading')}</p>
            <p className="text-sm text-gray-500 mt-2">{t('loadingMessage')}</p>
          </div>
        </div>
      )}

      <div
        ref={chatRef}
        className={`w-full border rounded-lg shadow-lg ${
          widgetReady ? "bg-white" : "bg-gray-50"
        } ${isLoading ? "hidden" : ""}`}
        style={{ minHeight: "600px" }}
      />

      {process.env.NODE_ENV === "development" && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-gray-600">
            Debug Info ({debug.length} messages) - Widget Ready:{" "}
            {widgetReady ? "Yes" : "No"}
          </summary>
          <pre className="mt-2 text-xs whitespace-pre-wrap bg-gray-100 p-2 rounded max-h-60 overflow-y-auto">
            {debug.join("\n")}
          </pre>
        </details>
      )}
    </div>
  );
}
