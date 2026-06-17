import React, { useState, useEffect } from 'react';
import { Applet, SandboxConfig } from '../types';
import { AppletErrorBoundary } from './AppletErrorBoundary';
import { 
  QuickNotesApp, 
  PomodoroApp, 
  CanvasApp, 
  JsonFormatterApp, 
  CalculatorApp 
} from './BuiltInApps';
import { DynamicComponentLoader } from './DynamicComponentLoader';
import { 
  LayoutGrid, 
  Columns, 
  Plus, 
  RefreshCw, 
  X, 
  Search, 
  Layers, 
  Info,
  Maximize2,
  Copy,
  AlertCircle
} from 'lucide-react';

interface TileInstance {
  instanceId: string;
  appletId: string;
  refreshKey: number; // to allow reloading this specific tile!
  // Optional freeform geometry values
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  zIndex?: number;
  isMaximized?: boolean;
}

interface Props {
  applets: Applet[];
  onTriggerCrashLog: (appName: string, errorMessage: string, stack: string) => void;
  useCohesiveInjector: boolean;
  triggerToast: (msg: string, type: 'success' | 'info' | 'warn' | 'error') => void;
}

export const TiledWorkspace: React.FC<Props> = ({ 
  applets, 
  onTriggerCrashLog, 
  useCohesiveInjector,
  triggerToast
}) => {
  const [tiles, setTiles] = useState<TileInstance[]>([]);
  const [cols, setCols] = useState<number | 'freeform'>(2); // 1, 2, 3 columns or 'freeform'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | string>('All');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFullscreenWorkboard, setIsFullscreenWorkboard] = useState(false);
  const [activeDraggingId, setActiveDraggingId] = useState<string | null>(null);

  // Initialize with some default tiles if blank (e.g. Note + Calculator)
  useEffect(() => {
    const savedTiles = localStorage.getItem('tiled_workspace_instances_v3');
    if (savedTiles) {
      try {
        setTiles(JSON.parse(savedTiles));
      } catch (err) {
        loadDefaults();
      }
    } else {
      loadDefaults();
    }
  }, []);

  const saveTiles = (updatedTiles: TileInstance[]) => {
    setTiles(updatedTiles);
    localStorage.setItem('tiled_workspace_instances_v3', JSON.stringify(updatedTiles));
  };

  const loadDefaults = () => {
    const initial: TileInstance[] = [];
    const notes = applets.find(a => a.url === 'internal:notes');
    const calc = applets.find(a => a.url === 'internal:calculator');
    if (notes) {
      initial.push({ 
        instanceId: `inst-${Date.now()}-1`, 
        appletId: notes.id, 
        refreshKey: 0,
        x: 40,
        y: 45,
        w: 520,
        h: 460,
        zIndex: 10
      });
    }
    if (calc) {
      initial.push({ 
        instanceId: `inst-${Date.now()}-2`, 
        appletId: calc.id, 
        refreshKey: 0,
        x: 480,
        y: 120,
        w: 420,
        h: 440,
        zIndex: 11
      });
    }
    if (initial.length > 0) {
      saveTiles(initial);
    }
  };

  const handleAddTile = (applet: Applet) => {
    const count = tiles.length;
    const x = 50 + (count % 8) * 40;
    const y = 60 + (count % 8) * 40;
    const zIndex = Math.max(...tiles.map(t => t.zIndex ?? 1), 0) + 1;

    const newTile: TileInstance = {
      instanceId: `inst-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      appletId: applet.id,
      refreshKey: 0,
      x,
      y,
      w: 520,
      h: 460,
      zIndex
    };
    const updated = [...tiles, newTile];
    saveTiles(updated);
    triggerToast(`Added ${applet.name} to workspace.`, 'success');
  };

  const handleRemoveTile = (instanceId: string, appletName: string) => {
    const updated = tiles.filter(t => t.instanceId !== instanceId);
    saveTiles(updated);
    triggerToast(`Removed pane: ${appletName}`, 'info');
  };

  const handleReloadTile = (instanceId: string) => {
    const updated = tiles.map(t => {
      if (t.instanceId === instanceId) {
        return { ...t, refreshKey: t.refreshKey + 1 };
      }
      return t;
    });
    saveTiles(updated);
    triggerToast('Pane reloaded successfully.', 'success');
  };

  const handleClearAll = () => {
    saveTiles([]);
    triggerToast('All tiled panes cleared.', 'info');
  };

  const handleCopyNodeId = (id: string) => {
    navigator.clipboard.writeText(id);
    triggerToast('Copied node reference ID!', 'success');
  };

  // Drag handlings for freeform mode
  const handleHeaderMouseDown = (e: React.PointerEvent<HTMLDivElement>, instanceId: string) => {
    if (cols !== 'freeform') return;
    if ((e.target as HTMLElement).closest('button')) return;

    e.preventDefault();
    const tile = tiles.find(t => t.instanceId === instanceId);
    if (!tile || tile.isMaximized) return;

    setActiveDraggingId(instanceId);
    const startX = e.clientX;
    const startY = e.clientY;
    
    const initialX = tile.x ?? 50;
    const initialY = tile.y ?? 60;

    const nextZ = Math.max(...tiles.map(t => t.zIndex ?? 1), 0) + 1;
    setTiles(prev => prev.map(t => t.instanceId === instanceId ? { ...t, zIndex: nextZ } : t));

    const handlePointerMove = (moveEv: PointerEvent) => {
      const deltaX = moveEv.clientX - startX;
      const deltaY = moveEv.clientY - startY;

      setTiles(prev => prev.map(t => {
        if (t.instanceId === instanceId) {
          return {
            ...t,
            x: Math.max(0, initialX + deltaX),
            y: Math.max(0, initialY + deltaY)
          };
        }
        return t;
      }));
    };

    const handlePointerUp = () => {
      setActiveDraggingId(null);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  const handleResizeMouseDown = (
    e: React.PointerEvent<HTMLDivElement>, 
    instanceId: string,
    direction: 'e' | 's' | 'se'
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const tile = tiles.find(t => t.instanceId === instanceId);
    if (!tile || tile.isMaximized) return;

    setActiveDraggingId(instanceId);
    const startX = e.clientX;
    const startY = e.clientY;
    
    const initialW = tile.w ?? 520;
    const initialH = tile.h ?? 460;

    const handlePointerMove = (moveEv: PointerEvent) => {
      const deltaX = moveEv.clientX - startX;
      const deltaY = moveEv.clientY - startY;

      setTiles(prev => prev.map(t => {
        if (t.instanceId === instanceId) {
          const updated = { ...t };
          if (direction === 'e' || direction === 'se') {
            updated.w = Math.max(280, initialW + deltaX);
          }
          if (direction === 's' || direction === 'se') {
            updated.h = Math.max(200, initialH + deltaY);
          }
          return updated;
        }
        return t;
      }));
    };

    const handlePointerUp = () => {
      setActiveDraggingId(null);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  const isSystemApp = (name: string) => {
    const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return n.includes('appleterror') || n.includes('tiledworkspace') || n.includes('appletbound') || n.includes('cohesive');
  };

  // Categories helper
  const categories = ['All', ...Array.from(new Set(applets.filter(a => !isSystemApp(a.name)).map(a => a.category)))];

  const filteredApplets = applets
    .filter(app => !isSystemApp(app.name))
    .filter(app => {
      const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            app.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || app.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

  const getSandboxString = (cfg?: SandboxConfig): string => {
    if (!cfg) return 'allow-scripts allow-forms allow-popups';
    const tokens: string[] = [];
    if (cfg.allowScripts) tokens.push('allow-scripts');
    if (cfg.allowSameOrigin) tokens.push('allow-same-origin');
    if (cfg.allowForms) tokens.push('allow-forms');
    if (cfg.allowPopups) tokens.push('allow-popups');
    return tokens.join(' ');
  };

  return (
    <div className="flex flex-1 min-h-0 bg-[#0A0A0A] select-none">
      {/* SIDEBAR CATALOG: Add Tiles */}
      {isSidebarOpen && (
        <aside className="w-80 border-r border-white/5 bg-[#121212] flex flex-col shrink-0">
          <div className="p-4 border-b border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/50 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" /> Catalog Nodes
              </span>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="text-[10px] font-mono text-white/30 hover:text-white uppercase tracking-wider bg-transparent border-0 cursor-pointer"
              >
                [Collapse]
              </button>
            </div>

            {/* Quick Filter Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter instances..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded py-1.5 pl-9 pr-3 text-[11px] font-mono focus:outline-none focus:border-white/20 text-white placeholder:text-white/25"
              />
            </div>

            {/* Category selection bar */}
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 text-[9px] uppercase tracking-wider whitespace-nowrap border transition shrink-0 cursor-pointer ${
                    selectedCategory === cat 
                      ? 'bg-white text-black border-white' 
                      : 'bg-[#181818] border-white/5 text-white/50 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Core catalog listings */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredApplets.map(app => (
              <div 
                key={app.id}
                className="p-3 bg-black/40 border border-white/5 hover:border-white/10 transition flex flex-col justify-between gap-3 group relative overflow-hidden"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{app.icon}</span>
                    <h4 className="text-xs font-serif italic text-white group-hover:text-emerald-400 transition-colors truncate">{app.name}</h4>
                  </div>
                  <p className="text-[10px] text-white/40 line-clamp-2 h-7 leading-relaxed font-sans pr-2">
                    {app.description || "Custom sandbox utility instance."}
                  </p>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-1">
                  <span className="text-[9px] font-mono text-white/25">{app.category}</span>
                  <button
                    onClick={() => handleAddTile(app)}
                    className="px-2 py-1 bg-white/5 hover:bg-emerald-500 hover:text-black border border-white/10 hover:border-emerald-400 text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Instantiate
                  </button>
                </div>
              </div>
            ))}

            {filteredApplets.length === 0 && (
              <span className="block text-center text-[10px] font-mono text-white/30 italic py-10">No matching application nodes</span>
            )}
          </div>

          <div className="p-4 border-t border-white/5 bg-black/20 text-[10px] font-mono text-white/30 leading-relaxed">
            <Info className="w-4 h-4 text-emerald-400 inline mr-1.5 shrink-0 -mt-0.5" />
            Each instanced micro-applet runs enclosed in a sandboxed layout container. If errors code triggers a crash, the host frame handles isolates it.
          </div>
        </aside>
      )}

      {/* CORE GRID DESKTOP STAGE */}
      <div className={`flex-1 flex flex-col min-w-0 ${
        isFullscreenWorkboard ? 'fixed inset-0 z-[190] bg-[#0A0A0A]' : 'relative'
      }`}>
        {/* Workspace Operations top bar */}
        <div className="p-4 bg-[#121212] border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="px-3 py-1.5 border border-white/5 hover:border-white/15 bg-black/20 text-[10px] uppercase font-mono tracking-wider text-white cursor-pointer"
              >
                [Show Nodes Sidebar]
              </button>
            )}
            <div className="flex flex-col">
              <span className="text-xs font-serif italic text-white flex items-center gap-2">
                📂 Custom Tiled Multi-Instance Workboard
              </span>
              <span className="text-[9px] font-mono text-white/30 uppercase tracking-widest">
                Active Panes: {tiles.length} / Matrix Status: Isolated Channels
              </span>
            </div>
          </div>

          {/* CONTROLS */}
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="text-white/30 text-[10px] uppercase tracking-wider">Density:</span>
            <div className="flex border border-white/5 bg-black/40">
              <button 
                onClick={() => setCols(1)}
                className={`p-2 transition-all cursor-pointer ${cols === 1 ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                title="1 Column List Flow"
              >
                <Columns className="w-3.5 h-3.5 rotate-90" />
              </button>
              <button 
                onClick={() => setCols(2)}
                className={`p-2 border-l border-white/5 transition-all cursor-pointer ${cols === 2 ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                title="2 Columns Grid"
              >
                <Columns className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setCols(3)}
                className={`p-2 border-l border-white/5 transition-all cursor-pointer ${cols === 3 ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                title="3 Columns Wide Grid"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setCols('freeform')}
                className={`p-2 px-2.5 border-l border-white/5 transition-all flex items-center gap-1 cursor-pointer text-[10px] font-bold uppercase tracking-wider ${cols === 'freeform' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                title="Freeform Desktop boarding workspace"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Windowed Mode</span>
              </button>
            </div>

            <button
              onClick={() => setIsFullscreenWorkboard(!isFullscreenWorkboard)}
              className={`px-3 py-1.5 border transition-all cursor-pointer text-[10px] font-bold uppercase tracking-wider ${
                isFullscreenWorkboard 
                  ? 'border-emerald-500 bg-emerald-950/40 text-emerald-400 font-bold' 
                  : 'border-white/5 hover:border-white/20 text-white/60 hover:text-white'
              }`}
              title={isFullscreenWorkboard ? "Minimize Workspace" : "Maximize Workspace Frame"}
            >
              {isFullscreenWorkboard ? "Exit Fullscreen" : "Fullscreen Board"}
            </button>

            {tiles.length > 0 && (
              <button
                onClick={handleClearAll}
                className="px-3 py-1.5 border border-red-900/30 hover:border-red-600 bg-red-950/20 hover:bg-neutral-900 text-[10px] font-bold text-red-400 hover:text-red-500 uppercase tracking-wider transition-all cursor-pointer"
              >
                Clear Panes
              </button>
            )}
          </div>
        </div>

        {/* TILED MATRIX VIEWPORT */}
        <div className="flex-1 p-4 overflow-y-auto relative bg-[#070707]">
          {tiles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 border border-dashed border-white/5 bg-black/20 select-none">
              <AlertCircle className="w-12 h-12 text-white/10 mb-4" />
              <h3 className="text-sm font-serif italic text-white mb-2">Workspace Matrix Empty</h3>
              <p className="text-xs text-white/40 max-w-sm mb-6 leading-relaxed">
                Click "Instantiate" on any applet node from the sidebar catalog listing to mount it in an isolated layout viewport.
              </p>
              <button
                onClick={loadDefaults}
                className="px-5 py-2 bg-white text-black text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-200 transition cursor-pointer"
              >
                Mount Default Workspace Layout
              </button>
            </div>
          ) : cols === 'freeform' ? (
            // FREEFORM WINDOW MANAGEMENT BOARD
            <div className="w-full h-full min-h-[660px] bg-transparent relative overflow-auto rounded-none">
              {tiles.map((tile) => {
                const app = applets.find(a => a.id === tile.appletId);
                if (!app) return null;

                const isMax = tile.isMaximized;

                return (
                  <div 
                    key={tile.instanceId} 
                    onPointerDown={() => {
                      // bring to front on click
                      const nextZ = Math.max(...tiles.map(t => t.zIndex ?? 1), 0) + 1;
                      setTiles(prev => prev.map(t => t.instanceId === tile.instanceId ? { ...t, zIndex: nextZ } : t));
                    }}
                    style={isMax ? {
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '100%',
                      height: '100%',
                      zIndex: 200,
                    } : {
                      position: 'absolute',
                      left: `${tile.x ?? 40}px`,
                      top: `${tile.y ?? 45}px`,
                      width: `${tile.w ?? 520}px`,
                      height: `${tile.h ?? 460}px`,
                      zIndex: tile.zIndex ?? 10
                    }}
                    className={`flex flex-col bg-[#121212] border border-white/10 rounded-none shadow-2xl overflow-hidden transition-shadow duration-150 ${
                      tile.isMaximized ? '' : 'hover:shadow-[0_0_30px_rgba(0,0,0,0.6)]'
                    }`}
                  >
                    {/* TILE CONTROLLER BAR (DRAG HANDLE) */}
                    <div 
                      onPointerDown={(e) => handleHeaderMouseDown(e, tile.instanceId)}
                      className="h-10 bg-black/60 border-b border-white/5 px-3 flex items-center justify-between select-none cursor-move shrink-0"
                    >
                      <div className="flex items-center gap-2 truncate pointer-events-none">
                        <span className="text-sm">{app.icon}</span>
                        <div className="flex flex-col truncate">
                          <span className="text-xs font-serif italic text-white truncate leading-tight">{app.name}</span>
                          <span className="text-[8px] font-mono text-white/20 truncate lowercase">
                            {app.url?.startsWith('internal:') ? `node://${app.url.replace('internal:', '')}` : app.url || 'embedded-sandbox'}
                          </span>
                        </div>
                      </div>

                      {/* Tool Controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleCopyNodeId(app.id)}
                          className="p-1 px-1.5 rounded hover:bg-white/5 text-white/45 hover:text-white transition flex items-center gap-1 cursor-pointer"
                          title="Copy Node ID"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        
                        {/* Maximize toggles */}
                        <button
                          onClick={() => {
                            setTiles(prev => prev.map(t => 
                              t.instanceId === tile.instanceId ? { ...t, isMaximized: !t.isMaximized } : t
                            ));
                          }}
                          className="p-1 px-1.5 rounded hover:bg-white/5 text-white/45 hover:text-white transition cursor-pointer"
                          title={tile.isMaximized ? "Restore" : "Maximize Applet window"}
                        >
                          <Maximize2 className="w-3 h-3" />
                        </button>

                        <button
                          onClick={() => handleReloadTile(tile.instanceId)}
                          className="p-1 px-1.5 rounded hover:bg-white/5 text-white/45 hover:text-white transition flex items-center gap-1 cursor-pointer"
                          title="Reload Component Tile"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleRemoveTile(tile.instanceId, app.name)}
                          className="p-1 px-1.5 rounded hover:bg-red-950 hover:text-red-400 text-white/45 transition flex items-center gap-1 cursor-pointer"
                          title="Close Pane"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* ENCLOSED WORKSPACE LAYER */}
                    <div className="flex-1 min-h-0 bg-transparent overflow-auto relative">
                      {/* overlay shielding to prevent iframes stealing drag mouse moves */}
                      {activeDraggingId && (
                        <div className="absolute inset-0 z-50 bg-black/0 cursor-move" />
                      )}

                      <AppletErrorBoundary 
                        key={`${tile.instanceId}-key-${tile.refreshKey}`}
                        appletName={app.name}
                        onCrash={(msg, st) => onTriggerCrashLog(app.name, msg, st)}
                      >
                        {/* Notes */}
                        {app.url === 'internal:notes' && (
                          <QuickNotesApp />
                        )}

                        {/* Pomodoro */}
                        {app.url === 'internal:pomodoro' && (
                          <PomodoroApp />
                        )}

                        {/* Canvas */}
                        {app.url === 'internal:canvas' && (
                          <CanvasApp />
                        )}

                        {/* JSON Formatter */}
                        {app.url === 'internal:json' && (
                          <JsonFormatterApp />
                        )}

                        {/* Calculator */}
                        {app.url === 'internal:calculator' && (
                          <CalculatorApp />
                        )}

                        {/* TSX Upload nodes */}
                        {app.url?.startsWith('internal:component:') && (
                          <DynamicComponentLoader 
                            componentName={app.url.replace('internal:component:', '')}
                            useCohesiveInjector={useCohesiveInjector}
                          />
                        )}

                        {/* Raw Embed Iframes */}
                        {!app.url?.startsWith('internal:') && !app.isCustomEmbed && (
                          <iframe
                            src={app.url}
                            sandbox={getSandboxString(app.sandboxConfig)}
                            title={app.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full border-0 bg-neutral-900"
                          />
                        )}

                        {/* Custom Code Sandboxes */}
                        {app.isCustomEmbed && (
                          <iframe
                            srcDoc={app.embedCode || '<h2>No code payload provided</h2>'}
                            sandbox="allow-scripts"
                            title={app.name}
                            className="w-full h-full border-0 bg-white"
                          />
                        )}
                      </AppletErrorBoundary>
                    </div>

                    {/* Directional Resize Handles */}
                    {!isMax && (
                      <>
                        {/* Right / East border resize zone */}
                        <div 
                          onPointerDown={(e) => handleResizeMouseDown(e, tile.instanceId, 'e')}
                          className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-emerald-500/20 active:bg-emerald-500/50 transition-colors z-[120]"
                          title="Drag edge to resize width"
                        />
                        {/* Bottom / South border resize zone */}
                        <div 
                          onPointerDown={(e) => handleResizeMouseDown(e, tile.instanceId, 's')}
                          className="absolute bottom-0 left-0 w-full h-1.5 cursor-row-resize hover:bg-emerald-500/20 active:bg-emerald-500/50 transition-colors z-[120]"
                          title="Drag edge to resize height"
                        />
                        {/* Corner / South-East corner resize handle */}
                        <div 
                          onPointerDown={(e) => handleResizeMouseDown(e, tile.instanceId, 'se')}
                          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-transparent flex items-end justify-end p-0.5 select-none z-[121] group/resize"
                          title="Drag corner to resize window"
                        >
                          <svg width="6" height="6" viewBox="0 0 6 6" className="text-white/30 fill-current opacity-70 group-hover/resize:text-emerald-400 transition-colors">
                            <path d="M6,0 L0,6 L6,6 Z" />
                          </svg>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            // GRID DENSITY TILES VIEWPORT
            <div className={`grid gap-4 ${
              cols === 1 ? 'grid-cols-1' :
              cols === 2 ? 'grid-cols-1 xl:grid-cols-2' : 
              'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
            }`}>
              {tiles.map((tile) => {
                const app = applets.find(a => a.id === tile.appletId);
                if (!app) return null;

                return (
                  <div 
                    key={tile.instanceId} 
                    className="flex flex-col h-[520px] bg-[#121212] border border-white/10 rounded-none shadow-2xl overflow-hidden relative"
                  >
                    {/* TILE CONTROLLER BAR */}
                    <div className="h-10 bg-black/60 border-b border-white/5 px-3 flex items-center justify-between select-none shrink-0">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-sm">{app.icon}</span>
                        <div className="flex flex-col truncate">
                          <span className="text-xs font-serif italic text-white truncate leading-tight">{app.name}</span>
                          <span className="text-[8px] font-mono text-white/20 truncate lowercase">
                            {app.url?.startsWith('internal:') ? `node://${app.url.replace('internal:', '')}` : app.url || 'embedded-sandbox'}
                          </span>
                        </div>
                      </div>

                      {/* Tool Controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleCopyNodeId(app.id)}
                          className="p-1 px-1.5 rounded hover:bg-white/5 text-white/45 hover:text-white transition flex items-center gap-1 cursor-pointer"
                          title="Copy Node ID"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleReloadTile(tile.instanceId)}
                          className="p-1 px-1.5 rounded hover:bg-white/5 text-white/45 hover:text-white transition flex items-center gap-1 cursor-pointer"
                          title="Reload Component Tile"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleRemoveTile(tile.instanceId, app.name)}
                          className="p-1 px-1.5 rounded hover:bg-red-950 hover:text-red-400 text-white/45 transition flex items-center gap-1 cursor-pointer"
                          title="Close Pane"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* ENCLOSED WORKSPACE LAYER */}
                    <div className="flex-1 min-h-0 bg-transparent overflow-auto relative">
                      <AppletErrorBoundary 
                        key={`${tile.instanceId}-key-${tile.refreshKey}`}
                        appletName={app.name}
                        onCrash={(msg, st) => onTriggerCrashLog(app.name, msg, st)}
                      >
                        {/* Notes */}
                        {app.url === 'internal:notes' && (
                          <QuickNotesApp />
                        )}

                        {/* Pomodoro */}
                        {app.url === 'internal:pomodoro' && (
                          <PomodoroApp />
                        )}

                        {/* Canvas */}
                        {app.url === 'internal:canvas' && (
                          <CanvasApp />
                        )}

                        {/* JSON Formatter */}
                        {app.url === 'internal:json' && (
                          <JsonFormatterApp />
                        )}

                        {/* Calculator */}
                        {app.url === 'internal:calculator' && (
                          <CalculatorApp />
                        )}

                        {/* TSX Upload nodes */}
                        {app.url?.startsWith('internal:component:') && (
                          <DynamicComponentLoader 
                            componentName={app.url.replace('internal:component:', '')}
                            useCohesiveInjector={useCohesiveInjector}
                          />
                        )}

                        {/* Raw Embed Iframes */}
                        {!app.url?.startsWith('internal:') && !app.isCustomEmbed && (
                          <iframe
                            src={app.url}
                            sandbox={getSandboxString(app.sandboxConfig)}
                            title={app.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full border-0 bg-neutral-900"
                          />
                        )}

                        {/* Custom Code Sandboxes */}
                        {app.isCustomEmbed && (
                          <iframe
                            srcDoc={app.embedCode || '<h2>No code payload provided</h2>'}
                            sandbox="allow-scripts"
                            title={app.name}
                            className="w-full h-full border-0 bg-white"
                          />
                        )}
                      </AppletErrorBoundary>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
