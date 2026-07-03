import React, { useState, useMemo } from 'react';
import { 
  X, Terminal, Trash2, Copy, Check, Download, AlertTriangle, 
  Info, CheckCircle, ChevronDown, ChevronRight, Search, Filter 
} from 'lucide-react';

interface SystemLog {
  id: string;
  timestamp: string;
  type: 'info' | 'error' | 'success' | 'warn';
  category: string;
  message: string;
  details?: string;
}

interface Props {
  logs: SystemLog[];
  onClose: () => void;
  onClear: () => void;
}

export const SystemConsoleModal: React.FC<Props> = ({ logs, onClose, onClear }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Extract all categories dynamically
  const categories = useMemo(() => {
    const list = new Set<string>();
    logs.forEach(log => {
      if (log.category) list.add(log.category);
    });
    return Array.from(list);
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = 
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase())) ||
        log.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = filterType === 'all' || log.type === filterType;
      const matchesCategory = filterCategory === 'all' || log.category === filterCategory;

      return matchesSearch && matchesType && matchesCategory;
    });
  }, [logs, searchTerm, filterType, filterCategory]);

  const toggleExpand = (id: string) => {
    setExpandedLogId(prev => prev === id ? null : id);
  };

  const handleCopyLog = (log: SystemLog, e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = `[${log.timestamp}] [${log.type.toUpperCase()}] [${log.category}] ${log.message}${log.details ? `\nDetails:\n${log.details}` : ''}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    if (logs.length === 0) return;
    const allText = logs.map(log => 
      `[${log.timestamp}] [${log.type.toUpperCase()}] [${log.category}] ${log.message}${log.details ? `\nDetails:\n${log.details}` : ''}`
    ).join('\n---\n');
    
    navigator.clipboard.writeText(allText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleDownloadLogs = () => {
    if (logs.length === 0) return;
    const allText = logs.map(log => 
      `[${log.timestamp}] [${log.type.toUpperCase()}] [${log.category}] ${log.message}${log.details ? `\nDetails:\n${log.details}` : ''}`
    ).join('\n\n');

    const blob = new Blob([allText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `applet_system_logs_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 font-mono select-text">
      <div className="bg-[#0C0C0C] border border-white/10 rounded-none w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="border-b border-white/5 p-5 bg-[#080808] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-neutral-900 border border-white/5 text-emerald-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                System Diagnostics Console & Debugger
              </h3>
              <p className="text-[10px] text-white/40 tracking-wide mt-0.5">
                Inspect raw stack traces, API response payloads, runtime warnings, and copy logs for bug fixing.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/5 text-white/40 hover:text-white transition cursor-pointer font-sans"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar & Filters */}
        <div className="border-b border-white/5 p-4 bg-[#0A0A0A] flex flex-col md:flex-row gap-3 items-center justify-between shrink-0 text-[10px]">
          {/* Search Box */}
          <div className="relative w-full md:w-64">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-white/30 pointer-events-none">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              placeholder="Search logs/details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#111] border border-white/5 rounded-none py-1.5 pl-8 pr-3 text-white placeholder-white/30 text-[10px] outline-none focus:border-white/15 focus:bg-[#141414]"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Type Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-white/30">Level:</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-[#111] border border-white/5 text-white/80 rounded-none px-2 py-1 outline-none text-[10px]"
              >
                <option value="all">ALL LEVELS</option>
                <option value="info">INFO</option>
                <option value="success">SUCCESS</option>
                <option value="warn">WARN</option>
                <option value="error">ERROR</option>
              </select>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-white/30">Module:</span>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-[#111] border border-white/5 text-white/80 rounded-none px-2 py-1 outline-none text-[10px]"
              >
                <option value="all">ALL MODULES</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 ml-auto md:ml-2">
              <button
                onClick={handleCopyAll}
                disabled={logs.length === 0}
                className="px-2.5 py-1 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white text-white/70 rounded-none cursor-pointer flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {copiedAll ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedAll ? 'Copied!' : 'Copy All'}
              </button>
              <button
                onClick={handleDownloadLogs}
                disabled={logs.length === 0}
                className="px-2.5 py-1 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white text-white/70 rounded-none cursor-pointer flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="w-3 h-3" />
                Export
              </button>
              <button
                onClick={onClear}
                disabled={logs.length === 0}
                className="px-2.5 py-1 bg-red-950/20 border border-red-900/30 hover:bg-red-950/40 text-red-400 hover:text-red-300 rounded-none cursor-pointer flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Console logs output terminal */}
        <div className="flex-1 bg-[#050505] overflow-y-auto p-4 space-y-2 text-[10.5px]">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-white/20 select-none space-y-2">
              <Terminal className="w-8 h-8 opacity-25 animate-pulse" />
              <span>No diagnostics captured in console buffer matching filters.</span>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              
              // Define level styling
              let badgeColor = "text-white/40 bg-white/5 border-white/10";
              let msgColor = "text-white/80";
              let Icon = Info;
              
              if (log.type === 'error') {
                badgeColor = "text-red-400 bg-red-950/20 border-red-900/30";
                msgColor = "text-red-200";
                Icon = AlertTriangle;
              } else if (log.type === 'warn') {
                badgeColor = "text-amber-400 bg-amber-950/10 border-amber-900/20";
                msgColor = "text-amber-200/90";
                Icon = AlertTriangle;
              } else if (log.type === 'success') {
                badgeColor = "text-emerald-400 bg-emerald-950/10 border-emerald-900/20";
                msgColor = "text-emerald-200/90";
                Icon = CheckCircle;
              }

              return (
                <div 
                  key={log.id} 
                  className={`border border-white/5 bg-[#090909] transition-all duration-150 ${isExpanded ? 'border-white/15 bg-[#0B0B0B]' : 'hover:border-white/10'}`}
                >
                  {/* Row Summary */}
                  <div 
                    onClick={() => log.details && toggleExpand(log.id)}
                    className={`p-3 flex items-start gap-3 select-none ${log.details ? 'cursor-pointer' : ''}`}
                  >
                    {/* Expand Chevron (only if details are present) */}
                    <div className="w-4 h-4 flex items-center justify-center shrink-0">
                      {log.details ? (
                        isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-white/40" /> : <ChevronRight className="w-3.5 h-3.5 text-white/40" />
                      ) : (
                        <span className="w-1.5 h-1.5 bg-white/10 rounded-full"></span>
                      )}
                    </div>

                    {/* Timestamp */}
                    <span className="text-white/30 shrink-0 select-text font-semibold">{log.timestamp}</span>

                    {/* Badge */}
                    <span className={`px-1.5 py-0.2 border text-[8px] uppercase tracking-wider font-bold shrink-0 ${badgeColor}`}>
                      {log.type}
                    </span>

                    {/* Category */}
                    <span className="text-emerald-500/80 font-bold tracking-tight shrink-0 select-text">
                      [{log.category}]
                    </span>

                    {/* Message */}
                    <span className={`flex-1 select-text break-all whitespace-pre-wrap leading-relaxed ${msgColor}`}>
                      {log.message}
                    </span>

                    {/* Row action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 pl-2">
                      <button
                        onClick={(e) => handleCopyLog(log, e)}
                        className="p-1 hover:bg-white/10 border border-transparent hover:border-white/10 text-white/40 hover:text-white transition rounded-none cursor-pointer"
                        title="Copy individual log entry"
                      >
                        {copiedId === log.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Detailed Content Section */}
                  {isExpanded && log.details && (
                    <div className="border-t border-white/5 bg-[#050505] p-3 text-[10px] leading-relaxed text-white/55 space-y-2 select-text">
                      <div className="flex items-center justify-between border-b border-white/5 pb-1 text-[9px] uppercase tracking-wider font-bold text-white/30 select-none">
                        <span>Details / Stack Trace / Raw Payloads</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(log.details || '');
                            setCopiedId(`${log.id}-detail`);
                            setTimeout(() => setCopiedId(null), 2000);
                          }}
                          className="hover:text-white transition flex items-center gap-1"
                        >
                          {copiedId === `${log.id}-detail` ? 'Copied Detail!' : 'Copy raw details'}
                        </button>
                      </div>
                      <pre className="overflow-x-auto whitespace-pre-wrap font-mono break-all bg-black/60 p-3 text-[10px] text-emerald-400 border border-white/5 max-h-72">
                        {log.details}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Statistics Bar */}
        <div className="border-t border-white/5 px-5 py-3 bg-[#080808] text-[9px] text-white/30 uppercase tracking-widest flex items-center justify-between shrink-0">
          <span>Active Log Buffer: {filteredLogs.length} matching / {logs.length} total</span>
          <span>Status: Capture Node Active • Safe sandboxed diagnostics</span>
        </div>
      </div>
    </div>
  );
};
