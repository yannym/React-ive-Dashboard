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
  ExternalLink,
  Zap,
  Gauge,
  Sliders,
  Layers,
  Box,
  Monitor,
  Calendar,
  LayoutGrid
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

  // Docker State
  const [socketAvailable, setSocketAvailable] = useState<boolean | null>(null);
  const [socketPath, setSocketPath] = useState<string>("/var/run/docker.sock");
  const [containers, setContainers] = useState<ContainerItem[]>([]);
  const [containerStats, setContainerStats] = useState<Record<string, ContainerStats>>({});
  const [loadingContainers, setLoadingContainers] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [autoRefresh, setAutoRefresh] = useState(true);

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
        // Fetch stats for running containers
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

  // Auto-refresh interval
  useEffect(() => {
    fetchContainers();
    fetchMergerfsPools();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (activeTab === "docker") fetchContainers();
      if (activeTab === "mergerfs") fetchMergerfsPools();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, activeTab]);

  // Filtered Containers
  const filteredContainers = containers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.image.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.ports.some((p) => p.includes(searchFilter));
    const matchesCategory = categoryFilter === "all" || c.appCategory === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="bg-[#0b0f19] text-gray-100 rounded-xl border border-white/10 shadow-2xl flex flex-col max-w-6xl w-full mx-auto overflow-hidden font-sans">
      {/* Toast Bar */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-2.5 rounded-lg border text-xs font-mono font-bold shadow-2xl flex items-center gap-2 animate-bounce ${
            toastMessage.type === "success"
              ? "bg-emerald-950 border-emerald-500/50 text-emerald-300"
              : toastMessage.type === "error"
              ? "bg-rose-950 border-rose-500/50 text-rose-300"
              : "bg-blue-950 border-blue-500/50 text-blue-300"
          }`}
        >
          <Info className="w-4 h-4 shrink-0" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="p-5 bg-gradient-to-r from-gray-950 via-[#0f172a] to-gray-950 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">NAS Server & Docker Engine Dashboard</h2>
              {socketAvailable ? (
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  DOCKER SOCKET ONLINE
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold rounded-full flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  SOCKET SETUP REQUIRED
                </span>
              )}
            </div>
            <p className="text-xs text-white/50">
              Live telemetry tracking for Cronpilot, Linux Webtop, Dashy, and MergerFS storage drive pools
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => {
              if (activeTab === "docker") fetchContainers();
              if (activeTab === "mergerfs") fetchMergerfsPools();
            }}
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/70 hover:text-white transition text-xs font-mono flex items-center gap-1.5 cursor-pointer"
            title="Refresh System Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(loadingContainers || loadingMergerfs) ? "animate-spin text-emerald-400" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 bg-white/5 hover:bg-rose-500/20 text-white/50 hover:text-rose-300 border border-white/10 rounded-lg transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="px-5 bg-black/40 border-b border-white/10 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1 py-2">
          <button
            onClick={() => setActiveTab("docker")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "docker"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Box className="w-4 h-4" />
            <span>Docker Containers ({containers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("mergerfs")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "mergerfs"
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>MergerFS Drive Pool</span>
          </button>

          <button
            onClick={() => setActiveTab("setup")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "setup"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>NAS Setup Guide</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 font-mono text-[11px] text-white/40">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded accent-emerald-500 cursor-pointer"
            />
            <span>Auto Poll (10s)</span>
          </label>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="p-5 max-h-[75vh] overflow-y-auto space-y-6">
        {/* --- TAB 1: DOCKER CONTAINERS ENGINE --- */}
        {activeTab === "docker" && (
          <div className="space-y-5">
            {/* Socket Offline Notice */}
            {socketAvailable === false && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-amber-300 text-sm">Docker Socket Not Bound Yet</h4>
                    <p className="text-amber-200/80 mt-0.5">
                      To pull real live CPU, RAM, and container stats from Cronpilot, Linux Webtop, and Dashy, bind{" "}
                      <code className="text-white bg-black/40 px-1 rounded">{socketPath}</code> into this container.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab("setup")}
                  className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg border border-amber-500/40 font-bold transition whitespace-nowrap self-start sm:self-auto cursor-pointer"
                >
                  View Docker Compose Config
                </button>
              </div>
            )}

            {/* Quick Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-black/30 p-3 rounded-xl border border-white/5">
              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Search container name, image, port..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-gray-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-emerald-500/50 font-mono"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
                {[
                  { id: "all", label: "All Containers" },
                  { id: "cronpilot", label: "Cronpilot" },
                  { id: "webtop", label: "Linux Webtop" },
                  { id: "dashy", label: "Dashy" },
                  { id: "nas_infrastructure", label: "NAS / OMV" }
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition whitespace-nowrap cursor-pointer ${
                      categoryFilter === cat.id
                        ? "bg-emerald-500 text-black font-bold"
                        : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Container Grid */}
            {filteredContainers.length === 0 ? (
              <div className="p-8 text-center bg-gray-900/40 rounded-xl border border-white/5">
                <Box className="w-10 h-10 text-white/20 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-white/80">No Matching Docker Containers Found</h3>
                <p className="text-xs text-white/40 mt-1 max-w-md mx-auto">
                  {socketAvailable === false
                    ? "Connect Docker Engine socket /var/run/docker.sock to auto-discover containers."
                    : "Try clearing search filters or launching target services."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredContainers.map((container) => {
                  const isRunning = container.state === "running";
                  const stats = containerStats[container.id];

                  // App specific icon/badge color
                  let badgeColor = "bg-gray-800 text-gray-300 border-gray-700";
                  let categoryLabel = "OTHER CONTAINER";
                  if (container.appCategory === "cronpilot") {
                    badgeColor = "bg-purple-950 text-purple-300 border-purple-800/50";
                    categoryLabel = "CRONPILOT TASKS";
                  } else if (container.appCategory === "webtop") {
                    badgeColor = "bg-blue-950 text-blue-300 border-blue-800/50";
                    categoryLabel = "LINUX WEBTOP";
                  } else if (container.appCategory === "dashy") {
                    badgeColor = "bg-amber-950 text-amber-300 border-amber-800/50";
                    categoryLabel = "DASHY PORTAL";
                  } else if (container.appCategory === "nas_infrastructure") {
                    badgeColor = "bg-emerald-950 text-emerald-300 border-emerald-800/50";
                    categoryLabel = "NAS SERVICE";
                  }

                  return (
                    <div
                      key={container.id}
                      className="bg-gray-900/80 border border-white/10 rounded-xl p-4 hover:border-white/20 transition flex flex-col justify-between space-y-4 shadow-lg group relative overflow-hidden"
                    >
                      {/* Top Bar */}
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${badgeColor}`}
                          >
                            {categoryLabel}
                          </span>

                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isRunning
                                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                                  : "bg-rose-500"
                              }`}
                            />
                            <span className="text-[10px] font-mono font-semibold uppercase text-white/70">
                              {container.state}
                            </span>
                          </div>
                        </div>

                        <h3 className="font-bold text-white text-sm truncate font-mono" title={container.name}>
                          {container.name}
                        </h3>

                        <div className="text-[11px] font-mono text-white/40 truncate mt-0.5" title={container.image}>
                          {container.image}
                        </div>

                        <div className="text-[10px] font-mono text-white/30 mt-1">
                          Status: {container.status}
                        </div>
                      </div>

                      {/* Live Usage Telemetry */}
                      {isRunning && (
                        <div className="bg-black/50 p-2.5 rounded-lg border border-white/5 space-y-2 font-mono text-[11px]">
                          {/* CPU Gauge */}
                          <div>
                            <div className="flex justify-between text-[10px] text-white/60 mb-1">
                              <span className="flex items-center gap-1">
                                <Cpu className="w-3 h-3 text-emerald-400" /> CPU Usage
                              </span>
                              <span className="font-bold text-emerald-300">
                                {stats ? `${stats.cpuPercent}%` : "Calculating..."}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${Math.min(stats?.cpuPercent || 0, 100)}%` }}
                              />
                            </div>
                          </div>

                          {/* RAM Gauge */}
                          <div>
                            <div className="flex justify-between text-[10px] text-white/60 mb-1">
                              <span className="flex items-center gap-1">
                                <Database className="w-3 h-3 text-blue-400" /> Memory (RAM)
                              </span>
                              <span className="font-bold text-blue-300">
                                {stats ? `${formatBytes(stats.memoryUsageBytes)} (${stats.memoryPercent}%)` : "Calculating..."}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 transition-all duration-500"
                                style={{ width: `${Math.min(stats?.memoryPercent || 0, 100)}%` }}
                              />
                            </div>
                          </div>

                          {/* Network Throughput */}
                          {stats && (
                            <div className="flex items-center justify-between text-[9px] text-white/40 pt-1 border-t border-white/5">
                              <span>Rx: {formatBytes(stats.netRxBytes)}</span>
                              <span>Tx: {formatBytes(stats.netTxBytes)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Ports & Actions Bar */}
                      <div>
                        {container.ports.length > 0 && (
                          <div className="text-[10px] font-mono text-emerald-400/80 mb-3 truncate">
                            Ports: {container.ports.join(", ")}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                          <button
                            onClick={() => fetchContainerLogs(container)}
                            className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded text-[11px] font-mono transition flex items-center gap-1 cursor-pointer"
                          >
                            <Terminal className="w-3 h-3 text-emerald-400" />
                            <span>Logs</span>
                          </button>

                          <div className="flex items-center gap-1">
                            {isRunning ? (
                              <>
                                <button
                                  onClick={() => handleContainerAction(container.id, "restart")}
                                  disabled={actionPendingId === container.id}
                                  className="p-1.5 bg-white/5 hover:bg-amber-500/20 text-white/70 hover:text-amber-300 rounded transition cursor-pointer"
                                  title="Restart Container"
                                >
                                  <RotateCw className={`w-3.5 h-3.5 ${actionPendingId === container.id ? "animate-spin" : ""}`} />
                                </button>
                                <button
                                  onClick={() => handleContainerAction(container.id, "stop")}
                                  disabled={actionPendingId === container.id}
                                  className="p-1.5 bg-white/5 hover:bg-rose-500/20 text-white/70 hover:text-rose-300 rounded transition cursor-pointer"
                                  title="Stop Container"
                                >
                                  <Square className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleContainerAction(container.id, "start")}
                                disabled={actionPendingId === container.id}
                                className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded text-[11px] font-mono transition flex items-center gap-1 cursor-pointer"
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
          <div className="space-y-6">
            {/* Pool Aggregated Summary Card */}
            {mergerfsSummary && (
              <div className="p-5 bg-gradient-to-br from-blue-950/40 via-gray-900 to-gray-950 border border-blue-500/30 rounded-xl space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-5 h-5 text-blue-400" />
                      <h3 className="font-bold text-white text-base">MergerFS Storage Pool Overview</h3>
                    </div>
                    <p className="text-xs text-white/50 mt-0.5">
                      Aggregated drive branches, creation policy, and fill balancing metrics
                    </p>
                  </div>

                  <span className="px-2.5 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-mono font-bold rounded-lg self-start sm:self-auto">
                    Policy: {mergerfsSummary.createPolicy}
                  </span>
                </div>

                {/* Pool Fill Meter */}
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1.5">
                    <span className="text-white/60">Total MergerFS Capacity Usage</span>
                    <span className="font-bold text-blue-300">
                      {formatBytes(mergerfsSummary.usedPoolBytes)} / {formatBytes(mergerfsSummary.totalPoolBytes)} ({mergerfsSummary.fillPercent}%)
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden p-0.5 border border-white/10">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        mergerfsSummary.fillPercent > 85
                          ? "bg-rose-500"
                          : mergerfsSummary.fillPercent > 70
                          ? "bg-amber-400"
                          : "bg-blue-500"
                      }`}
                      style={{ width: `${Math.min(mergerfsSummary.fillPercent, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-white/40 mt-1.5">
                    <span>Active Branches: {mergerfsSummary.onlineBranchCount} Drives</span>
                    <span>Free Space: {formatBytes(mergerfsSummary.freePoolBytes)}</span>
                  </div>
                </div>

                {/* Distribution Balance Message */}
                <div className="p-3 bg-black/40 rounded-lg border border-white/5 text-xs font-mono text-blue-200/90 flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>{mergerfsSummary.distributionMessage}</span>
                </div>
              </div>
            )}

            {/* Individual Drive Branches Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-sm tracking-tight flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  MergerFS Drive Branches ({inspectedBranches.length})
                </h3>
                <span className="text-xs font-mono text-white/40">
                  Inspect drive space, write permissions, and read/write speeds
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {inspectedBranches.map((branch) => {
                  const bench = benchmarks[branch.path];
                  const isBenchmarking = benchmarkingBranch === branch.path;

                  return (
                    <div
                      key={branch.path}
                      className="bg-gray-900/80 border border-white/10 rounded-xl p-4 space-y-3 shadow-lg hover:border-white/20 transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-white text-xs font-mono truncate" title={branch.name}>
                            {branch.name}
                          </h4>
                          <div className="text-[10px] font-mono text-white/40 truncate">{branch.path}</div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                            branch.exists
                              ? branch.writable
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-gray-800 text-white/40"
                          }`}
                        >
                          {branch.exists ? (branch.writable ? "ONLINE & WRITABLE" : "READ ONLY") : "NOT MOUNTED"}
                        </span>
                      </div>

                      {/* Drive Space Fill Meter */}
                      {branch.exists ? (
                        <div>
                          <div className="flex justify-between text-[11px] font-mono text-white/60 mb-1">
                            <span>Drive Fill</span>
                            <span className="font-bold text-emerald-300">
                              {formatBytes(branch.usedBytes)} / {formatBytes(branch.totalBytes)} ({branch.fillPercent}%)
                            </span>
                          </div>
                          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${
                                branch.fillPercent > 85
                                  ? "bg-rose-500"
                                  : branch.fillPercent > 70
                                  ? "bg-amber-400"
                                  : "bg-emerald-500"
                              }`}
                              style={{ width: `${Math.min(branch.fillPercent, 100)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs font-mono text-white/30 italic p-2 bg-black/20 rounded">
                          To map this branch drive, bind its path into docker-compose.yml.
                        </div>
                      )}

                      {/* Speed Benchmark Results */}
                      {bench && (
                        <div className="p-2.5 bg-black/50 border border-white/10 rounded-lg text-xs font-mono space-y-1">
                          <div className="flex items-center justify-between text-emerald-300 font-bold">
                            <span className="flex items-center gap-1">
                              <Zap className="w-3.5 h-3.5 text-amber-400" /> Speed Benchmark
                            </span>
                            <span className="text-[10px] uppercase text-amber-300">{bench.rating}</span>
                          </div>
                          <div className="flex justify-between text-[11px] text-white/70">
                            <span>Write: <strong className="text-white">{bench.writeSpeedMBps} MB/s</strong></span>
                            <span>Read: <strong className="text-white">{bench.readSpeedMBps} MB/s</strong></span>
                          </div>
                        </div>
                      )}

                      {/* Action Bar */}
                      <div className="pt-2 border-t border-white/5 flex justify-end">
                        <button
                          onClick={() => runDriveBenchmark(branch.path)}
                          disabled={!branch.exists || isBenchmarking}
                          className="px-3 py-1 bg-white/5 hover:bg-emerald-500/20 text-white/70 hover:text-emerald-300 border border-white/10 rounded-lg text-xs font-mono transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Gauge className={`w-3.5 h-3.5 ${isBenchmarking ? "animate-spin text-emerald-400" : ""}`} />
                          <span>{isBenchmarking ? "Testing I/O..." : "Run Speed Test"}</span>
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
          <div className="space-y-6 text-xs font-mono">
            <div className="p-5 bg-gradient-to-r from-purple-950/40 via-gray-900 to-gray-950 border border-purple-500/30 rounded-xl space-y-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-400" />
                Connecting Your Real OpenMediaVault / Debian NAS Data
              </h3>
              <p className="text-white/60 leading-relaxed">
                This cockpit dashboard uses native Docker Engine UNIX socket communication and direct host filesystem access.
                No simulated data is used. Follow these steps to map your real host containers and MergerFS pools.
              </p>
            </div>

            {/* Step 1: Docker Socket Setup */}
            <div className="bg-gray-900/80 border border-white/10 rounded-xl p-4 space-y-3">
              <h4 className="font-bold text-emerald-400 text-xs uppercase tracking-wider flex items-center gap-2">
                <span>1.</span> Bind Docker Socket for Live Telemetry (Cronpilot, Webtop, Dashy)
              </h4>
              <p className="text-white/70">
                In your OMV Portainer or <code className="text-white bg-black/40 px-1 rounded">docker-compose.yml</code> file,
                add the Docker daemon socket mount:
              </p>
              <pre className="bg-black/70 p-3 rounded-lg border border-white/10 text-emerald-300 overflow-x-auto text-[11px]">
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
            <div className="bg-gray-900/80 border border-white/10 rounded-xl p-4 space-y-3">
              <h4 className="font-bold text-blue-400 text-xs uppercase tracking-wider flex items-center gap-2">
                <span>2.</span> Run via Terminal / Docker CLI
              </h4>
              <pre className="bg-black/70 p-3 rounded-lg border border-white/10 text-blue-300 overflow-x-auto text-[11px]">
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
          <div className="bg-[#0c0f17] border border-white/10 rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 bg-gray-900 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-white text-xs">
                  Live Container Logs: <span className="text-emerald-300">{activeLogContainer.name}</span>
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(logsText);
                    setLogsCopied(true);
                    setTimeout(() => setLogsCopied(false), 2000);
                  }}
                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded text-[11px] transition flex items-center gap-1 cursor-pointer"
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

            <div className="p-4 bg-black/90 overflow-y-auto font-mono text-[11px] text-gray-300 leading-relaxed flex-1 whitespace-pre-wrap select-text">
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
    </div>
  );
};
