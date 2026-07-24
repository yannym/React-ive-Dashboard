import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { Activity, Cpu, HardDrive, RefreshCw } from 'lucide-react';

interface MetricPoint {
  time: string;
  memoryMB: number;
  sessionLoad: number;
}

export function PerformanceMetricsCard() {
  const [metrics, setMetrics] = useState<MetricPoint[]>(() => {
    const initial: MetricPoint[] = [];
    const now = Date.now();
    for (let i = 11; i >= 0; i--) {
      const t = new Date(now - i * 5000);
      const timeStr = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      initial.push({
        time: timeStr,
        memoryMB: Math.floor(34 + Math.sin(i) * 6 + Math.random() * 4),
        sessionLoad: Math.floor(12 + Math.cos(i) * 5 + Math.random() * 6)
      });
    }
    return initial;
  });

  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      setMetrics(prev => {
        const nextTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const lastMem = prev[prev.length - 1]?.memoryMB || 38;
        const lastLoad = prev[prev.length - 1]?.sessionLoad || 15;

        // Smooth random walk for memory and session load
        const nextMem = Math.min(64, Math.max(24, Math.round(lastMem + (Math.random() - 0.48) * 3)));
        const nextLoad = Math.min(45, Math.max(5, Math.round(lastLoad + (Math.random() - 0.5) * 4)));

        const updated = [...prev.slice(1), { time: nextTime, memoryMB: nextMem, sessionLoad: nextLoad }];
        return updated;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [isLive]);

  const currentMem = metrics[metrics.length - 1]?.memoryMB || 38;
  const currentLoad = metrics[metrics.length - 1]?.sessionLoad || 14;

  return (
    <div className="bg-[#121212] border border-white/10 p-4 md:p-5 relative overflow-hidden font-mono shadow-xl">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-white">
            Performance Metrics & Trends
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLive(!isLive)}
            className={`px-2 py-0.5 text-[9px] uppercase tracking-widest font-bold border transition-colors flex items-center gap-1.5 ${
              isLive
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-white/5 border-white/10 text-white/40'
            }`}
            title="Toggle Live Real-Time Stream"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-400 animate-ping' : 'bg-white/30'}`} />
            {isLive ? 'LIVE' : 'PAUSED'}
          </button>
        </div>
      </div>

      {/* Metric Summary Callouts */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-[#161616] border border-white/5 p-2.5">
          <div className="flex items-center gap-1.5 text-white/40 text-[9px] uppercase tracking-widest mb-1">
            <HardDrive className="w-3 h-3 text-emerald-400" />
            <span>Memory Usage</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-emerald-400 font-serif italic">{currentMem}</span>
            <span className="text-[10px] text-white/40">MB</span>
          </div>
        </div>

        <div className="bg-[#161616] border border-white/5 p-2.5">
          <div className="flex items-center gap-1.5 text-white/40 text-[9px] uppercase tracking-widest mb-1">
            <Cpu className="w-3 h-3 text-violet-400" />
            <span>Session Load</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-violet-400 font-serif italic">{currentLoad}</span>
            <span className="text-[10px] text-white/40">req/m</span>
          </div>
        </div>

        <div className="bg-[#161616] border border-white/5 p-2.5 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-1.5 text-white/40 text-[9px] uppercase tracking-widest mb-1">
            <RefreshCw className="w-3 h-3 text-cyan-400" />
            <span>Telemetry Status</span>
          </div>
          <div className="text-[11px] font-bold text-cyan-400 mt-1">
            OPTIMAL (100%)
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={metrics} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b',
                borderColor: 'rgba(255,255,255,0.1)',
                fontSize: '10px',
                fontFamily: 'monospace',
                color: '#fff',
                borderRadius: '0px'
              }}
              itemStyle={{ color: '#34d399' }}
            />
            <Area
              type="monotone"
              dataKey="memoryMB"
              name="Memory (MB)"
              stroke="#10b981"
              strokeWidth={1.5}
              fillOpacity={1}
              fill="url(#memGrad)"
            />
            <Area
              type="monotone"
              dataKey="sessionLoad"
              name="Session Load"
              stroke="#8b5cf6"
              strokeWidth={1.5}
              fillOpacity={1}
              fill="url(#loadGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-[9px] text-white/40">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-0.5 bg-emerald-500 rounded" />
            <span>Memory Usage (MB)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-0.5 bg-violet-500 rounded" />
            <span>Session Load</span>
          </div>
        </div>
        <span>5s Refresh Rate</span>
      </div>
    </div>
  );
}

export default PerformanceMetricsCard;
