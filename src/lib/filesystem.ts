// Client-Side Virtual Filesystem & Live Server Connector
// This module provides full read/write/delete operations for the Cockpit Filesystem.
// It detects static client-only environments (such as GitHub Pages) and transparently
// switches to an in-memory & localStorage-cached virtual filesystem so that files,
// components, and dynamic code can be fully modified and simulated inside the browser.

export interface FsItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
}

// 1. Initial template files to seed the Virtual Filesystem
const DEFAULT_VIRTUAL_FILES: { [path: string]: string } = {
  "README.md": `# 🎛️ Applet Cockpit Workspace\n\nWelcome to your browser-powered virtual workspace. You are running on a static host (GitHub Pages) with a virtual filesystem fallback.\n\n### Quick Instructions:\n* Create custom components (e.g. \`src/components/CoolWidget.tsx\`) using the **Create** button.\n* Upload files directly using the drag-and-drop uploader.\n* Any custom components written here will compile dynamically on-the-fly inside the browser.\n`,
  "package.json": `{
  "name": "applet-cockpit-workspace",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "react": "^18.3.1",
    "lucide-react": "^0.344.0",
    "recharts": "^2.12.2"
  }
}`,
  "config.json": `{
  "theme": "slate-dark",
  "refreshInterval": 5000,
  "animationsEnabled": true
}`,
  "src/App.tsx": `// Applet Cockpit Main Entry Point (Virtual File)\nimport React from 'react';\n\nexport default function App() {\n  return (\n    <div className="p-6 text-white bg-slate-900 rounded-xl">\n      <h2 className="text-xl font-bold">Workspace Engine</h2>\n      <p className="text-sm text-slate-400">Virtual host online</p>\n    </div>\n  );\n}`,
  "src/components/HelloWorld.tsx": `// Hello World dynamic component compiler test\nimport React, { useState } from 'react';\nimport { Sparkles } from 'lucide-react';\n\nexport default function HelloWorld() {\n  const [count, setCount] = useState(0);\n\n  return (\n    <div className="p-8 bg-gradient-to-br from-indigo-950/80 to-slate-950/90 border border-indigo-500/20 rounded-2xl text-center space-y-4 shadow-xl">\n      <div className="inline-flex p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">\n        <Sparkles className="w-6 h-6 animate-pulse" />\n      </div>\n      <h2 className="text-lg font-bold text-white font-serif tracking-tight">Dynamic UI Engine</h2>\n      <p className="text-xs text-white/60 max-w-sm mx-auto leading-relaxed">\n        This component was loaded from the virtual filesystem cache and compiled directly inside your browser.\n      </p>\n      <button \n        onClick={() => setCount(c => c + 1)}\n        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-mono font-bold uppercase rounded-lg text-white transition active:scale-95"\n      >\n        Clicks: {count}\n      </button>\n    </div>\n  );\n}`
};

// Key used in localStorage
const STORAGE_KEY = "applet_virtual_filesystem";

// Helper to load or initialize virtual fs
function getVirtualFs(): { [path: string]: string } {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Corrupted virtual filesystem, resetting to defaults", e);
    }
  }
  // Initialize with defaults
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_VIRTUAL_FILES));
  return DEFAULT_VIRTUAL_FILES;
}

// Helper to save virtual fs
function saveVirtualFs(fs: { [path: string]: string }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fs));
}

// Check if we are running in GitHub Pages or client-only mode
export function isStaticHost(): boolean {
  return (
    window.location.hostname.includes("github.io") ||
    window.location.hostname.includes("github.pages") ||
    localStorage.getItem("applet_fs_force_fallback") === "true"
  );
}

/**
 * Helper to resolve the correct URL for backend API requests.
 * If the user has configured a custom backend URL in Settings (saved in localStorage)
 * or if a backend running on port 3200 is auto-detected, we rewrite API requests.
 */
let autoDetectedBackendUrl: string | null = null;
let stickyFallbackMode: boolean | null = null;

export function getDetectedBackendUrl(): string {
  const customUrl = localStorage.getItem("applet_dashboard_custom_backend_url");
  if (customUrl && customUrl.trim().startsWith("http")) {
    return customUrl.trim();
  }
  return autoDetectedBackendUrl || "";
}

