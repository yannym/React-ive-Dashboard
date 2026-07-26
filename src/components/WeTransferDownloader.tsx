import React, { useState, useEffect, useRef } from "react";
import { 
  DownloadCloud, 
  Link as LinkIcon, 
  FileArchive, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Loader2, 
  Trash2, 
  FolderDown, 
  Terminal, 
  RefreshCw, 
  Lock, 
  FileCheck, 
  ArrowRight,
  HardDrive,
  FolderPlus,
  Plus,
  Server,
  Database,
  Info,
  Check,
  X,
  FolderOpen,
  Bell,
  Mail,
  Volume2,
  VolumeX,
  Copy,
  Globe,
  Settings,
  ShieldCheck,
  Layers,
  Send,
  Zap,
  ExternalLink
} from "lucide-react";
import { getBackendUrl, backendFetch } from "../lib/filesystem";

interface StorageMountStatus {
  accessible: boolean;
  writable: boolean;
  resolvedPath: string;
  freeBytes?: number;
  totalBytes?: number;
  error?: string;
  message?: string;
}

interface StorageMount {
  id: string;
  name: string;
  path: string;
  type: "workspace" | "omv_nas" | "external_drive" | "custom_directory";
  description?: string;
  isDefault?: boolean;
  status?: StorageMountStatus;
}

interface DiscoveredDockerMount {
  name: string;
  path: string;
  type: StorageMount["type"];
  status: StorageMountStatus;
  isMountedInDocker: boolean;
}

interface WeTransferJob {
  jobId: string;
  url: string;
  status: "queued" | "resolving" | "downloading" | "completed" | "error" | "cancelled";
  outputDir: string;
  fileName?: string;
  filePath?: string;
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
  speedBytesSec: number;
  etaSeconds: number;
  logs: string[];
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
  unzip: boolean;
}

interface DownloadedFile {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  mtime: number;
}

interface NotificationConfig {
  enableDesktopNotifications: boolean;
  enableEmailNotifications: boolean;
  emailRecipient?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  enableWebhookNotifications: boolean;
  webhookUrl?: string;
  enableSoundAlerts: boolean;
}

