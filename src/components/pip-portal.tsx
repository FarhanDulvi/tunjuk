"use client";

import { useEffect, useState } from "react";

// Minimal type surface for the Document Picture-in-Picture API.
// See: https://developer.mozilla.org/en-US/docs/Web/API/Document_Picture-in-Picture_API
interface DocumentPipRequestOptions {
  width?: number;
  height?: number;
  disallowReturnToOpener?: boolean;
}

interface DocumentPip {
  requestWindow: (opts?: DocumentPipRequestOptions) => Promise<Window>;
  window: Window | null;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPip;
  }
}

export function isDocumentPipSupported(): boolean {
  return (
    typeof window !== "undefined" && "documentPictureInPicture" in window
  );
}

/**
 * Copy stylesheets and meta charset from the main document into the PiP
 * window so Tailwind / app CSS applies there too.
 */
function mirrorStyles(target: Window) {
  const targetDoc = target.document;

  targetDoc.documentElement.lang = document.documentElement.lang || "en";
  targetDoc.body.style.margin = "0";
  targetDoc.body.style.background = "#ffffff";
  targetDoc.body.style.color = "#0f172a"; // slate-900
  targetDoc.body.style.fontFamily =
    getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";

  const charset = targetDoc.createElement("meta");
  charset.setAttribute("charset", "utf-8");
  targetDoc.head.appendChild(charset);

  const viewport = targetDoc.createElement("meta");
  viewport.setAttribute("name", "viewport");
  viewport.setAttribute("content", "width=device-width, initial-scale=1");
  targetDoc.head.appendChild(viewport);

  // Clone every <link rel="stylesheet"> and <style>.
  const nodes = document.head.querySelectorAll(
    'link[rel="stylesheet"], style',
  );
  for (const node of Array.from(nodes)) {
    if (node.tagName === "LINK") {
      const link = node as HTMLLinkElement;
      const clone = targetDoc.createElement("link");
      clone.rel = "stylesheet";
      clone.href = link.href;
      if (link.media) clone.media = link.media;
      if (link.crossOrigin) clone.crossOrigin = link.crossOrigin;
      targetDoc.head.appendChild(clone);
    } else {
      const style = node as HTMLStyleElement;
      const clone = targetDoc.createElement("style");
      clone.textContent = style.textContent;
      for (const attr of Array.from(style.attributes)) {
        try {
          clone.setAttribute(attr.name, attr.value);
        } catch {
          // ignore
        }
      }
      targetDoc.head.appendChild(clone);
    }
  }

  // Carry over adoptedStyleSheets (Next.js/Tailwind v4 sometimes use them).
  try {
    const adopted = (document as Document & {
      adoptedStyleSheets?: CSSStyleSheet[];
    }).adoptedStyleSheets;
    if (adopted && adopted.length) {
      (targetDoc as Document & {
        adoptedStyleSheets?: CSSStyleSheet[];
      }).adoptedStyleSheets = [...adopted];
    }
  } catch {
    // ignore
  }
}

interface UseDocumentPipOptions {
  width?: number;
  height?: number;
}

interface UseDocumentPipResult {
  /** The DOM element inside the PiP window to portal into, or null when closed. */
  container: HTMLElement | null;
  /** True while the PiP window is open. */
  isOpen: boolean;
  /** Open the PiP window. Resolves once the window and container are ready. */
  open: () => Promise<void>;
  /** Close the PiP window (if open). */
  close: () => void;
}

/**
 * React hook around the Document Picture-in-Picture API. The caller can portal
 * arbitrary React content into `container` via `createPortal`. The PiP window
 * receives a clone of the host document's stylesheets so Tailwind classes work.
 */
export function useDocumentPip(
  opts: UseDocumentPipOptions = {},
): UseDocumentPipResult {
  const { width = 420, height = 720 } = opts;
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  // Wire up cleanup if the window is closed externally (user clicks ✕).
  useEffect(() => {
    if (!pipWindow) return;
    const onPageHide = () => {
      setContainer(null);
      setPipWindow(null);
    };
    pipWindow.addEventListener("pagehide", onPageHide);
    return () => {
      pipWindow.removeEventListener("pagehide", onPageHide);
    };
  }, [pipWindow]);

  // Best-effort cleanup on unmount of the host component.
  useEffect(() => {
    return () => {
      if (pipWindow) {
        try {
          pipWindow.close();
        } catch {
          // ignore
        }
      }
    };
  }, [pipWindow]);

  const open = async () => {
    if (!isDocumentPipSupported()) {
      throw new Error("Document Picture-in-Picture is not supported here.");
    }
    if (pipWindow) return;
    const win = await window.documentPictureInPicture!.requestWindow({
      width,
      height,
      disallowReturnToOpener: false,
    });
    mirrorStyles(win);
    const root = win.document.createElement("div");
    root.className = "p-3";
    root.style.minHeight = "100vh";
    win.document.body.appendChild(root);
    setPipWindow(win);
    setContainer(root);
  };

  const close = () => {
    if (pipWindow) {
      try {
        pipWindow.close();
      } catch {
        // ignore
      }
      // pagehide listener will reset state, but reset eagerly too in case
      // the browser does not fire it synchronously.
      setContainer(null);
      setPipWindow(null);
    }
  };

  return { container, isOpen: pipWindow !== null, open, close };
}