export function setCustomBackendUrl(url: string) {
  if (url && url.trim()) {
    localStorage.setItem("applet_dashboard_custom_backend_url", url.trim());
  } else {
    localStorage.removeItem("applet_dashboard_custom_backend_url");
  }
  autoDetectedBackendUrl = null;
  stickyFallbackMode = null;
}

export function resetBackendHealthCache() {
  autoDetectedBackendUrl = null;
  stickyFallbackMode = null;
}

export function getBackendUrl(apiPath: string): string {
  const activeCustomUrl = localStorage.getItem("applet_dashboard_custom_backend_url");
  const activeBaseUrl = (activeCustomUrl && activeCustomUrl.trim().startsWith("http"))
    ? activeCustomUrl.trim()
    : autoDetectedBackendUrl;

  if (activeBaseUrl) {
    const baseUrl = activeBaseUrl.replace(/\/$/, ""); // strip trailing slash
    const relativePath = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
    return `${baseUrl}${relativePath}`;
  }
  return apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
}

export async function detectFallbackMode(): Promise<boolean> {
  // 1. Probe relative path first (standard same-origin unified container behavior)
  try {
    const relativeResp = await fetch("/api/list-components", { signal: AbortSignal.timeout(1500) });
    if (relativeResp.ok) {
      // Relative path works natively! Clear any stale custom backend URL overrides that might cause ERR_CONNECTION_REFUSED
      const customUrl = localStorage.getItem("applet_dashboard_custom_backend_url");
      if (customUrl && customUrl.includes(":3200")) {
        localStorage.removeItem("applet_dashboard_custom_backend_url");
      }
      autoDetectedBackendUrl = null;
      stickyFallbackMode = false;
      return false;
    }
  } catch (e) {
    // Relative fetch failed, try custom or legacy fallback probes
  }

  // 2. If explicit custom URL is saved in localStorage, probe it
  const activeCustomUrl = localStorage.getItem("applet_dashboard_custom_backend_url");
  if (activeCustomUrl && activeCustomUrl.trim().startsWith("http")) {
    try {
      const targetUrl = getBackendUrl("/api/list-components");
      const resp = await fetch(targetUrl, { signal: AbortSignal.timeout(2500) });
      if (resp.ok) {
        stickyFallbackMode = false;
        return false;
      }
    } catch (e) {
      console.warn("Configured custom backend URL failed health check, clearing stale override:", e);
      localStorage.removeItem("applet_dashboard_custom_backend_url");
    }
  }

  // 3. Probe host port 3200 fallback if running on a custom port/host
  if (typeof window !== "undefined" && window.location && window.location.hostname) {
    const protocol = window.location.protocol && window.location.protocol.startsWith("http") ? window.location.protocol : "http:";
    const hostname = window.location.hostname;
    const candidate3200 = `${protocol}//${hostname}:3200`;

    try {
      const probeResp = await fetch(`${candidate3200}/api/list-components`, { signal: AbortSignal.timeout(2000) });
      if (probeResp.ok) {
        console.log(`[Filesystem] Discovered active backend running on port 3200: ${candidate3200}`);
        autoDetectedBackendUrl = candidate3200;
        stickyFallbackMode = false;
        return false;
      }
    } catch (e) {
      // Port 3200 probe failed
    }
  }

  if (isStaticHost()) {
    stickyFallbackMode = true;
    return true;
  }

  stickyFallbackMode = true;
  return true;
}

// --- CORE API IMPLEMENTATIONS ---

/**
 * Lists items inside a directory (files and virtual folders)
 */