export function WeTransferDownloader() {
  const [urlInput, setUrlInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [autoUnzip, setAutoUnzip] = useState(true);
  const [selectedMountPath, setSelectedMountPath] = useState("./downloads/wetransfer");
  const [customPathInput, setCustomPathInput] = useState("");
  const [useCustomPath, setUseCustomPath] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [jobs, setJobs] = useState<WeTransferJob[]>([]);
  const [downloadedFiles, setDownloadedFiles] = useState<DownloadedFile[]>([]);
  const [mounts, setMounts] = useState<StorageMount[]>([]);
  const [discoveredDockerMounts, setDiscoveredDockerMounts] = useState<DiscoveredDockerMount[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mount management modal state
  const [showMountModal, setShowMountModal] = useState(false);
  const [mountModalTab, setMountModalTab] = useState<"configured" | "docker_discover" | "docker_compose">("configured");
  const [newMountName, setNewMountName] = useState("");
  const [newMountPath, setNewMountPath] = useState("");
  const [newMountType, setNewMountType] = useState<StorageMount["type"]>("omv_nas");
  const [newMountDesc, setNewMountDesc] = useState("");
  const [mountTestResult, setMountTestResult] = useState<StorageMountStatus | null>(null);
  const [isTestingMount, setIsTestingMount] = useState(false);
  const [copiedComposeSnippet, setCopiedComposeSnippet] = useState(false);

  // Notification Modal State
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [desktopPermission, setDesktopPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [notifConfig, setNotifConfig] = useState<NotificationConfig>({
    enableDesktopNotifications: true,
    enableEmailNotifications: false,
    emailRecipient: "",
    enableWebhookNotifications: false,
    webhookUrl: "",
    enableSoundAlerts: true
  });
  const [isSavingNotif, setIsSavingNotif] = useState(false);
  const [notifSuccessMsg, setNotifSuccessMsg] = useState<string | null>(null);
  const [notificationLogs, setNotificationLogs] = useState<any[]>([]);

  // Enhanced Connection & Server API Error Diagnostic State
  interface ConnectionDiagnostic {
    type: "network" | "api";
    message: string;
    statusCode?: number;
    timestamp: string;
  }
  const [connectionDiagnostic, setConnectionDiagnostic] = useState<ConnectionDiagnostic | null>(null);

  // Helper to process fetch errors and categorize them
  const handleFetchError = (err: any, endpoint: string) => {
    console.warn(`Fetch error on endpoint ${endpoint}:`, err);
    const errString = String(err?.message || err);
    const isNetwork = 
      err?.name === "TypeError" || 
      errString.includes("Failed to fetch") || 
      errString.includes("NetworkError") || 
      errString.includes("ERR_CONNECTION") ||
      errString.includes("Load failed");

    setConnectionDiagnostic({
      type: isNetwork ? "network" : "api",
      message: isNetwork
        ? `Network Connection Failure when reaching '${endpoint}'. The Express backend container or OMV gateway appears unreachable or offline.`
        : `Server API Error on '${endpoint}': ${errString}`,
      timestamp: new Date().toLocaleTimeString()
    });
  };

  // Ref to track notified jobs to prevent duplicate popups
  const notifiedJobIdsRef = useRef<Set<string>>(new Set());

  // Web Audio Chime Sound Synthesizer
  const playCompletionSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc2.type = "triangle";

      // Musical chime frequencies (E5 -> B5 chord)
      const now = ctx.currentTime;
      osc1.frequency.setValueAtTime(659.25, now);
      osc1.frequency.exponentialRampToValueAtTime(987.77, now + 0.15);

      osc2.frequency.setValueAtTime(1318.51, now + 0.15);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now + 0.15);
      osc1.stop(now + 0.8);
      osc2.stop(now + 0.8);
    } catch (e) {
      console.warn("Could not play notification sound chime:", e);
    }
  };

  // Trigger System Desktop & Sound Notification
  const triggerSystemNotification = (job: WeTransferJob) => {
    if (notifiedJobIdsRef.current.has(job.jobId)) return;
    notifiedJobIdsRef.current.add(job.jobId);

    // Play Web Audio Sound Chime
    if (notifConfig.enableSoundAlerts) {
      playCompletionSound();
    }

    // Trigger Native MacBook / Web Desktop Notification
    if (
      notifConfig.enableDesktopNotifications &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      const isCompleted = job.status === "completed";
      const title = isCompleted
        ? `📦 Download Complete: ${job.fileName || "WeTransfer Package"}`
        : `⚠️ Download Failed: ${job.fileName || "WeTransfer Job"}`;

      const body = isCompleted
        ? `Saved directly to ${job.outputDir} (${((job.totalBytes || 0) / (1024 * 1024)).toFixed(1)} MB)`
        : `Error: ${job.errorMessage || "Check downloader console logs"}`;

      try {
        const notif = new Notification(title, {
          body,
          icon: "/favicon.ico",
          tag: job.jobId
        });
        notif.onclick = () => {
          window.focus();
        };
      } catch (err) {
        console.warn("Desktop notification creation error:", err);
      }
    }
  };

  // Fetch Notification Config & Logs
  const fetchNotificationConfig = async () => {
    try {
      const res = await backendFetch("/api/notifications/config");
      if (res.ok) {
        const data = await res.json();
        setNotifConfig(data.config || {});
      }
      const logsRes = await backendFetch("/api/notifications/logs");
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setNotificationLogs(logsData.logs || []);
      }
    } catch (err) {
      console.warn("Failed to fetch notification config:", err);
    }
  };

  // Save Notification Config
  const handleSaveNotificationConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingNotif(true);
    setNotifSuccessMsg(null);
    try {
      const res = await backendFetch("/api/notifications/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notifConfig)
      });
      if (res.ok) {
        setNotifSuccessMsg("Notification preferences saved successfully!");
        setTimeout(() => setNotifSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      console.error("Failed to save notification settings:", err);
    } finally {
      setIsSavingNotif(false);
    }
  };

  // Request Native System Desktop Notification Permissions
  const handleRequestDesktopPermission = async () => {
    if (typeof Notification === "undefined") return;
    try {
      const perm = await Notification.requestPermission();
      setDesktopPermission(perm);
      if (perm === "granted") {
        new Notification("🔔 System Desktop Notifications Active", {
          body: "You will receive native popups on your MacBook when downloads complete!",
          icon: "/favicon.ico"
        });
      }
    } catch (err) {
      console.warn("Error requesting notification permission:", err);
    }
  };

  // Send Test Notification
  const handleSendTestNotification = async () => {
    playCompletionSound();
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("📦 [TEST] WeTransfer Downloader Popup", {
        body: "MacBook System Desktop Notifications are working perfectly!",
        icon: "/favicon.ico"
      });
    }

    try {
      await backendFetch("/api/notifications/test", { method: "POST" });
      setNotifSuccessMsg("Test notification dispatched to Email & Webhook channels!");
      setTimeout(() => setNotifSuccessMsg(null), 3500);
      fetchNotificationConfig();
    } catch (err) {
      console.error("Failed to send test notification:", err);
    }
  };

  // Fetch Configured Storage Mounts & Auto-Discovered Docker Volumes
  const fetchMounts = async () => {
    try {
      const res = await backendFetch("/api/mounts");
      if (res.ok) {
        const data = await res.json();
        setMounts(data.mounts || []);
        if (data.mounts?.length > 0 && !selectedMountPath) {
          const defaultMount = data.mounts.find((m: StorageMount) => m.isDefault) || data.mounts[0];
          setSelectedMountPath(defaultMount.path);
        }
        setConnectionDiagnostic(null);
      } else {
        setConnectionDiagnostic({
          type: "api",
          message: `Backend API endpoint '/api/mounts' returned HTTP status ${res.status} (${res.statusText || "Server Error"}).`,
          statusCode: res.status,
          timestamp: new Date().toLocaleTimeString()
        });
      }

      const dockerRes = await backendFetch("/api/mounts/docker-auto-discover");
      if (dockerRes.ok) {
        const dockerData = await dockerRes.json();
        setDiscoveredDockerMounts(dockerData.discovered || []);
      }
    } catch (err) {
      handleFetchError(err, "/api/mounts");
    }
  };

  // Poll background download jobs & trigger notifications when jobs finish
  const fetchJobs = async () => {
    try {
      const res = await backendFetch("/api/wetransfer/jobs");
      if (res.ok) {
        const data = await res.json();
        const freshJobs: WeTransferJob[] = data.jobs || [];
        setJobs(freshJobs);
        setConnectionDiagnostic(null);

        // Check for completed or errored jobs to notify
        freshJobs.forEach((job) => {
          if (job.status === "completed" || job.status === "error") {
            triggerSystemNotification(job);
          }
        });
      } else {
        setConnectionDiagnostic({
          type: "api",
          message: `Backend API endpoint '/api/wetransfer/jobs' returned HTTP status ${res.status} (${res.statusText || "Server Error"}).`,
          statusCode: res.status,
          timestamp: new Date().toLocaleTimeString()
        });
      }
    } catch (err) {
      handleFetchError(err, "/api/wetransfer/jobs");
    }
  };

  // Fetch files inside active target directory
  const fetchFiles = async () => {
    try {
      const targetDir = useCustomPath ? customPathInput : selectedMountPath;
      const res = await backendFetch(`/api/wetransfer/files?targetDir=${encodeURIComponent(targetDir)}`);
      if (res.ok) {
        const data = await res.json();
        setDownloadedFiles(data.files || []);
      }
    } catch (err) {
      // Quietly process fetch error without cluttering if jobs/mounts already caught it
      console.warn("Failed to fetch downloaded files:", err);
    }
  };

  useEffect(() => {
    fetchMounts();
    fetchJobs();
    fetchFiles();
    fetchNotificationConfig();

    if (typeof Notification !== "undefined") {
      setDesktopPermission(Notification.permission);
    }

    const interval = setInterval(() => {
      fetchJobs();
      fetchFiles();
    }, 2000);
    return () => clearInterval(interval);
  }, [selectedMountPath, useCustomPath, customPathInput]);

  const activeTargetPath = useCustomPath ? customPathInput : selectedMountPath;

  const handleStartDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const outputDir = activeTargetPath;
      const res = await backendFetch("/api/wetransfer/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: urlInput.trim(),
          outputDir,
          password: passwordInput.trim() || undefined,
          unzip: autoUnzip
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start download job");
      }

      setUrlInput("");
      setPasswordInput("");
      fetchJobs();
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred starting the download.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestMountPath = async (pathTesting?: string) => {
    const target = pathTesting || newMountPath;
    if (!target) return;
    setIsTestingMount(true);
    setMountTestResult(null);
    try {
      const res = await backendFetch("/api/mounts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: target })
      });
      const data = await res.json();
      setMountTestResult(data);
    } catch (err: any) {
      setMountTestResult({
        accessible: false,
        writable: false,
        resolvedPath: target,
        error: err.message || "Test failed"
      });
    } finally {
      setIsTestingMount(false);
    }
  };

  const handleAddMount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMountName.trim() || !newMountPath.trim()) return;

    try {
      const res = await backendFetch("/api/mounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newMountName.trim(),
          path: newMountPath.trim(),
          type: newMountType,
          description: newMountDesc.trim() || undefined
        })
      });

      if (res.ok) {
        setNewMountName("");
        setNewMountPath("");
        setNewMountDesc("");
        setMountTestResult(null);
        setShowMountModal(false);
        fetchMounts();
      }
    } catch (err) {
      console.error("Failed to add mount:", err);
    }
  };

  const handleImportDockerMount = async (discovered: DiscoveredDockerMount) => {
    try {
      const res = await backendFetch("/api/mounts/docker-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: discovered.path,
          name: discovered.name,
          type: discovered.type
        })
      });
      if (res.ok) {
        fetchMounts();
        setSelectedMountPath(discovered.path);
        setShowMountModal(false);
      }
    } catch (err) {
      console.error("Failed to import docker mount:", err);
    }
  };

  const handleDeleteMount = async (mountId: string) => {
    try {
      await backendFetch(`/api/mounts/${mountId}`, { method: "DELETE" });
      fetchMounts();
    } catch (err) {
      console.error("Failed to delete mount:", err);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      await backendFetch(`/api/wetransfer/jobs/${jobId}`, {
        method: "DELETE"
      });
      fetchJobs();
    } catch (err) {
      console.error("Failed to cancel job:", err);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatSpeed = (bytesPerSec: number) => {
    return `${formatBytes(bytesPerSec)}/s`;
  };

  return (
    <div className="space-y-6">
      {/* Connection & API Error Diagnostic Banner */}
      {connectionDiagnostic && (
        <div className="bg-[#180A0C] border-2 border-red-500/40 rounded-xl p-4 font-mono text-xs text-white shadow-2xl space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-red-400 font-bold">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 animate-pulse" />
              <span>
                {connectionDiagnostic.type === "network"
                  ? "Network / Docker Connection Error (ERR_CONNECTION_REFUSED)"
                  : `Server API Error ${connectionDiagnostic.statusCode ? `(HTTP ${connectionDiagnostic.statusCode})` : ""}`}
              </span>
            </div>
            <span className="text-[10px] text-white/40">{connectionDiagnostic.timestamp}</span>
          </div>

          <p className="text-white/80 leading-relaxed text-[11px] bg-black/50 p-3 border border-red-500/20 rounded-lg">
            {connectionDiagnostic.message}
          </p>

          {connectionDiagnostic.type === "network" && (
            <div className="space-y-2 text-[11px] bg-black/60 p-3.5 border border-amber-500/20 rounded-lg text-amber-200/90">
              <div className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
                <Server className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Troubleshooting OMV / Docker Container Connection:</span>
              </div>
              <ul className="list-disc list-inside space-y-1.5 text-white/70 pl-1 text-[11px]">
                <li>
                  <strong className="text-white">Check Container Status:</strong> Ensure your backend Docker container (e.g. <code className="text-emerald-400 px-1 bg-white/5 rounded">architect-backend</code> or <code className="text-emerald-400 px-1 bg-white/5 rounded">omv-nas-gateway</code>) is actively running in OpenMediaVault / Docker Desktop.
                </li>
                <li>
                  <strong className="text-white">Port Mapping & Gateway:</strong> Verify that port 3000 is mapped correctly and no firewall/proxy rule is blocking local loopback requests.
                </li>
                <li>
                  <strong className="text-white">Inspect Telemetry:</strong> Open <strong className="text-white">Settings &gt; System &gt; Docker Containers</strong> in the dashboard to check live memory/CPU stats or restart container threads.
                </li>
              </ul>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setConnectionDiagnostic(null)}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded text-xs transition cursor-pointer"
            >
              Dismiss Warning
            </button>
            <button
              type="button"
              onClick={async () => {
                setIsRefreshing(true);
                await Promise.all([fetchMounts(), fetchJobs(), fetchFiles(), fetchNotificationConfig()]);
                setIsRefreshing(false);
              }}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold transition flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>Retry Backend Connection</span>
            </button>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-[#111111] border border-white/10 rounded-xl p-5 md:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <DownloadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2 font-mono">
                WeTransfer Direct Downloader
                <span className="text-[10px] font-normal px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded font-mono">
                  Mountable Filesystems
                </span>
              </h2>
              <p className="text-xs text-white/50 font-mono mt-0.5">
                Paste direct email links (<span className="text-emerald-400">we.tl/...</span>) & write files directly into mounted OMV shares or external SSDs.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            {/* Notification Config Button */}
            <button
              type="button"
              onClick={() => setShowNotificationModal(true)}
              className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-mono transition flex items-center gap-1.5 cursor-pointer font-bold relative"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Notifications</span>
              {desktopPermission === "granted" && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" title="MacBook System Desktop Notifications Active" />
              )}
            </button>

            {/* Mount Manager Button */}
            <button
              type="button"
              onClick={() => setShowMountModal(true)}
              className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-mono transition flex items-center gap-1.5 cursor-pointer font-bold"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Mount Filesystem / OMV</span>
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={async () => {
                setIsRefreshing(true);
                await Promise.all([fetchMounts(), fetchJobs(), fetchFiles(), fetchNotificationConfig()]);
                setTimeout(() => setIsRefreshing(false), 500);
              }}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 rounded-lg text-xs font-mono transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleStartDownload} className="mt-5 space-y-4 pt-5 border-t border-white/10">
          <div>
            <label className="block text-xs font-mono text-white/70 mb-1.5 flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span>WeTransfer Link or Email Short URL</span>
            </label>
            <input
              type="text"
              placeholder="e.g. https://we.tl/t-abc123xyz or https://wetransfer.com/downloads/..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#0A0A0A] border border-white/10 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50 font-mono text-xs"
            />
          </div>

          {/* Target Storage Mount Selector */}
          <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold text-white/90 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <span>Target Storage Mount / Write Location</span>
              </label>

              <button
                type="button"
                onClick={() => setUseCustomPath(!useCustomPath)}
                className="text-[11px] font-mono text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {useCustomPath ? "Select Pre-configured Mount" : "+ Enter Custom Directory Path"}
              </button>
            </div>

            {!useCustomPath ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {mounts.map((mount) => {
                  const isSelected = selectedMountPath === mount.path;
                  const isWritable = mount.status?.writable;
                  const isFallback = mount.status?.mode === "sandboxed_fallback";

                  return (
                    <button
                      key={mount.id}
                      type="button"
                      onClick={() => setSelectedMountPath(mount.path)}
                      className={`text-left p-3 rounded-lg border font-mono transition relative cursor-pointer ${
                        isSelected
                          ? "bg-emerald-500/10 border-emerald-500/50 text-white"
                          : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          {mount.type === "omv_nas" ? (
                            <Server className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          ) : mount.type === "external_drive" ? (
                            <Database className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          ) : (
                            <FolderOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          )}
                          <span className="truncate">{mount.name}</span>
                        </span>

                        <span
                          className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                            isFallback
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : isWritable
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-red-500/20 text-red-300 border border-red-500/30"
                          }`}
                          title={
                            isFallback
                              ? `Sandboxed Fallback: Writing to ${mount.status?.resolvedPath}`
                              : isWritable
                              ? "Direct Mount: Online & Writable"
                              : "Inaccessible"
                          }
                        >
                          {isFallback ? "SANDBOX" : isWritable ? "ONLINE" : "OFFLINE"}
                        </span>
                      </div>

                      <div className="text-[10px] text-white/40 truncate mt-1">
                        {mount.path}
                      </div>

                      {isFallback && (
                        <div className="text-[9px] text-amber-300/80 mt-1 truncate">
                          Mirror: {mount.status?.resolvedPath}
                        </div>
                      )}

                      {!isFallback && mount.status?.freeBytes ? (
                        <div className="text-[9px] text-emerald-400/80 mt-1">
                          Free: {formatBytes(mount.status.freeBytes)}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  placeholder="e.g. /mnt/omv_media/wetransfer or /media/ssd/my_folder"
                  value={customPathInput}
                  onChange={(e) => setCustomPathInput(e.target.value)}
                  className="w-full px-3.5 py-2 bg-black border border-white/20 rounded-lg text-white font-mono text-xs focus:border-emerald-500 focus:outline-none"
                />
                <p className="text-[10px] font-mono text-white/40 mt-1">
                  Specify any mounted filesystem path (NFS, SMB, Samba, external SSD, or local directory).
                </p>
              </div>
            )}

            {/* Active Mount Sandbox Notice */}
            {(() => {
              const currentMountObj = mounts.find(m => m.path === activeTargetPath);
              if (currentMountObj?.status?.mode === "sandboxed_fallback") {
                return (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] font-mono text-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        Path <code className="text-white bg-black/40 px-1 rounded">{activeTargetPath}</code> is operating in Sandboxed Fallback Mode (<code className="text-amber-300 bg-black/40 px-1 rounded">{currentMountObj.status.resolvedPath}</code>).
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMountModal(true)}
                      className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded font-bold transition text-[10px] whitespace-nowrap self-start sm:self-auto cursor-pointer"
                    >
                      View Docker Host Setup
                    </button>
                  </div>
                );
              }
              return null;
            })()}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-white/70 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Password (Optional)</span>
              </label>
              <input
                type="password"
                placeholder="Required if transfer is password protected"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#0A0A0A] border border-white/10 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50 font-mono text-xs"
              />
            </div>

            <div className="flex items-center gap-3 pt-6">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoUnzip}
                  onChange={(e) => setAutoUnzip(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                <span className="ml-2.5 text-xs font-mono text-white/80 flex items-center gap-1">
                  <FileArchive className="w-3.5 h-3.5 text-emerald-400" />
                  Auto-Extract .zip Archives
                </span>
              </label>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !urlInput.trim()}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-mono text-xs font-bold rounded-lg transition flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/40"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Initiating Job...</span>
                </>
              ) : (
                <>
                  <FolderDown className="w-4 h-4" />
                  <span>Download Directly to Mount</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Background Download Jobs Queue */}
      <div className="bg-[#111111] border border-white/10 rounded-xl p-5 md:p-6 shadow-xl">
        <h3 className="text-sm font-bold text-white font-mono mb-4 flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-emerald-400" />
          <span>Active & Recent Background Download Jobs</span>
          <span className="ml-auto text-xs font-normal text-white/40">
            {jobs.length} {jobs.length === 1 ? "Job" : "Jobs"}
          </span>
        </h3>

        {jobs.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-white/10 rounded-xl text-white/40 font-mono text-xs">
            No background download jobs running. Paste a WeTransfer link above to start downloading.
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.jobId}
                className="bg-[#0A0A0A] border border-white/10 rounded-lg p-4 font-mono space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white font-bold truncate max-w-md">
                        {job.fileName || job.url}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded border uppercase font-bold ${
                          job.status === "completed"
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : job.status === "downloading"
                            ? "bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse"
                            : job.status === "resolving"
                            ? "bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse"
                            : job.status === "error"
                            ? "bg-red-500/20 text-red-400 border-red-500/30"
                            : "bg-white/10 text-white/60 border-white/10"
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/40 truncate mt-0.5">
                      Target Mount Path: <span className="text-emerald-400">{job.outputDir}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedLogId(expandedLogId === job.jobId ? null : job.jobId)
                      }
                      className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white/70 text-[10px] rounded border border-white/10 flex items-center gap-1 transition cursor-pointer"
                    >
                      <Terminal className="w-3 h-3 text-emerald-400" />
                      <span>{expandedLogId === job.jobId ? "Hide Logs" : "View Logs"}</span>
                    </button>

                    {job.filePath && job.status === "completed" && (
                      <a
                        href={getBackendUrl(`/api/wetransfer/file-download?filePath=${encodeURIComponent(job.filePath)}`)}
                        download
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] rounded font-bold flex items-center gap-1 transition"
                      >
                        <DownloadCloud className="w-3 h-3" />
                        <span>Save File</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteJob(job.jobId)}
                      className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] rounded border border-red-500/20 transition cursor-pointer"
                      title="Cancel or remove job"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                {(job.status === "downloading" || job.status === "resolving" || job.status === "completed") && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[11px] text-white/70">
                      <span>
                        {job.status === "resolving"
                          ? "Connecting & Resolving Transfer Link..."
                          : `${formatBytes(job.downloadedBytes)} / ${formatBytes(job.totalBytes)} (${job.percent}%)`}
                      </span>
                      {job.status === "downloading" && (
                        <span>
                          {formatSpeed(job.speedBytesSec)} • {job.etaSeconds}s remaining
                        </span>
                      )}
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          job.status === "completed"
                            ? "bg-emerald-500"
                            : "bg-gradient-to-r from-blue-500 to-emerald-400"
                        }`}
                        style={{ width: `${Math.min(100, job.percent || (job.status === "completed" ? 100 : 5))}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {job.errorMessage && (
                  <div className="text-[11px] text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">
                    {job.errorMessage}
                  </div>
                )}

                {/* Log Terminal Window */}
                {expandedLogId === job.jobId && (
                  <div className="bg-[#050505] border border-white/10 rounded p-3 text-[10px] text-emerald-400/90 font-mono space-y-1 max-h-48 overflow-y-auto">
                    <div className="text-white/40 border-b border-white/10 pb-1 mb-1 font-bold">
                      Console Execution Output:
                    </div>
                    {job.logs.map((log, idx) => (
                      <div key={idx} className="leading-relaxed whitespace-pre-wrap">
                        {log}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Downloaded Files in Selected Mount Directory */}
      <div className="bg-[#111111] border border-white/10 rounded-xl p-5 md:p-6 shadow-xl">
        <h3 className="text-sm font-bold text-white font-mono mb-4 flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-emerald-400" />
          <span>Downloaded Files in Active Target Path (<span className="text-emerald-400">{activeTargetPath}</span>)</span>
          <span className="ml-auto text-xs font-normal text-white/40">
            {downloadedFiles.length} {downloadedFiles.length === 1 ? "File" : "Files"}
          </span>
        </h3>

        {downloadedFiles.length === 0 ? (
          <div className="text-center py-6 text-white/40 font-mono text-xs border border-dashed border-white/10 rounded-xl">
            No downloaded files found in this mount path directory yet.
          </div>
        ) : (
          <div className="divide-y divide-white/5 border border-white/10 rounded-lg overflow-hidden bg-[#0A0A0A]">
            {downloadedFiles.map((file, idx) => (
              <div key={idx} className="p-3.5 flex items-center justify-between gap-3 hover:bg-white/5 transition font-mono text-xs">
                <div className="min-w-0 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-emerald-400">
                    {file.fileName.endsWith('.zip') ? <FileArchive className="w-4 h-4" /> : <FileCheck className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-white font-bold truncate">{file.fileName}</div>
                    <div className="text-[10px] text-white/40 truncate">
                      Full Path: {file.filePath}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-white/60">
                    {formatBytes(file.sizeBytes)}
                  </span>
                  <a
                    href={getBackendUrl(`/api/wetransfer/file-download?filePath=${encodeURIComponent(file.filePath)}`)}
                    download
                    className="px-3 py-1.5 bg-emerald-600/80 hover:bg-emerald-500 text-white font-bold text-[11px] rounded transition flex items-center gap-1.5"
                  >
                    <DownloadCloud className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MOUNT FILESYSTEM & DOCKER COMPOSE MANAGER MODAL */}
      {showMountModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/10 rounded-xl max-w-2xl w-full p-6 space-y-5 font-mono shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowMountModal(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Filesystem Storage Mount Manager</h3>
                <p className="text-xs text-white/50">Mount OMV Server shares, external SSDs, or Docker Compose volumes</p>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-white/10 gap-2">
              <button
                onClick={() => setMountModalTab("configured")}
                className={`px-3 py-2 text-xs font-bold transition rounded-t-lg border-b-2 flex items-center gap-1.5 cursor-pointer ${
                  mountModalTab === "configured"
                    ? "border-emerald-500 text-emerald-400 bg-white/5"
                    : "border-transparent text-white/50 hover:text-white"
                }`}
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Configured Mounts ({mounts.length})</span>
              </button>

              <button
                onClick={() => setMountModalTab("docker_discover")}
                className={`px-3 py-2 text-xs font-bold transition rounded-t-lg border-b-2 flex items-center gap-1.5 cursor-pointer ${
                  mountModalTab === "docker_discover"
                    ? "border-blue-500 text-blue-400 bg-white/5"
                    : "border-transparent text-white/50 hover:text-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Docker Auto-Discovered ({discoveredDockerMounts.length})</span>
              </button>

              <button
                onClick={() => setMountModalTab("docker_compose")}
                className={`px-3 py-2 text-xs font-bold transition rounded-t-lg border-b-2 flex items-center gap-1.5 cursor-pointer ${
                  mountModalTab === "docker_compose"
                    ? "border-purple-500 text-purple-400 bg-white/5"
                    : "border-transparent text-white/50 hover:text-white"
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Docker Compose YAML Guide</span>
              </button>
            </div>

            {/* Tab 1: Configured Mounts & Add Custom */}
            {mountModalTab === "configured" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/80">Active Storage Mount Points:</label>
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {mounts.map((m) => (
                      <div key={m.id} className="p-3 bg-[#0A0A0A] border border-white/10 rounded-lg flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-white flex items-center gap-2">
                            <span>{m.name}</span>
                            <span className="text-[9px] px-1.5 py-0.2 bg-white/10 text-white/60 rounded uppercase">{m.type}</span>
                          </div>
                          <div className="text-[10px] text-white/40">{m.path}</div>
                        </div>
                        {m.id !== "default" && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMount(m.id)}
                            className="p-1 text-red-400 hover:bg-red-500/20 rounded transition"
                            title="Remove Mount Point"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Form to Add New Mount */}
                <form onSubmit={handleAddMount} className="space-y-3 pt-3 border-t border-white/10">
                  <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add New Storage Mount Point</span>
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-white/60 block mb-1">Mount Display Name</label>
                      <input
                        type="text"
                        placeholder="e.g. OMV Server Downloads"
                        value={newMountName}
                        onChange={(e) => setNewMountName(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#0A0A0A] border border-white/10 rounded text-xs text-white focus:border-emerald-500 focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-white/60 block mb-1">Mount Type</label>
                      <select
                        value={newMountType}
                        onChange={(e) => setNewMountType(e.target.value as any)}
                        className="w-full px-3 py-1.5 bg-[#0A0A0A] border border-white/10 rounded text-xs text-white focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="omv_nas">OpenMediaVault (NFS/SMB Share)</option>
                        <option value="external_drive">External SSD / USB Storage</option>
                        <option value="custom_directory">Custom System Directory</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-white/60 block mb-1">Absolute Directory Path on System/Host</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. /mnt/omv_media/wetransfer or /media/ssd/downloads"
                        value={newMountPath}
                        onChange={(e) => setNewMountPath(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-[#0A0A0A] border border-white/10 rounded text-xs text-white focus:border-emerald-500 focus:outline-none"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => handleTestMountPath()}
                        disabled={isTestingMount || !newMountPath.trim()}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded transition flex items-center gap-1 disabled:opacity-50"
                      >
                        {isTestingMount ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Test Path"}
                      </button>
                    </div>
                  </div>

                  {mountTestResult && (
                    <div className={`p-2.5 rounded text-[11px] border flex items-center gap-2 ${
                      mountTestResult.writable 
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-red-500/10 border-red-500/30 text-red-300"
                    }`}>
                      {mountTestResult.writable ? <Check className="w-4 h-4 shrink-0 text-emerald-400" /> : <X className="w-4 h-4 shrink-0 text-red-400" />}
                      <span>{mountTestResult.message || mountTestResult.error}</span>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowMountModal(false)}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs rounded transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded transition flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Storage Mount</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Tab 2: Docker Auto-Discovered Volumes */}
            {mountModalTab === "docker_discover" && (
              <div className="space-y-4">
                <p className="text-xs text-white/60">
                  The system automatically scans container system volumes (e.g. <code className="text-blue-300">/mnt/omv_media</code>, <code className="text-purple-300">/media/ssd</code>, <code className="text-emerald-300">/app/downloads</code>) and environment paths to detect active Docker Compose mounts:
                </p>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {discoveredDockerMounts.map((disc, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-[#0A0A0A] border border-white/10 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>{disc.name}</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded uppercase font-bold ${
                            disc.status.writable
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          }`}>
                            {disc.status.writable ? "ONLINE & WRITABLE" : "NOT MOUNTED YET"}
                          </span>
                        </div>
                        <div className="text-[10px] text-white/40 mt-0.5">{disc.path}</div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleImportDockerMount(disc)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] rounded transition flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Enable Mount</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 3: Docker Compose YAML Snippet Helper */}
            {mountModalTab === "docker_compose" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Example <code className="text-purple-300">docker-compose.yml</code> Volume Mapping:</span>
                  <button
                    onClick={() => {
                      const snippet = `services:
  backend:
    image: applet-cockpit
    volumes:
      - ./downloads:/app/downloads
      - /srv/dev-disk-by-uuid-omv/downloads:/mnt/omv_media
      - /media/external_ssd:/media/ssd`;
                      navigator.clipboard.writeText(snippet);
                      setCopiedComposeSnippet(true);
                      setTimeout(() => setCopiedComposeSnippet(false), 2000);
                    }}
                    className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white text-[11px] rounded transition flex items-center gap-1"
                  >
                    {copiedComposeSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedComposeSnippet ? "Copied!" : "Copy YAML"}</span>
                  </button>
                </div>

                <pre className="bg-black/80 border border-white/10 p-3.5 rounded-lg text-emerald-400 font-mono text-[11px] leading-relaxed overflow-x-auto">
{`services:
  backend:
    build: .
    environment:
      - PORT=3200
      - DOCKER_VOLUMES=/mnt/omv_media:/media/ssd
    volumes:
      # Local workspace downloads
      - ./downloads:/app/downloads
      # OpenMediaVault (OMV) NAS Share Mount
      - /srv/dev-disk-by-uuid-omv/share:/mnt/omv_media
      # External USB / NVMe SSD Mount
      - /media/external_ssd:/media/ssd`}
                </pre>
                <p className="text-[10px] text-white/50 leading-relaxed">
                  When you run <code className="text-white">docker compose up -d</code> with these volume mappings, the backend container will automatically write WeTransfer downloads directly to your OpenMediaVault server share or mounted SSD!
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NOTIFICATION CENTER SETTINGS MODAL */}
      {showNotificationModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/10 rounded-xl max-w-xl w-full p-6 space-y-5 font-mono shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowNotificationModal(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Notification & Alert Center</h3>
                <p className="text-xs text-white/50">Get popups on MacBook, email logs, webhooks, and completion chimes</p>
              </div>
            </div>

            <form onSubmit={handleSaveNotificationConfig} className="space-y-4">
              {/* Option 1: Native System Desktop / MacBook Popups */}
              <div className="p-3.5 bg-[#0A0A0A] border border-white/10 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="text-xs font-bold text-white">MacBook System / Browser Desktop Notifications</div>
                      <div className="text-[10px] text-white/50">Native system popup alerts when downloads complete or fail</div>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifConfig.enableDesktopNotifications}
                      onChange={(e) => setNotifConfig({ ...notifConfig, enableDesktopNotifications: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {desktopPermission !== "granted" ? (
                  <button
                    type="button"
                    onClick={handleRequestDesktopPermission}
                    className="w-full py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded text-xs font-bold transition flex items-center justify-center gap-1.5 mt-2"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Grant MacBook System Permission</span>
                  </button>
                ) : (
                  <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>MacBook System Desktop Permission Active</span>
                  </div>
                )}
              </div>

              {/* Option 2: Email Notifications */}
              <div className="p-3.5 bg-[#0A0A0A] border border-white/10 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-400" />
                    <div>
                      <div className="text-xs font-bold text-white">Email Notifications</div>
                      <div className="text-[10px] text-white/50">Send email logs directly when background jobs complete</div>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifConfig.enableEmailNotifications}
                      onChange={(e) => setNotifConfig({ ...notifConfig, enableEmailNotifications: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {notifConfig.enableEmailNotifications && (
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <div>
                      <label className="text-[10px] text-white/60 block mb-1">Recipient Email Address</label>
                      <input
                        type="email"
                        placeholder="e.g. user@example.com"
                        value={notifConfig.emailRecipient || ""}
                        onChange={(e) => setNotifConfig({ ...notifConfig, emailRecipient: e.target.value })}
                        className="w-full px-3 py-1.5 bg-black border border-white/10 rounded text-xs text-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-white/60 block mb-1">SMTP Host (Optional)</label>
                        <input
                          type="text"
                          placeholder="smtp.gmail.com"
                          value={notifConfig.smtpHost || ""}
                          onChange={(e) => setNotifConfig({ ...notifConfig, smtpHost: e.target.value })}
                          className="w-full px-2.5 py-1 bg-black border border-white/10 rounded text-[11px] text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-white/60 block mb-1">SMTP User (Optional)</label>
                        <input
                          type="text"
                          placeholder="user@gmail.com"
                          value={notifConfig.smtpUser || ""}
                          onChange={(e) => setNotifConfig({ ...notifConfig, smtpUser: e.target.value })}
                          className="w-full px-2.5 py-1 bg-black border border-white/10 rounded text-[11px] text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Option 3: Webhook Alerts & Sound Chimes */}
              <div className="p-3.5 bg-[#0A0A0A] border border-white/10 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-purple-400" />
                    <div>
                      <div className="text-xs font-bold text-white">Webhook Alerts (Slack / Discord / Ntfy)</div>
                      <div className="text-[10px] text-white/50">Send HTTP JSON POST alerts on completion</div>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifConfig.enableWebhookNotifications}
                      onChange={(e) => setNotifConfig({ ...notifConfig, enableWebhookNotifications: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                {notifConfig.enableWebhookNotifications && (
                  <div>
                    <input
                      type="url"
                      placeholder="https://discord.com/api/webhooks/... or https://ntfy.sh/my_topic"
                      value={notifConfig.webhookUrl || ""}
                      onChange={(e) => setNotifConfig({ ...notifConfig, webhookUrl: e.target.value })}
                      className="w-full px-3 py-1.5 bg-black border border-white/10 rounded text-xs text-white focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">Audio Completion Chime Sound</span>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifConfig.enableSoundAlerts}
                      onChange={(e) => setNotifConfig({ ...notifConfig, enableSoundAlerts: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>

              {notifSuccessMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{notifSuccessMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleSendTestNotification}
                  className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold text-xs rounded transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Notification</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNotificationModal(false)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs rounded transition"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingNotif}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSavingNotif ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Save Settings</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Notification Dispatch History Logs */}
            {notificationLogs.length > 0 && (
              <div className="pt-3 border-t border-white/10 space-y-2">
                <label className="text-[11px] font-bold text-white/70">Recent Notification History Logs:</label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto text-[10px] text-white/60">
                  {notificationLogs.map((log, idx) => (
                    <div key={idx} className="p-2 bg-[#0A0A0A] rounded border border-white/5 flex items-center justify-between">
                      <span className="truncate max-w-xs">{log.subject}</span>
                      <span className="text-emerald-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
