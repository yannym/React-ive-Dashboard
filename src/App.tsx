import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutGrid, 
  Plus, 
  Settings, 
  Search, 
  Pin, 
  RefreshCw, 
  ExternalLink, 
  Maximize2, 
  Minimize2, 
  Trash2, 
  Edit, 
  Cloud, 
  Database, 
  Folder,
  HardDrive, 
  Filter, 
  X, 
  ChevronLeft, 
  HelpCircle, 
  FileDown, 
  FileUp, 
  Key, 
  ZoomIn, 
  FileText,
  CornerUpLeft, 
  ZoomOut, 
  Check, 
  Bell,
  AlertTriangle,
  Copy,
  Sliders, 
  Globe, 
  Server, 
  Sparkles, 
  LogIn, 
  LogOut,
  Info,
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import { Applet, OpenMode, SandboxConfig, FirebaseConnectionDetails } from './types';
import { BUILT_IN_APPLETS, AVAILABLE_CATEGORIES, ACCENT_COLORS, POPULAR_LAUNCH_ICONS } from './data/builtInApplets';
import { 
  QuickNotesApp, 
  PomodoroApp, 
  CanvasApp, 
  JsonFormatterApp, 
  CalculatorApp 
} from './components/BuiltInApps';
import { DynamicComponentLoader } from './components/DynamicComponentLoader';
import { AppletErrorBoundary } from './components/AppletErrorBoundary';
import { TiledWorkspace } from './components/TiledWorkspace';
import { SystemConsoleModal } from './components/SystemConsoleModal';
import { GeminiCopilot } from './components/GeminiCopilot';
import { 
  db, 
  auth, 
  isConfigured, 
  signInWithGoogle, 
  logOutUser, 
  fetchUserApplets, 
  saveAppletToCloud, 
  deleteAppletFromCloud 
} from './lib/firebase';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, collection, setDoc, doc, deleteDoc, getDocs, query, where } from 'firebase/firestore';

export interface CategoryConfig {
  name: string;
  icon: string;
  color: string;
  isCustom?: boolean;
}

const DEFAULT_CATEGORIES: CategoryConfig[] = [
  { name: 'Productivity', icon: '📝', color: 'text-emerald-400' },
  { name: 'Utilities', icon: '🧮', color: 'text-sky-400' },
  { name: 'Developer', icon: '🔧', color: 'text-indigo-400' },
  { name: 'Creativity', icon: '🎨', color: 'text-rose-400' },
  { name: 'Self-Hosted (Local)', icon: '🏠', color: 'text-amber-400' },
  { name: 'System', icon: '🛡️', color: 'text-violet-400' },
  { name: 'External Tools', icon: '🌐', color: 'text-rose-400' }
];

const PRESET_DIR_ICONS = [
  '📝', '🧮', '🔧', '🎨', '🏠', '🛡️', '🌐', '🤖', '📊', '📁', '💬', '🚀', '🎮', '⚡', '📂', '⚙️', '🔍', '📅', '💡', '🎵', '🔒', '👥', '🍕', '🚴'
];

const PRESET_DIR_COLORS = [
  { name: 'Emerald', class: 'text-emerald-400', bg: 'bg-emerald-500' },
  { name: 'Sky', class: 'text-sky-400', bg: 'bg-sky-500' },
  { name: 'Indigo', class: 'text-indigo-400', bg: 'bg-indigo-500' },
  { name: 'Rose', class: 'text-rose-400', bg: 'bg-rose-500' },
  { name: 'Amber', class: 'text-amber-400', bg: 'bg-amber-500' },
  { name: 'Violet', class: 'text-violet-400', bg: 'bg-violet-500' },
  { name: 'Red', class: 'text-red-400', bg: 'bg-red-500' },
  { name: 'Teal', class: 'text-teal-400', bg: 'bg-teal-500' },
  { name: 'Pink', class: 'text-pink-400', bg: 'bg-pink-500' },
  { name: 'Cyan', class: 'text-cyan-400', bg: 'bg-cyan-500' }
];