export async function listFiles(targetPath: string = "."): Promise<{ success: boolean; currentPath: string; contents: FsItem[] }> {
  const isFallback = await detectFallbackMode();
  const normalizedPath = targetPath === "" || targetPath === "." ? "." : targetPath;

  if (!isFallback || localStorage.getItem("applet_dashboard_custom_backend_url")) {
    try {
      const resp = await fetch(getBackendUrl(`/api/files/list?path=${encodeURIComponent(normalizedPath)}`));
      if (resp.ok) {
        const data = await resp.json();
        if (data.success) {
          return data;
        }
      }
    } catch (e) {
      console.warn("Express server listing failed, falling back to local Virtual FS:", e);
    }
  }

  // --- VIRTUAL FS LOGIC ---
  const fs = getVirtualFs();
  const itemsMap = new Map<string, FsItem>();
  const searchPrefix = normalizedPath === "." ? "" : normalizedPath + "/";

  Object.keys(fs).forEach((filePath) => {
    // We only care about files starting with our path prefix
    if (searchPrefix && !filePath.startsWith(searchPrefix)) return;
    
    // Remainder of path relative to search directory
    const remainder = searchPrefix ? filePath.substring(searchPrefix.length) : filePath;
    if (!remainder) return;

    const segments = remainder.split("/");
    const primarySegment = segments[0];

    if (segments.length > 1) {
      // It's a directory
      const dirPath = normalizedPath === "." ? primarySegment : `${normalizedPath}/${primarySegment}`;
      if (!itemsMap.has(primarySegment)) {
        itemsMap.set(primarySegment, {
          name: primarySegment,
          path: dirPath,
          isDirectory: true,
          size: 0
        });
      }
    } else {
      // It's a file
      const fullPath = normalizedPath === "." ? primarySegment : `${normalizedPath}/${primarySegment}`;
      itemsMap.set(primarySegment, {
        name: primarySegment,
        path: fullPath,
        isDirectory: false,
        size: fs[filePath]?.length || 0
      });
    }
  });

  return {
    success: true,
    currentPath: normalizedPath,
    contents: Array.from(itemsMap.values())
  };
}

/**
 * Reads a file's content
 */
export async function readFile(filePath: string): Promise<{ success: boolean; path: string; content: string }> {
  const isFallback = await detectFallbackMode();
  if (!isFallback || localStorage.getItem("applet_dashboard_custom_backend_url")) {
    try {
      const resp = await fetch(getBackendUrl("/api/files/read"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success) return data;
      }
    } catch (e) {
      console.warn("Express server file read failed, falling back to local Virtual FS:", e);
    }
  }

  // --- VIRTUAL FS LOGIC ---
  const fs = getVirtualFs();
  // If we try to read a file that isn't created yet but has a default template
  if (fs[filePath] !== undefined) {
    return { success: true, path: filePath, content: fs[filePath] };
  }
  
  // Try case insensitive fallback for component names
  const match = Object.keys(fs).find(k => k.toLowerCase() === filePath.toLowerCase());
  if (match) {
    return { success: true, path: match, content: fs[match] };
  }

  throw new Error(`Virtual file not found: ${filePath}`);
}

/**
 * Writes content to a file (creates if it doesn't exist)
 */
export async function writeFile(filePath: string, content: string): Promise<{ success: boolean; path: string }> {
  const isFallback = await detectFallbackMode();
  
  // Synchronize component-specific caches instantly for loading on the fly
  if (filePath.startsWith("src/components/") && filePath.endsWith(".tsx")) {
    const compName = filePath.split("/").pop()?.replace(/\.tsx$/, "");
    if (compName) {
      localStorage.setItem(`custom_component_code:${compName}`, content);
    }
  }

  if (!isFallback || localStorage.getItem("applet_dashboard_custom_backend_url")) {
    try {
      const resp = await fetch(getBackendUrl("/api/files/write"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, content })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success) return data;
      }
    } catch (e) {
      console.warn("Express server file write failed, syncing locally on Virtual FS fallback:", e);
    }
  }

  // --- VIRTUAL FS LOGIC ---
  const fs = getVirtualFs();
  fs[filePath] = content;
  saveVirtualFs(fs);

  return { success: true, path: filePath };
}

/**
 * Deletes a file or directory recursively
 */
export async function deleteFile(filePath: string): Promise<{ success: boolean; path: string }> {
  const isFallback = await detectFallbackMode();
  if (!isFallback || localStorage.getItem("applet_dashboard_custom_backend_url")) {
    try {
      const resp = await fetch(getBackendUrl("/api/files/delete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success) return data;
      }
    } catch (e) {
      console.warn("Express server file deletion failed, deleting from Virtual FS fallback:", e);
    }
  }

  // --- VIRTUAL FS LOGIC ---
  const fs = getVirtualFs();
  
  // If deleting a directory, remove all children
  let deletedAny = false;
  Object.keys(fs).forEach((f) => {
    if (f === filePath || f.startsWith(filePath + "/")) {
      delete fs[f];
      deletedAny = true;
    }
  });

  if (deletedAny) {
    saveVirtualFs(fs);
    return { success: true, path: filePath };
  }

  throw new Error(`File or folder not found: ${filePath}`);
}
