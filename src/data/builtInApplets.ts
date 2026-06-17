import { Applet } from '../types';

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
    updatedAt: new Date().toISOString()
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
    updatedAt: new Date().toISOString()
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
    updatedAt: new Date().toISOString()
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
    updatedAt: new Date().toISOString()
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
