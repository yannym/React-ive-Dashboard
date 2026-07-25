import { Applet, AppletSetting } from '../types';

export const BUILT_IN_APPLETS: Applet[] = [
  {
    id: 'builtin-notes',
    name: 'QuickNotes Workspace',
    description: 'A stylish rich markdown and scratchpad with client-side persistent storage and instant copy support.',
    url: 'internal:notes',
    isCustomEmbed: false,
    icon: '📝',
    category: 'Productivity',
    tags: ['markdown', 'editor', 'scratchpad'],
    openMode: 'iframe',
    accentColor: 'indigo',
    isPinned: true,
    ownerId: 'default',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customSettings: [
      { key: 'font_size', label: 'Font Size', type: 'select', value: 'normal', options: [
        { label: 'Small', value: 'small' },
        { label: 'Normal', value: 'normal' },
        { label: 'Large', value: 'large' }
      ]},
      { key: 'autosave_enabled', label: 'Enable Autosave', type: 'boolean', value: true }
    ]
  },
  {
    id: 'builtin-pomodoro',
    name: 'Pomodoro Focus Timer',
    description: 'A circular customizable interval focus clock with task list integration and notification chime.',
    url: 'internal:pomodoro',
    isCustomEmbed: false,
    icon: '⏱️',
    category: 'Productivity',
    tags: ['focus', 'timer', 'productivity'],
    openMode: 'iframe',
    accentColor: 'rose',
    isPinned: true,
    ownerId: 'default',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customSettings: [
      { key: 'work_duration', label: 'Work Duration (m)', type: 'number', value: 25, min: 1, max: 120 },
      { key: 'break_duration', label: 'Break Duration (m)', type: 'number', value: 5, min: 1, max: 60 }
    ]
  },
  {
    id: 'builtin-canvas',
    name: 'Micro Canvas Paint',
    description: 'An interactive HTML5 whiteboard to paint, sketch diagrams, alter stroke sizes, and export as PNG image files.',
    url: 'internal:canvas',
    isCustomEmbed: false,
    icon: '🎨',
    category: 'Creativity',
    tags: ['drawing', 'whiteboard', 'canvas'],
    openMode: 'iframe',
    accentColor: 'emerald',
    isPinned: false,
    ownerId: 'default',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customSettings: [
      { key: 'brush_size', label: 'Default Brush Size', type: 'range', value: 5, min: 1, max: 50 }
    ]
  },
  {
    id: 'builtin-json',
    name: 'JSON Formatter Studio',
    description: 'A quick JSON validator, beautifier, minifier, and structural parser with error highlighting.',
    url: 'internal:json',
    isCustomEmbed: false,
    icon: '🔧',
    category: 'Developer',
    tags: ['json', 'formatter', 'developer', 'tool'],
    openMode: 'iframe',
    accentColor: 'amber',
    isPinned: false,
    ownerId: 'default',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customSettings: [
      { key: 'tab_size', label: 'Tab Indent Size', type: 'number', value: 2, min: 1, max: 8 }
    ]
  },
  {
    id: 'builtin-calculator',
    name: 'Decimal Math Calculator',
    description: 'A simple interactive grid calculator with running history tape, percentage operations, and tactile key clicking.',
    url: 'internal:calculator',
    isCustomEmbed: false,
    icon: '🧮',
    category: 'Utilities',
    tags: ['calculator', 'math', 'tools'],
    openMode: 'iframe',
    accentColor: 'sky',
    isPinned: false,
    ownerId: 'default',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'builtin-wetransfer',
    name: 'WeTransfer Downloader',
    description: 'Background downloader for direct WeTransfer email links (we.tl/t-...) with real-time process tracking and auto-unzip.',
    url: 'internal:wetransfer',
    isCustomEmbed: false,
    icon: '📦',
    category: 'Utilities',
    tags: ['wetransfer', 'downloader', 'background', 'files'],
    openMode: 'iframe',
    accentColor: 'emerald',
    isPinned: true,
    ownerId: 'default',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'builtin-screensaver',
    name: 'Fluid Screensaver',
    description: 'Topographic flow-field dynamic screensaver with customizable idle timeout and mouse interactive dissolving.',
    url: 'internal:screensaver',
    isCustomEmbed: false,
    icon: '🌌',
    category: 'System',
    tags: ['screensaver', 'visualizer', 'fluid', 'canvas'],
    openMode: 'iframe',
    accentColor: 'violet',
    isPinned: true,
    ownerId: 'default',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customSettings: [
      { key: 'screensaver_enabled', label: 'Enable Screensaver', type: 'boolean', value: true },
      { key: 'screensaver_timeout', label: 'Idle Timeout (Seconds)', type: 'number', value: 60, min: 3, max: 3600 }
    ]
  }
];

export const AVAILABLE_CATEGORIES = [
  'Productivity',
  'Utilities',
  'Developer',
  'Creativity',
  'Self-Hosted (Local)',
  'System',
  'External Tools'
];

export const ACCENT_COLORS = [
  { name: 'Indigo', value: 'indigo', border: 'border-indigo-500/30', bg: 'bg-indigo-50/10', text: 'text-indigo-400', button: 'bg-indigo-600 hover:bg-indigo-500 hover:shadow-indigo-500/20' },
  { name: 'Rose', value: 'rose', border: 'border-rose-500/30', bg: 'bg-rose-50/10', text: 'text-rose-400', button: 'bg-rose-600 hover:bg-rose-500 hover:shadow-rose-500/20' },
  { name: 'Emerald', value: 'emerald', border: 'border-emerald-500/30', bg: 'bg-emerald-50/10', text: 'text-emerald-400', button: 'bg-emerald-600 hover:bg-emerald-500 hover:shadow-emerald-500/20' },
  { name: 'Sky', value: 'sky', border: 'border-sky-500/30', bg: 'bg-sky-50/10', text: 'text-sky-400', button: 'bg-sky-600 hover:bg-sky-500 hover:shadow-sky-500/20' },
  { name: 'Amber', value: 'amber', border: 'border-amber-500/30', bg: 'bg-amber-50/10', text: 'text-amber-400', button: 'bg-amber-600 hover:bg-amber-500 hover:shadow-amber-500/20' },
  { name: 'Violet', value: 'violet', border: 'border-violet-500/30', bg: 'bg-violet-50/10', text: 'text-violet-400', button: 'bg-violet-600 hover:bg-violet-500 hover:shadow-violet-500/20' },
  { name: 'Red', value: 'red', border: 'border-red-500/30', bg: 'bg-red-50/10', text: 'text-red-400', button: 'bg-red-600 hover:bg-red-500 hover:shadow-red-500/20' },
  { name: 'Teal', value: 'teal', border: 'border-teal-500/30', bg: 'bg-teal-50/10', text: 'text-teal-400', button: 'bg-teal-600 hover:bg-teal-500 hover:shadow-teal-500/20' }
];

export const POPULAR_LAUNCH_ICONS = [
  '📝', '⏱️', '🎨', '🔧', '🧮', '🖧', '🛡️', '📊', '💬', '🔔', '📁', '⚙️', 
  '🌐', '💾', '📧', '🎵', '📺', '🔑', '☁️', '🏠', '📈', '🚀', '🧠', '👾'
];