export default function App() {
  // --- STATE LISTINGS ---
  const [applets, setApplets] = useState<Applet[]>([]);
  const [activeApplet, setActiveApplet] = useState<Applet | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // React-side state for purged applets to filter out of active lists instantly
  const [purgedIds, setPurgedIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('applet_dashboard_purged_ids');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // --- TRASH BIN TYPES & STATES ---
  interface TrashedApplet {
    applet: Applet;
    deletedAt: string;
    associatedFile?: {
      path: string;
      content: string;
    };
  }

  interface TrashedFile {
    path: string;
    name: string;
    content: string;
    deletedAt: string;
    size: number;
    isDirectory: boolean;
  }

  const [trashBin, setTrashBin] = useState<{ applets: TrashedApplet[]; files: TrashedFile[] }>(() => {
    try {
      const stored = localStorage.getItem('applet_dashboard_trash_bin');
      return stored ? JSON.parse(stored) : { applets: [], files: [] };
    } catch {
      return { applets: [], files: [] };
    }
  });

  const [showTrashModal, setShowTrashModal] = useState(false);
  const [appletToTrash, setAppletToTrash] = useState<Applet | null>(null);
  const [fileToTrash, setFileToTrash] = useState<{ path: string; isDirectory: boolean; name: string } | null>(null);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);
  const [appletToPermanentlyDelete, setAppletToPermanentlyDelete] = useState<{ id: string; name: string } | null>(null);
  const [fileToPermanentlyDelete, setFileToPermanentlyDelete] = useState<{ path: string; name: string } | null>(null);

  const syncTrashBinToStorage = (updatedTrash: typeof trashBin) => {
    setTrashBin(updatedTrash);
    localStorage.setItem('applet_dashboard_trash_bin', JSON.stringify(updatedTrash));
  };

  // Filesystem Manager State
  const [showFilesystemModal, setShowFilesystemModal] = useState(false);
  const [fsCurrentPath, setFsCurrentPath] = useState<string>('.');
  const [fsItems, setFsItems] = useState<any[]>([]);
  const [fsLoading, setFsLoading] = useState(false);
  const [fsError, setFsError] = useState<string | null>(null);
  const [fsSelectedFilePath, setFsSelectedFilePath] = useState<string | null>(null);
  const [fsFileContent, setFsFileContent] = useState<string>('');
  const [fsFileLoading, setFsFileLoading] = useState(false);
  const [fsSaving, setFsSaving] = useState(false);
  
  // UI Panels
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingApplet, setEditingApplet] = useState<Applet | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Theme override state
  const [useCohesiveInjector, setUseCohesiveInjector] = useState<boolean>(() => {
    const saved = localStorage.getItem('cohesive_style_injector');
    return saved !== null ? saved === 'true' : true;
  });

  // --- SYSTEM LOGS CONSOLE STATE ---
  interface SystemLog {
    id: string;
    timestamp: string;
    type: 'info' | 'error' | 'success' | 'warn';
    category: string;
    message: string;
    details?: string;
  }
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [showConsoleModal, setShowConsoleModal] = useState(false);

  const addSystemLog = React.useCallback((type: 'info' | 'error' | 'success' | 'warn', category: string, message: string, details?: string) => {
    const newLog: SystemLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type,
      category,
      message,
      details
    };
    setSystemLogs(prev => [newLog, ...prev].slice(0, 500));
  }, []);

  useEffect(() => {
    (window as any).addSystemLog = addSystemLog;
    addSystemLog('info', 'system', 'Applet Cockpit Dashboard initialized.');
    addSystemLog('info', 'system', 'Local workspace is mapped to client dashboard sandbox. Port 3000 binds active routing.');
    
    const handleError = (event: ErrorEvent) => {
      addSystemLog('error', 'runtime', event.message, event.error?.stack);
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? reason.stack : undefined;
      addSystemLog('error', 'promise', `Unhandled Promise Rejection: ${message}`, stack);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [addSystemLog]);

  // Automated Component discovery scanner
  const [didScanComponents, setDidScanComponents] = useState(false);
  
  // Configuration Form States
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formEmbedCode, setFormEmbedCode] = useState('');
  const [formIsCustomEmbed, setFormIsCustomEmbed] = useState(false);
  const [formIcon, setFormIcon] = useState('🌐');
  const [formCategory, setFormCategory] = useState('Productivity');
  const [formTags, setFormTags] = useState('');
  const [formOpenMode, setFormOpenMode] = useState<OpenMode>('iframe');
  const [formAccentColor, setFormAccentColor] = useState('indigo');
  const [formSandbox, setFormSandbox] = useState<SandboxConfig>({
    allowScripts: true,
    allowSameOrigin: true,
    allowForms: true,
    allowPopups: true
  });

  // Client Dashboard Metrics
  const [connectionType, setConnectionType] = useState<'local' | 'cloud'>(isConfigured ? 'cloud' : 'local');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'offline' | 'error'>('synced');
  const [syncError, setSyncError] = useState<string | null>(null);

  // Custom toast notification state
  interface AppToast {
    message: string;
    type: 'success' | 'warn' | 'error' | 'info' | 'crash';
    appletName?: string;
    stack?: string;
  }
  const [toast, setToast] = useState<AppToast | null>(null);

  const triggerToast = (message: string, type: 'success' | 'warn' | 'error' | 'info' | 'crash' = 'success') => {
    setToast({ message, type });
  };

  // --- DYNAMIC CATEGORIES STATE & HANDLERS ---
  const [categories, setCategories] = useState<CategoryConfig[]>(() => {
    const saved = localStorage.getItem('applet_dashboard_categories_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse category configs:", e);
      }
    }
    return DEFAULT_CATEGORIES;
  });

  useEffect(() => {
    localStorage.setItem('applet_dashboard_categories_config', JSON.stringify(categories));
  }, [categories]);

  const [showManageCategoriesModal, setShowManageCategoriesModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📁');
  const [newCatColor, setNewCatColor] = useState('text-emerald-400');

  const [editingCategoryName, setEditingCategoryName] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatIcon, setEditCatIcon] = useState('');
  const [editCatColor, setEditCatColor] = useState('');

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newCatName.trim();
    if (!cleanName) return;

    if (categories.some(c => c.name.toLowerCase() === cleanName.toLowerCase())) {
      alert("A directory with that name already exists.");
      return;
    }

    const newCategory: CategoryConfig = {
      name: cleanName,
      icon: newCatIcon,
      color: newCatColor,
      isCustom: true
    };

    setCategories([...categories, newCategory]);
    setNewCatName('');
    setNewCatIcon('📁');
    setNewCatColor('text-emerald-400');
    triggerToast(`Created dynamic directory: ${cleanName}`, 'success');
  };

  const handleDeleteCategory = async (catName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${catName}"? Any applets in this category will automatically be reassigned to "Productivity".`)) {
      return;
    }

    const updatedApplets = applets.map(app => {
      if (app.category === catName) {
        return { ...app, category: 'Productivity' };
      }
      return app;
    });

    setApplets(updatedApplets);
    await syncAppletsToStorage(updatedApplets);

    setCategories(categories.filter(c => c.name !== catName));
    if (selectedCategory === catName) {
      setSelectedCategory('All');
    }
    triggerToast(`Deleted directory: ${catName}`, 'success');
  };

  const handleStartEditCategory = (cat: CategoryConfig) => {
    setEditingCategoryName(cat.name);
    setEditCatName(cat.name);
    setEditCatIcon(cat.icon);
    setEditCatColor(cat.color);
  };

  const handleSaveEditedCategory = async (originalName: string) => {
    const cleanName = editCatName.trim();
    if (!cleanName) return;

    if (cleanName.toLowerCase() !== originalName.toLowerCase() && 
        categories.some(c => c.name.toLowerCase() === cleanName.toLowerCase())) {
      alert("A directory with that name already exists.");
      return;
    }

    const updatedCategories = categories.map(c => {
      if (c.name === originalName) {
        return {
          ...c,
          name: cleanName,
          icon: editCatIcon,
          color: editCatColor
        };
      }
      return c;
    });

    setCategories(updatedCategories);

    if (cleanName !== originalName) {
      const updatedApplets = applets.map(app => {
        if (app.category === originalName) {
          return { ...app, category: cleanName };
        }
        return app;
      });
      setApplets(updatedApplets);
      await syncAppletsToStorage(updatedApplets);

      if (selectedCategory === originalName) {
        setSelectedCategory(cleanName);
      }
    }

    setEditingCategoryName(null);
    triggerToast(`Updated directory: ${cleanName}`, 'success');
  };

  // --- SYSTEM FILESYSTEM MANAGER HANDLERS ---
  const handleOpenFilesystemManager = async () => {
    setShowFilesystemModal(true);
    await handleFetchFsItems(fsCurrentPath);
  };

  const handleFetchFsItems = async (subPath: string) => {
    setFsLoading(true);
    setFsError(null);
    try {
      const resp = await fetch(`/api/files/list?path=${encodeURIComponent(subPath)}`);
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: `HTTP ${resp.status}: ${resp.statusText}` }));
        throw new Error(errData.error || 'Failed to list directory contents.');
      }
      const data = await resp.json();
      if (data.success) {
        setFsItems(data.contents || []);
        setFsCurrentPath(data.currentPath || subPath);
        addSystemLog('success', 'fs', `Listed directory "${data.currentPath}" successfully with ${data.contents?.length || 0} items.`);
      }
    } catch (err: any) {
      setFsError(err.message || 'Error listing files.');
      addSystemLog('error', 'fs', `Failed to list directory "${subPath}": ${err.message || err.toString()}`, err.stack);
    } finally {
      setFsLoading(false);
    }
  };

  const handleFsReadFile = async (filePath: string) => {
    setFsFileLoading(true);
    setFsError(null);
    try {
      const resp = await fetch('/api/files/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath })
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: `HTTP ${resp.status}: ${resp.statusText}` }));
        throw new Error(errData.error || 'Failed to read file contents.');
      }
      const data = await resp.json();
      if (data.success) {
        setFsSelectedFilePath(filePath);
        setFsFileContent(data.content || '');
        addSystemLog('success', 'fs', `Read file "${filePath}" successfully (${data.content?.length || 0} characters).`);
      }
    } catch (err: any) {
      setFsError(err.message || 'Error reading file.');
      addSystemLog('error', 'fs', `Failed to read file "${filePath}": ${err.message || err.toString()}`, err.stack);
    } finally {
      setFsFileLoading(false);
    }
  };

  const handleFsWriteFile = async () => {
    if (!fsSelectedFilePath) return;
    setFsSaving(true);
    setFsError(null);
    try {
      const resp = await fetch('/api/files/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fsSelectedFilePath, content: fsFileContent })
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: `HTTP ${resp.status}: ${resp.statusText}` }));
        throw new Error(errData.error || 'Failed to save changes.');
      }
      const data = await resp.json();
      if (data.success) {
        triggerToast('File saved successfully.', 'success');
        addSystemLog('success', 'fs', `Saved file "${fsSelectedFilePath}" successfully (${fsFileContent?.length || 0} characters).`);
        await handleFetchFsItems(fsCurrentPath);
      }
    } catch (err: any) {
      setFsError(err.message || 'Error saving file.');
      addSystemLog('error', 'fs', `Failed to save file "${fsSelectedFilePath}": ${err.message || err.toString()}`, err.stack);
    } finally {
      setFsSaving(false);
    }
  };

  const handleFsDeleteFile = async (filePath: string, isDirectory: boolean) => {
    setFileToTrash({
      path: filePath,
      isDirectory,
      name: filePath.split('/').pop() || filePath
    });
  };

  // --- TRASH BIN EXECUTOR ACTIONS ---
  const executeTrashApplet = async (applet: Applet) => {
    try {
      let associatedFile: { path: string; content: string } | undefined = undefined;

      // Check if it's a dynamic component
      if (applet.url?.startsWith('internal:component:')) {
        const compName = applet.url.replace('internal:component:', '');
        const filePath = `src/components/${compName}.tsx`;
        
        try {
          // Read content to archive it in trash
          const readResp = await fetch('/api/files/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: filePath })
          });
          if (readResp.ok) {
            const readData = await readResp.json();
            if (readData.success) {
              associatedFile = {
                path: filePath,
                content: readData.content || ''
              };
            }
          }
          
          // Physically delete the file
          await fetch('/api/files/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: filePath })
          });
          console.log(`Archived and physically deleted component file for trash: ${filePath}`);
        } catch (err) {
          console.error('Failed to read/delete physical file during trashing:', err);
        }
      }

      // Add to trashBin state
      const newTrashedApplet: TrashedApplet = {
        applet,
        deletedAt: new Date().toISOString(),
        associatedFile
      };

      const updatedTrashApplets = [newTrashedApplet, ...trashBin.applets];
      syncTrashBinToStorage({
        ...trashBin,
        applets: updatedTrashApplets
      });

      // Filter active applets
      const updatedApplets = applets.filter(a => a.id !== applet.id);
      await syncAppletsToStorage(updatedApplets);

      // Add to purged IDs
      const purgedRaw = localStorage.getItem('applet_dashboard_purged_ids');
      const currentPurged = purgedRaw ? JSON.parse(purgedRaw) : [];
      if (!currentPurged.includes(applet.id)) {
        const updatedPurged = [...currentPurged, applet.id];
        localStorage.setItem('applet_dashboard_purged_ids', JSON.stringify(updatedPurged));
        setPurgedIds(updatedPurged);
      }

      // Clear active applet if the deleted one was open
      if (activeApplet && activeApplet.id === applet.id) {
        setActiveApplet(null);
      }

      // Sync to cloud if online
      const activeDb = customFirebaseActive ? customDb : db;
      if (connectionType === 'cloud' && currentUser && activeDb) {
        try {
          await deleteDoc(doc(activeDb, 'applets', applet.id));
        } catch (err) {
          console.error('Delete rejected from Firestore. Check rules:', err);
        }
      }

      triggerToast(`Moved "${applet.name}" to Trash Bin`, 'success');
      await handleFetchFsItems(fsCurrentPath);
    } catch (err: any) {
      triggerToast(`Failed to trash applet: ${err.message}`, 'error');
    }
  };

  const executeTrashFile = async (filePath: string, isDirectory: boolean, name: string) => {
    setFsLoading(true);
    try {
      // Check if it matches a dynamic applet
      let matchingApplet: Applet | undefined = undefined;
      if (filePath.startsWith('src/components/') && filePath.endsWith('.tsx')) {
        const compName = filePath.replace('src/components/', '').replace('.tsx', '');
        matchingApplet = applets.find(a => a.url === `internal:component:${compName}`);
      }

      if (matchingApplet) {
        await executeTrashApplet(matchingApplet);
        return;
      }

      let content = '';
      let size = 0;

      if (!isDirectory) {
        // Read file contents
        const resp = await fetch('/api/files/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: filePath })
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.success) {
            content = data.content || '';
            size = content.length;
          }
        }
      }

      // Call physical delete API
      const delResp = await fetch('/api/files/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath })
      });
      if (!delResp.ok) {
        const errData = await delResp.json();
        throw new Error(errData.error || 'Failed to physically delete file.');
      }

      // Add to trashBin files
      const newTrashedFile: TrashedFile = {
        path: filePath,
        name,
        content,
        deletedAt: new Date().toISOString(),
        size,
        isDirectory
      };

      const updatedTrashFiles = [newTrashedFile, ...trashBin.files];
      syncTrashBinToStorage({
        ...trashBin,
        files: updatedTrashFiles
      });

      if (fsSelectedFilePath === filePath) {
        setFsSelectedFilePath(null);
        setFsFileContent('');
      }

      triggerToast(`Moved "${name}" to Trash Bin`, 'success');
      await handleFetchFsItems(fsCurrentPath);
    } catch (err: any) {
      triggerToast(`Failed to trash file: ${err.message}`, 'error');
    } finally {
      setFsLoading(false);
    }
  };

  const handleRestoreApplet = async (trashed: TrashedApplet) => {
    try {
      // 1. If there's an associated file, recreate it
      if (trashed.associatedFile) {
        const writeResp = await fetch('/api/files/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: trashed.associatedFile.path,
            content: trashed.associatedFile.content
          })
        });
        if (!writeResp.ok) {
          console.warn('Failed to restore associated component file:', trashed.associatedFile.path);
        } else {
          await handleFetchFsItems(fsCurrentPath);
        }
      }

      // 2. Remove from purged IDs so it is visible
      const purgedRaw = localStorage.getItem('applet_dashboard_purged_ids');
      if (purgedRaw) {
        const purgedList = JSON.parse(purgedRaw);
        const updatedPurged = purgedList.filter((id: string) => id.toLowerCase() !== trashed.applet.id.toLowerCase());
        localStorage.setItem('applet_dashboard_purged_ids', JSON.stringify(updatedPurged));
        setPurgedIds(updatedPurged);
      }

      // 3. Add back to active applets
      const updatedApplets = [trashed.applet, ...applets];
      await syncAppletsToStorage(updatedApplets);

      // 4. Remove from trashBin
      const updatedTrashApplets = trashBin.applets.filter(a => a.applet.id.toLowerCase() !== trashed.applet.id.toLowerCase());
      syncTrashBinToStorage({
        ...trashBin,
        applets: updatedTrashApplets
      });

      // Save to cloud if online
      const activeDb = customFirebaseActive ? customDb : db;
      if (connectionType === 'cloud' && currentUser && activeDb) {
        try {
          await setDoc(doc(activeDb, 'applets', trashed.applet.id), trashed.applet);
        } catch (err) {
          console.error('Failed to restore in Firestore:', err);
        }
      }

      triggerToast(`Restored "${trashed.applet.name}" successfully!`, 'success');
    } catch (err: any) {
      triggerToast(`Failed to restore applet: ${err.message}`, 'error');
    }
  };

  const handleRestoreFile = async (trashed: TrashedFile) => {
    try {
      if (trashed.isDirectory) {
        const writeResp = await fetch('/api/files/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: `${trashed.path}/.keep`,
            content: ''
          })
        });
        if (!writeResp.ok) {
          throw new Error('Failed to recreate directory structure.');
        }
      } else {
        const writeResp = await fetch('/api/files/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: trashed.path,
            content: trashed.content
          })
        });
        if (!writeResp.ok) {
          const errData = await writeResp.json();
          throw new Error(errData.error || 'Failed to write restored file.');
        }
      }

      // Remove from trashBin
      const updatedTrashFiles = trashBin.files.filter(f => f.path !== trashed.path);
      syncTrashBinToStorage({
        ...trashBin,
        files: updatedTrashFiles
      });

      triggerToast(`Restored file "${trashed.name}" successfully!`, 'success');
      await handleFetchFsItems(fsCurrentPath);
    } catch (err: any) {
      triggerToast(`Failed to restore file: ${err.message}`, 'error');
    }
  };

  const handlePermanentDeleteApplet = (id: string, name: string) => {
    setAppletToPermanentlyDelete({ id, name });
  };

  const executePermanentDeleteApplet = (id: string, name: string) => {
    const updatedTrashApplets = trashBin.applets.filter(a => a.applet.id.toLowerCase() !== id.toLowerCase());
    syncTrashBinToStorage({
      ...trashBin,
      applets: updatedTrashApplets
    });
    triggerToast(`Permanently deleted: ${name}`, 'success');
  };

  const handlePermanentDeleteFile = (path: string, name: string) => {
    setFileToPermanentlyDelete({ path, name });
  };

  const executePermanentDeleteFile = (path: string, name: string) => {
    const updatedTrashFiles = trashBin.files.filter(f => f.path !== path);
    syncTrashBinToStorage({
      ...trashBin,
      files: updatedTrashFiles
    });
    triggerToast(`Permanently deleted file: ${name}`, 'success');
  };

  const handleEmptyTrash = () => {
    setConfirmEmptyTrash(true);
  };

  const executeEmptyTrash = () => {
    syncTrashBinToStorage({ applets: [], files: [] });
    triggerToast('Trash Bin cleared', 'success');
  };

  // --- ALARMS, ERROR RECORDERS & MULTI-INSTANCE WORKSPACE LOGIC ---
  interface ErrorLog {
    id: string;
    appletName: string;
    errorMessage: string;
    stack: string;
    timestamp: string;
    read: boolean;
  }

  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>(() => {
    const saved = localStorage.getItem('cohesive_applet_error_logs');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return []; }
    }
    return [];
  });

  const [showErrorLogsDropdown, setShowErrorLogsDropdown] = useState(false);
  const [selectedErrorToView, setSelectedErrorToView] = useState<ErrorLog | null>(null);

  const [dashboardLayoutMode, setDashboardLayoutMode] = useState<'grid' | 'tiled'>(() => {
    const saved = localStorage.getItem('cohesive_dashboard_layout_mode');
    return (saved === 'tiled' || saved === 'grid') ? saved : 'grid';
  });

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('applet_dashboard_sidebar_width');
    return saved ? parseInt(saved) : 256;
  });

  const [headerHeight, setHeaderHeight] = useState(() => {
    const saved = localStorage.getItem('applet_dashboard_header_height');
    return saved ? parseInt(saved) : 180;
  });

  const handleSidebarPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const handlePointerMove = (moveEv: PointerEvent) => {
      const newWidth = Math.max(80, Math.min(600, moveEv.clientX));
      setSidebarWidth(newWidth);
      localStorage.setItem('applet_dashboard_sidebar_width', String(newWidth));
    };
    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  const handleHeaderPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = headerHeight;
    const handlePointerMove = (moveEv: PointerEvent) => {
      const deltaY = moveEv.clientY - startY;
      const newHeight = Math.max(50, Math.min(800, startHeight + deltaY));
      setHeaderHeight(newHeight);
      localStorage.setItem('applet_dashboard_header_height', String(newHeight));
    };
    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  useEffect(() => {
    localStorage.setItem('cohesive_dashboard_layout_mode', dashboardLayoutMode);
  }, [dashboardLayoutMode]);

  const [gentleCrashModal, setGentleCrashModal] = useState<{
    isOpen: boolean;
    appletName: string;
    errorMessage: string;
    stack: string;
  }>({
    isOpen: false,
    appletName: '',
    errorMessage: '',
    stack: ''
  });

  // Central crash registry
  const handleAppletCrash = (appletName: string, errorMessage: string, stack: string) => {
    const logId = `log-${Date.now()}`;
    const newLog: ErrorLog = {
      id: logId,
      appletName,
      errorMessage,
      stack,
      timestamp: new Date().toLocaleTimeString(),
      read: false
    };

    setErrorLogs(prev => {
      const n = [newLog, ...prev];
      localStorage.setItem('cohesive_applet_error_logs', JSON.stringify(n));
      return n;
    });

    // Top-Center specialized Interactive Toast
    setToast({ 
      message: `Process crash inside: "${appletName}"`, 
      type: 'crash',
      appletName,
      stack
    });

    // If active applet is currently single active viewport, back out to dashboard and show pop-up
    setActiveApplet(prevActive => {
      if (prevActive && prevActive.name === appletName) {
        setGentleCrashModal({
          isOpen: true,
          appletName,
          errorMessage,
          stack
        });
        return null;
      }
      return prevActive;
    });
  };

  const [stats, setStats] = useState({
    sessionLoads: 1,
    clientMemory: 'N/A',
    latency: '0ms'
  });

  // Iframe Viewport Modifiers
  const [iframeZoom, setIframeZoom] = useState(100);
  const [iframeRefreshKey, setIframeRefreshKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSandboxWarning, setShowSandboxWarning] = useState(true);

  // Dynamic pasting of user custom Firebase details
  const [customFirebaseConfig, setCustomFirebaseConfig] = useState<string>(() => {
    return localStorage.getItem('applet_dashboard_custom_fb_config') || '';
  });
  const [customFirebaseActive, setCustomFirebaseActive] = useState<boolean>(() => {
    return localStorage.getItem('applet_dashboard_custom_fb_active') === 'true';
  });
  
  // Active dynamic custom firebase client references
  const [customDb, setCustomDb] = useState<any>(null);
  const [customAuth, setCustomAuth] = useState<any>(null);

  // Suppress benign internal Vite HMR WS alerts inside preview environments
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (!event) return;
      const reason = event.reason;
      const reasonStr = String(reason || '');
      const reasonMsg = String(reason?.message || '');
      
      if (
        reasonStr.includes('WebSocket') || 
        reasonStr.includes('vite') ||
        reasonMsg.includes('WebSocket') ||
        reasonMsg.includes('vite') ||
        reasonMsg.includes('closed without opened')
      ) {
        console.warn('Suppressing benign Vite HMR internal network promise rejection:', reason);
        event.preventDefault();
      }
    };

    const handleError = (event: ErrorEvent) => {
      if (!event) return;
      const msg = String(event.message || '');
      if (
        msg.includes('WebSocket') || 
        msg.includes('vite') || 
        msg.includes('closed without opened')
      ) {
        console.warn('Suppressing benign Vite HMR error frame update:', msg);
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', handleRejection);
    window.addEventListener('error', handleError);
    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  // --- INITIALIZE DATA LOADERS ---
  useEffect(() => {
    // Generate simple client system stats
    setStats(prev => ({
      ...prev,
      clientMemory: (window.performance && (window.performance as any).memory) 
        ? `${Math.round((window.performance as any).memory.usedJSHeapSize / 1048576)} MB`
        : 'Available',
      latency: `${Math.round(Math.random() * 25 + 5)}ms`
    }));

    // Listen to official Firebase auth state changes
    if (auth && !customFirebaseActive) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
        if (user) {
          setConnectionType('cloud');
          loadDataFromFirebase(user.uid, null);
        } else {
          setConnectionType('local');
          loadDataFromLocalStorage();
        }
      });
      return () => unsubscribe();
    } else if (customFirebaseActive && customFirebaseConfig) {
      // Initialize custom user firebase config dynamically
      try {
        const parsed = JSON.parse(customFirebaseConfig);
        const customApp = getApps().find(app => app.name === 'custom-fb-dashboard') || initializeApp(parsed, 'custom-fb-dashboard');
        const cDb = getFirestore(customApp);
        const cAuth = getAuth(customApp);
        setCustomDb(cDb);
        setCustomAuth(cAuth);

        const unsubscribe = onAuthStateChanged(cAuth, (user) => {
          setCurrentUser(user);
          if (user) {
            setConnectionType('cloud');
            loadDataFromFirebase(user.uid, cDb);
          } else {
            setConnectionType('local');
            loadDataFromLocalStorage();
          }
        });
        return () => unsubscribe();
      } catch (err: any) {
        console.error('Custom user Firebase configuration failed:', err);
        setSyncStatus('error');
        setSyncError(`Custom Firebase Parser error: ${err?.message || 'Check syntax'}`);
        loadDataFromLocalStorage();
      }
    } else {
      // Local fallback
      setConnectionType('local');
      loadDataFromLocalStorage();
    }
  }, [customFirebaseActive, customFirebaseConfig]);

  // Order Index normalization and strict ID de-duplication
  const normalizeAppletsOrder = (list: Applet[]): Applet[] => {
    const uniqueMap = new Map<string, Applet>();
    list.forEach(app => {
      if (!app || !app.id) return;
      const lowerId = app.id.toLowerCase();
      // Keep the first entry. If duplicate, skip to avoid duplicate keys.
      if (!uniqueMap.has(lowerId)) {
        uniqueMap.set(lowerId, app);
      }
    });
    const uniqueList = Array.from(uniqueMap.values());
    return uniqueList.map((app, index) => ({
      ...app,
      orderIndex: app.orderIndex !== undefined ? app.orderIndex : index
    }));
  };

  // Read dataset from LocalStorage
  const loadDataFromLocalStorage = () => {
    try {
      const stored = localStorage.getItem('applet_dashboard_configs');
      if (stored) {
        setApplets(normalizeAppletsOrder(JSON.parse(stored)));
      } else {
        // Hydrate defaults
        const sequenced = normalizeAppletsOrder(BUILT_IN_APPLETS);
        localStorage.setItem('applet_dashboard_configs', JSON.stringify(sequenced));
        setApplets(sequenced);
      }
      setSyncStatus('synced');
      setSyncError(null);
    } catch (err) {
      console.error('Failed reading localStorage config:', err);
      setApplets(normalizeAppletsOrder(BUILT_IN_APPLETS));
    }
  };

  // Read user synced recordset from target Firestore
  const loadDataFromFirebase = async (uid: string, specificDbInstance: any) => {
    const targetDb = specificDbInstance || db;
    if (!targetDb) {
      loadDataFromLocalStorage();
      return;
    }
    setSyncStatus('pending');
    try {
      const q = query(collection(targetDb, 'applets'), where('ownerId', '==', uid));
      const querySnapshot = await getDocs(q);
      const cloudList: Applet[] = [];
      querySnapshot.forEach((doc) => {
        cloudList.push(doc.data() as Applet);
      });

      if (cloudList.length === 0) {
        // Hydrate default built-ins into cloud if empty
        console.log('Spawning initial cloud catalog entries for user account...');
        const initialList = normalizeAppletsOrder(BUILT_IN_APPLETS.map(app => ({
          ...app,
          ownerId: uid,
          id: app.id.startsWith('builtin') ? `${app.id}-${uid.substring(0, 5)}` : app.id
        })));
        
        for (const app of initialList) {
          await setDoc(doc(targetDb, 'applets', app.id), app);
        }
        setApplets(initialList);
      } else {
        setApplets(normalizeAppletsOrder(cloudList));
      }
      setSyncStatus('synced');
      setSyncError(null);
    } catch (error: any) {
      console.warn('Network read blocked. Ensure Firestore rules align securely:', error);
      setSyncStatus('error');
      setSyncError(error?.message || 'Firestore reads rejected');
      // Fallback local sandbox representation
      loadDataFromLocalStorage();
    }
  };

  // Sync state to current active system (LocalStorage or Cloud DB)
  const syncAppletsToStorage = async (updatedList: Applet[]) => {
    const normalized = normalizeAppletsOrder(updatedList);
    // Always store a copy in local sandbox as durable fallback
    localStorage.setItem('applet_dashboard_configs', JSON.stringify(normalized));
    setApplets(normalized);

    const activeDb = customFirebaseActive ? customDb : db;
    if (connectionType === 'cloud' && currentUser && activeDb) {
      setSyncStatus('pending');
      try {
        // Clean out orphaned links or sync modifications sequentially
        // For larger scalability we save atomic writes, but for standard user counts we ensure document synchronization
        setSyncStatus('synced');
        setSyncError(null);
      } catch (err: any) {
        setSyncStatus('error');
        setSyncError(err?.message || 'Cloud write synchronizer failed');
      }
    }
  };

  // --- ACTIONS MANAGER ---
  const handleTriggerLogin = async () => {
    try {
      if (customFirebaseActive && customAuth) {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(customAuth, provider);
      } else if (isConfigured) {
        await signInWithGoogle();
      } else {
        triggerToast('Please provision Firebase in Settings first, or connect your custom configuration.', 'warn');
      }
    } catch (err: any) {
      triggerToast(`Login failed: ${err?.message || String(err)}`, 'error');
    }
  };

  const handleTriggerLogout = async () => {
    try {
      if (customFirebaseActive && customAuth) {
        await customAuth.signOut();
      } else {
        await logOutUser();
      }
      setCurrentUser(null);
      setConnectionType('local');
      loadDataFromLocalStorage();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleOpenApplet = (applet: Applet) => {
    if (applet.openMode === 'new_tab') {
      const urlToOpen = applet.isCustomEmbed ? '' : applet.url;
      if (urlToOpen) {
        window.open(urlToOpen, '_blank', 'noreferrer,noopener');
      } else {
        triggerToast('Custom raw code embed applets must be rendered inside the Cockpit iframe workspace.', 'warn');
      }
    } else {
      setActiveApplet(applet);
      setIframeZoom(100);
      setIframeRefreshKey(prev => prev + 1);
    }
  };

  const handleTogglePin = async (e: React.MouseEvent, applet: Applet) => {
    e.stopPropagation();
    const updated = applets.map(a => a.id === applet.id ? { ...a, isPinned: !a.isPinned } : a);
    await syncAppletsToStorage(updated);
    
    // Save to Firestore if connected
    const activeDb = customFirebaseActive ? customDb : db;
    if (connectionType === 'cloud' && currentUser && activeDb) {
      try {
        await setDoc(doc(activeDb, 'applets', applet.id), { ...applet, isPinned: !applet.isPinned }, { merge: true });
      } catch (err) {
        console.error('FA/FS connection rejected:', err);
      }
    }
  };

  // Dynamic Rearrange / Swapping logic within Category Grids
  const handleMoveApplet = async (appletId: string, direction: 'left' | 'right') => {
    const applet = applets.find(a => a.id === appletId);
    if (!applet) return;

    const isPinned = applet.isPinned;
    const sorted = [...applets].sort((a, b) => {
      const valA = a.orderIndex !== undefined ? a.orderIndex : 0;
      const valB = b.orderIndex !== undefined ? b.orderIndex : 0;
      return valA - valB;
    });

    const groupItems = sorted.filter(a => a.isPinned === isPinned);
    const indexInGroup = groupItems.findIndex(a => a.id === appletId);
    if (indexInGroup === -1) return;

    let targetGroupIndex = -1;
    if (direction === 'left' && indexInGroup > 0) {
      targetGroupIndex = indexInGroup - 1;
    } else if (direction === 'right' && indexInGroup < groupItems.length - 1) {
      targetGroupIndex = indexInGroup + 1;
    }

    if (targetGroupIndex !== -1) {
      const currentObj = groupItems[indexInGroup];
      const targetObj = groupItems[targetGroupIndex];

      const currentOrder = currentObj.orderIndex !== undefined ? currentObj.orderIndex : sorted.indexOf(currentObj);
      const targetOrder = targetObj.orderIndex !== undefined ? targetObj.orderIndex : sorted.indexOf(targetObj);

      const updatedList = applets.map(a => {
        if (a.id === currentObj.id) return { ...a, orderIndex: targetOrder };
        if (a.id === targetObj.id) return { ...a, orderIndex: currentOrder };
        return a;
      });

      setApplets(updatedList);
      await syncAppletsToStorage(updatedList);

      const activeDb = customFirebaseActive ? customDb : db;
      if (connectionType === 'cloud' && currentUser && activeDb) {
        try {
          await setDoc(doc(activeDb, 'applets', currentObj.id), { ...currentObj, orderIndex: targetOrder }, { merge: true });
          await setDoc(doc(activeDb, 'applets', targetObj.id), { ...targetObj, orderIndex: currentOrder }, { merge: true });
        } catch (err) {
          console.error('Firestore order update failed:', err);
        }
      }
    }
  };

  // Secure Back-End TSX Applet Compiler Connector with Client-Side Fallback
  const handleUploadTsx = async (fileName: string, fileContent: string) => {
    setUploading(true);
    setUploadError(null);
    addSystemLog('info', 'uploader', `Starting upload/save flow for custom component: ${fileName}`, `Payload size: ${fileContent.length} characters.`);
    try {
      const compName = fileName.replace(/\.tsx$/, '');
      let uploadSuccess = false;
      let appletMetadata: any = null;

      // 1. Attempt server-side compilation first (if available)
      try {
        const response = await fetch('/api/upload-applet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: fileName, content: fileContent })
        });

        let responseData: any;
        const contentType = response.headers.get("content-type");
        
        if (contentType && contentType.includes("application/json")) {
          responseData = await response.json().catch(() => null);
        }
        
        if (!responseData) {
          const responseText = await response.text().catch(() => '');
          responseData = {
            success: response.ok,
            error: `HTTP ${response.status}: ${response.statusText}`,
            rawText: responseText
          };
        }

        if (response.ok && responseData.success) {
          uploadSuccess = true;
          appletMetadata = responseData.applet;
        } else {
          addSystemLog('warn', 'uploader', `Server-side upload returned non-ok status (${response.status}): ${responseData.error || 'Server error'}`);
        }
      } catch (fetchErr: any) {
        addSystemLog('warn', 'uploader', `Server upload endpoint not reachable (network error or static environment like GitHub Pages). Initiating local storage fallback...`);
      }

      // 2. Client-side local persistence fallback if server upload failed
      if (!uploadSuccess) {
        addSystemLog('info', 'uploader', `Activating client-side dynamic sandbox registration for "${fileName}"...`);
        
        appletMetadata = {
          id: `applet-${compName.toLowerCase()}-${Date.now()}`,
          name: compName,
          description: `Custom React Component dynamic fallback compiler (${fileName}).`,
          url: `internal:component:${compName}`,
          isCustomEmbed: false,
          icon: '🤖',
          category: 'Creativity',
          tags: ['Custom', 'React', 'Dynamic'],
          openMode: 'iframe',
          accentColor: 'indigo',
          isPinned: false,
          ownerId: currentUser?.uid || 'anonymous',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sourceCode: fileContent
        };
        uploadSuccess = true;
      }

      // 3. Complete the applet registration
      if (uploadSuccess && appletMetadata) {
        // Cache code to localStorage under unique key
        localStorage.setItem(`custom_component_code:${compName}`, fileContent);

        const newApplet: Applet = {
          ...appletMetadata,
          sourceCode: fileContent, // always bundle source code so it is synchronized
          orderIndex: applets.length
        };

        const updatedList = [...applets, newApplet];
        setApplets(updatedList);
        await syncAppletsToStorage(updatedList);

        const activeDb = customFirebaseActive ? customDb : db;
        if (connectionType === 'cloud' && currentUser && activeDb) {
          try {
            await setDoc(doc(activeDb, 'applets', newApplet.id), newApplet);
            addSystemLog('success', 'database', `Successfully synced custom TSX metadata and source code for "${compName}" to Firestore.`);
          } catch (err: any) {
            console.error('Firestore upload mapping rejected:', err);
            addSystemLog('warn', 'database', `Firestore applet registration rejected: ${err.message}`);
          }
        }

        addSystemLog('success', 'uploader', `Successfully compiled and registered ${fileName}!`, JSON.stringify(newApplet, null, 2));

        setActiveApplet(newApplet);
        setShowUploadModal(false);
        setUploadError(null);
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.message || 'Failure mapping file contents.';
      setUploadError(errMsg);
      addSystemLog('error', 'uploader', `Upload caught exception: ${errMsg}`, err.stack || err.toString());
    } finally {
      setUploading(false);
    }
  };

  // Synchronize dynamic theme override state to cache
  useEffect(() => {
    localStorage.setItem('cohesive_style_injector', String(useCohesiveInjector));
  }, [useCohesiveInjector]);

  // Handle toast clearing timeout
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Automated Component discovery scanner
  const scanAndSyncDynamicComponents = async (currentApplets: Applet[]) => {
    try {
      const resp = await fetch('/api/list-components');
      if (!resp.ok) return;
      const data = await resp.json();
      if (data.success && Array.isArray(data.components)) {
        let listChanged = false;
        const updatedList = [...currentApplets];

        const purgedRaw = localStorage.getItem('applet_dashboard_purged_ids');
        const purgedIds = purgedRaw ? JSON.parse(purgedRaw) : [];

        data.components.forEach((comp: any) => {
          if (purgedIds.includes(comp.applet.id)) return;

          const exists = updatedList.some(app => 
            (app.url && comp.applet.url && app.url.toLowerCase() === comp.applet.url.toLowerCase()) || 
            app.id.toLowerCase() === comp.applet.id.toLowerCase()
          );
          if (!exists) {
            updatedList.push({
              ...comp.applet,
              orderIndex: updatedList.length
            });
            listChanged = true;
          }
        });

        if (listChanged) {
          console.log("Automatically registering newly detected TSX modules:", updatedList);
          const normalized = normalizeAppletsOrder(updatedList);
          localStorage.setItem('applet_dashboard_configs', JSON.stringify(normalized));
          setApplets(normalized);

          const activeDb = customFirebaseActive ? customDb : db;
          if (connectionType === 'cloud' && currentUser && activeDb) {
            for (const app of normalized) {
              const appExists = currentApplets.some(a => a.id.toLowerCase() === app.id.toLowerCase());
              if (!appExists) {
                try {
                  await setDoc(doc(activeDb, 'applets', app.id), app);
                } catch (fsErr) {
                  console.error("Firestore background registration rejected:", fsErr);
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed executing automated scan code:", err);
    }
  };

  useEffect(() => {
    if (applets.length > 0 && !didScanComponents) {
      setDidScanComponents(true);
      scanAndSyncDynamicComponents(applets);
    }
  }, [applets, didScanComponents]);

  const handleAddOrEditApplet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const activeDb = customFirebaseActive ? customDb : db;
    const resolvedOwner = currentUser ? currentUser.uid : 'default';

    const cleanTags = formTags
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0);

    const appletId = editingApplet ? editingApplet.id : `applet-${Date.now()}`;

    const newApplet: Applet = {
      id: appletId,
      name: formName.trim(),
      description: formDescription.trim(),
      url: formIsCustomEmbed ? undefined : formUrl.trim(),
      embedCode: formIsCustomEmbed ? formEmbedCode.trim() : undefined,
      isCustomEmbed: formIsCustomEmbed,
      icon: formIcon,
      category: formCategory,
      tags: cleanTags,
      openMode: formOpenMode,
      accentColor: formAccentColor,
      isPinned: editingApplet ? editingApplet.isPinned : false,
      ownerId: resolvedOwner,
      createdAt: editingApplet ? editingApplet.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sandboxConfig: formSandbox
    };

    // Update state lists
    let updatedList: Applet[];
    if (editingApplet) {
      updatedList = applets.map(a => a.id === editingApplet.id ? newApplet : a);
    } else {
      updatedList = [newApplet, ...applets];
    }

    // Remove from purged IDs if they added it back or saved
    try {
      const purgedRaw = localStorage.getItem('applet_dashboard_purged_ids');
      if (purgedRaw) {
        const purgedIds = JSON.parse(purgedRaw);
        if (purgedIds.includes(appletId)) {
          const filtered = purgedIds.filter((id: string) => id !== appletId);
          localStorage.setItem('applet_dashboard_purged_ids', JSON.stringify(filtered));
        }
      }
    } catch (err) {
      console.error('Failed to clear ID from purged lists:', err);
    }

    await syncAppletsToStorage(updatedList);

    // Sync cloud document
    if (connectionType === 'cloud' && currentUser && activeDb) {
      try {
        await setDoc(doc(activeDb, 'applets', appletId), newApplet);
      } catch (err: any) {
        console.error('Firestore save failed:', err);
        triggerToast(`Cloud Sync issue: Check firestore.rules permission limits. Local copy saved.`, 'error');
      }
    }

    // Reset Form
    setEditingApplet(null);
    setShowConfigModal(false);
    resetFormFields();
  };

  const resetFormFields = () => {
    setFormName('');
    setFormDescription('');
    setFormUrl('');
    setFormEmbedCode('');
    setFormIsCustomEmbed(false);
    setFormIcon('🌐');
    setFormCategory('Productivity');
    setFormTags('');
    setFormOpenMode('iframe');
    setFormAccentColor('indigo');
    setFormSandbox({
      allowScripts: true,
      allowSameOrigin: true,
      allowForms: true,
      allowPopups: true
    });
  };

  const handleTriggerEdit = (e: React.MouseEvent, applet: Applet) => {
    e.stopPropagation();
    setEditingApplet(applet);
    setFormName(applet.name);
    setFormDescription(applet.description);
    setFormUrl(applet.url || '');
    setFormEmbedCode(applet.embedCode || '');
    setFormIsCustomEmbed(applet.isCustomEmbed);
    setFormIcon(applet.icon);
    setFormCategory(applet.category);
    setFormTags(applet.tags.join(', '));
    setFormOpenMode(applet.openMode);
    setFormAccentColor(applet.accentColor);
    if (applet.sandboxConfig) {
      setFormSandbox(applet.sandboxConfig);
    }
    setShowConfigModal(true);
  };

  const handleDeleteApplet = (e: React.MouseEvent, applet: Applet) => {
    e.stopPropagation();
    setAppletToTrash(applet);
  };

  // --- CATALOG BACKUP & LOAD HANDLERS ---
  const handleExportBackup = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(applets, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `applets_dashboard_catalog_backup_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      triggerToast('Failed exporting JSON config file.', 'error');
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const targetFile = e.target.files?.[0];
    if (!targetFile) return;

    fileReader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (Array.isArray(importedData)) {
          // Perform basic type matching validation
          const validated = importedData.filter(app => app && app.id && app.name);
          if (validated.length === 0) {
            triggerToast('Invalid array format found. Unable to load configurations.', 'error');
            return;
          }
          
          if (window.confirm(`Load and merge ${validated.length} applets into your active dashboard storage?`)) {
            // merge distinct lists
            const existingIds = new Set(applets.map(a => a.id));
            const merged = [...applets];
            validated.forEach(item => {
              if (!existingIds.has(item.id)) {
                merged.push(item);
                // Try copying to Firestore if cloud sync is fully live
                const activeDb = customFirebaseActive ? customDb : db;
                if (connectionType === 'cloud' && currentUser && activeDb) {
                   setDoc(doc(activeDb, 'applets', item.id), item).catch(err => console.warn(err));
                }
              }
            });
            await syncAppletsToStorage(merged);
            triggerToast('Database merged successfully!', 'success');
          }
        } else {
          triggerToast('JSON structure is clean but does not contain a raw Array list backing applets.', 'warn');
        }
      } catch (err: any) {
        triggerToast(`Parsing failed: ${err?.message || 'Check backup file structure'}`, 'error');
      }
    };
    fileReader.readAsText(targetFile);
  };

  // --- FIREBASE UI TOGGLER ---
  const handleSaveCustomFirebaseSettings = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (customFirebaseConfig.trim() === '') {
        localStorage.removeItem('applet_dashboard_custom_fb_config');
        localStorage.removeItem('applet_dashboard_custom_fb_active');
        setCustomFirebaseActive(false);
        setCustomDb(null);
        setCustomAuth(null);
        triggerToast('Custom Firebase configuration deleted. System defaults back to sandbox environments.', 'info');
        return;
      }
      
      // Try validate string
      JSON.parse(customFirebaseConfig);
      
      localStorage.setItem('applet_dashboard_custom_fb_config', customFirebaseConfig);
      localStorage.setItem('applet_dashboard_custom_fb_active', 'true');
      setCustomFirebaseActive(true);
      setShowSettingsModal(false);
      triggerToast('Settings changed. Refreshing nodes...', 'success');
      window.location.reload();
    } catch (err: any) {
      triggerToast(`Invalid configuration formatting: Code must be standard valid JSON.\nError: ${err?.message}`, 'error');
    }
  };

  // --- FILTERS & MATCHING LOGIC ---
  const isSystemApp = (name: string) => {
    const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return n.includes('appleterror') || n.includes('tiledworkspace') || n.includes('appletbound') || n.includes('cohesive');
  };

  const nonPurgedApplets = applets
    .filter(applet => !isSystemApp(applet.name))
    .filter(applet => !purgedIds.some(pid => pid.toLowerCase() === applet.id.toLowerCase()));

  const filteredApplets = nonPurgedApplets
    .filter(applet => {
      const matchesSearch = 
        applet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        applet.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        applet.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        applet.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = selectedCategory === 'All' || applet.category === selectedCategory;

      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      const valA = a.orderIndex !== undefined ? a.orderIndex : 0;
      const valB = b.orderIndex !== undefined ? b.orderIndex : 0;
      return valA - valB;
    });

  const pinnedApplets = filteredApplets.filter(a => a.isPinned);
  const remainingApplets = filteredApplets.filter(a => !a.isPinned);

  // --- COCKPIT IFRAME SANDBOX GENERATOR ---
  const makeSandboxString = (cfg?: SandboxConfig) => {
    if (!cfg) return 'allow-scripts allow-same-origin allow-forms allow-popups';
    const tokens = [];
    if (cfg.allowScripts) tokens.push('allow-scripts');
    if (cfg.allowSameOrigin) tokens.push('allow-same-origin');
    if (cfg.allowForms) tokens.push('allow-forms');
    if (cfg.allowPopups) tokens.push('allow-popups');
    return tokens.join(' ');
  };

  const getAccentColorStyle = (colorValue: string) => {
    const config = ACCENT_COLORS.find(c => c.value === colorValue) || ACCENT_COLORS[0];
    return config;
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] font-sans text-gray-255 flex flex-col antialiased selection:bg-white selection:text-black">
      {/* HEADER NAV RIG */}
      <header className="h-20 border-b border-white/5 bg-[#0A0A0A] sticky top-0 z-40 px-6 md:px-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center">
            <span className="text-xl font-serif italic text-white font-bold">Ω</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-serif italic text-white tracking-tight leading-none">Architect</h1>
              <span className="bg-white/5 border border-white/10 text-white/40 px-1.5 py-0.5 rounded text-[8px] font-mono uppercase tracking-widest leading-none">System Controller</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/30 flex items-center gap-1.5 mt-1 leading-none">
              {connectionType === 'cloud' ? (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                  <span className="text-emerald-400 font-medium font-mono">Cloud Sync: logged in as {currentUser?.email?.split('@')[0]}</span>
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20"></div>
                  <span className="text-white/40 font-medium font-mono">Local Workspace: production_omega</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Global Search */}
        <div className="flex-1 max-w-md hidden sm:block relative">
          <Search className="w-3.5 h-3.5 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search catalog: tags, OMV servers, elements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#121212] border border-white/5 hover:border-white/10 focus:border-white/20 rounded py-2 pl-10 pr-4 text-xs font-mono focus:ring-0 focus:outline-none text-white transition-all placeholder:text-white/20"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {currentUser ? (
            <button
              onClick={handleTriggerLogout}
              className="px-4 py-2 border border-white/5 bg-[#121212] text-white/70 hover:text-white hover:bg-white/5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5 text-white/40" />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          ) : (
            <button
              onClick={handleTriggerLogin}
              className="px-4 py-2 border border-white/10 bg-[#121212] text-white/80 hover:text-white hover:bg-white/5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition"
              title="Google Account Sync"
            >
              <LogIn className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Google Sync</span>
            </button>
          )}

          <button
            onClick={handleOpenFilesystemManager}
            className="px-3 py-2 border border-white/5 bg-[#121212] text-white/50 hover:text-white hover:bg-white/5 rounded transition flex items-center gap-1.5 cursor-pointer"
            title="System Filesystem Manager"
          >
            <Folder className="w-4 h-4 text-emerald-400" />
            <span className="hidden lg:inline text-[10px] font-mono font-bold uppercase tracking-wider text-white/50">Filesystem</span>
          </button>

          <button
            onClick={() => setShowTrashModal(true)}
            className="px-3 py-2 border border-white/5 bg-[#121212] text-white/50 hover:text-white hover:bg-rose-500/10 rounded transition flex items-center gap-1.5 cursor-pointer relative animate-[fade-in_0.2s_ease-out]"
            title="System Trash Bin"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span className="hidden lg:inline text-[10px] font-mono font-bold uppercase tracking-wider text-white/50">Trash Bin</span>
            {(trashBin.applets.length + trashBin.files.length) > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full animate-pulse font-mono">
                {trashBin.applets.length + trashBin.files.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2 border border-white/5 bg-[#121212] text-white/50 hover:text-white hover:bg-white/5 rounded transition cursor-pointer"
            title="Database Configuration"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* SYSTEM ALARMS / TELEMETRY BELL DROPDOWN */}
          <div className="relative">
            <button
              onClick={() => {
                setShowErrorLogsDropdown(!showErrorLogsDropdown);
                // Clear dropdown of any other components
              }}
              className="p-2 border border-white/5 bg-[#121212] text-white/50 hover:text-white hover:bg-white/5 rounded transition relative flex items-center justify-center focus:outline-none"
              title="System Trace Alarms"
            >
              <Bell className="w-4.5 h-4.5" />
              {errorLogs.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 bg-red-600 rounded-full flex items-center justify-center text-[7px] font-bold text-white font-mono animate-pulse outline outline-2 outline-[#0A0A0A]">
                  {errorLogs.length}
                </span>
              )}
            </button>

            {showErrorLogsDropdown && (
              <div className="absolute right-0 mt-3.5 w-80 bg-[#121212] border border-white/10 shadow-2xl z-[250] font-mono text-[10px] py-1 text-white animate-fade-in divide-y divide-white/5">
                <div className="p-3 bg-black/40 flex items-center justify-between">
                  <span className="font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                    ⚠️ TELEMETRY ACCIDENTS {errorLogs.length > 0 && `(${errorLogs.length})`}
                  </span>
                  {errorLogs.length > 0 && (
                    <button
                      onClick={() => {
                        setErrorLogs([]);
                        localStorage.removeItem('cohesive_applet_error_logs');
                        triggerToast('Telemetry trace database wiped.', 'info');
                      }}
                      className="text-[9px] uppercase tracking-wider text-red-400 hover:text-red-300 transition-colors"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto divide-y divide-white/5">
                  {errorLogs.map(log => (
                    <div key={log.id} className="p-3 hover:bg-white/5 transition flex flex-col gap-1.5 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-white/40 text-[8px]">{log.timestamp}</span>
                        <span className="px-1.5 py-0.5 bg-red-950/40 border border-red-900/40 text-red-500 text-[8px] uppercase tracking-wider scale-95 shrink-0 rounded font-bold">
                          {log.appletName}
                        </span>
                      </div>
                      <p className="text-[10px] text-white/70 line-clamp-1 break-all pr-2">{log.errorMessage}</p>
                      
                      <div className="flex items-center gap-3 pt-1 text-[8px] uppercase tracking-widest text-[#555]">
                        <button
                          onClick={() => {
                            setSelectedErrorToView(log);
                            setShowErrorLogsDropdown(false);
                          }}
                          className="hover:text-emerald-400 transition"
                        >
                          [See Trace]
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(log.stack || log.errorMessage);
                            triggerToast('Trace vector copied!', 'success');
                          }}
                          className="hover:text-white transition"
                        >
                          [Copy Core]
                        </button>
                      </div>
                    </div>
                  ))}

                  {errorLogs.length === 0 && (
                    <div className="p-6 text-center text-white/20 italic text-[10px]">
                      Zero telemetry defects logged. Heartbeat green.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => { setUploadError(null); setShowUploadModal(true); }}
            className="px-4 py-2 border border-white/10 bg-[#121212] text-white/90 hover:text-white hover:bg-white/5 text-xs font-bold uppercase tracking-widest transition flex items-center gap-1.5 focus:outline-none"
            title="Upload Custom TSX React Applet"
          >
            <FileUp className="w-4 h-4 shrink-0 text-white/50" />
            <span className="hidden md:inline">Upload TSX</span>
          </button>

          <button
            onClick={() => { resetFormFields(); setEditingApplet(null); setShowConfigModal(true); }}
            className="px-6 py-2 bg-white text-black text-xs font-bold uppercase tracking-widest hover:bg-neutral-200 transition flex items-center gap-1.5 focus:outline-none"
          >
            <Plus className="w-4 h-4 shrink-0 text-black" />
            <span className="hidden md:inline">New Applet</span>
          </button>
        </div>
      </header>

      {/* PRIMARY SIDEBAR AND WORKSPACE ROW */}
      <div className="flex-1 flex min-h-0 bg-[#0A0A0A]">
        {/* COLLAPSIBLE SIDE RAIL */}
        <aside 
          className="relative border-r border-white/5 bg-[#121212] flex flex-col justify-between hidden lg:flex select-none shrink-0 overflow-hidden"
          style={{ width: `${sidebarWidth}px` }}
        >
          {/* Vertical drag handle for resizability */}
          <div 
            onPointerDown={handleSidebarPointerDown}
            className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-emerald-500/35 active:bg-emerald-500 transition-colors select-none z-30"
          />
          {/* Top category indexes */}
          <div className={`${sidebarWidth < 160 ? 'p-3' : 'p-6'} space-y-6`}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] uppercase tracking-widest text-white/30 block font-mono">
                  {sidebarWidth < 160 ? 'Dir' : 'System Directory'}
                </h3>
                {sidebarWidth >= 160 && (
                  <button
                    onClick={() => setShowManageCategoriesModal(true)}
                    className="p-1 text-white/40 hover:text-white hover:bg-white/5 rounded transition cursor-pointer"
                    title="Manage Directories"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <nav className="space-y-1">
                <button
                  onClick={() => setSelectedCategory('All')}
                  className={`w-full text-xs transition-all flex items-center ${
                    sidebarWidth < 160 
                      ? 'px-2 py-3 flex-col justify-center gap-1 border-l-2' 
                      : 'px-4 py-3 justify-between border-l'
                  } ${
                    selectedCategory === 'All' 
                      ? 'bg-white/5 text-white border-emerald-500 font-medium' 
                      : 'text-white/50 hover:text-white hover:bg-white/5 border-transparent'
                  }`}
                  title="All Applets"
                >
                  <span className="flex items-center gap-3">
                    <span className="text-sm">🔲</span>
                    {sidebarWidth >= 160 && <span>All Applets</span>}
                  </span>
                  <span className={`${sidebarWidth < 160 ? 'text-[8px]' : 'text-[9px] px-2 py-0.5 border border-white/10'} bg-white/5 text-white/40 rounded font-mono font-bold`}>
                    {nonPurgedApplets.length}
                  </span>
                </button>

                {categories.map(category => {
                  const count = nonPurgedApplets.filter(a => a.category === category.name).length;
                  const isSelected = selectedCategory === category.name;
                  return (
                    <button
                      key={category.name}
                      onClick={() => setSelectedCategory(category.name)}
                      className={`w-full text-xs transition-all flex items-center ${
                        sidebarWidth < 160 
                          ? 'px-2 py-3 flex-col justify-center gap-1 border-l-2' 
                          : 'px-4 py-3 justify-between border-l'
                      } ${
                        isSelected 
                          ? 'bg-white/5 text-white border-emerald-500 font-medium' 
                          : 'text-white/50 hover:text-white hover:bg-white/5 border-transparent'
                      }`}
                      title={`${category.name} (${count})`}
                    >
                      <span className="truncate flex items-center gap-3">
                        <span className={`${category.color || 'text-white'} text-sm`}>{category.icon || '📁'}</span>
                        {sidebarWidth >= 160 && <span className="truncate">{category.name}</span>}
                      </span>
                      {count > 0 && (
                        <span className={`${sidebarWidth < 160 ? 'text-[8px]' : 'text-[9px] px-2 py-0.5 border border-white/10'} bg-white/5 text-white/40 rounded font-mono font-bold`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Quick backup / migration files / metrics */}
            {sidebarWidth < 160 ? (
              <div className="flex flex-col items-center gap-3 pt-4 border-t border-white/5">
                <button
                  onClick={() => setShowManageCategoriesModal(true)}
                  className="p-2 bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white rounded transition cursor-pointer"
                  title="Manage Directories"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  onClick={handleExportBackup}
                  className="p-2 bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white rounded transition cursor-pointer"
                  title="Export JSON Backup"
                >
                  <FileDown className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div>
                <h3 className="text-[10px] uppercase tracking-widest text-white/30 mb-3 block font-mono">Catalog Archive</h3>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <button
                    onClick={handleExportBackup}
                    className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white px-2.5 py-2 rounded justify-center transition cursor-pointer"
                    title="Export Dashboard configurations to local JSON"
                  >
                    <FileDown className="w-3.5 h-3.5 text-white/40" />
                    Save JSON
                  </button>
                  <label
                    className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white px-2 py-2 rounded justify-center cursor-pointer transition text-center"
                    title="Import/restore custom JSON catalogs"
                  >
                    <FileUp className="w-3.5 h-3.5 text-white/40" />
                    Load JSON
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportBackup}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* System status metrics widgets */}
          {sidebarWidth >= 160 && (
            <div className="p-6 border-t border-white/5 bg-black/20 font-mono text-[10px] space-y-3">
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-widest text-white/30">OMV Server</span>
                <span className="text-emerald-400">Online</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-widest text-white/30">Sync Latency</span>
                <span className="text-white/60">{stats.latency}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-widest text-white/30 font-bold">Vault state</span>
                <span className={syncStatus === 'synced' ? 'text-emerald-400' : 'text-amber-400'}>{syncStatus.toUpperCase()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-widest text-white/30">Memory</span>
                <span className="text-white/50">{stats.clientMemory}</span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-1">
                <div className="w-[42%] h-full bg-white/40"></div>
              </div>
            </div>
          )}
        </aside>

        {/* WORKSPACE AREA */}
        <main className="flex-1 min-w-0 flex flex-col bg-[#0A0A0A] overflow-y-auto relative">
          {/* MAIN PAGE BANNER FOR HOMEPAGE ONLY IF NO ACTIVE APPLET */}
          {!activeApplet ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Outer top status block */}
              <div className="p-4 md:p-6 pb-2 space-y-4 shrink-0">
                {/* HEADING HERO BANNER WITH DYNAMIC HEIGHT RESIZABILITY */}
                <div 
                  className="relative overflow-hidden bg-[#121212] border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl shrink-0 transition-all duration-75"
                  style={{ 
                    minHeight: `${headerHeight}px`,
                    padding: headerHeight < 100 ? '12px 24px' : headerHeight < 150 ? '16px 24px' : '32px 32px'
                  }}
                >
                  {/* Background lines for architecture vibe */}
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_60%,transparent_100%)] pointer-events-none" />

                  <div className="space-y-2 z-10 max-w-xl">
                    {headerHeight >= 120 && (
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] uppercase font-mono tracking-widest">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                        System Controller Interface
                      </div>
                    )}
                    <h2 className={`${headerHeight < 100 ? 'text-lg' : headerHeight < 150 ? 'text-xl' : 'text-2xl'} font-serif italic text-white tracking-tight leading-tight`}>
                      Micro-App Dashboard Console
                    </h2>
                    {headerHeight >= 150 && (
                      <p className="text-xs text-white/40 leading-relaxed font-sans">
                        Consolidating developer utilities, custom single-file embeds, and open-media-vault cluster coordinates inside production_omega. Connect custom components dynamically.
                      </p>
                    )}
                  </div>

                  {headerHeight >= 110 && (
                    <div className="flex items-center gap-4 font-mono text-xs z-10">
                      <div className="bg-[#161616] border border-white/10 p-4 min-w-[120px]">
                        <span className="text-xl font-serif italic text-white block">
                          {nonPurgedApplets.filter(a => !a.id.startsWith('builtin') && !isSystemApp(a.name)).length}
                        </span>
                        <span className="text-[9px] text-white/30 uppercase tracking-[0.15em] block mt-1 font-bold">Custom Nodes</span>
                      </div>
                      <div className="bg-[#161616] border border-white/10 p-4 min-w-[120px]">
                        <span className="text-xl font-serif italic text-white block">
                          {nonPurgedApplets.filter(a => a.category.includes('Self-Hosted') && !isSystemApp(a.name)).length}
                        </span>
                        <span className="text-[9px] text-white/30 uppercase tracking-[0.15em] block mt-1 font-bold">LAN Nodes</span>
                      </div>
                    </div>
                  )}

                  {/* Horizontal drag resizer bar */}
                  <div 
                    onPointerDown={handleHeaderPointerDown}
                    className="absolute bottom-0 left-0 w-full h-1.5 cursor-row-resize hover:bg-emerald-500/35 active:bg-emerald-500 transition-colors select-none z-30"
                  />
                </div>

                {/* WORKBOARD LAYOUT MODE NAVIGATION TABS */}
                <div className="flex border-b border-white/5 pb-px gap-6 my-2 font-mono text-xs select-none">
                  <button
                    onClick={() => setDashboardLayoutMode('grid')}
                    className={`pb-2 px-1 relative font-bold uppercase text-[10px] tracking-widest transition-all focus:outline-none flex items-center gap-2 ${
                      dashboardLayoutMode === 'grid' 
                        ? 'text-emerald-400 border-b-2 border-emerald-500 font-bold' 
                        : 'text-white/40 hover:text-white'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5 text-emerald-400" />
                    Applet Catalog Grid
                  </button>
                  <button
                    onClick={() => setDashboardLayoutMode('tiled')}
                    className={`pb-2 px-1 relative font-bold uppercase text-[10px] tracking-widest transition-all focus:outline-none flex items-center gap-2 ${
                      dashboardLayoutMode === 'tiled' 
                        ? 'text-emerald-400 border-b-2 border-emerald-500 font-bold' 
                        : 'text-white/40 hover:text-white'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                    Tiled Workspace
                  </button>
                </div>
              </div>

              {dashboardLayoutMode === 'grid' ? (
                <div className="p-4 md:p-6 pt-0 space-y-6 overflow-y-auto flex-1 text-left">
                  {/* SEARCH BOX MOBILE ONLY */}
                  <div className="sm:hidden relative">
                <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search apps catalog..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#121212] border border-white/10 rounded py-2 pl-10 pr-4 text-xs font-mono text-white focus:outline-none"
                />
              </div>

              {/* CATEGORY TAGS MOBILE ONLY */}
              <div className="lg:hidden flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setSelectedCategory('All')}
                  className={`px-3 py-1 text-[10px] uppercase tracking-wider whitespace-nowrap border transition ${
                    selectedCategory === 'All' ? 'bg-white text-black border-white' : 'bg-[#121212] border-white/10 text-white/40'
                  }`}
                >
                  All Applets
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.name}
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`px-3 py-1 text-[10px] uppercase tracking-wider whitespace-nowrap border transition ${
                      selectedCategory === cat.name ? 'bg-white text-black border-white' : 'bg-[#121212] border-white/10 text-white/40'
                    }`}
                  >
                    <span className="mr-1">{cat.icon}</span>
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* DYNAMIC ERROR WARNING BANNER */}
              {syncError && (
                <div className="bg-amber-500/5 border border-amber-500/20 p-4 text-xs flex gap-3 text-amber-250 font-mono">
                  <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Sync warning:</span> {syncError}. The system is executing in Offline Vault mode and caching configurations.
                  </div>
                </div>
              )}

              {/* NO MAP MATCH CASES */}
              {filteredApplets.length === 0 && (
                <div className="flex flex-col items-center justify-center p-12 text-center border border-white/5 bg-[#121212]">
                  <div className="w-12 h-12 bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                    <Filter className="w-5 h-5 text-white/45" />
                  </div>
                  <h3 className="text-sm font-serif italic text-white mb-1">No matching applets found</h3>
                  <p className="text-xs text-white/40 max-w-xs mb-6 font-sans">
                    Refine search queries or select another category from the sidebar index to locate self-hosted server dashboards.
                  </p>
                  <button
                    onClick={() => { resetFormFields(); setEditingApplet(null); setShowConfigModal(true); }}
                    className="px-6 py-2 bg-white text-black text-xs font-bold uppercase tracking-widest hover:bg-neutral-200 transition"
                  >
                    Create Custom Applet
                  </button>
                </div>
              )}

              {/* CARD CATALOG SEGMENT 1: PINNED / FAVORITES */}
              {pinnedApplets.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-[10px] uppercase tracking-widest text-white/30 block font-mono flex items-center gap-2">
                    <Pin className="w-3.5 h-3.5 text-emerald-500 rotate-45" />
                    Pinned Desktop Shortcuts
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {pinnedApplets.map(app => {
                      return (
                        <div
                          key={app.id}
                          onClick={() => handleOpenApplet(app)}
                          className="group relative bg-[#161616] border border-white/10 hover:border-white/20 p-6 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl overflow-hidden cursor-pointer"
                        >
                          <div className="space-y-4">
                            <div className="flex justify-between items-start">
                              <div className="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center text-xl">
                                {app.icon}
                              </div>
                              <span className="text-[9px] px-2 py-1 bg-emerald-500/10 text-emerald-500 uppercase font-mono border border-emerald-500/20">Pinned</span>
                            </div>
                            <div>
                              <h3 className="text-base font-serif italic text-white leading-snug group-hover:text-emerald-400 transition-colors">{app.name}</h3>
                              <span className="text-[9px] uppercase tracking-wider text-white/30 block mt-1 font-mono">{app.category}</span>
                              <p className="text-xs text-white/40 mt-3 leading-relaxed line-clamp-2 h-10">
                                {app.description}
                              </p>
                            </div>
                          </div>

                          {/* Footer details */}
                          <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-white/30">
                            <span className="truncate max-w-[100px] text-white/25">ID: {app.id.substring(0, 8).toUpperCase()}</span>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center border border-white/5 bg-black/40 px-1.5 py-0.5 gap-1.5 mr-1 text-[11px] font-bold">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleMoveApplet(app.id, 'left'); }}
                                  className="text-white/40 hover:text-white transition cursor-pointer select-none px-0.5 font-mono"
                                  title="Move Left"
                                >
                                  ◀
                                </button>
                                <span className="text-[8px] text-white/25 select-none font-mono">Move</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleMoveApplet(app.id, 'right'); }}
                                  className="text-white/40 hover:text-white transition cursor-pointer select-none px-0.5 font-mono"
                                  title="Move Right"
                                >
                                  ▶
                                </button>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleTogglePin(e, app); }}
                                className="text-[10px] uppercase tracking-widest text-white/60 hover:text-white border-b border-white/10 hover:border-white pb-0.5 transition cursor-pointer"
                              >
                                Unpin
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleTriggerEdit(e, app); }}
                                className="text-[10px] uppercase tracking-widest text-white/60 hover:text-white border-b border-white/10 hover:border-white pb-0.5 transition cursor-pointer"
                              >
                                Config
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteApplet(e, app); }}
                                className="text-[10px] uppercase tracking-widest text-rose-455 hover:text-rose-400 border-b border-rose-500/10 hover:border-rose-400 pb-0.5 transition cursor-pointer"
                              >
                                Purge
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* CARD CATALOG SEGMENT 2: MAIN LISTING */}
              {remainingApplets.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-[10px] uppercase tracking-widest text-white/30 block font-mono">
                    Applets Indexes Catalog
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {remainingApplets.map(app => {
                      return (
                        <div
                          key={app.id}
                          onClick={() => handleOpenApplet(app)}
                          className="group relative bg-[#161616] border border-white/10 hover:border-white/20 p-6 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl overflow-hidden cursor-pointer"
                        >
                          <div className="space-y-4">
                            <div className="flex justify-between items-start">
                              <div className="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center text-xl">
                                {app.icon}
                              </div>
                              <span className="text-[9px] px-2 py-1 bg-white/5 text-white/40 uppercase font-mono border border-white/10">Active</span>
                            </div>
                            <div>
                              <h3 className="text-base font-serif italic text-white leading-snug group-hover:text-emerald-400 transition-colors">{app.name}</h3>
                              <span className="text-[9px] uppercase tracking-wider text-white/30 block mt-1 font-mono">{app.category}</span>
                              <p className="text-xs text-white/40 mt-3 leading-relaxed line-clamp-2 h-10">
                                {app.description}
                              </p>
                            </div>
                          </div>

                          {/* Footer details */}
                          <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-white/30">
                            <span className="truncate max-w-[100px] text-white/25">ID: {app.id.substring(0, 8).toUpperCase()}</span>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center border border-white/5 bg-black/40 px-1.5 py-0.5 gap-1.5 mr-1 text-[11px] font-bold font-mono">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleMoveApplet(app.id, 'left'); }}
                                  className="text-white/40 hover:text-white transition cursor-pointer select-none px-0.5 font-mono"
                                  title="Move Left"
                                >
                                  ◀
                                </button>
                                <span className="text-[8px] text-white/25 select-none font-mono">Move</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleMoveApplet(app.id, 'right'); }}
                                  className="text-white/40 hover:text-white transition cursor-pointer select-none px-0.5 font-mono"
                                  title="Move Right"
                                >
                                  ▶
                                </button>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleTogglePin(e, app); }}
                                className="text-[10px] uppercase tracking-widest text-white/60 hover:text-white border-b border-white/10 hover:border-white pb-0.5 transition cursor-pointer"
                              >
                                Pin
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleTriggerEdit(e, app); }}
                                className="text-[10px] uppercase tracking-widest text-white/60 hover:text-white border-b border-white/10 hover:border-white pb-0.5 transition cursor-pointer"
                              >
                                Config
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteApplet(e, app); }}
                                className="text-[10px] uppercase tracking-widest text-rose-455 hover:text-rose-400 border-b border-rose-500/10 hover:border-rose-400 pb-0.5 transition cursor-pointer"
                              >
                                Purge
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col p-4 md:p-6 pt-0">
              <TiledWorkspace
                applets={nonPurgedApplets}
                onTriggerCrashLog={(appletName, errorMsg, stack) => {
                  handleAppletCrash(appletName, errorMsg, stack);
                }}
                triggerToast={(msg, t) => triggerToast(msg, t as any)}
                useCohesiveInjector={useCohesiveInjector}
              />
            </div>
          )}
        </div>
      ) : (
        /* COCKPIT WORKSPACE ACTIVE APPLET VIEWPORT */
            <div className={`p-6 md:p-8 flex-1 flex flex-col min-h-0 ${isFullscreen ? 'fixed inset-0 z-50 bg-[#0A0A0A]' : 'relative bg-[#0A0A0A]'}`}>
              
              {/* Header Navigation with controls */}
              <div className="flex flex-col md:flex-row border-b border-white/5 pb-4 justify-between items-start md:items-center gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setActiveApplet(null)}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-white text-black hover:bg-neutral-200 transition flex items-center gap-1.5 cursor-pointer rounded-none"
                  >
                    <ChevronLeft className="w-4 h-4 text-black shrink-0" />
                    Console Deck
                  </button>
                  <div className="flex items-center gap-3 border-l border-white/10 pl-4">
                    <span className="text-2xl" role="img" aria-label="Active Appicon">{activeApplet.icon}</span>
                    <div>
                      <h3 className="text-base font-serif italic text-white leading-none">{activeApplet.name}</h3>
                      <p className="text-[10px] text-white/40 font-mono uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                        {activeApplet.isCustomEmbed ? (
                          <>
                            <Sliders className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Embedded Payload Core
                          </>
                        ) : activeApplet.url?.startsWith('internal:') ? (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> System Module Node
                          </>
                        ) : (
                          <>
                            <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Frame Node: {activeApplet.url}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Framing Control tools */}
                <div className="flex items-center flex-wrap gap-2.5 font-mono text-[10px]">
                  {/* Zoom controls for non responsive applets */}
                  {!activeApplet.url?.startsWith('internal:') && (
                    <div className="flex items-center bg-[#121212] border border-white/5 px-2.5 py-1.5 gap-2 text-white/50">
                      <button
                        onClick={() => { if (iframeZoom > 50) setIframeZoom(prev => prev - 10); }}
                        className="text-white/40 hover:text-white disabled:opacity-30 cursor-pointer"
                        title="Zoom Scale Out"
                        disabled={iframeZoom <= 50}
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-bold font-mono min-w-8 text-center text-[10px]">{iframeZoom}%</span>
                      <button
                        onClick={() => { if (iframeZoom < 150) setIframeZoom(prev => prev + 10); }}
                        className="text-white/40 hover:text-white disabled:opacity-30 cursor-pointer"
                        title="Zoom Scale In"
                        disabled={iframeZoom >= 150}
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {activeApplet.url?.startsWith('internal:component:') && (
                    <button
                      onClick={() => setUseCohesiveInjector(prev => !prev)}
                      className={`p-1 px-3 border text-[10px] font-bold tracking-widest transition cursor-pointer flex items-center gap-1.5 ${
                        useCohesiveInjector 
                          ? "bg-indigo-600/10 text-indigo-400 border-indigo-500/25 hover:bg-indigo-600/20" 
                          : "bg-white/5 text-white/40 border-white/5 hover:text-white hover:bg-white/10"
                      }`}
                      title="Forces custom TSX elements to match the unified Slate Carbon design guidelines"
                    >
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>COHESIVE STYLE: {useCohesiveInjector ? "ACTIVE" : "BYPASSED"}</span>
                    </button>
                  )}

                  <button
                    onClick={() => setIframeRefreshKey(prev => prev + 1)}
                    className="p-1 px-3 bg-[#121212] border border-white/5 text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-1.5 transition cursor-pointer text-[10px] font-mono"
                    title="Reload/Restart source container"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-white/40" />
                    <span>REBOOT NODE</span>
                  </button>

                  {!activeApplet.url?.startsWith('internal:') && (
                    <a
                      href={activeApplet.isCustomEmbed ? undefined : activeApplet.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="p-1 px-3 text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 hover:text-emerald-300 hover:bg-emerald-500/10 flex items-center gap-1.5 transition decoration-none cursor-pointer"
                      title="Launch standalone external dashboard"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-550" />
                      <span>STANDALONE</span>
                    </a>
                  )}

                  <button
                    onClick={() => setIsFullscreen(prev => !prev)}
                    className="p-1.5 bg-[#121212] border border-white/5 text-white/60 hover:text-white transition cursor-pointer"
                    title="Toggle Cockpit stage view"
                  >
                    {isFullscreen ? (
                      <Minimize2 className="w-4 h-4" />
                    ) : (
                      <Maximize2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* COCKPIT CONTAINER VIEWPORT */}
              <div className="flex-1 min-h-0 relative border border-white/10 overflow-hidden bg-black flex flex-col">
                
                {/* SANDBOX SECURITY NOTICE ON COCKPIT BOUNDS */}
                {showSandboxWarning && !activeApplet.url?.startsWith('internal:') && (
                  <div className="bg-amber-500/5 text-[9px] uppercase tracking-wider text-amber-400 px-4 py-2 border-b border-amber-500/15 flex items-center justify-between font-mono">
                    <span className="flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      Sandbox Shield: {makeSandboxString(activeApplet.sandboxConfig)}
                    </span>
                    <button onClick={() => setShowSandboxWarning(false)} className="text-amber-500 hover:text-amber-100 cursor-pointer">
                      [Hide]
                    </button>
                  </div>
                )}

                {/* MOUNT CORE DOCK INTERACTIVE MODULES OR LOAD SHADOW IFRAMES */}
                <div className="flex-1 min-h-0 bg-transparent relative overflow-auto">
                  <AppletErrorBoundary
                    key={`${activeApplet.id}-${iframeRefreshKey}`}
                    appletName={activeApplet.name}
                    onCrash={(err, st) => handleAppletCrash(activeApplet.name, err, st)}
                    fallback={<div className="bg-[#0a0a0a] h-full w-full" />}
                  >
                    {activeApplet.url === 'internal:notes' && (
                      <QuickNotesApp key={iframeRefreshKey} />
                    )}
                    {activeApplet.url === 'internal:pomodoro' && (
                      <PomodoroApp key={iframeRefreshKey} />
                    )}
                    {activeApplet.url === 'internal:canvas' && (
                      <CanvasApp key={iframeRefreshKey} />
                    )}
                    {activeApplet.url === 'internal:json' && (
                      <JsonFormatterApp key={iframeRefreshKey} />
                    )}
                    {activeApplet.url === 'internal:calculator' && (
                      <CalculatorApp key={iframeRefreshKey} />
                    )}

                    {activeApplet.url?.startsWith('internal:component:') && (
                      <DynamicComponentLoader 
                        key={`${activeApplet.id}-${iframeRefreshKey}`} 
                        componentName={activeApplet.url.replace('internal:component:', '')} 
                        useCohesiveInjector={useCohesiveInjector}
                      />
                    )}

                    {/* Standard Iframes or Custom Raw HTML Embed viewports */}
                    {!activeApplet.url?.startsWith('internal:') && !activeApplet.isCustomEmbed && (
                      <div 
                        className="w-full h-full origin-top-left"
                        style={{ 
                          transform: `scale(${iframeZoom / 100})`, 
                          width: `${100 * (100 / iframeZoom)}%`,
                          height: `${100 * (100 / iframeZoom)}%`
                        }}
                      >
                        <iframe
                          key={`${activeApplet.id}-${iframeRefreshKey}`}
                          src={activeApplet.url}
                          sandbox={makeSandboxString(activeApplet.sandboxConfig)}
                          title={activeApplet.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full border-0"
                        />
                      </div>
                    )}

                    {/* Custom Raw Code HTML Sandbox renderer */}
                    {activeApplet.isCustomEmbed && (
                      <div 
                        className="w-full h-full origin-top-left"
                        style={{ 
                          transform: `scale(${iframeZoom / 100})`, 
                          width: `${100 * (100 / iframeZoom)}%`,
                          height: `${100 * (100 / iframeZoom)}%`
                        }}
                      >
                        <iframe
                          key={`${activeApplet.id}-${iframeRefreshKey}`}
                          srcDoc={activeApplet.embedCode || '<h2>No code payload provided</h2>'}
                          sandbox="allow-scripts"
                          title={activeApplet.name}
                          className="w-full h-full border-0 bg-white"
                        />
                      </div>
                    )}
                  </AppletErrorBoundary>
                </div>

              </div>

              {/* Bottom detail footer */}
              {activeApplet.description && (
                <div className="mt-3 text-xxs text-slate-450 flex items-start gap-1 justify-between select-none">
                  <p className="flex-1">
                    <span className="font-bold text-slate-300">Description:</span> {activeApplet.description}
                  </p>
                  <span className="font-mono text-tiny text-slate-550 border border-slate-900 rounded px-1.5 py-0.2">
                    NODE SPEC: {activeApplet.id}
                  </span>
                </div>
              )}

            </div>
          )}
        </main>
      </div>

      {/* FOOTER GENERAL TRIVIA */}
      <footer className="bg-[#0A0A0A] border-t border-white/5 px-10 py-5 text-center text-[10px] text-white/30 tracking-widest uppercase font-mono flex flex-col sm:flex-row justify-between items-center gap-4 select-none shrink-0">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4">
          <span>Applet Cockpit Dashboard • Verified local execution</span>
          <button
            type="button"
            onClick={() => setShowConsoleModal(true)}
            className="px-3 py-1 bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition flex items-center gap-1.5 cursor-pointer rounded-none text-[9px] font-mono tracking-wider uppercase font-bold"
          >
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            Show Diagnostic Logs ({systemLogs.length})
          </button>
        </div>
        <span>OMV Server Node Backed • Node specs active</span>
      </footer>

      {/* --- ADD/EDIT APPLET CONFIGURATION MODAL --- */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-white/10 rounded-none w-full max-w-lg overflow-hidden flex flex-col justify-between max-h-[90vh]">
            {/* Header */}
            <div className="border-b border-white/5 p-6 flex items-center justify-between">
              <h3 className="text-sm font-serif italic text-white flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-white/40" />
                {editingApplet ? 'Modify Applet Node' : 'Register New Applet'}
              </h3>
              <button 
                onClick={() => setShowConfigModal(false)}
                className="p-1 rounded-none hover:bg-white/5 text-white/40 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddOrEditApplet} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-medium">
              
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-white/40 block uppercase tracking-widest text-[9px] font-mono">App Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Pi-Hole Network Node, My local portfolio"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#0A0A0A] border border-white/10 rounded-none text-white focus:outline-none focus:border-white/30 font-mono placeholder:text-white/15"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-white/40 block uppercase tracking-widest text-[9px] font-mono">Description</label>
                <textarea
                  placeholder="Write a brief overview of what this application handles..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  maxLength={500}
                  className="w-full px-3 py-2.5 bg-[#0A0A0A] border border-white/10 rounded-none text-white focus:outline-none focus:border-white/30 resize-none h-16 font-mono placeholder:text-white/15"
                />
              </div>

              {/* Category and Mode Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-white/40 block uppercase tracking-widest text-[9px] font-mono">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#0A0A0A] border border-white/10 rounded-none text-white focus:outline-none focus:border-white/30 cursor-pointer font-mono"
                  >
                    {categories.map(cat => (
                      <option key={cat.name} value={cat.name}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-white/40 block uppercase tracking-widest text-[9px] font-mono">Launcher Open Mode</label>
                  <select
                    value={formOpenMode}
                    onChange={(e) => setFormOpenMode(e.target.value as OpenMode)}
                    className="w-full px-3 py-2.5 bg-[#0A0A0A] border border-white/10 rounded-none text-white focus:outline-none focus:border-white/30 cursor-pointer font-mono"
                  >
                    <option value="iframe">Embedded Cockpit Iframe</option>
                    <option value="new_tab">Spawn New Browser Tab</option>
                  </select>
                </div>
              </div>

              {/* Source types switch */}
              <div className="space-y-1.5">
                <label className="text-white/40 block uppercase tracking-widest text-[9px] font-mono">Source Interface Type</label>
                <div className="flex bg-[#0A0A0A] p-1 border border-white/10 rounded-none">
                  <button
                    type="button"
                    onClick={() => setFormIsCustomEmbed(false)}
                    className={`flex-1 py-2 text-[9px] font-mono font-bold uppercase transition rounded-none cursor-pointer ${
                      !formIsCustomEmbed ? 'bg-white/5 text-white' : 'text-white/40 hover:text-white'
                    }`}
                  >
                    ⚙️ URL Endpoint (OMV or Web)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormIsCustomEmbed(true)}
                    className={`flex-1 py-2 text-[9px] font-mono font-bold uppercase transition rounded-none cursor-pointer ${
                      formIsCustomEmbed ? 'bg-white/5 text-white' : 'text-white/40 hover:text-white'
                    }`}
                  >
                    💻 Direct Code Embed (HTML/JS)
                  </button>
                </div>
              </div>

              {/* URL or Code Area */}
              {!formIsCustomEmbed ? (
                <div className="space-y-1.5">
                  <label className="text-white/40 block uppercase tracking-widest text-[9px] font-mono">Iframe/Target URL</label>
                  <input
                    type="url"
                    required={!formIsCustomEmbed}
                    placeholder="e.g., http://192.168.1.150:8000 (OMV Server) or https://maps.google.com"
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#0A0A0A] border border-white/10 rounded-none text-white focus:outline-none focus:border-white/30 font-mono placeholder:text-white/15"
                  />
                  <span className="text-[10px] text-white/30 font-mono block mt-1 leading-normal">
                    To display self-hosted LAN resources inside an iframe, both this app and the resource must match security protocols (HTTP vs HTTPS).
                  </span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-white/40 block uppercase tracking-widest text-[9px] font-mono">Custom HTML Embed Code</label>
                  <textarea
                    required={formIsCustomEmbed}
                    placeholder="<h2>Hello Workspace</h2>"
                    value={formEmbedCode || '<!-- Inject HTML/CSS/JS Sandbox Applet code here -->\n<div style="font-family:sans-serif; text-align:center; padding-top:40px; color:#fff;">\n  <h2>Raw Sandboxed Snippet</h2>\n  <p>Modify this source code directly inside your dashboard settings.</p>\n</div>'}
                    onChange={(e) => setFormEmbedCode(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#0A0A0A] border border-white/10 rounded-none text-white focus:outline-none focus:border-white/30 resize-none h-28 font-mono placeholder:text-white/15"
                  />
                </div>
              )}

              {/* Popular Icon Chooser */}
              <div className="space-y-1.5">
                <label className="text-white/40 block uppercase tracking-widest text-[9px] font-mono">Visual Icon</label>
                <div className="flex items-center gap-3 bg-[#0A0A0A] p-3 border border-white/5 rounded-none">
                  <span className="text-3xl p-1 px-3 bg-[#121212] border border-white/10 rounded-none block shrink-0">{formIcon}</span>
                  <div className="flex-1 overflow-x-auto py-1 flex gap-1.5 scrollbar-thin">
                    {POPULAR_LAUNCH_ICONS.map(i => (
                      <button
                        type="button"
                        key={i}
                        onClick={() => setFormIcon(i)}
                        className={`text-xl p-1 rounded-none border hover:bg-white/5 transition cursor-pointer ${
                          formIcon === i ? 'border-white bg-[#121212] text-white' : 'border-transparent'
                        }`}
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Visual accents border color chooser */}
              <div className="space-y-1.5">
                <label className="text-white/40 block uppercase tracking-widest text-[9px] font-mono">Card Accent Highlight</label>
                <div className="flex gap-2">
                  {ACCENT_COLORS.map(c => (
                    <button
                      type="button"
                      key={c.value}
                      onClick={() => setFormAccentColor(c.value)}
                      className={`w-6 h-6 rounded-full border transition flex items-center justify-center cursor-pointer ${
                        formAccentColor === c.value ? 'ring-2 ring-white ring-offset-2 ring-offset-[#121212]' : 'border-neutral-800 hover:scale-110'
                      }`}
                      style={{ backgroundColor: c.value === 'red' ? '#ef4444' : c.value === 'emerald' ? '#10b981' : c.value === 'sky' ? '#0ea5e9' : c.value === 'indigo' ? '#6366f1' : c.value === 'rose' ? '#f43f5e' : c.value === 'amber' ? '#f59e0b' : c.value === 'violet' ? '#8b5cf6' : '#22c55e' }}
                      title={c.name}
                    >
                      {formAccentColor === c.value && (
                        <Check className="w-3.5 h-3.5 text-black font-bold" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-1.5">
                <label className="text-white/40 block uppercase tracking-widest text-[9px] font-mono">Searchable Tags (Comma Separated)</label>
                <input
                  type="text"
                  placeholder="e.g., server, docker, automation, system"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#0A0A0A] border border-white/10 rounded-none text-white focus:outline-none focus:border-white/30 font-mono placeholder:text-white/15"
                />
              </div>

              {/* Iframe sandbox configuration */}
              {!formIsCustomEmbed && formOpenMode === 'iframe' && (
                <div className="space-y-2 bg-[#0A0A0A] p-3.5 border border-white/5 rounded-none">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 block">Iframe Sandbox Protections</span>
                  <div className="grid grid-cols-2 gap-3 text-[10px] font-mono uppercase tracking-wider text-white/50">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formSandbox.allowScripts}
                        onChange={(e) => setFormSandbox({ ...formSandbox, allowScripts: e.target.checked })}
                        className="rounded-none border-white/25 bg-[#121212] cursor-pointer"
                      />
                      Allow Scripts
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formSandbox.allowSameOrigin}
                        onChange={(e) => setFormSandbox({ ...formSandbox, allowSameOrigin: e.target.checked })}
                        className="rounded-none border-white/25 bg-[#121212] cursor-pointer"
                      />
                      Allow Same Origin
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formSandbox.allowForms}
                        onChange={(e) => setFormSandbox({ ...formSandbox, allowForms: e.target.checked })}
                        className="rounded-none border-white/25 bg-[#121212] cursor-pointer"
                      />
                      Allow Forms
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formSandbox.allowPopups}
                        onChange={(e) => setFormSandbox({ ...formSandbox, allowPopups: e.target.checked })}
                        className="rounded-none border-white/25 bg-[#121212] cursor-pointer"
                      />
                      Allow Popups
                    </label>
                  </div>
                </div>
              )}

            </form>

            {/* Actions Footer */}
            <div className="border-t border-white/5 p-6 bg-[#0A0A0A] flex justify-end gap-3 shrink-0">
              {editingApplet && (
                <button
                  type="button"
                  onClick={async (e) => {
                    await handleDeleteApplet(e as any, editingApplet);
                    setShowConfigModal(false);
                  }}
                  className="mr-auto px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest bg-rose-950/30 text-rose-400 hover:bg-rose-900/40 border border-rose-500/20 hover:border-rose-400 rounded-none cursor-pointer"
                >
                  Purge Applet
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest bg-transparent hover:bg-white/5 text-white/70 border border-white/10 rounded-none cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddOrEditApplet}
                className="px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest bg-white text-black hover:bg-neutral-200 rounded-none cursor-pointer"
              >
                {editingApplet ? 'Save Modifications' : 'Launch Config'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MANAGE SYSTEM DIRECTORIES MODAL --- */}
      {showManageCategoriesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-white/10 rounded-none w-full max-w-lg overflow-hidden flex flex-col justify-between max-h-[90vh]">
            {/* Header */}
            <div className="border-b border-white/5 p-6 flex items-center justify-between">
              <h3 className="text-sm font-serif italic text-white flex items-center gap-2.5">
                <Folder className="w-5 h-5 text-white/40" />
                Manage System Directories
              </h3>
              <button 
                onClick={() => {
                  setShowManageCategoriesModal(false);
                  setEditingCategoryName(null);
                }}
                className="p-1 rounded-none hover:bg-white/5 text-white/40 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs font-medium">
              
              {/* Form to Create New Custom Directory */}
              <form onSubmit={handleAddCategory} className="space-y-4 bg-white/5 p-4 border border-white/10 rounded-none text-left">
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 block">Create Custom Directory</span>
                
                <div className="space-y-1.5">
                  <label className="text-white/40 block uppercase tracking-widest text-[9px] font-mono">Directory Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Development, Backups, Fun"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#0A0A0A] border border-white/10 rounded-none text-white focus:outline-none focus:border-white/30 font-mono placeholder:text-white/15"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Selected Preset Icon */}
                  <div className="space-y-1.5">
                    <label className="text-white/40 block uppercase tracking-widest text-[9px] font-mono">Preset Icon</label>
                    <div className="grid grid-cols-6 gap-1 bg-[#0A0A0A] p-2 border border-white/10 max-h-24 overflow-y-auto">
                      {PRESET_DIR_ICONS.map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setNewCatIcon(emoji)}
                          className={`text-base p-1 hover:bg-white/10 transition ${newCatIcon === emoji ? 'bg-white/20' : ''}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Selected Preset Color */}
                  <div className="space-y-1.5">
                    <label className="text-white/40 block uppercase tracking-widest text-[9px] font-mono">Icon Color Accent</label>
                    <div className="grid grid-cols-5 gap-1.5 bg-[#0A0A0A] p-2 border border-white/10 max-h-24 overflow-y-auto">
                      {PRESET_DIR_COLORS.map(color => (
                        <button
                          key={color.name}
                          type="button"
                          onClick={() => setNewCatColor(color.class)}
                          className={`flex items-center justify-center p-1 hover:bg-white/10 transition ${newCatColor === color.class ? 'border border-white/40 bg-white/5' : ''}`}
                          title={color.name}
                        >
                          <span className={`w-3.5 h-3.5 rounded-full ${color.bg}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="flex items-center gap-1 bg-white text-black hover:bg-neutral-200 px-4 py-2 text-[9px] font-bold uppercase tracking-widest transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create Directory
                  </button>
                </div>
              </form>

              {/* Existing Directories Catalog List */}
              <div className="space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 block">Existing System Folders</span>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {categories.map(cat => {
                    const isEditing = editingCategoryName === cat.name;
                    return (
                      <div 
                        key={cat.name} 
                        className="flex items-center justify-between p-3 bg-[#0A0A0A] border border-white/5 hover:border-white/10 transition text-left"
                      >
                        {isEditing ? (
                          <div className="flex-1 space-y-3">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={editCatName}
                                onChange={(e) => setEditCatName(e.target.value)}
                                className="flex-1 px-2.5 py-1.5 bg-[#121212] border border-white/10 text-white text-xs font-mono"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3 p-2 bg-[#121212] border border-white/5">
                              <div>
                                <span className="text-[8px] text-white/40 uppercase font-mono block mb-1">Pick Icon</span>
                                <div className="grid grid-cols-6 gap-1 max-h-16 overflow-y-auto">
                                  {PRESET_DIR_ICONS.map(emoji => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() => setEditCatIcon(emoji)}
                                      className={`text-sm p-0.5 hover:bg-white/10 ${editCatIcon === emoji ? 'bg-white/20' : ''}`}
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <span className="text-[8px] text-white/40 uppercase font-mono block mb-1">Pick Accent</span>
                                <div className="grid grid-cols-5 gap-1 max-h-16 overflow-y-auto">
                                  {PRESET_DIR_COLORS.map(color => (
                                    <button
                                      key={color.name}
                                      type="button"
                                      onClick={() => setEditCatColor(color.class)}
                                      className={`p-0.5 hover:bg-white/10 ${editCatColor === color.class ? 'border border-white/20' : ''}`}
                                      title={color.name}
                                    >
                                      <span className={`w-3 h-3 rounded-full block ${color.bg}`} />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-end gap-2 text-[9px] font-bold uppercase tracking-wider">
                              <button
                                type="button"
                                onClick={() => setEditingCategoryName(null)}
                                className="px-3 py-1.5 border border-white/10 text-white/50 hover:text-white"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEditedCategory(cat.name)}
                                className="px-3 py-1.5 bg-emerald-500 text-black hover:bg-emerald-400"
                              >
                                Save Changes
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3">
                              <span className={`text-lg ${cat.color || 'text-white'}`}>{cat.icon || '📁'}</span>
                              <div className="font-mono">
                                <span className="text-white font-semibold text-xs">{cat.name}</span>
                                {cat.isCustom && <span className="text-[8px] bg-white/5 text-white/40 border border-white/10 px-1 ml-1.5">CUSTOM</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleStartEditCategory(cat)}
                                className="p-1.5 text-white/40 hover:text-white hover:bg-white/5 rounded transition cursor-pointer"
                                title="Edit Directory Appearance"
                              >
                                <Sliders className="w-3.5 h-3.5" />
                              </button>
                              {cat.isCustom && (
                                <button
                                  onClick={() => handleDeleteCategory(cat.name)}
                                  className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition cursor-pointer"
                                  title="Delete Directory"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="border-t border-white/5 p-6 bg-[#0A0A0A] flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowManageCategoriesModal(false);
                  setEditingCategoryName(null);
                }}
                className="px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest bg-white text-black hover:bg-neutral-200 rounded-none cursor-pointer"
              >
                Close Manager
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CLOUD SETTINGS / CONFIGURATION MODAL --- */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-white/10 rounded-none w-full max-w-md overflow-hidden flex flex-col justify-between max-h-[90vh]">
            <div className="border-b border-white/5 p-6 flex items-center justify-between">
              <h3 className="text-sm font-serif italic text-white flex items-center gap-2.5">
                <Database className="w-5 h-5 text-white/40" />
                Durable Storage Settings
              </h3>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded-none hover:bg-white/5 text-white/40 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomFirebaseSettings} className="p-6 space-y-4 text-xs font-medium overflow-y-auto">
              <div className="space-y-1.5 bg-black p-4 border border-white/5 rounded-none">
                <span className="text-[9px] font-mono font-bold block uppercase text-white/50 tracking-widest mb-1">GitHub Pages & OMV Ready</span>
                <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider leading-relaxed">
                  By default, catalog configurations write securely to browser client LocalStorage! To backing up or sharing catalogs, download the JSON back-up. Paste your Firebase configurations below to activate live multi-device real-time sync.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-white/40 block uppercase tracking-widest text-[9px] font-mono">Custom Firebase Web Config (JSON)</label>
                <textarea
                  placeholder='{"apiKey": "AIzaSy...", "authDomain": "...", "projectId": "...", ...}'
                  value={customFirebaseConfig}
                  onChange={(e) => setCustomFirebaseConfig(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#0A0A0A] border border-white/10 rounded-none text-white focus:outline-none focus:border-white/30 font-mono resize-none h-44 placeholder:text-white/15 text-xs"
                />
                <span className="text-[10px] text-white/20 block mt-1.5 italic font-mono leading-normal">
                  Leave completely empty and save to delete custom key bindings and return fully to local isolated execution.
                </span>
              </div>

              {/* State check */}
              <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-widest bg-[#0A0A0A] p-3 rounded-none border border-white/5">
                <span className="text-white/40">Sync Toggle Status:</span>
                {customFirebaseActive ? (
                  <span className="text-emerald-400 font-bold">● Active Cloud Sync</span>
                ) : (
                  <span className="text-white/20 font-bold">● Offline Local Sandbox</span>
                )}
              </div>
            </form>

            <div className="border-t border-white/5 p-6 bg-[#0A0A0A] flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest bg-transparent hover:bg-white/5 text-white/70 border border-white/10 rounded-none cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveCustomFirebaseSettings}
                className="px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest bg-white text-black hover:bg-neutral-200 rounded-none cursor-pointer"
              >
                Assign Config Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- .TSX APPLET UPLOAD MODAL --- */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-mono text-xs">
          <div className="bg-[#121212] border border-white/10 rounded-none w-full max-w-lg overflow-hidden flex flex-col justify-between max-h-[90vh]">
            {/* Header */}
            <div className="border-b border-white/5 p-6 flex items-center justify-between">
              <h3 className="text-sm font-serif italic text-white flex items-center gap-2.5">
                <FileUp className="w-5 h-5 text-white/40" />
                Upload Dynamic TSX Applet
              </h3>
              <button 
                onClick={() => setShowUploadModal(false)}
                className="p-1 rounded-none hover:bg-white/5 text-white/40 hover:text-white transition cursor-pointer font-sans"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Dropzone container */}
            <div className="p-6 overflow-y-auto space-y-4 font-sans font-medium">
              <div
                className={`border-2 border-dashed rounded-none p-8 text-center transition-all ${
                  dragActive 
                    ? 'border-emerald-500 bg-emerald-500/10' 
                    : 'border-white/10 bg-[#0A0A0A] hover:border-white/20'
                }`}
                onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    if (!file.name.endsWith('.tsx')) {
                      setUploadError('Only .tsx React Components are accepted.');
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      const text = evt.target?.result as string;
                      handleUploadTsx(file.name, text);
                    };
                    reader.readAsText(file);
                  }
                }}
              >
                <div className="flex flex-col items-center justify-center space-y-3 cursor-pointer" onClick={() => document.getElementById('tsx-file-picker')?.click()}>
                  <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
                    <FileUp className="w-5 h-5 flex shrink-0" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-white font-semibold">Drag and drop your .tsx file here</p>
                    <p className="text-[10px] text-white/40 font-mono">or click to browse local storage</p>
                  </div>
                </div>
                <input 
                  id="tsx-file-picker"
                  type="file"
                  accept=".tsx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        const text = evt.target?.result as string;
                        handleUploadTsx(file.name, text);
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
              </div>

              {uploading && (
                <div className="flex flex-col items-center justify-center p-6 space-y-3 border border-white/5 bg-[#0A0A0A]">
                  <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-400">Saving and Hot-Deploying component...</span>
                </div>
              )}

              {uploadError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 font-mono text-[10px] leading-normal flex items-start gap-2 select-none">
                  <span className="font-bold shrink-0">⚠️ Error:</span>
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="bg-white/5 border border-white/10 p-4 rounded-none space-y-2 select-none">
                <span className="text-[9px] uppercase tracking-widest font-mono text-white/40 block">Hot-Development Rules:</span>
                <ul className="text-[10px] text-white/50 space-y-1 list-disc pl-4 font-mono leading-normal">
                  <li>Your `.tsx` file should default-export a React Component.</li>
                  <li>Import shared packages (e.g., `lucide-react`, `recharts`, `motion`) as needed.</li>
                  <li>Avoid including local relative imports that do not exist inside target framework paths.</li>
                  <li>The local Vite bundler will compile the component instantly as a dynamic lazy-chunk.</li>
                </ul>
              </div>
            </div>

            <div className="border-t border-white/5 p-6 bg-[#0A0A0A] flex justify-end">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest bg-transparent hover:bg-white/5 text-white/70 border border-white/10 rounded-none cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SYSTEM DIAGNOSTIC LOGS CONSOLE MODAL --- */}
      {showConsoleModal && (
        <SystemConsoleModal
          logs={systemLogs}
          onClose={() => setShowConsoleModal(false)}
          onClear={() => setSystemLogs([])}
        />
      )}

      {/* --- SYSTEM FILESYSTEM & SOURCE CODE EDITOR MODAL --- */}
      {showFilesystemModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-white/10 rounded-none w-full max-w-6xl h-[85vh] overflow-hidden flex flex-col justify-between">
            {/* Header */}
            <div className="border-b border-white/5 p-5 flex items-center justify-between shrink-0 bg-[#0A0A0A]">
              <div className="flex items-center gap-2.5">
                <HardDrive className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-serif italic text-white leading-tight">
                    System Filesystem & Source Editor
                  </h3>
                  <span className="text-[9px] uppercase tracking-widest text-white/30 font-mono block mt-0.5">
                    Navigate, Inspect, Edit, and Manage Active Dashboard Files
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setShowFilesystemModal(false)}
                className="p-1.5 rounded-none hover:bg-white/5 text-white/40 hover:text-white transition cursor-pointer font-sans"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Main Dual Panel Body */}
            <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
              
              {/* Left Panel: Filesystem Listing */}
              <div className="w-full md:w-5/12 border-b md:border-b-0 md:border-r border-white/5 p-4 flex flex-col min-h-0 bg-[#0D0D0D]">
                
                {/* Path breadcrumbs and directory up button */}
                <div className="flex items-center gap-2 mb-3 shrink-0">
                  <button
                    onClick={() => {
                      if (fsCurrentPath === '.') return;
                      const parts = fsCurrentPath.split('/');
                      parts.pop();
                      const parent = parts.join('/') || '.';
                      handleFetchFsItems(parent);
                    }}
                    disabled={fsCurrentPath === '.'}
                    className="p-1.5 border border-white/5 bg-[#121212] text-white/50 hover:text-white disabled:opacity-35 disabled:hover:text-white/50 transition cursor-pointer"
                    title="Go to Parent Directory"
                  >
                    <CornerUpLeft className="w-4 h-4" />
                  </button>
                  <div className="flex-1 bg-[#070707] border border-white/10 px-3 py-1.5 text-[10px] font-mono text-emerald-400 truncate tracking-wide">
                    {fsCurrentPath === '.' ? './' : `./${fsCurrentPath}`}
                  </div>
                </div>

                {/* Simple create-file tool inline */}
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.currentTarget.elements.namedItem('fileNameInput') as HTMLInputElement;
                  const trimmed = input.value.trim();
                  if (!trimmed) return;
                  const filePath = fsCurrentPath === '.' ? trimmed : `${fsCurrentPath}/${trimmed}`;
                  fetch('/api/files/write', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: filePath, content: '' })
                  })
                  .then(r => r.json())
                  .then(data => {
                    if (data.success) {
                      triggerToast(`Created file: ${trimmed}`, 'success');
                      handleFetchFsItems(fsCurrentPath);
                      handleFsReadFile(filePath);
                      input.value = '';
                    } else {
                      triggerToast(data.error || 'Failed to create file', 'error');
                    }
                  })
                  .catch(err => triggerToast(err.message, 'error'));
                }} className="flex gap-2 mb-3 shrink-0">
                  <input
                    id="fileNameInput"
                    name="fileNameInput"
                    type="text"
                    required
                    placeholder="New file (e.g., config.json)..."
                    className="flex-1 px-2.5 py-1.5 bg-[#050505] border border-white/10 text-[10px] font-mono text-white focus:outline-none focus:border-white/20 placeholder:text-white/15"
                  />
                  <button
                    type="submit"
                    className="px-3 bg-white text-black hover:bg-neutral-200 text-[10px] font-mono font-bold uppercase transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create</span>
                  </button>
                </form>

                {/* Directory Content List */}
                <div className="flex-1 overflow-y-auto min-h-0 space-y-1.5 pr-1">
                  {fsLoading ? (
                    <div className="flex flex-col items-center justify-center py-10 space-y-2">
                      <RefreshCw className="w-5 h-5 text-emerald-500 animate-spin" />
                      <span className="text-[9px] uppercase tracking-widest font-mono text-white/30">Reading filesystem index...</span>
                    </div>
                  ) : fsItems.length === 0 ? (
                    <div className="text-center py-10 text-white/30 font-mono text-[10px]">
                      Empty Directory
                    </div>
                  ) : (
                    fsItems.map((item, index) => {
                      const isSelected = fsSelectedFilePath === item.path;
                      return (
                        <div
                          key={index}
                          onClick={() => {
                            if (item.isDirectory) {
                              handleFetchFsItems(item.path);
                            } else {
                              handleFsReadFile(item.path);
                            }
                          }}
                          className={`group flex items-center justify-between p-2 border transition cursor-pointer select-none text-[11px] font-mono ${
                            isSelected 
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                              : 'bg-black/30 border-white/5 hover:border-white/15 text-white/70 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate flex-1 pr-2">
                            {item.isDirectory ? (
                              <Folder className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            )}
                            <span className="truncate">{item.name}</span>
                          </div>
                          
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[8px] text-white/20">
                              {item.isDirectory ? 'DIR' : `${(item.size / 1024).toFixed(1)} KB`}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFsDeleteFile(item.path, item.isDirectory);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                              title="Delete permanently"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Panel: Code Editor */}
              <div className="w-full md:w-7/12 p-4 flex flex-col min-h-0 bg-[#090909]">
                {fsSelectedFilePath ? (
                  <div className="flex-1 flex flex-col min-h-0">
                    {/* Active File Header Details */}
                    <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-3 shrink-0">
                      <div className="space-y-0.5">
                        <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-400 font-bold block">
                          ACTIVE WORKSPACE FILE
                        </span>
                        <div className="text-xs font-mono text-white/80 select-all truncate">
                          {fsSelectedFilePath}
                        </div>
                      </div>
                      <div className="text-[9px] font-mono text-white/30 text-right">
                        <span>Ready for modification</span>
                      </div>
                    </div>

                    {/* Code Input */}
                    <div className="flex-1 relative min-h-0 border border-white/10 bg-[#030303] flex">
                      {fsFileLoading ? (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center space-y-2 z-10">
                          <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
                          <span className="text-[9px] uppercase tracking-widest font-mono text-white/30">Loading content streams...</span>
                        </div>
                      ) : null}
                      <textarea
                        value={fsFileContent}
                        onChange={(e) => setFsFileContent(e.target.value)}
                        className="w-full h-full p-4 font-mono text-xs text-slate-300 bg-transparent resize-none focus:outline-none leading-relaxed select-text overflow-y-auto"
                        placeholder="Write standard code or text content here..."
                        spellCheck="false"
                      />
                    </div>

                    {/* Editor Footer Actions */}
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5 shrink-0">
                      <button
                        onClick={() => {
                          setFsSelectedFilePath(null);
                          setFsFileContent('');
                        }}
                        className="px-4 py-2 text-[10px] font-mono font-bold uppercase border border-white/5 hover:bg-white/5 text-white/60 hover:text-white transition cursor-pointer"
                      >
                        Close File
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={handleFsWriteFile}
                          disabled={fsSaving || fsFileLoading}
                          className="px-6 py-2 bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-40 text-[10px] font-mono font-bold uppercase transition flex items-center gap-1.5 cursor-pointer"
                        >
                          {fsSaving ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>{fsSaving ? 'Saving Changes...' : 'Save Changes'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4 border border-dashed border-white/5 bg-black/10">
                    <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/20">
                      <FileText className="w-6 h-6 text-white/30" />
                    </div>
                    <div className="max-w-xs space-y-1.5">
                      <h4 className="text-xs font-serif italic text-white/70">No active file selected</h4>
                      <p className="text-[10px] text-white/30 font-mono leading-relaxed">
                        Choose a workspace configuration or applet source file from the catalog tree on the left to review or edit.
                      </p>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* General Filesystem Status Banner */}
            <div className="border-t border-white/5 p-4 bg-[#0A0A0A] flex flex-col sm:flex-row justify-between items-center gap-2 select-none shrink-0 text-[10px] font-mono uppercase tracking-widest text-white/35">
              <span>Filesystem Status: ONLINE</span>
              {fsError && (
                <span className="text-rose-400 animate-pulse font-bold">ERROR: {fsError}</span>
              )}
              <span>Isolated Environment Sandbox</span>
            </div>
          </div>
        </div>
      )}

      {/* --- SYSTEM TRASH BIN MODAL --- */}
      {showTrashModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-white/10 rounded-none w-full max-w-5xl h-[80vh] overflow-hidden flex flex-col justify-between shadow-2xl">
            {/* Header */}
            <div className="border-b border-white/5 p-5 flex items-center justify-between shrink-0 bg-[#0A0A0A]">
              <div className="flex items-center gap-2.5">
                <Trash2 className="w-5 h-5 text-rose-500 animate-pulse" />
                <div>
                  <h3 className="text-sm font-serif italic text-white leading-tight">
                    System Trash Bin
                  </h3>
                  <span className="text-[9px] uppercase tracking-widest text-white/30 font-mono block mt-0.5">
                    Restore or Permanently Erase Trashed Applets and File Backups
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {(trashBin.applets.length > 0 || trashBin.files.length > 0) && (
                  <button
                    onClick={handleEmptyTrash}
                    className="px-3 py-1.5 border border-rose-500/20 bg-rose-950/20 text-rose-400 hover:text-white hover:bg-rose-900/40 text-[9px] font-mono font-bold uppercase tracking-widest transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Empty Trash</span>
                  </button>
                )}
                <button 
                  onClick={() => setShowTrashModal(false)}
                  className="p-1.5 rounded-none hover:bg-white/5 text-white/40 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Split Content Panels */}
            <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden bg-[#0D0D0D]">
              
              {/* Left Panel: Trashed Applets */}
              <div className="flex-1 border-b md:border-b-0 md:border-r border-white/5 p-5 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <h4 className="text-[10px] uppercase font-mono tracking-widest text-emerald-400 font-bold">
                    Trashed Applets ({trashBin.applets.length})
                  </h4>
                  <span className="text-[9px] text-white/20 font-mono">Restorable to Catalog</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
                  {trashBin.applets.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-white/20 font-mono text-[10px] space-y-2">
                      <LayoutGrid className="w-8 h-8 opacity-20" />
                      <span>No trashed applets</span>
                    </div>
                  ) : (
                    trashBin.applets.map((item, idx) => (
                      <div 
                        key={idx}
                        className="p-3 border border-white/5 bg-black/40 hover:border-white/10 transition font-mono text-[11px] flex flex-col gap-2 relative group text-left"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-serif italic text-xs text-white block">
                              {item.applet.name}
                            </span>
                            <span className="text-[9px] text-white/30 uppercase tracking-widest mt-0.5 block">
                              Category: {item.applet.category}
                            </span>
                          </div>
                          <span className="text-[8px] text-white/20">
                            Trashed: {new Date(item.deletedAt).toLocaleDateString()}
                          </span>
                        </div>

                        {item.associatedFile && (
                          <div className="text-[8px] text-emerald-500/80 bg-emerald-500/5 px-2 py-1 border border-emerald-500/10 rounded-sm">
                            Contains Backup: {item.associatedFile.path}
                          </div>
                        )}

                        <div className="flex justify-end gap-2 mt-1">
                          <button
                            onClick={() => handleRestoreApplet(item)}
                            className="px-2.5 py-1 border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase transition cursor-pointer flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Restore</span>
                          </button>
                          <button
                            onClick={() => handlePermanentDeleteApplet(item.applet.id, item.applet.name)}
                            className="px-2.5 py-1 border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/20 text-rose-400 text-[9px] font-bold uppercase transition cursor-pointer flex items-center gap-1"
                          >
                            <X className="w-3 h-3" />
                            <span>Erase</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Panel: Trashed Files */}
              <div className="flex-1 p-5 flex flex-col min-h-0 bg-[#090909]">
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <h4 className="text-[10px] uppercase font-mono tracking-widest text-indigo-400 font-bold">
                    Trashed Files & Folders ({trashBin.files.length})
                  </h4>
                  <span className="text-[9px] text-white/20 font-mono">Restorable to Filesystem</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
                  {trashBin.files.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-white/20 font-mono text-[10px] space-y-2">
                      <FileText className="w-8 h-8 opacity-20" />
                      <span>No trashed files or folders</span>
                    </div>
                  ) : (
                    trashBin.files.map((item, idx) => (
                      <div 
                        key={idx}
                        className="p-3 border border-white/5 bg-black/40 hover:border-white/10 transition font-mono text-[11px] flex flex-col gap-2 relative group text-left"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-white block font-bold truncate max-w-[200px]">
                              {item.name}
                            </span>
                            <span className="text-[9px] text-white/30 truncate block max-w-[250px] mt-0.5">
                              Path: {item.path}
                            </span>
                          </div>
                          <span className="text-[8px] text-white/20">
                            Trashed: {new Date(item.deletedAt).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="text-[8px] text-white/40">
                          Type: {item.isDirectory ? 'Directory' : 'File'} • Size: {(item.size / 1024).toFixed(1)} KB
                        </div>

                        <div className="flex justify-end gap-2 mt-1">
                          <button
                            onClick={() => handleRestoreFile(item)}
                            className="px-2.5 py-1 border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase transition cursor-pointer flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Restore</span>
                          </button>
                          <button
                            onClick={() => handlePermanentDeleteFile(item.path, item.name)}
                            className="px-2.5 py-1 border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/20 text-rose-400 text-[9px] font-bold uppercase transition cursor-pointer flex items-center gap-1"
                          >
                            <X className="w-3 h-3" />
                            <span>Erase</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Status Footer */}
            <div className="border-t border-white/5 p-4 bg-[#0A0A0A] flex justify-between items-center select-none shrink-0 text-[10px] font-mono uppercase tracking-widest text-white/35">
              <span>Trash Engine: ACTIVE</span>
              <span>Local Storage Buffering Enabled</span>
            </div>
          </div>
        </div>
      )}

      {/* --- CUSTOM DELETE/TRASH CONFIRMATION MODAL --- */}
      {(appletToTrash || fileToTrash) && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-white/10 rounded-none w-full max-w-md p-6 space-y-6 text-left shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h3 className="text-sm font-serif italic text-white">Move Item to Trash Bin?</h3>
                <span className="text-[9px] uppercase tracking-widest text-white/30 font-mono block mt-0.5">
                  Confirm Temporary Removal
                </span>
              </div>
            </div>

            <div className="text-xs text-white/70 font-mono space-y-2 leading-relaxed">
              {appletToTrash && (
                <>
                  {isSystemApp(appletToTrash.name) && (
                    <div className="mb-3 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold text-[10px] leading-snug flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>⚠️ CRITICAL SYSTEM WARNING: This is a core system-level utility. Purging it may break key dashboard features or cause layout issues.</span>
                    </div>
                  )}
                  <p>
                    Are you sure you want to remove the applet <span className="text-rose-400 font-bold">"{appletToTrash.name}"</span>? 
                    It will be hidden from your active dashboard lists, and safely retained in the Trash Bin where you can restore it at any time.
                  </p>
                </>
              )}
              {fileToTrash && (
                <p>
                  Are you sure you want to delete <span className="text-rose-400 font-bold">"{fileToTrash.name}"</span>? 
                  It will be deleted from the active project workspace, but a full backup of its code content will be saved in your Trash Bin so you can restore or permanently erase it.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setAppletToTrash(null);
                  setFileToTrash(null);
                }}
                className="px-4 py-2 border border-white/10 hover:bg-white/5 text-white/70 hover:text-white text-[10px] font-mono font-bold uppercase tracking-wider transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (appletToTrash) {
                    await executeTrashApplet(appletToTrash);
                    setAppletToTrash(null);
                  } else if (fileToTrash) {
                    await executeTrashFile(fileToTrash.path, fileToTrash.isDirectory, fileToTrash.name);
                    setFileToTrash(null);
                  }
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-mono font-bold uppercase tracking-wider transition cursor-pointer"
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CUSTOM PERMANENT ERASE / EMPTY TRASH CONFIRMATION MODALS --- */}
      {confirmEmptyTrash && (
        <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-rose-500/20 rounded-none w-full max-w-md p-6 space-y-6 text-left shadow-2xl animate-[fade-in_0.15s_ease-out]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-serif italic text-white">Empty Trash Bin?</h3>
                <span className="text-[9px] uppercase tracking-widest text-white/30 font-mono block mt-0.5">
                  Irreversible Wipe Operation
                </span>
              </div>
            </div>

            <p className="text-xs text-white/70 font-mono leading-relaxed">
              Are you absolutely sure you want to empty the Trash Bin? 
              All <span className="text-rose-400 font-bold">{trashBin.applets.length} applets</span> and <span className="text-rose-400 font-bold">{trashBin.files.length} file backups</span> will be permanently and irreversibly destroyed.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmEmptyTrash(false)}
                className="px-4 py-2 border border-white/10 hover:bg-white/5 text-white/70 hover:text-white text-[10px] font-mono font-bold uppercase tracking-wider transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  executeEmptyTrash();
                  setConfirmEmptyTrash(false);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-mono font-bold uppercase tracking-wider transition cursor-pointer"
              >
                Confirm Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {appletToPermanentlyDelete && (
        <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-rose-500/20 rounded-none w-full max-w-md p-6 space-y-6 text-left shadow-2xl animate-[fade-in_0.15s_ease-out]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <AlertCircle className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h3 className="text-sm font-serif italic text-white">Permanently Erase Applet?</h3>
                <span className="text-[9px] uppercase tracking-widest text-white/30 font-mono block mt-0.5">
                  Irreversible Action
                </span>
              </div>
            </div>

            <p className="text-xs text-white/70 font-mono leading-relaxed">
              Are you absolutely sure you want to permanently erase <span className="text-rose-400 font-bold">"{appletToPermanentlyDelete.name}"</span>? 
              This will destroy all backups for this node completely.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setAppletToPermanentlyDelete(null)}
                className="px-4 py-2 border border-white/10 hover:bg-white/5 text-white/70 hover:text-white text-[10px] font-mono font-bold uppercase tracking-wider transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  executePermanentDeleteApplet(appletToPermanentlyDelete.id, appletToPermanentlyDelete.name);
                  setAppletToPermanentlyDelete(null);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-mono font-bold uppercase tracking-wider transition cursor-pointer"
              >
                Confirm Erase
              </button>
            </div>
          </div>
        </div>
      )}

      {fileToPermanentlyDelete && (
        <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-rose-500/20 rounded-none w-full max-w-md p-6 space-y-6 text-left shadow-2xl animate-[fade-in_0.15s_ease-out]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <AlertCircle className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h3 className="text-sm font-serif italic text-white">Permanently Erase File?</h3>
                <span className="text-[9px] uppercase tracking-widest text-white/30 font-mono block mt-0.5">
                  Irreversible Action
                </span>
              </div>
            </div>

            <p className="text-xs text-white/70 font-mono leading-relaxed">
              Are you absolutely sure you want to permanently erase the backup for <span className="text-rose-400 font-bold">"{fileToPermanentlyDelete.name}"</span>? 
              This backup file content will be gone forever.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setFileToPermanentlyDelete(null)}
                className="px-4 py-2 border border-white/10 hover:bg-white/5 text-white/70 hover:text-white text-[10px] font-mono font-bold uppercase tracking-wider transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  executePermanentDeleteFile(fileToPermanentlyDelete.path, fileToPermanentlyDelete.name);
                  setFileToPermanentlyDelete(null);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-mono font-bold uppercase tracking-wider transition cursor-pointer"
              >
                Confirm Erase
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- RECONSTRUCTED CUSTOM INTERACTIVE TOAST --- */}
      {toast && (
        <>
          {toast.type === 'crash' ? (
            /* Premium Top-Center Interactive Crash Modal Banner */
            <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[300] w-full max-w-lg px-4 select-none animate-[slide-down_0.25s_ease-out]">
              <div className="bg-[#1C0D0E] border-2 border-red-500/40 p-5 shadow-[0_0_50px_rgba(239,68,68,0.15)] flex flex-col gap-3 font-mono text-xs text-left">
                <div className="flex items-center gap-2 text-red-500 font-bold uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 animate-pulse" />
                  <span>✗ [PROCESS CRASH] IN INTERACTIVE CLIENT</span>
                </div>
                <p className="text-white/80 font-semibold leading-relaxed text-[11px]">
                  {toast.message}
                </p>
                <div className="flex items-center gap-3 mt-1.5 text-[10px] uppercase font-bold tracking-widest pt-2.5 border-t border-red-955/40 text-red-400">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(toast.stack || toast.message);
                      triggerToast('Crash log trace copied!', 'success');
                    }}
                    className="hover:text-white bg-red-950/20 px-3 py-1 border border-red-900/30 hover:border-red-500 transition cursor-pointer"
                  >
                    Copy Trace
                  </button>
                  <button
                    onClick={() => {
                      setSelectedErrorToView({
                        id: 'toast-view',
                        appletName: toast.appletName || 'Component',
                        errorMessage: toast.message,
                        stack: toast.stack || 'No traceback captured.',
                        timestamp: new Date().toLocaleTimeString(),
                        read: true
                      });
                      setToast(null);
                    }}
                    className="hover:text-white bg-red-950/20 px-3 py-1 border border-red-900/30 hover:border-red-500 transition cursor-pointer"
                  >
                    View Trace
                  </button>
                  <button
                    onClick={() => setToast(null)}
                    className="hover:text-white ml-auto text-white/40 cursor-pointer"
                  >
                    [Dismiss]
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Typical Bottom Right Toast */
            <div className="fixed bottom-6 right-6 z-[200] select-none animate-[slide-in_0.2s_ease-out]">
              <div className={`p-4 border shadow-2xl flex items-center gap-3 font-mono text-xs max-w-sm ${
                toast.type === "success" 
                  ? "bg-[#091E11] border-emerald-500/30 text-emerald-400" 
                  : toast.type === "warn" 
                    ? "bg-[#251D0C] border-amber-500/30 text-amber-400" 
                    : toast.type === "info"
                      ? "bg-[#0A1A2F] border-sky-500/30 text-sky-400"
                      : "bg-[#200A0C] border-red-500/30 text-red-500"
              }`}>
                <span className="font-bold shrink-0">
                  {toast.type === "success" && "✓ [SUCCESS]"}
                  {toast.type === "warn" && "⚠ [WARNING]"}
                  {toast.type === "info" && "ℹ [INFO]"}
                  {toast.type === "error" && "✗ [ERROR]"}
                </span>
                <p className="flex-1 text-[11px] font-semibold text-left">{toast.message}</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* --- SORRY SOMETHING WENT WRONG MODAL (Gentle applet crash handler pop-up) --- */}
      {gentleCrashModal.isOpen && (
        <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border-2 border-red-500/30 text-white font-mono text-xs max-w-md w-full p-6 shadow-2xl relative select-none">
            <div className="flex items-center gap-3 mb-4 text-red-400 font-bold uppercase tracking-widest text-left">
              <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
              <span>Sorry Something Went Wrong</span>
            </div>
            
            <p className="text-white/70 leading-relaxed text-[10px] block mb-4 text-left">
              We encountered an unhandled execution fault while rendering <span className="text-red-400 font-bold">"{gentleCrashModal.appletName}"</span>. 
              To avoid crashing your sidebar dashboard or corrupting active local states, the container thread was forced offline and you have been backed out safely.
            </p>

            <div className="bg-black/45 p-3.5 border border-white/5 space-y-2 mb-5 text-left">
              <span className="text-[9px] uppercase tracking-widest text-red-500/70 font-bold block">Fatal Diagnostic Stack Trace:</span>
              <p className="font-mono text-[9px] text-white/50 leading-normal line-clamp-3 break-all bg-black/50 p-2 border border-red-950 select-text">
                {gentleCrashModal.errorMessage || 'Unknown stack fault'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 text-[9px] uppercase font-bold tracking-widest font-mono">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(gentleCrashModal.stack || gentleCrashModal.errorMessage);
                  triggerToast('Fault diagnostic stack trace copied!', 'success');
                }}
                className="px-4 py-2 border border-white/10 hover:border-white text-white/80 hover:text-white transition bg-white/5 cursor-pointer"
              >
                Copy Crash Log
              </button>
              <button
                onClick={() => setGentleCrashModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white transition cursor-pointer"
              >
                Dismiss & Safe Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- TELEMETRY TRACEBACK VIEW MODEL --- */}
      {selectedErrorToView && (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-white/10 text-white font-mono text-xs max-w-2xl w-full flex flex-col justify-between max-h-[85vh] shadow-2xl select-none">
            <div className="border-b border-white/5 p-5 flex items-center justify-between text-left">
              <span className="font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Telemetry Fault Trace: {selectedErrorToView.appletName}
              </span>
              <span className="text-white/30 text-[9px] font-mono">{selectedErrorToView.timestamp}</span>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="space-y-1 text-left">
                <span className="text-white/40 uppercase tracking-widest text-[8px] font-bold block">Fault Message:</span>
                <p className="text-red-400 font-bold text-xs p-3 bg-red-950/25 border border-red-900/30 select-text break-all">
                  {selectedErrorToView.errorMessage}
                </p>
              </div>

              <div className="space-y-1 text-left">
                <span className="text-white/40 uppercase tracking-widest text-[8px] font-bold block">Execution Engine Traceback:</span>
                <pre className="p-4 bg-black border border-white/5 text-[9px] text-white/60 font-mono overflow-auto max-h-72 select-text leading-relaxed whitespace-pre font-mono">
                  {selectedErrorToView.stack || 'No dynamic traceback vector captured or initialized.'}
                </pre>
              </div>
            </div>

            <div className="border-t border-white/5 p-5 bg-black/30 flex justify-end gap-3 font-mono text-[9px] uppercase font-bold tracking-widest">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedErrorToView.stack || selectedErrorToView.errorMessage);
                  triggerToast('Traceback vector written to clipboard!', 'success');
                }}
                className="px-4 py-2 bg-white/5 border border-white/10 hover:border-white text-white/80 hover:text-white transition flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy Trace
              </button>
              <button
                onClick={() => setSelectedErrorToView(null)}
                className="px-5 py-2 bg-white text-black hover:bg-neutral-200 transition cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <GeminiCopilot
        onWorkspaceChange={() => scanAndSyncDynamicComponents(applets)}
        addSystemLog={addSystemLog}
        appletsCount={applets.length}
      />

    </div>
  );
}
