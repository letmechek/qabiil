"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function isPrimaryClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function NavigationLoadingIndicator() {
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const lastSeenUrlRef = useRef<string>("");

  useEffect(() => {
    const startLoading = () => {
      startedAtRef.current = Date.now();
      setIsLoading(true);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setIsLoading(false), 12000);
    };

    const onClick = (event: MouseEvent) => {
      if (!isPrimaryClick(event)) return;
      const target = event.target as HTMLElement | null;
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;

      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      try {
        const url = new URL(link.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        const current = `${window.location.pathname}${window.location.search}`;
        const next = `${url.pathname}${url.search}`;
        if (current === next) return;
        startLoading();
      } catch {
        // Ignore malformed urls
      }
    };

    const onSubmit = (event: Event) => {
      const form = event.target as HTMLFormElement | null;
      if (!form || form.method.toLowerCase() !== "get") return;
      startLoading();
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    lastSeenUrlRef.current = `${window.location.pathname}${window.location.search}`;

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isLoading) return;
    const currentUrl = typeof window === "undefined" ? "" : `${window.location.pathname}${window.location.search}`;
    if (currentUrl === lastSeenUrlRef.current) return;
    lastSeenUrlRef.current = currentUrl;
    const elapsed = Date.now() - startedAtRef.current;
    const remaining = Math.max(0, 450 - elapsed);
    const doneTimer = window.setTimeout(() => {
      setIsLoading(false);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }, remaining);
    return () => window.clearTimeout(doneTimer);
  }, [pathname, isLoading]);

  if (!isLoading) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60]">
      <div className="h-1 w-full overflow-hidden bg-cyan-100">
        <div className="h-full w-1/3 animate-[navLoad_1.1s_ease-in-out_infinite] bg-cyan-600" />
      </div>
      <div className="absolute right-4 top-3 rounded-full border border-cyan-200 bg-white/95 px-3 py-1 text-xs font-semibold text-cyan-700 shadow-sm">
        Loading...
      </div>
    </div>
  );
}
