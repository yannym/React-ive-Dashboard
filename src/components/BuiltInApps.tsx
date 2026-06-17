import React, { useState, useEffect, useRef } from 'react';

// Play sound using Web Audio API synthesis (no assets needed, fits standard container environment)
const playChime = (type: 'beep' | 'success' | 'click') => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if (type === 'beep') {
      osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.stop(audioCtx.currentTime + 0.15);
    } else if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.stop(audioCtx.currentTime + 0.45);
    } else if (type === 'click') {
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
      osc.stop(audioCtx.currentTime + 0.06);
    }
  } catch (err) {
    console.debug('Web Audio API not supported/permitted in this container state:', err);
  }
};

// 1. QuickNotes Component
interface NoteTab {
  id: string;
  title: string;
  content: string;
}

export const QuickNotesApp: React.FC = () => {
  const [tabs, setTabs] = useState<NoteTab[]>(() => {
    const saved = localStorage.getItem('cohesive_quick_notes_tabs_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (err) {}
    }
    return [
      {
        id: 'tab-1',
        title: 'Scratchpad 1',
        content: '# QuickNotes Scratchpad\n\n- Welcome to your scratchpad!\n- This note autosaves instantly inside your dynamic dashboard.\n\n### Formatting Guide\nUse markdown like **bold text**, *italics*, or `inline code` for highlights.'
      },
      {
        id: 'tab-2',
        title: 'Note B',
        content: '# Note B\n\nDraft code concepts, CLI paths, or meeting logs here.'
      }
    ];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    return localStorage.getItem('cohesive_quick_notes_active_tab_v3') || 'tab-1';
  });

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    localStorage.setItem('cohesive_quick_notes_tabs_v3', JSON.stringify(tabs));
  }, [tabs]);

  useEffect(() => {
    localStorage.setItem('cohesive_quick_notes_active_tab_v3', activeTabId);
  }, [activeTabId]);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0] || { id: 'default', title: 'Scratchpad', content: '' };
  const note = activeTab.content;

  const setNote = (newContent: string) => {
    setTabs(prev => prev.map(t => t.id === activeTab.id ? { ...t, content: newContent } : t));
  };

  const handleRenameActiveTab = (newTitle: string) => {
    setTabs(prev => prev.map(t => t.id === activeTab.id ? { ...t, title: newTitle || 'Untitled Note' } : t));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(note);
    setCopied(true);
    playChime('success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000); // Reset confirmation after 3s
    } else {
      setNote('');
      setConfirmClear(false);
      playChime('click');
    }
  };

  const insertMarkdown = (syntax: string) => {
    const textarea = document.getElementById('notes-text-area') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);

    let replacement = '';
    if (syntax === 'bold') replacement = `**${selected || 'bold text'}**`;
    else if (syntax === 'italic') replacement = `*${selected || 'italic text'}*`;
    else if (syntax === 'code') replacement = `\`${selected || 'code'}\``;
    else if (syntax === 'header') replacement = `\n### ${selected || 'Heading'}\n`;
    else if (syntax === 'list') replacement = `\n- ${selected || 'List item'}\n`;

    const nextText = text.substring(0, start) + replacement + text.substring(end);
    setNote(nextText);
    playChime('click');
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + replacement.length, start + replacement.length);
    }, 50);
  };

  const wordCount = note.trim() === '' ? 0 : note.trim().split(/\s+/).length;
  const charCount = note.length;

  return (
    <div className="flex flex-col h-full bg-[#121212] text-white select-none border border-white/10 p-6">
      <div className="flex border-b border-white/5 pb-4 justify-between items-center bg-transparent">
        <div>
          <h2 className="text-sm font-serif italic text-white leading-none">Notes Scratchpad</h2>
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono mt-1.5">Autosaves locally to browser client</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest bg-white text-black hover:bg-neutral-200 transition flex items-center gap-1.5 cursor-pointer rounded-none"
          >
            {copied ? 'COPIED' : 'COPY ALL'}
          </button>
          <button
            onClick={handleClear}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition cursor-pointer rounded-none border ${
              confirmClear 
                ? 'bg-red-950 border-red-500 text-red-400 hover:text-white' 
                : 'bg-transparent border-white/10 text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            {confirmClear ? "CONFIRM CLEAR?" : "Clear Note"}
          </button>
        </div>
      </div>

      {/* Dynamic Tabs list at top of input box, side scrollable */}
      <div className="flex items-center gap-1.5 bg-[#0A0A0A]/80 border border-white/5 p-1.5 overflow-x-auto scrollbar-thin select-none mt-4">
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => { setActiveTabId(tab.id); setConfirmClear(false); }}
              className={`group flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-bold tracking-wider uppercase border cursor-pointer transition shrink-0 ${
                isActive 
                  ? 'bg-[#121212] border-white/20 text-emerald-400' 
                  : 'bg-black/40 border-transparent text-white/40 hover:text-white/80'
              }`}
            >
              {isEditingTitle && isActive ? (
                <input
                  type="text"
                  autoFocus
                  value={tab.title}
                  onChange={(e) => handleRenameActiveTab(e.target.value)}
                  onBlur={() => setIsEditingTitle(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setIsEditingTitle(false);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-black/95 text-white text-[10px] font-mono px-1 border border-emerald-500/50 focus:outline-none max-w-[80px]"
                />
              ) : (
                <span 
                  onDoubleClick={() => setIsEditingTitle(true)}
                  title="Double click to rename note"
                  className="truncate max-w-[100px]"
                >
                  {tab.title}
                </span>
              )}

              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const index = tabs.findIndex(t => t.id === tab.id);
                    const updated = tabs.filter(t => t.id !== tab.id);
                    setTabs(updated);
                    if (isActive) {
                      const nextPick = index > 0 ? index - 1 : 0;
                      setActiveTabId(updated[nextPick]?.id || 'default');
                    }
                    playChime('click');
                  }}
                  className="text-white/30 group-hover:text-red-400 font-bold ml-1 text-[10px]"
                  title="Delete this scratchpad note"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}

        <button
          onClick={() => {
            const newId = `tab-${Date.now()}`;
            const newTab: NoteTab = {
              id: newId,
              title: `Note ${tabs.length + 1}`,
              content: `# Note ${tabs.length + 1}\n\nType note content...`
            };
            setTabs([...tabs, newTab]);
            setActiveTabId(newId);
            playChime('click');
          }}
          className="p-1 px-3 bg-white/5 text-white/40 border border-white/5 hover:border-white/20 hover:text-white text-[10px] font-mono uppercase tracking-wider transition shrink-0 cursor-pointer"
        >
          + Add note
        </button>
      </div>

      {/* Editor toolbar */}
      <div className="flex flex-row items-center gap-1 border-b border-white/5 py-3 bg-transparent overflow-x-auto">
        <button onClick={() => insertMarkdown('header')} className="p-1 px-3 bg-[#0A0A0A] border border-white/5 text-[10px] text-white/70 hover:text-white hover:bg-white/5 transition rounded-none font-mono tracking-wider cursor-pointer" title="Insert Heading">H3</button>
        <button onClick={() => insertMarkdown('bold')} className="p-1 px-3 bg-[#0A0A0A] border border-white/5 text-[10px] text-white/70 hover:text-white hover:bg-white/5 transition rounded-none font-mono tracking-wider cursor-pointer" title="Insert Bold">B</button>
        <button onClick={() => insertMarkdown('italic')} className="p-1 px-3 bg-[#0A0A0A] border border-white/5 text-[10px] text-white/70 hover:text-white hover:bg-white/5 transition rounded-none font-mono tracking-wider cursor-pointer" title="Insert Italic">I</button>
        <button onClick={() => insertMarkdown('code')} className="p-1 px-3 bg-[#0A0A0A] border border-white/5 text-[10px] text-white/70 hover:text-white hover:bg-white/5 transition rounded-none font-mono tracking-wider cursor-pointer" title="Insert Code Block">{"</>"}</button>
        <button onClick={() => insertMarkdown('list')} className="p-1 px-3 bg-[#0A0A0A] border border-white/5 text-[10px] text-white/70 hover:text-white hover:bg-white/5 transition rounded-none font-mono tracking-wider cursor-pointer" title="Insert Bullet List">• List</button>
      </div>

      {/* Text Area */}
      <div className="flex-1 min-h-0 py-4">
        <textarea
          id="notes-text-area"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Start typing your scratchpad notes..."
          className="w-full h-full p-4 bg-[#0A0A0A] text-white border border-white/10 rounded-none text-sm font-mono focus:outline-none focus:border-white/30 resize-none overflow-y-auto placeholder:text-white/20"
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-white/30 font-mono uppercase tracking-widest border-t border-white/5 pt-4">
        <div>
          Word count: <span className="text-white font-bold">{wordCount}</span>
        </div>
        <div>
          Characters: <span className="text-white font-bold">{charCount}</span>
        </div>
      </div>
    </div>
  );
};

