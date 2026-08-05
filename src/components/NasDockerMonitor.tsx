import React, { useState, useEffect } from "react";
import {
  Server,
  HardDrive,
  Activity,
  Cpu,
  Database,
  Terminal,
  RefreshCw,
  Play,
  Square,
  RotateCw,
  X,
  Copy,
  Check,
  AlertTriangle,
  Info,
  Zap,
  Gauge,
  Sliders,
  Layers,
  Box,
  ChevronRight,
  ShieldCheck
} from "lucide-react";

interface ContainerItem {
  id: string;
  shortId: string;
  name: string;
  names: string[];
  image: string;
  state: string;
  status: string;
  created: number;
  ports: string[];
  appCategory: "cronpilot" | "webtop" | "dashy" | "nas_infrastructure" | "other";
}

interface ContainerStats {
  containerId: string;
  cpuPercent: number;
  memoryUsageBytes: number;
  memoryLimitBytes: number;
  memoryPercent: number;
  netRxBytes: number;
  netTxBytes: number;
  readTime?: string;
}

interface DriveBranch {
  path: string;
  name: string;
  exists: boolean;
  writable: boolean;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  fillPercent: number;
  status: "online" | "read_only" | "not_mounted";
}

interface MergerfsSummary {
  onlineBranchCount: number;
  totalPoolBytes: number;
  usedPoolBytes: number;
  freePoolBytes: number;
  fillPercent: number;
  createPolicy: string;
  distributionMessage: string;
}

interface BenchmarkResult {
  branchPath: string;
  resolvedPath: string;
  writeSpeedMBps: number;
  readSpeedMBps: number;
  fileSizeBytes: number;
  durationMs: number;
  status: string;
  rating: string;
}

interface Props {
  onClose?: () => void;
}

