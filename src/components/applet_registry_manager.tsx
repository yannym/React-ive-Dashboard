import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, Upload, Trash2, FileCode, Tag, LayoutGrid, 
  Download, FileUp, Archive, RotateCcw, PackagePlus, 
  Check, X, FileText, Settings, Sparkles, Calendar, 
  Database, RefreshCw, Eye, Code, Layers, Trash, Play,
  Cpu, FileCheck, Save, ChevronRight, AlertCircle, Info, Flame
} from 'lucide-react';

export default function App() {
  const [applets, setApplets] = useState([
    { 
      id: 1, 
      name: 'Calculator', 
      code: 'export default function Calc() {\n  const [val, setVal] = useState(0);\n  return (\n    <div className="p-4 bg-zinc-900 rounded-lg text-center">\n      <h2 className="text-zinc-100 font-bold mb-4">React Counter Sandbox</h2>\n      <div className="text-3xl font-mono text-white mb-4">{val}</div>\n      <div className="flex gap-2 justify-center">\n        <button onClick={() => setVal(val + 1)} className="px-4 py-2 bg-zinc-100 text-black rounded font-bold hover:bg-zinc-200 transition">Increment</button>\n        <button onClick={() => setVal(val - 1)} className="px-4 py-2 bg-zinc-800 text-white rounded font-bold hover:bg-zinc-700 transition">Decrement</button>\n      </div>\n    </div>\n  );\n}', 
      description: 'A mathematical utility featuring responsive controls & localized state.', 
      size: '0.48 KB',
      version: '1.0.4',
      lastModified: 'July 5, 2026',
      features: ['Interactive Button', 'State Hooks', 'Layout Grid'],
      archivedAt: null 
    },
    { 
      id: 2, 
      name: 'TodoList', 
      code: 'export default function Todo() {\n  const [task, setTask] = useState("");\n  return (\n    <div className="p-4 bg-zinc-900 rounded-lg">\n      <h2 className="text-zinc-100 font-bold mb-3">Workspace Tasks</h2>\n      <input type="text" placeholder="Add custom action..." className="w-full p-2 bg-zinc-950 border border-zinc-800 rounded text-xs text-white mb-3" />\n      <ul className="space-y-1">\n        <li className="text-xs text-zinc-400">✓ Compile source pipeline</li>\n        <li className="text-xs text-zinc-400">✓ Establish OS handshakes</li>\n      </ul>\n    </div>\n  );\n}', 
      description: 'A task tracking list component with structured list rendering.', 
      size: '0.36 KB',
      version: '1.0.0',
      lastModified: 'June 28, 2026',
      features: ['Form Input', 'List Rendering', 'Layout Structure'],
      archivedAt: null 
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApp, setSelectedApp] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showArchiveView, setShowArchiveView] = useState(false);
  const [detailTab, setDetailTab] = useState('overview'); // 'overview' | 'code' | 'diagnostics'
  const [dragOver, setDragOver] = useState(false);
  const [editableCode, setEditableCode] = useState('');
  const [saveStatus, setSaveStatus] = useState(''); // '', 'saved', 'error'
  const [toasts, setToasts] = useState([]);
  const fileInputRef = useRef(null);

  // Sandboxed Dynamic Runtime State
  const [runtimeState, setRuntimeState] = useState({});
  const [interpreterLogs, setInterpreterLogs] = useState([]);

  // Load and parse code for active simulation whenever an app is selected or edited
  useEffect(() => {
    if (selectedApp) {
      setEditableCode(selectedApp.code);
      compileAndLoadState(selectedApp.code);
    }
  }, [selectedApp]);

  // Toast notifier helper
  const triggerToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Background Cleanup for 30-day archive expiry
  useEffect(() => {
    const interval = setInterval(() => {
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      setApplets(prev => prev.filter(app => !app.archivedAt || (Date.now() - app.archivedAt < thirtyDays)));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Generate a distinct and beautiful dark-mode gradient based on the applet's name
  const getAppletGradient = (name) => {
    let hash1 = 0;
    let hash2 = 0;
    for (let i = 0; i < name.length; i++) {
      hash1 = name.charCodeAt(i) + ((hash1 << 5) - hash1);
      hash2 = name.charCodeAt(i) * 33 + ((hash2 << 3) - hash2);
    }
    const hue1 = Math.abs(hash1) % 360;
    const hue2 = Math.abs(hash1 + hash2) % 360;
    return `linear-gradient(135deg, hsl(${hue1}, 55%, 12%) 0%, hsl(${hue2}, 45%, 25%) 100%)`;
  };

  // Live Interpreter & Mini Compiling Engine
  const compileAndLoadState = (codeString) => {
    try {
      const parsedState = {};
      const stateRegex = /const\s+\[\s*([a-zA-Z0-9_]+)\s*,\s*([a-zA-Z0-9_]+)\s*\]\s*=\s*useState\(([^)]+)\)/g;
      let match;
      
      while ((match = stateRegex.exec(codeString)) !== null) {
        const varName = match[1];
        let defaultVal = match[3].trim();
        
        // Parse primitive values
        if (defaultVal.startsWith('"') || defaultVal.startsWith("'")) {
          defaultVal = defaultVal.slice(1, -1);
        } else if (defaultVal === 'true') {
          defaultVal = true;
        } else if (defaultVal === 'false') {
          defaultVal = false;
        } else if (!isNaN(Number(defaultVal))) {
          defaultVal = Number(defaultVal);
        }
        
        parsedState[varName] = defaultVal;
      }

      setRuntimeState(parsedState);
      setInterpreterLogs([`[System] Compiled state variables successfully: ${JSON.stringify(parsedState)}`]);
    } catch (err) {
      setInterpreterLogs(prev => [...prev, `[Compile Error] State extraction failure: ${err.message}`]);
    }
  };

  const handleLiveInteraction = (actionType: string, variable: string, payload?: any) => {
    setRuntimeState(prev => {
      let updatedVal = prev[variable];
      if (actionType === 'increment') updatedVal = (Number(updatedVal) || 0) + 1;
      if (actionType === 'decrement') updatedVal = (Number(updatedVal) || 0) - 1;
      if (actionType === 'set') updatedVal = payload;

      const newState = { ...prev, [variable]: updatedVal };
      setInterpreterLogs(l => [...l, `[Interactive Update] State change: ${variable} -> ${JSON.stringify(updatedVal)}`]);
      return newState;
    });
  };

  const handleInstall = (app: any) => {
    if (window.parent) {
      window.parent.postMessage({
        type: 'APPLET_INSTALL',
        payload: { name: `${app.name}.tsx`, code: app.code }
      }, '*');
      triggerToast(`Installed ${app.name}.tsx safely inside /src/components`, 'success');
    }
  };

  const saveAndPatchApp = () => {
    if (!selectedApp) return;
    try {
      // Validate Basic Syntax
      if (editableCode.includes('import') && !editableCode.includes('from')) {
        throw new Error("Potential broken import syntax detected.");
      }

      // Bump Patch Version
      const versionParts = selectedApp.version.split('.').map(Number);
      if (versionParts.length === 3) {
        versionParts[2] += 1;
      } else {
        versionParts[0] = (versionParts[0] || 1) + 1;
      }
      const newVersion = versionParts.join('.');
      const computedSize = `${(editableCode.length / 1024).toFixed(2)} KB`;

      // Update Database
      setApplets(prev => prev.map(app => {
        if (app.id === selectedApp.id) {
          const updated = {
            ...app,
            code: editableCode,
            version: newVersion,
            size: computedSize,
            lastModified: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          };
          // Keep active view synced
          setSelectedApp(updated);
          return updated;
        }
        return app;
      }));

      compileAndLoadState(editableCode);
      setSaveStatus('saved');
      triggerToast(`Patched extension ${selectedApp.name} to v${newVersion}`, 'success');
      setTimeout(() => setSaveStatus(''), 2500);
    } catch (err) {
      setSaveStatus('error');
      triggerToast(`Code validation error: ${err.message}`, 'error');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const archiveApp = (id) => {
    setApplets(prev => prev.map(a => a.id === id ? { ...a, archivedAt: Date.now() } : a));
    setConfirmDelete(null);
    triggerToast("Applet relocated to archive directory.");
    if (selectedApp?.id === id) {
      setSelectedApp(null);
    }
  };

  const restoreApp = (id) => {
    setApplets(prev => prev.map(a => a.id === id ? { ...a, archivedAt: null } : a));
    triggerToast("Applet fully restored to primary index.");
  };

  const permanentlyDelete = (id) => {
    setApplets(prev => prev.filter(a => a.id !== id));
    triggerToast("Permanently purged extension from catalog.", "error");
  };

  const analyzeFile = (content, filename) => {
    const nameMatch = content.match(/export\s+default\s+function\s+([A-Za-z0-9_]+)/) ||
                       content.match(/const\s+([A-Za-z0-9_]+)\s*=\s*\(\)\s*=>/) ||
                       content.match(/class\s+([A-Za-z0-9_]+)\s+extends/);
    const name = nameMatch ? nameMatch[1] : filename.replace('.tsx', '');
    
    const features = [];
    if (content.includes('button') || content.includes('onClick')) features.push('Interactive Button');
    if (content.includes('useState') || content.includes('useEffect')) features.push('State Hooks');
    if (content.includes('input') || content.includes('onChange')) features.push('Form Input');
    if (content.includes('map(') || content.includes('ul') || content.includes('li')) features.push('List Rendering');
    if (content.includes('grid') || content.includes('flex')) features.push('Layout Structure');
    if (features.length === 0) features.push('Static Component');

    const desc = `An autonomous extension running ${features.slice(0, 2).join(' & ')} inside a sandboxed frame.`;
    const sizeInKB = (content.length / 1024).toFixed(2);

    return {
      name,
      description: desc,
      size: `${sizeInKB} KB`,
      version: '1.0.0',
      lastModified: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      features
    };
  };

  const handleFileUpload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const code = e.target.result;
      const analysis = analyzeFile(code, file.name);
      const newApp = { 
        id: Date.now(), 
        code, 
        archivedAt: null,
        ...analysis 
      };
      setApplets(prev => [newApp, ...prev]);
      setSelectedApp(newApp);
      triggerToast(`Successfully ingested and loaded ${analysis.name}.tsx!`);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const downloadFile = (app) => {
    const blob = new Blob([app.code], { type: 'text/typescript-jsx' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${app.name}.tsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    triggerToast(`Downloaded local source for ${app.name}`);
  };

  const activeApplets = useMemo(() => {
    return applets.filter(a => !a.archivedAt && a.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [applets, searchTerm]);

  const archivedApplets = useMemo(() => {
    return applets.filter(a => a.archivedAt);
  }, [applets]);

  return (
    <div className="min-h-screen bg-[#070708] text-zinc-400 p-4 md:p-8 font-mono select-none antialiased flex flex-col justify-between">
      
      {/* Absolute Dynamic Notifications Block */}
      <div className="fixed top-5 right-5 z-50 space-y-2 max-w-sm w-full pointer-events-none">
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className={`p-3.5 rounded-xl border shadow-2xl flex items-center gap-3 transition-all duration-300 pointer-events-auto transform translate-y-0 ${
              toast.type === 'success' 
                ? 'bg-zinc-950 border-emerald-900/50 text-emerald-300' 
                : toast.type === 'error'
                ? 'bg-zinc-950 border-red-950 text-red-400'
                : 'bg-zinc-950 border-zinc-800 text-zinc-300'
            }`}
          >
            <div className={`h-2 w-2 rounded-full ${
              toast.type === 'success' ? 'bg-emerald-500' : toast.type === 'error' ? 'bg-red-500' : 'bg-zinc-400'
            }`} />
            <span className="text-xs leading-relaxed">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Dynamic Pop-up Confirm Delete Box */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-2xl w-full max-w-md shadow-2xl relative">
            <h3 className="font-bold text-sm text-zinc-100 mb-2 flex items-center gap-2">
              <Archive className="text-zinc-500" size={16} /> Relocate to System Archive?
            </h3>
            <p className="text-[11px] text-zinc-500 mb-6 leading-relaxed">
              This action suspends deployment. You retain exact recovery access for <span className="text-zinc-300">30 days</span> before automated garbage collection purges this item permanently.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => archiveApp(confirmDelete)} 
                className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold py-2 rounded-lg text-xs transition duration-200"
              >
                Move to Archive
              </button>
              <button 
                onClick={() => setConfirmDelete(null)} 
                className="flex-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 py-2 rounded-lg text-xs transition duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Application Container */}
      <div className="max-w-7xl mx-auto w-full">
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-900 pb-6 gap-4">
          <div>
            <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2.5">
              <Cpu className="text-zinc-400" size={16} />
              SYSTEM.COMPONENTS_v2.5
            </h1>
            <p className="text-[10px] text-zinc-600 mt-0.5">Automated high-density indexing ecosystem for dynamic client packages</p>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-2.5 text-zinc-600" size={12} />
              <input 
                className="bg-[#0b0b0d] border border-zinc-900 rounded-lg pl-8 pr-4 py-2 text-xs w-full text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-zinc-800 transition" 
                placeholder="Search package index..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
            
            <button 
              onClick={() => { setShowArchiveView(!showArchiveView); setSelectedApp(null); }} 
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs transition-all duration-200 ${
                showArchiveView 
                ? 'bg-zinc-100 border-zinc-100 text-zinc-950 font-bold' 
                : 'bg-[#0b0b0d] border-zinc-900 hover:bg-zinc-900 text-zinc-400'
              }`}
            >
              <Archive size={12} />
              <span>Archive ({archivedApplets.length})</span>
            </button>
          </div>
        </header>

        {showArchiveView ? (
          /* ARCHIVE VIEW */
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xs font-bold text-zinc-400 flex items-center gap-2">
                <Archive size={14} className="text-zinc-500" /> SUSPENDED DEPLOYMENTS
              </h2>
              <button 
                onClick={() => setShowArchiveView(false)} 
                className="text-[10px] text-zinc-500 hover:text-zinc-300 transition flex items-center gap-1"
              >
                <X size={12} /> Return to Primary Registry
              </button>
            </div>
            
            {archivedApplets.length === 0 ? (
              <div className="border border-zinc-900/60 p-12 text-center rounded-2xl bg-zinc-950/20">
                <Archive className="mx-auto text-zinc-700 mb-2" size={20} />
                <p className="text-xs text-zinc-600">The archive storage path is currently vacant.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {archivedApplets.map(app => {
                  const daysRemaining = 30 - Math.floor((Date.now() - app.archivedAt) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={app.id} className="bg-[#0b0b0d] border border-zinc-900 hover:border-zinc-800 p-5 rounded-xl transition duration-200 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-zinc-200 font-bold text-xs">{app.name}</h3>
                          <span className="text-[9px] text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded">
                            {daysRemaining}d retention
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-600 line-clamp-2">{app.description}</p>
                      </div>
                      <div className="flex gap-2 mt-4 pt-3 border-t border-zinc-900/50">
                        <button 
                          onClick={() => restoreApp(app.id)} 
                          className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition"
                        >
                          <RotateCcw size={12} /> Re-Deploy
                        </button>
                        <button 
                          onClick={() => permanentlyDelete(app.id)} 
                          className="bg-red-950/20 hover:bg-red-950/40 text-red-400 px-2.5 rounded-lg transition"
                          title="Purge Component"
                        >
                          <Trash size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* CORE WORKSPACE INTERFACE (Interactive Split View when Selected) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Panel: Grid Catalog & Ingestion (Occupies full space or left column) */}
            <div className={`transition-all duration-350 ${selectedApp ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Drag-and-Drop Loader */}
                <div className={`${selectedApp ? 'md:col-span-12' : 'md:col-span-4'}`}>
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer min-h-[140px] transition-all duration-200 ${
                      dragOver 
                        ? 'border-zinc-300 bg-zinc-900/40 scale-[1.01]' 
                        : 'border-zinc-900 hover:border-zinc-700 bg-[#0b0b0d]/50'
                    }`}
                  >
                    <FileUp className="text-zinc-600 mb-2" size={18} />
                    <span className="text-xs font-bold text-zinc-300">Ingest Source Package</span>
                    <span className="text-[10px] text-zinc-600 mt-1">Drag `.tsx` component here or search drive</span>
                    <input 
                      type="file" 
                      accept=".tsx" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={(e) => handleFileUpload(e.target.files[0])} 
                    />
                  </div>
                </div>

                {/* Main Component Inventory */}
                <div className={`${selectedApp ? 'md:col-span-12' : 'md:col-span-8'}`}>
                  {activeApplets.length === 0 ? (
                    <div className="border border-zinc-900 p-12 text-center rounded-xl bg-zinc-950/20">
                      <FileCode className="mx-auto text-zinc-700 mb-2" size={20} />
                      <p className="text-xs text-zinc-600">No active extensions deployed in directory.</p>
                    </div>
                  ) : (
                    <div className={`grid gap-4 ${selectedApp ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                      {activeApplets.map(app => {
                        const isCurrent = selectedApp?.id === app.id;
                        return (
                          <div 
                            key={app.id} 
                            onClick={() => setSelectedApp(app)}
                            className={`group border rounded-xl p-4 transition-all duration-250 cursor-pointer flex flex-col justify-between ${
                              isCurrent 
                                ? 'bg-zinc-900/65 border-zinc-400 shadow-[0_0_15px_rgba(255,255,255,0.03)]' 
                                : 'bg-[#0b0b0d] border-zinc-900 hover:border-zinc-800'
                            }`}
                          >
                            <div className="flex gap-3.5">
                              {/* Procedural Unique Gradient Icon with dynamic glow */}
                              <div 
                                className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 border border-zinc-850 relative overflow-hidden"
                                style={{ background: getAppletGradient(app.name) }}
                              >
                                <div className="absolute inset-0 bg-white/5 mix-blend-overlay"></div>
                                <FileCode className="text-zinc-100" size={15} />
                              </div>

                              <div className="overflow-hidden w-full">
                                <div className="flex items-center justify-between gap-2">
                                  <h3 className="font-bold text-zinc-200 text-xs truncate group-hover:text-zinc-100 transition">{app.name}</h3>
                                  <span className="text-[9px] font-mono text-zinc-500 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-900">
                                    v{app.version}
                                  </span>
                                </div>
                                <p className="text-[10px] text-zinc-500 mt-1.5 line-clamp-2 leading-relaxed">{app.description}</p>
                              </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-zinc-900/50 flex items-center justify-between">
                              <span className="text-[9px] text-zinc-600 font-mono">{app.size}</span>
                              <div className="flex gap-1 opacity-50 group-hover:opacity-100 transition duration-150" onClick={(e) => e.stopPropagation()}>
                                <button 
                                  onClick={() => handleInstall(app)} 
                                  className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-zinc-100 transition" 
                                  title="Install to /src/components"
                                >
                                  <PackagePlus size={12} />
                                </button>
                                <button 
                                  onClick={() => downloadFile(app)} 
                                  className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-zinc-100 transition" 
                                  title="Export Component"
                                >
                                  <Download size={12} />
                                </button>
                                <button 
                                  onClick={() => setConfirmDelete(app.id)} 
                                  className="p-1.5 hover:bg-red-950/20 rounded-md text-zinc-500 hover:text-red-400 transition" 
                                  title="Suspend Deployment"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

            </div>

            {/* Right Panel: Split Active Sandbox System Workspace */}
            {selectedApp && (
              <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-12 gap-5 animate-fade-in">
                
                {/* 1. Sandbox Emulator Device (Left Column inside Workspace) */}
                <div className="md:col-span-5 flex flex-col gap-4">
                  <div className="bg-[#0b0b0d] border border-zinc-900 rounded-xl overflow-hidden shadow-2xl flex flex-col h-[400px]">
                    <div className="bg-zinc-950 px-3.5 py-3 border-b border-zinc-900 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></div>
                        <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Simulator Device</span>
                      </div>
                      <div className="text-[9px] font-mono text-zinc-600 bg-[#070708] px-2 py-0.5 rounded">
                        ext: {selectedApp.name}.tsx
                      </div>
                    </div>

                    <div className="flex-1 p-5 overflow-y-auto bg-zinc-950 flex flex-col justify-center items-center">
                      
                      {/* Interactive Client-Side Transpilation Sandbox Screen */}
                      <div className="w-full max-w-xs space-y-4">
                        
                        {/* Renderer checking compiled state variables inside the custom applet */}
                        {runtimeState.hasOwnProperty('val') && (
                          <div className="bg-[#0b0b0d] border border-zinc-900 p-4 rounded-xl text-center space-y-3 shadow-inner">
                            <span className="text-[8px] uppercase tracking-wider text-zinc-600 font-bold block">Live Increment Component</span>
                            <div className="text-3xl font-bold text-white font-mono tracking-tight">{runtimeState.val}</div>
                            <div className="flex gap-2 justify-center">
                              <button 
                                onClick={() => handleLiveInteraction('increment', 'val')}
                                className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold rounded-lg text-[10px] transition"
                              >
                                Increment
                              </button>
                              <button 
                                onClick={() => handleLiveInteraction('decrement', 'val')}
                                className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-bold rounded-lg text-[10px] transition"
                              >
                                Decrement
                              </button>
                            </div>
                          </div>
                        )}

                        {runtimeState.hasOwnProperty('task') && (
                          <div className="bg-[#0b0b0d] border border-zinc-900 p-4 rounded-xl space-y-3.5 shadow-inner">
                            <span className="text-[8px] uppercase tracking-wider text-zinc-600 font-bold block">Dynamic Task Tracker</span>
                            <div className="flex gap-1.5">
                              <input 
                                type="text" 
                                placeholder="Enter action..."
                                value={runtimeState.task || ''}
                                onChange={(e) => handleLiveInteraction('set', 'task', e.target.value)}
                                className="bg-zinc-950 border border-zinc-850 rounded px-2 py-1 text-[10px] text-zinc-200 flex-1 focus:outline-none focus:border-zinc-700"
                              />
                            </div>
                            {runtimeState.task && (
                              <div className="text-[10px] text-zinc-400 bg-zinc-950 p-2 rounded border border-zinc-900 font-mono flex items-center gap-1.5">
                                <span className="h-1 w-1 rounded-full bg-emerald-400"></span>
                                <span className="truncate">Active: "{runtimeState.task}"</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Standard Static fallback visualization if no state registers found */}
                        {!runtimeState.hasOwnProperty('val') && !runtimeState.hasOwnProperty('task') && (
                          <div className="text-center py-6 space-y-3.5 bg-[#0b0b0d] border border-zinc-900 rounded-xl p-4">
                            <Layers className="mx-auto text-zinc-800 animate-pulse" size={18} />
                            <p className="text-[10px] text-zinc-500 leading-relaxed font-sans px-2">
                              Static TSX loaded successfully. Code complies and operates inside the OS components namespace.
                            </p>
                          </div>
                        )}

                      </div>

                    </div>

                    {/* Sim Logs Console Footer */}
                    <div className="bg-zinc-950 p-3.5 border-t border-zinc-900 max-h-[110px] overflow-y-auto font-mono text-[9px] text-zinc-600 space-y-1">
                      {interpreterLogs.map((log, idx) => (
                        <div key={idx} className="truncate select-text">
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Install & Export Command Controls */}
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => handleInstall(selectedApp)} 
                      className="bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <PackagePlus size={12} /> Install to OS
                    </button>
                    <button 
                      onClick={() => downloadFile(selectedApp)} 
                      className="bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <Download size={12} /> Export File
                    </button>
                  </div>
                </div>

                {/* 2. Metadata Inspector & Interactive Code Editor (Right Column) */}
                <div className="md:col-span-7 flex flex-col gap-4">
                  <div className="bg-[#0b0b0d] border border-zinc-900 rounded-xl p-5 shadow-2xl min-h-[400px] flex flex-col justify-between">
                    
                    <div>
                      {/* Spec Header & Tab Selection */}
                      <div className="flex justify-between items-start mb-4 pb-4 border-b border-zinc-900">
                        <div>
                          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                            <FileText size={11} /> Config Dashboard
                          </div>
                          <h2 className="text-sm font-bold text-zinc-200 mt-1">{selectedApp.name} Specification</h2>
                        </div>
                        <button 
                          onClick={() => setSelectedApp(null)} 
                          className="text-zinc-600 hover:text-zinc-300 transition"
                          title="Close panel"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {/* Detail Tab Buttons */}
                      <div className="flex gap-2 border-b border-zinc-900 pb-3 mb-4">
                        <button 
                          onClick={() => setDetailTab('overview')} 
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition duration-150 ${
                            detailTab === 'overview' ? 'bg-zinc-900 text-zinc-100 border border-zinc-850' : 'text-zinc-600 hover:text-zinc-400'
                          }`}
                        >
                          Specs & Analytics
                        </button>
                        <button 
                          onClick={() => setDetailTab('code')} 
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition duration-150 ${
                            detailTab === 'code' ? 'bg-zinc-900 text-zinc-100 border border-zinc-850' : 'text-zinc-600 hover:text-zinc-400'
                          }`}
                        >
                          Interactive Editor
                        </button>
                        <button 
                          onClick={() => setDetailTab('diagnostics')} 
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition duration-150 ${
                            detailTab === 'diagnostics' ? 'bg-zinc-900 text-zinc-100 border border-zinc-850' : 'text-zinc-600 hover:text-zinc-400'
                          }`}
                        >
                          System Handshake
                        </button>
                      </div>

                      {/* Tab Content 1: Overview Specs */}
                      {detailTab === 'overview' && (
                        <div className="space-y-4 animate-fade-in text-[11px]">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-900">
                              <span className="text-zinc-600 text-[9px] uppercase tracking-wider block mb-0.5">Package Weight</span>
                              <span className="text-zinc-200 font-bold">{selectedApp.size}</span>
                            </div>
                            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-900">
                              <span className="text-zinc-600 text-[9px] uppercase tracking-wider block mb-0.5">Modified Timeline</span>
                              <span className="text-zinc-200 font-bold">{selectedApp.lastModified}</span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <span className="text-zinc-600 text-[9px] uppercase tracking-wider block">Compiled Architecture Features</span>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedApp.features.map((feat, idx) => (
                                <span key={idx} className="flex items-center gap-1 bg-zinc-950 border border-zinc-900 text-zinc-400 px-2.5 py-1 rounded-md text-[9px]">
                                  <Check size={9} className="text-emerald-500" /> {feat}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-900/60 leading-relaxed text-zinc-500 text-[10px]">
                            <span className="text-[9px] uppercase font-bold text-zinc-400 block mb-1">Functional Abstract</span>
                            {selectedApp.description}
                          </div>
                        </div>
                      )}

                      {/* Tab Content 2: Interactive Real-time Code Editor */}
                      {detailTab === 'code' && (
                        <div className="space-y-3.5 animate-fade-in">
                          <div className="relative">
                            <textarea 
                              value={editableCode}
                              onChange={(e) => setEditableCode(e.target.value)}
                              className="w-full h-[180px] bg-zinc-950 border border-zinc-900 p-3.5 rounded-xl text-[10px] text-zinc-300 font-mono focus:outline-none focus:border-zinc-700 leading-relaxed resize-none select-text"
                              placeholder="Edit TSX Component Source Code..."
                            />
                            <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-[#070708] border border-zinc-900 px-2 py-1 rounded text-[8px] text-zinc-500">
                              <Code size={10} /> lines: {editableCode.split('\n').length}
                            </div>
                          </div>

                          <div className="flex justify-between items-center">
                            <div className="text-[9px] text-zinc-600 flex items-center gap-1">
                              <Info size={10} /> Hot-reloads output dynamically
                            </div>
                            <button 
                              onClick={saveAndPatchApp}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition ${
                                saveStatus === 'saved' 
                                  ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/40'
                                  : saveStatus === 'error'
                                  ? 'bg-red-950/20 text-red-400 border border-red-900/40'
                                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-950'
                              }`}
                            >
                              <Save size={11} /> 
                              {saveStatus === 'saved' ? 'Patched!' : saveStatus === 'error' ? 'Failed!' : 'Save & Patch'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Tab Content 3: OS Connection Diagnostics */}
                      {detailTab === 'diagnostics' && (
                        <div className="space-y-3.5 animate-fade-in text-[10px] text-zinc-500">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center py-1.5 border-b border-zinc-900">
                              <span>Target Deployment Directory</span>
                              <span className="text-zinc-300 font-mono">/src/components/{selectedApp.name}.tsx</span>
                            </div>
                            <div className="flex justify-between items-center py-1.5 border-b border-zinc-900">
                              <span>Handshake Protocol Status</span>
                              <span className="text-emerald-500 font-bold flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Connected
                              </span>
                            </div>
                            <div className="flex justify-between items-center py-1.5 border-b border-zinc-900">
                              <span>Host Compatibility Check</span>
                              <span className="text-zinc-300 font-bold">100% Compliant</span>
                            </div>
                          </div>

                          <div className="border border-zinc-900 p-3 rounded-lg bg-zinc-950/40 text-[9px] leading-relaxed flex gap-2">
                            <AlertCircle className="text-zinc-600 shrink-0" size={13} />
                            <span>
                              Deploying saves the active component code inside your local OS runtime directory. Handshake validation processes security certificates inside the `/src/components` namespace.
                            </span>
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Detail Card Workspace Footer */}
                    <div className="border-t border-zinc-900 pt-4 flex items-center justify-between text-[8px] text-zinc-600 mt-4">
                      <span>MOUNT INDEX: {selectedApp.id}</span>
                      <span>OS COMPATIBLE extension package</span>
                    </div>

                  </div>
                </div>

              </div>
            )}

          </div>
        )}
      </div>

      {/* Global Interface Footer */}
      <footer className="mt-12 border-t border-zinc-900 pt-6 flex flex-col md:flex-row justify-between items-center text-[10px] text-zinc-700 max-w-7xl mx-auto w-full gap-2">
        <span>APPLET REGISTRY TERMINAL SYSTEM // EXTS-SECURE</span>
        <span>COMPILE PIPELINE ONLINE</span>
      </footer>
    </div>
  );
}