// 2. Pomodoro Focus Timer Component
export const PomodoroApp: React.FC = () => {
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<'focus' | 'short' | 'long'>('focus');

  // Custom input states
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [customInput, setCustomInput] = useState('25');

  const [tasks, setTasks] = useState<{ id: string; text: string; completed: boolean }[]>(() => {
    const saved = localStorage.getItem('pomodoro_tasks');
    return saved ? JSON.parse(saved) : [
      { id: 't1', text: 'Structure design parameters', completed: false },
      { id: 't2', text: 'Validate self-hosted routing', completed: false }
    ];
  });
  const [newTaskText, setNewTaskText] = useState('');

  useEffect(() => {
    localStorage.setItem('pomodoro_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive) {
      interval = setInterval(() => {
        if (seconds > 0) {
          setSeconds(seconds - 1);
        } else if (seconds === 0) {
          if (minutes === 0) {
            setIsActive(false);
            playChime('success');
            // switch modes on auto
            alert(`${mode === 'focus' ? 'Focus interval complete! Take a break.' : 'Break over, let\'s get back to work!'}`);
            if (mode === 'focus') {
              handleSwitchMode('short');
            } else {
              handleSwitchMode('focus');
            }
          } else {
            setMinutes(minutes - 1);
            setSeconds(59);
          }
        }
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, seconds, minutes, mode]);

  const handleSwitchMode = (newMode: 'focus' | 'short' | 'long') => {
    setMode(newMode);
    setIsActive(false);
    playChime('click');
    if (newMode === 'focus') {
      setMinutes(25);
    } else if (newMode === 'short') {
      setMinutes(5);
    } else {
      setMinutes(15);
    }
    setSeconds(0);
  };

  const toggleTimer = () => {
    setIsActive(!isActive);
    playChime('beep');
  };

  const resetTimer = () => {
    setIsActive(false);
    playChime('click');
    if (mode === 'focus') setMinutes(25);
    else if (mode === 'short') setMinutes(5);
    else setMinutes(15);
    setSeconds(0);
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    setTasks([...tasks, { id: Date.now().toString(), text: newTaskText.trim(), completed: false }]);
    setNewTaskText('');
    playChime('click');
  };

  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    playChime('click');
  };

  const removeTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
    playChime('click');
  };

  // formatting
  const displayMin = minutes < 10 ? `0${minutes}` : minutes;
  const displaySec = seconds < 10 ? `0${seconds}` : seconds;

  return (
    <div className="flex flex-col lg:flex-row h-full bg-[#121212] border border-white/10 text-white p-6 gap-6 select-none">
      {/* Clock section */}
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0A0A0A] border border-white/5 p-6 rounded-none">
        <div className="flex justify-center gap-1.5 mb-6">
          <button
            onClick={() => handleSwitchMode('focus')}
            className={`px-3 py-2 text-[9px] font-mono uppercase tracking-widest border transition rounded-none cursor-pointer ${
              mode === 'focus' ? 'bg-white/5 border-white text-white font-bold' : 'bg-transparent border-white/5 text-white/30 hover:text-white hover:border-white/20'
            }`}
          >
            💻 Focus (25m)
          </button>
          <button
            onClick={() => handleSwitchMode('short')}
            className={`px-3 py-2 text-[9px] font-mono uppercase tracking-widest border transition rounded-none cursor-pointer ${
              mode === 'short' ? 'bg-white/5 border-white text-white font-bold' : 'bg-transparent border-white/5 text-white/30 hover:text-white hover:border-white/20'
            }`}
          >
            ☕ Break (5m)
          </button>
          <button
            onClick={() => handleSwitchMode('long')}
            className={`px-3 py-2 text-[9px] font-mono uppercase tracking-widest border transition rounded-none cursor-pointer ${
              mode === 'long' ? 'bg-white/5 border-white text-white font-bold' : 'bg-transparent border-white/5 text-white/30 hover:text-white hover:border-white/20'
            }`}
          >
            🛌 Long (15m)
          </button>
        </div>

        {/* Display */}
        {/* Display details */}
        <div 
          onClick={() => {
            if (!isActive) {
              setCustomInput(String(minutes));
              setIsEditingCustom(true);
            }
          }}
          className="relative flex items-center justify-center w-48 h-48 rounded-none border border-white/10 bg-[#0A0A0A] mb-6 cursor-pointer hover:border-white/30 transition group"
          title={isActive ? "Pause timer to customize duration" : "Click to type custom timer"}
        >
          {/* Circular color highlight based on mode */}
          <div className="absolute inset-3 rounded-full border border-dashed border-white/20 opacity-25 animate-spin-slow" style={{ animationDuration: '30s' }} />

          <div className="z-10 text-center px-4">
            {isEditingCustom ? (
              <div 
                className="flex flex-col items-center gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="number"
                  min="1"
                  max="999"
                  autoFocus
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onBlur={() => {
                    const parsed = parseInt(customInput, 10);
                    if (!isNaN(parsed) && parsed > 0) {
                      setMinutes(parsed);
                      setSeconds(0);
                    }
                    setIsEditingCustom(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const parsed = parseInt(customInput, 10);
                      if (!isNaN(parsed) && parsed > 0) {
                        setMinutes(parsed);
                        setSeconds(0);
                      }
                      setIsEditingCustom(false);
                    } else if (e.key === 'Escape') {
                      setIsEditingCustom(false);
                    }
                  }}
                  className="bg-black text-white text-center font-mono font-bold text-3xl w-28 border-b-2 border-white focus:outline-none"
                />
                <span className="text-[8px] tracking-widest font-mono text-white/30 uppercase">minutes (Press Enter)</span>
              </div>
            ) : (
              <>
                <span className="text-5xl font-bold font-mono tracking-tighter text-white block group-hover:scale-105 transition-transform duration-150">
                  {displayMin}:{displaySec}
                </span>
                <span className="text-[9px] font-mono uppercase tracking-widest text-white/40 mt-1 block group-hover:text-emerald-400 transition-colors">
                  {isActive ? (mode === 'focus' ? 'FOCUS SESSION' : 'MIND BREAK') : 'CLICK TO CUSTOMIZE'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTimer}
            className={`w-36 py-2.5 text-[10px] font-bold uppercase tracking-widest transition duration-150 rounded-none cursor-pointer border ${
              isActive 
                ? 'bg-white text-black border-white hover:bg-neutral-200' 
                : 'bg-transparent text-white border-white/20 hover:border-white'
            }`}
          >
            {isActive ? 'Pause Timer' : 'Start Timer'}
          </button>
          <button
            onClick={resetTimer}
            className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest bg-[#0A0A0A] text-white/60 hover:text-white hover:bg-white/5 rounded-none border border-white/10 transition cursor-pointer"
          >
            Reboot
          </button>
        </div>
      </div>

      {/* Task checklist section */}
      <div className="w-full lg:w-72 flex flex-col justify-between border border-white/5 bg-[#0A0A0A] p-5 rounded-none">
        <div>
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-4 block">Task Checklist</h3>
          
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {tasks.map(t => (
              <div key={t.id} className="flex items-center justify-between bg-[#121212]/50 p-2.5 rounded-none border border-white/5 mb-2">
                <label className="flex items-center gap-2.5 cursor-pointer select-none truncate text-xs flex-1">
                  <input
                    type="checkbox"
                    checked={t.completed}
                    onChange={() => toggleTask(t.id)}
                    className="rounded-none border-white/20 text-white focus:ring-0 bg-[#0A0A0A] cursor-pointer"
                  />
                  <span className={`truncate text-white/80 text-xs ${t.completed ? 'line-through text-white/30' : ''}`}>
                    {t.text}
                  </span>
                </label>
                <button
                  onClick={() => removeTask(t.id)}
                  className="text-white/40 hover:text-white p-0.5 text-xs font-bold leading-none cursor-pointer ml-1"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
            {tasks.length === 0 && (
              <p className="text-[10px] font-mono uppercase tracking-widest text-white/20 text-center py-6">No tasks logged.</p>
            )}
          </div>
        </div>

        <form onSubmit={handleAddTask} className="mt-4 flex gap-1.5">
          <input
            type="text"
            placeholder="Add new task..."
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            className="flex-1 px-3 py-2 text-xs bg-[#0A0A0A] text-white border border-white/10 rounded-none focus:outline-none focus:border-white/30 font-mono placeholder:text-white/20"
          />
          <button
            type="submit"
            className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest bg-white text-black hover:bg-neutral-200 transition rounded-none cursor-pointer"
          >
            + ADD
          </button>
        </form>
      </div>
    </div>
  );
};

// 3. Drawing Canvas component
export const CanvasApp: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [color, setColor] = useState('#6366f1'); // Indigo default
  const [lineWidth, setLineWidth] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Fill canvas background white on first draw
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawing(true);
    playChime('click');
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    playChime('click');
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `whiteboard_drawing_${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
    playChime('success');
  };

  return (
    <div className="flex flex-col h-full bg-[#121212] border border-white/10 text-white p-6 select-none">
      <div className="flex border-b border-white/5 pb-4 justify-between items-center mb-4 bg-transparent">
        <div>
          <h2 className="text-sm font-serif italic text-white leading-none">Micro Canvas Whiteboard</h2>
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono mt-1.5">Sketch thoughts and download diagrams instantly</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={clearCanvas}
            className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest bg-transparent border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition rounded-none cursor-pointer"
          >
            Clear Canvas
          </button>
          <button
            onClick={downloadCanvas}
            className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest bg-white text-black hover:bg-neutral-200 transition flex items-center gap-1.5 rounded-none cursor-pointer"
          >
            Export PNG
          </button>
        </div>
      </div>

      {/* Toolbar / Options */}
      <div className="flex flex-wrap items-center gap-6 bg-[#0A0A0A] border border-white/5 p-4 rounded-none mb-4 text-[10px] font-mono uppercase tracking-wider">
        {/* Colors */}
        <div className="flex items-center gap-3">
          <span className="text-white/40">Palette:</span>
          <div className="flex gap-1.5">
            {['#6366f1', '#f43f5e', '#10b981', '#0ea5e9', '#f59e0b', '#000000', '#d97706'].map(c => (
              <button
                key={c}
                onClick={() => { setColor(c); playChime('click'); }}
                className={`w-5 h-5 rounded-full border transition ${
                  color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#121212] scale-110' : 'border-white/15 hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Brush Size */}
        <div className="flex items-center gap-3">
          <span className="text-white/40 whitespace-nowrap">Size: ({lineWidth}px)</span>
          <input
            type="range"
            min="1"
            max="15"
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="w-24 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
          />
        </div>
      </div>

      {/* Canvas Block */}
      <div className="flex-1 min-h-0 bg-white rounded-none overflow-hidden border border-white/10 relative">
        <canvas
          ref={canvasRef}
          width={800}
          height={400}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="w-full h-full cursor-crosshair bg-white"
        />
      </div>
    </div>
  );
};

// 4. JSON Editor & Formatter Studio
export const JsonFormatterApp: React.FC = () => {
  const [input, setInput] = useState('{\n  "applet_id": "dashboard-v1",\n  "project": "Applet Cockpit",\n  "status": "ready",\n  "features": [\n    "iframe isolation",\n    "localstate auto-save",\n    "firebase backup"\n  ],\n  "stats": {\n    "nodesCount": 7,\n    "OMVHostActive": true\n  }\n}');
  const [output, setOutput] = useState('');
  const [errorString, setErrorString] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleFormat = () => {
    try {
      setErrorString(null);
      const parsed = JSON.parse(input);
      const formatted = JSON.stringify(parsed, null, 2);
      setOutput(formatted);
      playChime('success');
    } catch (err: any) {
      setErrorString(err?.message || 'Invalid JSON syntax');
      setOutput('');
      playChime('beep');
    }
  };

  const handleMinify = () => {
    try {
      setErrorString(null);
      const parsed = JSON.parse(input);
      const minified = JSON.stringify(parsed);
      setOutput(minified);
      playChime('success');
    } catch (err: any) {
      setErrorString(err?.message || 'Invalid JSON syntax');
      setOutput('');
      playChime('beep');
    }
  };

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    playChime('success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#121212] border border-white/10 text-white p-6 select-none">
      <div className="flex border-b border-white/5 pb-4 justify-between items-center mb-4 bg-transparent">
        <div>
          <h2 className="text-sm font-serif italic text-white leading-none">JSON Formatter Studio</h2>
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono mt-1.5">Validate code structures and format payload keys</p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0 mb-4">
        {/* Input */}
        <div className="flex flex-col min-h-0">
          <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-widest text-white/40 mb-2">
            <span>Input Blurb:</span>
            <button
              onClick={() => { setInput(''); setOutput(''); setErrorString(null); playChime('click'); }}
              className="text-[9px] hover:text-white text-white/40 font-mono tracking-widest uppercase cursor-pointer"
            >
              [Clear]
            </button>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste your unformatted raw JSON blurb here..."
            className="flex-1 w-full p-3 bg-[#0A0A0A] text-white border border-white/10 rounded-none text-xs font-mono focus:outline-none focus:border-white/30 resize-none overflow-y-auto placeholder:text-white/20"
          />
        </div>

        {/* Output */}
        <div className="flex flex-col min-h-0">
          <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-widest text-white/40 mb-2">
            <span>Formatted Stream:</span>
            {output && (
              <button
                onClick={handleCopy}
                className="text-[10px] text-white hover:text-white/80 font-bold uppercase font-mono tracking-wider bg-transparent border-0 cursor-pointer"
              >
                {copied ? '[COPIED]' : '[COPY ALL]'}
              </button>
            )}
          </div>
          <div className="flex-1 w-full bg-[#0A0A0A] border border-white/10 rounded-none p-3 overflow-hidden flex flex-col">
            {errorString ? (
              <div className="text-red-400 text-xs font-mono whitespace-pre-wrap p-3 border border-red-900 bg-red-950/20 rounded-none h-full overflow-y-auto">
                ⚠️ JSON parsing failed:<br />
                {errorString}
              </div>
            ) : (
              <textarea
                readOnly
                value={output}
                placeholder="Click 'Format JSON' or 'Minify' to process..."
                className="w-full h-full bg-transparent text-white text-xs font-mono resize-none focus:outline-none overflow-y-auto placeholder:text-white/15"
              />
            )}
          </div>
        </div>
      </div>

      {/* Buttons block */}
      <div className="flex gap-2">
        <button
          onClick={handleFormat}
          className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest bg-white text-black hover:bg-neutral-200 transition rounded-none cursor-pointer"
        >
          Format & Beautify
        </button>
        <button
          onClick={handleMinify}
          className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest bg-transparent border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition rounded-none cursor-pointer"
        >
          Minify Output
        </button>
      </div>
    </div>
  );
};

// 5. Decimal Math Calculator
export const CalculatorApp: React.FC = () => {
  const [display, setDisplay] = useState('0');
  const [tape, setTape] = useState<string[]>([]);
  const [expression, setExpression] = useState('');
  
  // Keyboard capture focus state
  const [isFocused, setIsFocused] = useState(false);

  const keyClick = (char: string) => {
    playChime('click');
    if (char === 'C') {
      setDisplay('0');
      setExpression('');
    } else if (char === 'Backspace') {
      if (display.length > 1) {
        setDisplay(display.slice(0, -1));
      } else {
        setDisplay('0');
      }
    } else if (char === '=') {
      try {
        // Safe evaluation pattern
        const sanitized = display.replace(/×/g, '*').replace(/÷/g, '/');
        const calculated = Function(`"use strict"; return (${sanitized})`)();
        const output = String(calculated);
        setTape([`${display} = ${output}`, ...tape.slice(0, 9)]);
        setDisplay(output);
      } catch {
        setDisplay('Error');
        setTimeout(() => setDisplay('0'), 1500);
      }
    } else if (char === '%') {
      try {
        const val = parseFloat(display) / 100;
        setDisplay(String(val));
      } catch {
        setDisplay('Error');
      }
    } else {
      if (display === '0' || display === 'Error') {
        if ('+ - × ÷'.includes(char)) {
          setDisplay('0' + char);
        } else {
          setDisplay(char);
        }
      } else {
        const lastChar = display[display.length - 1];
        if ('+ - × ÷'.includes(lastChar) && '+ - × ÷'.includes(char)) {
          // Replace last operator
          setDisplay(display.slice(0, -1) + char);
        } else {
          setDisplay(display + char);
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const key = e.key;
    if (key >= '0' && key <= '9') {
      e.preventDefault();
      keyClick(key);
    } else if (key === '.') {
      e.preventDefault();
      keyClick('.');
    } else if (key === '+') {
      e.preventDefault();
      keyClick('+');
    } else if (key === '-') {
      e.preventDefault();
      keyClick('-');
    } else if (key === '*') {
      e.preventDefault();
      keyClick('×');
    } else if (key === '/') {
      e.preventDefault();
      keyClick('÷');
    } else if (key === 'Enter' || key === '=') {
      e.preventDefault();
      keyClick('=');
    } else if (key === 'Backspace') {
      e.preventDefault();
      keyClick('Backspace');
    } else if (key === 'Escape' || key === 'c' || key === 'C') {
      e.preventDefault();
      keyClick('C');
    } else if (key === '%') {
      e.preventDefault();
      keyClick('%');
    }
  };

  return (
    <div 
      tabIndex={0}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onKeyDown={handleKeyDown}
      className={`flex flex-col lg:flex-row h-full bg-[#121212] border text-white p-6 gap-6 select-none focus:outline-none transition-all duration-200 ${
        isFocused ? 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.12)]' : 'border-white/10'
      }`}
      title="Click applet to focus and input with your keyboard"
    >
      
      {/* Calculator Body */}
      <div className="flex-1 flex flex-col justify-between max-w-sm mx-auto bg-[#0A0A0A] border border-white/5 p-4 rounded-none">
        {/* Screen */}
        <div className="bg-[#121212]/50 border border-white/5 p-4 rounded-none text-right overflow-hidden mb-4">
          <div className="text-[9px] font-mono text-white/30 h-4 uppercase tracking-widest select-none">
            {display.includes('+') || display.includes('-') || display.includes('×') || display.includes('÷') ? 'CALCULATING' : 'IDLE'}
          </div>
          <div className="text-2xl font-bold font-mono tracking-tighter text-white mt-1 truncate">
            {display}
          </div>
        </div>

        {/* Tactile Grids */}
        <div className="grid grid-cols-4 gap-2">
          {['C', 'Backspace', '%', '÷'].map(k => (
            <button
              key={k}
              onClick={() => keyClick(k)}
              className="py-3 text-[11px] font-bold font-mono rounded-none border border-white/5 bg-[#121212]/70 hover:bg-white/5 text-white/70 hover:text-white transition cursor-pointer"
            >
              {k === 'Backspace' ? '⌫' : k}
            </button>
          ))}
          {['7', '8', '9', '×'].map(k => (
            <button
              key={k}
              onClick={() => keyClick(k)}
              className={`py-3 text-[11px] font-bold font-mono rounded-none border transition cursor-pointer ${
                '×'.includes(k) 
                  ? 'border-white/10 text-white bg-[#121212]/50 hover:bg-white/5' 
                  : 'border-white/5 text-white/60 bg-[#0A0A0A] hover:bg-white/5'
              }`}
            >
              {k}
            </button>
          ))}
          {['4', '5', '6', '-'].map(k => (
            <button
              key={k}
              onClick={() => keyClick(k)}
              className={`py-3 text-[11px] font-bold font-mono rounded-none border transition cursor-pointer ${
                '-'.includes(k) 
                  ? 'border-white/10 text-white bg-[#121212]/50 hover:bg-white/5' 
                  : 'border-white/5 text-white/60 bg-[#0A0A0A] hover:bg-white/5'
              }`}
            >
              {k}
            </button>
          ))}
          {['1', '2', '3', '+'].map(k => (
            <button
              key={k}
              onClick={() => keyClick(k)}
              className={`py-3 text-[11px] font-bold font-mono rounded-none border transition cursor-pointer ${
                '+'.includes(k) 
                  ? 'border-white/10 text-white bg-[#121212]/50 hover:bg-white/5' 
                  : 'border-white/5 text-white/60 bg-[#0A0A0A] hover:bg-white/5'
              }`}
            >
              {k}
            </button>
          ))}
          {['0', '.', '=', ''].map((k, index) => {
            if (index === 3) return <div key="spacer" />;
            return (
              <button
                key={k}
                onClick={() => keyClick(k)}
                className={`py-3 text-[11px] font-bold font-mono rounded-none border transition cursor-pointer ${
                  k === '=' 
                    ? 'border-white text-black bg-white hover:bg-neutral-200 font-bold' 
                    : 'border-white/5 text-white/60 bg-[#0A0A0A] hover:bg-white/5'
                }`}
              >
                {k}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tape Tape */}
      <div className="w-full lg:w-48 bg-[#0A0A0A] border border-white/5 p-4 rounded-none flex flex-col justify-between">
        <div>
          <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-white/40 mb-3 block">History Tape</span>
          <div className="space-y-1.5 overflow-y-auto max-h-48 pr-1">
            {tape.map((t, idx) => (
              <div key={idx} className="text-[10px] text-right font-mono border-b border-white/5 py-2 text-white/50">
                {t}
              </div>
            ))}
            {tape.length === 0 && (
              <p className="text-[9px] font-mono uppercase tracking-widest text-white/20 text-center py-6">Tape is empty</p>
            )}
          </div>
        </div>
        <button
          onClick={() => { setTape([]); playChime('click'); }}
          className="text-center text-[9px] font-mono uppercase tracking-widest text-white/40 hover:text-white transition cursor-pointer pt-4 no-underline bg-transparent border-0 outline-none"
        >
          Clear Memory
        </button>
      </div>

    </div>
  );
};