export const NasDockerMonitor: React.FC<Props> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<"docker" | "mergerfs" | "setup">("docker");

  // Threshold Configuration State (Persisted in localStorage)
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [cpuWarnThreshold, setCpuWarnThreshold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("nas_alert_thresholds");
      if (saved) return JSON.parse(saved).cpuWarnThreshold ?? 80;
    } catch (e) {}
    return 80;
  });
  const [memoryWarnThreshold, setMemoryWarnThreshold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("nas_alert_thresholds");
      if (saved) return JSON.parse(saved).memoryWarnThreshold ?? 80;
    } catch (e) {}
    return 80;
  });

  // Docker State
  const [socketAvailable, setSocketAvailable] = useState<boolean | null>(null);
  const [socketPath, setSocketPath] = useState<string>("/var/run/docker.sock");
  const [containers, setContainers] = useState<ContainerItem[]>([]);
  const [containerStats, setContainerStats] = useState<Record<string, ContainerStats>>({});
  const [loadingContainers, setLoadingContainers] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  
  // Poll Frequency state (min 0.5s / 500ms)
  const [pollIntervalMs, setPollIntervalMs] = useState<number>(1000);

  // Selected Logs
  const [activeLogContainer, setActiveLogContainer] = useState<ContainerItem | null>(null);
  const [logsText, setLogsText] = useState("");
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsCopied, setLogsCopied] = useState(false);

  // MergerFS State
  const [inspectedBranches, setInspectedBranches] = useState<DriveBranch[]>([]);
  const [mergerfsSummary, setMergerfsSummary] = useState<MergerfsSummary | null>(null);
  const [loadingMergerfs, setLoadingMergerfs] = useState(false);
  const [benchmarks, setBenchmarks] = useState<Record<string, BenchmarkResult>>({});
  const [benchmarkingBranch, setBenchmarkingBranch] = useState<string | null>(null);

  // Action Pending
  const [actionPendingId, setActionPendingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (text: string, type: "success" | "error" | "info" = "info") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB", "PB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  // Fetch Docker Containers
  const fetchContainers = async () => {
    setLoadingContainers(true);
    try {
      const res = await fetch("/api/docker/containers");
      const data = await res.json();
      setSocketAvailable(data.socketAvailable);
      if (data.socketPath) setSocketPath(data.socketPath);
      if (data.socketAvailable && Array.isArray(data.containers)) {
        setContainers(data.containers);
        data.containers.forEach((c: ContainerItem) => {
          if (c.state === "running") {
            fetchContainerStats(c.id);
          }
        });
      }
    } catch (e: any) {
      setSocketAvailable(false);
    } finally {
      setLoadingContainers(false);
    }
  };

  // Fetch Individual Container Live Stats
  const fetchContainerStats = async (id: string) => {
    try {
      const res = await fetch(`/api/docker/containers/${id}/stats`);
      if (res.ok) {
        const stats: ContainerStats = await res.json();
        setContainerStats((prev) => ({ ...prev, [id]: stats }));
      }
    } catch (e) {}
  };

  // Fetch Container Logs
  const fetchContainerLogs = async (container: ContainerItem) => {
    setActiveLogContainer(container);
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/docker/containers/${container.id}/logs`);
      const data = await res.json();
      setLogsText(data.logs || "No logs output recorded.");
    } catch (e: any) {
      setLogsText(`Error fetching logs: ${e.message}`);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Handle Container Lifecycle Action
  const handleContainerAction = async (id: string, action: "start" | "stop" | "restart") => {
    setActionPendingId(id);
    try {
      const res = await fetch(`/api/docker/containers/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Signal '${action}' sent to container successfully`, "success");
        setTimeout(fetchContainers, 1500);
      } else {
        showToast(data.error || `Failed to ${action} container`, "error");
      }
    } catch (e: any) {
      showToast(`Error: ${e.message}`, "error");
    } finally {
      setActionPendingId(null);
    }
  };

  // Fetch MergerFS Pool & Branches
  const fetchMergerfsPools = async () => {
    setLoadingMergerfs(true);
    try {
      const res = await fetch("/api/mergerfs/pools");
      const data = await res.json();
      if (res.ok) {
        setInspectedBranches(data.inspectedBranches || []);
        setMergerfsSummary(data.summary || null);
      }
    } catch (e) {
      showToast("Failed to inspect mergerfs pool", "error");
    } finally {
      setLoadingMergerfs(false);
    }
  };

  // Benchmark MergerFS Branch Speed
  const runDriveBenchmark = async (branchPath: string) => {
    setBenchmarkingBranch(branchPath);
    try {
      const res = await fetch("/api/mergerfs/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchPath })
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setBenchmarks((prev) => ({ ...prev, [branchPath]: data }));
        showToast(`Benchmark complete for ${branchPath}: ${data.writeSpeedMBps} MB/s Write, ${data.readSpeedMBps} MB/s Read`, "success");
      } else {
        showToast(data.error || "Benchmark test failed", "error");
      }
    } catch (e: any) {
      showToast(`Benchmark error: ${e.message}`, "error");
    } finally {
      setBenchmarkingBranch(null);
    }
  };

  const saveThresholds = (newCpu: number, newMem: number) => {
    setCpuWarnThreshold(newCpu);
    setMemoryWarnThreshold(newMem);
    try {
      localStorage.setItem(
        "nas_alert_thresholds",
        JSON.stringify({ cpuWarnThreshold: newCpu, memoryWarnThreshold: newMem })
      );
    } catch (e) {}
    showToast(`Alert thresholds updated: CPU ${newCpu}%, RAM ${newMem}%`, "success");
    setShowThresholdModal(false);
  };

  // Initial fetch
  useEffect(() => {
    fetchContainers();
    fetchMergerfsPools();
  }, []);

  // Poll interval effect (supports down to 0.5s / 500ms)
  useEffect(() => {
    if (!pollIntervalMs || pollIntervalMs <= 0) return;
    const interval = setInterval(() => {
      if (activeTab === "docker") fetchContainers();
      if (activeTab === "mergerfs") fetchMergerfsPools();
    }, pollIntervalMs);
    return () => clearInterval(interval);
  }, [pollIntervalMs, activeTab]);

  // Filtered Containers
  const filteredContainers = containers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.image.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.ports.some((p) => p.includes(searchFilter));
    const matchesCategory = categoryFilter === "all" || c.appCategory === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Count containers exceeding warning thresholds
  const alertContainers = containers.filter((c) => {
    if (c.state !== "running") return false;
    const stats = containerStats[c.id];
    if (!stats) return false;
    return stats.cpuPercent >= cpuWarnThreshold || stats.memoryPercent >= memoryWarnThreshold;
  });

  return (
    <div className="NasDockerMonitor bg-[#121212] text-white/90 rounded-none md:rounded-lg border border-white/10 shadow-2xl flex flex-col max-w-6xl w-full mx-auto overflow-hidden font-sans">
      {/* Toast Notification Bar */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-2 rounded border text-xs font-mono font-bold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200 ${
            toastMessage.type === "success"
              ? "bg-[#161616] border-emerald-500/50 text-emerald-400"
              : toastMessage.type === "error"
              ? "bg-[#161616] border-rose-500/50 text-rose-400"
              : "bg-[#161616] border-sky-500/50 text-sky-400"
          }`}
        >
          <Info className="w-4 h-4 shrink-0" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="px-5 py-4 bg-[#161616] border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-white tracking-wide uppercase font-mono">NAS Docker Engine & MergerFS Cockpit</h2>
              {socketAvailable ? (
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[9px] font-mono font-bold rounded uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Docker Socket Online
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[9px] font-mono font-bold rounded uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  Socket Binding Required
                </span>
              )}
              {alertContainers.length > 0 && (
                <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-mono font-bold rounded uppercase tracking-wider flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                  {alertContainers.length} {alertContainers.length === 1 ? "Container Exceeded Threshold" : "Containers Exceeded Threshold"}
                </span>
              )}
            </div>
            <p className="text-[11px] text-white/40 mt-0.5 font-sans">
              Real-time telemetry for Cronpilot, Linux Webtop, Dashy, and MergerFS storage drive pools
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto font-mono text-xs">
          <button
            onClick={() => setShowThresholdModal(true)}
            className="px-2.5 py-1.5 bg-[#1f1f1f] hover:bg-[#282828] border border-white/10 text-white/70 hover:text-white transition flex items-center gap-1.5 cursor-pointer rounded-sm"
            title="Configure CPU and Memory Alert Thresholds"
          >
            <Sliders className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Alert Limits ({cpuWarnThreshold}% / {memoryWarnThreshold}%)</span>
          </button>

          <button
            onClick={() => {
              if (activeTab === "docker") fetchContainers();
              if (activeTab === "mergerfs") fetchMergerfsPools();
            }}
            className="px-2.5 py-1.5 bg-[#1f1f1f] hover:bg-[#282828] border border-white/10 text-white/70 hover:text-white transition flex items-center gap-1.5 cursor-pointer rounded-sm"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(loadingContainers || loadingMergerfs) ? "animate-spin text-emerald-400" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 bg-[#1f1f1f] hover:bg-rose-500/20 text-white/40 hover:text-rose-300 border border-white/10 transition cursor-pointer rounded-sm"
              title="Close Panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs & Poll Frequency Bar */}
      <div className="px-5 bg-[#0f0f0f] border-b border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 py-2 font-mono">
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("docker")}
            className={`px-3 py-1.5 rounded-sm text-xs transition flex items-center gap-2 cursor-pointer ${
              activeTab === "docker"
                ? "bg-[#222222] text-white font-bold border border-white/20"
                : "text-white/50 hover:text-white hover:bg-white/5 border border-transparent"
            }`}
          >
            <Box className="w-3.5 h-3.5 text-emerald-400" />
            <span>Containers ({containers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("mergerfs")}
            className={`px-3 py-1.5 rounded-sm text-xs transition flex items-center gap-2 cursor-pointer ${
              activeTab === "mergerfs"
                ? "bg-[#222222] text-white font-bold border border-white/20"
                : "text-white/50 hover:text-white hover:bg-white/5 border border-transparent"
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 text-sky-400" />
            <span>MergerFS Pool</span>
          </button>

          <button
            onClick={() => setActiveTab("setup")}
            className={`px-3 py-1.5 rounded-sm text-xs transition flex items-center gap-2 cursor-pointer ${
              activeTab === "setup"
                ? "bg-[#222222] text-white font-bold border border-white/20"
                : "text-white/50 hover:text-white hover:bg-white/5 border border-transparent"
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-purple-400" />
            <span>Setup Guide</span>
          </button>
        </div>

        {/* Poll Frequency Selector (min 0.5s) */}
        <div className="flex items-center gap-2 text-xs text-white/60 bg-[#161616] px-2.5 py-1 rounded border border-white/10 self-end sm:self-auto">
          <span className="text-white/40 text-[10px] uppercase tracking-wider">Poll Rate:</span>
          <select
            value={pollIntervalMs}
            onChange={(e) => setPollIntervalMs(Number(e.target.value))}
            className="bg-[#121212] border border-white/10 rounded px-2 py-0.5 text-xs text-emerald-400 font-bold focus:outline-none focus:border-emerald-500/50 cursor-pointer"
          >
            <option value={500}>0.5s (Ultra Fast)</option>
            <option value={1000}>1s (Fast)</option>
            <option value={2000}>2s (Normal)</option>
            <option value={5000}>5s (Relaxed)</option>
            <option value={10000}>10s (Slow)</option>
            <option value={0}>Paused</option>
          </select>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="p-5 max-h-[72vh] overflow-y-auto space-y-5 bg-[#121212]">
        {/* --- TAB 1: DOCKER CONTAINERS ENGINE --- */}
        {activeTab === "docker" && (
          <div className="space-y-4 font-mono">
            {/* Socket Offline Notice */}
            {socketAvailable === false && (
              <div className="p-3.5 bg-[#1a150c] border border-amber-500/30 rounded-sm text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-amber-300">Docker Socket Not Bound</h4>
                    <p className="text-amber-200/70 text-[11px] mt-0.5 font-sans">
                      Bind <code className="text-white bg-black/40 px-1 py-0.5 rounded">{socketPath}</code> into this container to auto-discover containers and stream CPU/RAM.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab("setup")}
                  className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded border border-amber-500/40 text-xs font-bold transition whitespace-nowrap self-start sm:self-auto cursor-pointer"
                >
                  View Setup Guide
                </button>
              </div>
            )}

            {/* Quick Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#161616] p-3 rounded-sm border border-white/10">
              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Filter name, image, port..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-[#121212] border border-white/10 rounded px-3 py-1 text-xs text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
                {[
                  { id: "all", label: "All" },
                  { id: "cronpilot", label: "Cronpilot" },
                  { id: "webtop", label: "Webtop" },
                  { id: "dashy", label: "Dashy" },
                  { id: "nas_infrastructure", label: "NAS / OMV" }
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-2.5 py-1 rounded text-[10px] transition whitespace-nowrap cursor-pointer uppercase tracking-wider ${
                      categoryFilter === cat.id
                        ? "bg-white/15 text-white font-bold border border-white/30"
                        : "bg-[#121212] text-white/50 border border-white/5 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Container Grid */}
            {filteredContainers.length === 0 ? (
              <div className="p-8 text-center bg-[#161616] rounded-sm border border-white/10">
                <Box className="w-8 h-8 text-white/20 mx-auto mb-2" />
                <h3 className="text-xs font-bold text-white/70 uppercase tracking-wider">No Docker Containers Matched</h3>
                <p className="text-[11px] text-white/40 mt-1 max-w-md mx-auto font-sans">
                  {socketAvailable === false
                    ? "Connect Docker Engine socket /var/run/docker.sock to auto-discover containers."
                    : "Try clearing search filters."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredContainers.map((container) => {
                  const isRunning = container.state === "running";
                  const stats = containerStats[container.id];

                  const isCpuExceeded = Boolean(isRunning && stats && stats.cpuPercent >= cpuWarnThreshold);
                  const isMemExceeded = Boolean(isRunning && stats && stats.memoryPercent >= memoryWarnThreshold);
                  const hasAlert = isCpuExceeded || isMemExceeded;

                  let badgeColor = "bg-[#222222] text-white/60 border-white/10";
                  let categoryLabel = "OTHER";
                  if (container.appCategory === "cronpilot") {
                    badgeColor = "bg-purple-950/40 text-purple-300 border-purple-800/40";
                    categoryLabel = "CRONPILOT";
                  } else if (container.appCategory === "webtop") {
                    badgeColor = "bg-blue-950/40 text-blue-300 border-blue-800/40";
                    categoryLabel = "WEBTOP";
                  } else if (container.appCategory === "dashy") {
                    badgeColor = "bg-amber-950/40 text-amber-300 border-amber-800/40";
                    categoryLabel = "DASHY";
                  } else if (container.appCategory === "nas_infrastructure") {
                    badgeColor = "bg-emerald-950/40 text-emerald-300 border-emerald-800/40";
                    categoryLabel = "NAS / OMV";
                  }

                  return (
                    <div
                      key={container.id}
                      className={`bg-[#161616] border rounded-sm p-3.5 transition flex flex-col justify-between space-y-3 ${
                        hasAlert
                          ? "border-rose-500/60 bg-[#1c1214]"
                          : "border-white/10 hover:border-white/20"
                      }`}
                    >
                      {/* Top Bar */}
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${badgeColor}`}
                            >
                              {categoryLabel}
                            </span>
                            {hasAlert && (
                              <span
                                className="px-1.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-bold rounded flex items-center gap-1 animate-pulse"
                                title={`CPU: ${stats?.cpuPercent}% (Warn: ${cpuWarnThreshold}%), RAM: ${stats?.memoryPercent}% (Warn: ${memoryWarnThreshold}%)`}
                              >
                                <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                                <span>
                                  {isCpuExceeded && isMemExceeded
                                    ? "CPU & RAM EXCEEDED"
                                    : isCpuExceeded
                                    ? `CPU > ${cpuWarnThreshold}%`
                                    : `RAM > ${memoryWarnThreshold}%`}
                                </span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isRunning
                                  ? hasAlert
                                    ? "bg-rose-500 animate-pulse"
                                    : "bg-emerald-400"
                                  : "bg-rose-500/60"
                              }`}
                            />
                            <span className="text-[10px] uppercase text-white/50">
                              {container.state}
                            </span>
                          </div>
                        </div>

                        <h3 className="font-bold text-white text-xs truncate" title={container.name}>
                          {container.name}
                        </h3>

                        <div className="text-[10px] text-white/30 truncate mt-0.5" title={container.image}>
                          {container.image}
                        </div>
                      </div>

                      {/* Live Usage Telemetry */}
                      {isRunning && (
                        <div
                          className={`p-2.5 rounded border space-y-2 text-[10px] transition ${
                            hasAlert
                              ? "bg-rose-950/20 border-rose-500/30"
                              : "bg-[#121212] border-white/5"
                          }`}
                        >
                          {/* CPU Gauge */}
                          <div>
                            <div className="flex justify-between text-white/50 mb-1">
                              <span className="flex items-center gap-1">
                                <Cpu className={`w-3 h-3 ${isCpuExceeded ? "text-rose-400" : "text-emerald-400"}`} /> CPU
                              </span>
                              <span className={isCpuExceeded ? "font-bold text-rose-400" : "font-bold text-emerald-400"}>
                                {stats ? `${stats.cpuPercent}%` : "..."}
                              </span>
                            </div>
                            <div className="w-full h-1 bg-[#222] rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  isCpuExceeded ? "bg-rose-500" : "bg-emerald-400"
                                }`}
                                style={{ width: `${Math.min(stats?.cpuPercent || 0, 100)}%` }}
                              />
                            </div>
                          </div>

                          {/* RAM Gauge */}
                          <div>
                            <div className="flex justify-between text-white/50 mb-1">
                              <span className="flex items-center gap-1">
                                <Database className={`w-3 h-3 ${isMemExceeded ? "text-rose-400" : "text-sky-400"}`} /> Memory
                              </span>
                              <span className={isMemExceeded ? "font-bold text-rose-400" : "font-bold text-sky-400"}>
                                {stats ? `${formatBytes(stats.memoryUsageBytes)} (${stats.memoryPercent}%)` : "..."}
                              </span>
                            </div>
                            <div className="w-full h-1 bg-[#222] rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  isMemExceeded ? "bg-rose-500" : "bg-sky-400"
                                }`}
                                style={{ width: `${Math.min(stats?.memoryPercent || 0, 100)}%` }}
                              />
                            </div>
                          </div>

                          {/* Network Throughput */}
                          {stats && (
                            <div className="flex items-center justify-between text-[9px] text-white/30 pt-1 border-t border-white/5">
                              <span>Rx: {formatBytes(stats.netRxBytes)}</span>
                              <span>Tx: {formatBytes(stats.netTxBytes)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Ports & Actions Bar */}
                      <div>
                        {container.ports.length > 0 && (
                          <div className="text-[10px] text-white/40 mb-2 truncate">
                            Ports: {container.ports.join(", ")}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                          <button
                            onClick={() => fetchContainerLogs(container)}
                            className="px-2 py-1 bg-[#121212] hover:bg-white/10 text-white/70 hover:text-white rounded text-[10px] transition flex items-center gap-1 border border-white/10 cursor-pointer"
                          >
                            <Terminal className="w-3 h-3 text-sky-400" />
                            <span>Logs</span>
                          </button>

                          <div className="flex items-center gap-1">
                            {isRunning ? (
                              <>
                                <button
                                  onClick={() => handleContainerAction(container.id, "restart")}
                                  disabled={actionPendingId === container.id}
                                  className="p-1 bg-[#121212] hover:bg-amber-500/20 text-white/50 hover:text-amber-300 border border-white/10 rounded transition cursor-pointer"
                                  title="Restart Container"
                                >
                                  <RotateCw className={`w-3.5 h-3.5 ${actionPendingId === container.id ? "animate-spin" : ""}`} />
                                </button>
                                <button
                                  onClick={() => handleContainerAction(container.id, "stop")}
                                  disabled={actionPendingId === container.id}
                                  className="p-1 bg-[#121212] hover:bg-rose-500/20 text-white/50 hover:text-rose-300 border border-white/10 rounded transition cursor-pointer"
                                  title="Stop Container"
                                >
                                  <Square className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleContainerAction(container.id, "start")}
                                disabled={actionPendingId === container.id}
                                className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded text-[10px] transition flex items-center gap-1 cursor-pointer"
                              >
                                <Play className="w-3 h-3" />
                                <span>Start</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* --- TAB 2: MERGERFS POOL ANALYZER --- */}
        {activeTab === "mergerfs" && (
          <div className="space-y-4 font-mono">
            {/* Pool Aggregated Summary Card */}
            {mergerfsSummary && (
              <div className="p-4 bg-[#161616] border border-white/10 rounded-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-sky-400" />
                      <h3 className="font-bold text-white text-xs uppercase tracking-wider">MergerFS Storage Pool Overview</h3>
                    </div>
                    <p className="text-[11px] text-white/40 mt-0.5 font-sans">
                      Aggregated drive branches and balance policy
                    </p>
                  </div>

                  <span className="px-2 py-0.5 bg-[#121212] text-sky-300 border border-sky-500/30 text-[10px] font-bold rounded">
                    Policy: {mergerfsSummary.createPolicy}
                  </span>
                </div>

                {/* Pool Fill Meter */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-white/50">Capacity Usage</span>
                    <span className="font-bold text-sky-300">
                      {formatBytes(mergerfsSummary.usedPoolBytes)} / {formatBytes(mergerfsSummary.totalPoolBytes)} ({mergerfsSummary.fillPercent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#121212] rounded overflow-hidden border border-white/5">
                    <div
                      className={`h-full transition-all duration-500 ${
                        mergerfsSummary.fillPercent > 85
                          ? "bg-rose-500"
                          : mergerfsSummary.fillPercent > 70
                          ? "bg-amber-400"
                          : "bg-sky-400"
                      }`}
                      style={{ width: `${Math.min(mergerfsSummary.fillPercent, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-white/40 mt-1">
                    <span>Active Branches: {mergerfsSummary.onlineBranchCount} Drives</span>
                    <span>Free: {formatBytes(mergerfsSummary.freePoolBytes)}</span>
                  </div>
                </div>

                {/* Distribution Balance Message */}
                <div className="p-2.5 bg-[#121212] rounded border border-white/5 text-[11px] text-white/70 flex items-center gap-2 font-sans">
                  <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>{mergerfsSummary.distributionMessage}</span>
                </div>
              </div>
            )}

            {/* Individual Drive Branches Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-xs tracking-wider uppercase flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  MergerFS Drive Branches ({inspectedBranches.length})
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {inspectedBranches.map((branch) => {
                  const bench = benchmarks[branch.path];
                  const isBenchmarking = benchmarkingBranch === branch.path;

                  return (
                    <div
                      key={branch.path}
                      className="bg-[#161616] border border-white/10 rounded-sm p-3.5 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-white text-xs truncate" title={branch.name}>
                            {branch.name}
                          </h4>
                          <div className="text-[10px] text-white/40 truncate">{branch.path}</div>
                        </div>

                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                            branch.exists
                              ? branch.writable
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                              : "bg-[#222] text-white/30 border-white/10"
                          }`}
                        >
                          {branch.exists ? (branch.writable ? "ONLINE & WRITABLE" : "READ ONLY") : "NOT MOUNTED"}
                        </span>
                      </div>

                      {/* Drive Space Fill Meter */}
                      {branch.exists ? (
                        <div>
                          <div className="flex justify-between text-[10px] text-white/50 mb-1">
                            <span>Drive Fill</span>
                            <span className="font-bold text-white/80">
                              {formatBytes(branch.usedBytes)} / {formatBytes(branch.totalBytes)} ({branch.fillPercent}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-[#121212] rounded overflow-hidden border border-white/5">
                            <div
                              className={`h-full transition-all duration-500 ${
                                branch.fillPercent > 85
                                  ? "bg-rose-500"
                                  : branch.fillPercent > 70
                                  ? "bg-amber-400"
                                  : "bg-emerald-400"
                              }`}
                              style={{ width: `${Math.min(branch.fillPercent, 100)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-white/30 italic p-2 bg-[#121212] rounded border border-white/5 font-sans">
                          To map this branch drive, bind its path in docker-compose.yml.
                        </div>
                      )}

                      {/* Speed Benchmark Results */}
                      {bench && (
                        <div className="p-2.5 bg-[#121212] border border-white/5 rounded text-[10px] space-y-1">
                          <div className="flex items-center justify-between text-emerald-400 font-bold">
                            <span className="flex items-center gap-1">
                              <Zap className="w-3 h-3 text-amber-400" /> Speed Benchmark
                            </span>
                            <span className="text-[9px] uppercase text-amber-300 px-1 py-0.2 bg-amber-500/10 rounded border border-amber-500/20">{bench.rating}</span>
                          </div>
                          <div className="flex justify-between text-white/60">
                            <span>Write: <strong className="text-white">{bench.writeSpeedMBps} MB/s</strong></span>
                            <span>Read: <strong className="text-white">{bench.readSpeedMBps} MB/s</strong></span>
                          </div>
                        </div>
                      )}

                      {/* Action Bar */}
                      <div className="pt-2 border-t border-white/10 flex justify-end">
                        <button
                          onClick={() => runDriveBenchmark(branch.path)}
                          disabled={!branch.exists || isBenchmarking}
                          className="px-2.5 py-1 bg-[#121212] hover:bg-white/10 text-white/70 hover:text-white border border-white/10 rounded text-[10px] transition flex items-center gap-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Gauge className={`w-3 h-3 ${isBenchmarking ? "animate-spin text-emerald-400" : ""}`} />
                          <span>{isBenchmarking ? "Testing..." : "Run Speed Test"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 3: REAL NAS SETUP GUIDE --- */}
        {activeTab === "setup" && (
          <div className="space-y-4 text-xs font-mono">
            <div className="p-4 bg-[#161616] border border-white/10 rounded-sm space-y-1.5">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-purple-400" />
                Connecting Your OpenMediaVault / Debian NAS Data
              </h3>
              <p className="text-white/50 leading-relaxed font-sans text-[11px]">
                This cockpit uses native UNIX domain socket communication for Docker Engine metrics and direct filesystem mounts for MergerFS drive pools.
              </p>
            </div>

            {/* Step 1: Docker Socket Setup */}
            <div className="bg-[#161616] border border-white/10 rounded-sm p-4 space-y-2.5">
              <h4 className="font-bold text-emerald-400 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <span>1.</span> Bind Docker Socket for Live Telemetry
              </h4>
              <p className="text-white/60 font-sans text-[11px]">
                In Portainer or <code className="text-white bg-black/40 px-1 py-0.5 rounded">docker-compose.yml</code>, bind the Docker daemon socket:
              </p>
              <pre className="bg-[#121212] p-3 rounded border border-white/5 text-emerald-300 overflow-x-auto text-[10px]">
{`services:
  cockpit-app:
    image: node:20
    container_name: cockpit_app
    ports:
      - "3000:3000"
    volumes:
      # Docker Socket for Live Container Health (Cronpilot, Webtop, Dashy)
      - /var/run/docker.sock:/var/run/docker.sock:ro

      # MergerFS Drive Pool & OMV Storage Shares
      - /mnt:/mnt:rw
      - /srv:/srv:rw
    environment:
      - NODE_ENV=production
      - MERGERFS_BRANCHES=/mnt/disk1:/mnt/disk2:/mnt/disk3`}
              </pre>
            </div>

            {/* Step 2: Docker CLI alternative */}
            <div className="bg-[#161616] border border-white/10 rounded-sm p-4 space-y-2.5">
              <h4 className="font-bold text-sky-400 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <span>2.</span> Terminal / Docker CLI Command
              </h4>
              <pre className="bg-[#121212] p-3 rounded border border-white/5 text-sky-300 overflow-x-auto text-[10px]">
{`docker run -d \\
  --name cockpit \\
  -p 3000:3000 \\
  -v /var/run/docker.sock:/var/run/docker.sock:ro \\
  -v /mnt:/mnt:rw \\
  -e MERGERFS_BRANCHES="/mnt/disk1:/mnt/disk2:/mnt/disk3" \\
  cockpit-app:latest`}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* --- LOGS VIEWER MODAL --- */}
      {activeLogContainer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-mono">
          <div className="bg-[#121212] border border-white/15 rounded-lg max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-3 bg-[#161616] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-white text-xs">
                  Logs: <span className="text-emerald-300">{activeLogContainer.name}</span>
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(logsText);
                    setLogsCopied(true);
                    setTimeout(() => setLogsCopied(false), 2000);
                  }}
                  className="px-2 py-1 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded text-[10px] transition flex items-center gap-1 border border-white/10 cursor-pointer"
                >
                  {logsCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{logsCopied ? "Copied" : "Copy"}</span>
                </button>
                <button
                  onClick={() => setActiveLogContainer(null)}
                  className="p-1 text-white/50 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 bg-[#0a0a0a] overflow-y-auto font-mono text-[10px] text-gray-300 leading-relaxed flex-1 whitespace-pre-wrap select-text">
              {loadingLogs ? (
                <div className="text-white/40 italic flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" /> Fetching container logs...
                </div>
              ) : (
                logsText
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- ALERT THRESHOLDS CONFIGURATION MODAL --- */}
      {showThresholdModal && (
        <ThresholdConfigModal
          cpuThreshold={cpuWarnThreshold}
          memoryThreshold={memoryWarnThreshold}
          onSave={saveThresholds}
          onClose={() => setShowThresholdModal(false)}
        />
      )}
    </div>
  );
};

// Threshold Config Sub-component
const ThresholdConfigModal: React.FC<{
  cpuThreshold: number;
  memoryThreshold: number;
  onSave: (cpu: number, mem: number) => void;
  onClose: () => void;
}> = ({ cpuThreshold, memoryThreshold, onSave, onClose }) => {
  const [tempCpu, setTempCpu] = useState(cpuThreshold);
  const [tempMem, setTempMem] = useState(memoryThreshold);

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <div className="bg-[#121212] border border-white/15 rounded-lg max-w-md w-full p-5 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded text-rose-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Alert Thresholds</h3>
              <p className="text-[11px] text-white/40 mt-0.5 font-sans">
                Set custom CPU and Memory limits for alert badges
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 font-mono">
          {/* CPU Slider */}
          <div className="bg-[#161616] p-3 rounded border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-bold text-white/80">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" /> CPU Limit
              </span>
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold rounded text-[11px]">
                {tempCpu}%
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={tempCpu}
              onChange={(e) => setTempCpu(Number(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-[#222] rounded"
            />
            <div className="flex justify-between text-[9px] text-white/30">
              <span>10%</span>
              <span>50%</span>
              <span>80%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Memory Slider */}
          <div className="bg-[#161616] p-3 rounded border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-bold text-white/80">
                <Database className="w-3.5 h-3.5 text-sky-400" /> Memory Limit
              </span>
              <span className="px-2 py-0.5 bg-sky-500/10 text-sky-400 border border-sky-500/30 font-bold rounded text-[11px]">
                {tempMem}%
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={tempMem}
              onChange={(e) => setTempMem(Number(e.target.value))}
              className="w-full accent-sky-400 cursor-pointer h-1.5 bg-[#222] rounded"
            />
            <div className="flex justify-between text-[9px] text-white/30">
              <span>10%</span>
              <span>50%</span>
              <span>80%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">Presets:</span>
            <div className="flex items-center gap-1">
              {[
                { label: "50%", cpu: 50, mem: 50 },
                { label: "80%", cpu: 80, mem: 80 },
                { label: "90%", cpu: 90, mem: 90 }
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setTempCpu(p.cpu);
                    setTempMem(p.mem);
                  }}
                  className="px-2 py-1 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 rounded text-[10px] transition cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10 font-mono">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded text-xs transition cursor-pointer border border-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(tempCpu, tempMem)}
            className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded text-xs transition cursor-pointer shadow-lg flex items-center gap-1"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Thresholds</span>
          </button>
        </div>
      </div>
    </div>
  );
};
