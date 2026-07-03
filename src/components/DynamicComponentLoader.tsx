import React, { Suspense, useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Copy, Check, Wrench, RefreshCw, FileText, Sparkles } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import * as MotionReact from 'motion/react';
import { readFile } from '../lib/filesystem';

// Grab all pre-built .tsx files from /src/components directory dynamically for instant loading
const componentsMap = (import.meta as any).glob('/src/components/*.tsx');

interface Props {
  componentName: string;
  useCohesiveInjector?: boolean;
}

export const DynamicComponentLoader: React.FC<Props> = ({ componentName, useCohesiveInjector = true }) => {
  // 1. Check if the component is pre-bundled in Vite's static index
  const matchedPath = Object.keys(componentsMap).find(path => {
    const filename = path.split('/').pop() || '';
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
    return nameWithoutExt.toLowerCase() === componentName.toLowerCase();
  });

  // 2. States for our Dynamic on-the-fly compiler/runner fallback
  const [compiledComponent, setCompiledComponent] = useState<React.ComponentType<any> | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Auto-Fixer States
  const [isFixing, setIsFixing] = useState(false);
  const [fixStatus, setFixStatus] = useState<{ type: 'idle' | 'success' | 'error' | 'info'; msg: string }>({
    type: 'idle',
    msg: ''
  });

  // Load the dynamic component if not present in pre-bundled map or when reloadKey changes
  useEffect(() => {
  if (matchedPath && reloadKey === 0) {
    setCompiledComponent(null);
    setCompileError(null);
    return;
  }

  setIsLoading(true);
  setCompileError(null);

  const addLog = (window as any).addSystemLog || (() => {});
  addLog('info', 'compiler', `Babel on-the-fly compiler: Compiling "${componentName}.tsx" client-side...`);

  // 1. Retrieve the raw TSX code (either from LocalStorage cache, synced list, or static asset)
  const sourceUrl = `./src/components/${componentName}.tsx`;
  
  // Tier A: Check dedicated custom_component_code cache in localStorage
  let resolvedCode = localStorage.getItem(`custom_component_code:${componentName}`);
  
  // Tier B: Check if embedded in synced applets array in localStorage
  if (!resolvedCode) {
    try {
      const storedApplets = localStorage.getItem('applet_dashboard_configs');
      if (storedApplets) {
        const appletsList = JSON.parse(storedApplets);
        const matchingApplet = appletsList.find((a: any) => 
          a.url === `internal:component:${componentName}` || 
          a.name?.toLowerCase() === componentName.toLowerCase()
        );
        if (matchingApplet?.sourceCode) {
          resolvedCode = matchingApplet.sourceCode;
          addLog('info', 'compiler', `Resolved TSX source code for "${componentName}" from synced metadata.`);
        }
      }
    } catch (e) {
      console.warn('Error reading source code from applet configs cache:', e);
    }
  }

  const loadSourcePromise = resolvedCode 
    ? Promise.resolve(resolvedCode)
    : readFile(`src/components/${componentName}.tsx`)
        .then(res => res.content)
        .catch(() => {
          addLog('warn', 'compiler', `Failed virtual file read for "${componentName}.tsx". Falling back to static assets fetch...`);
          return fetch(sourceUrl).then(async (res) => {
            if (!res.ok) throw new Error(`Could not load source file ${componentName}.tsx from server (HTTP ${res.status}: ${res.statusText})`);
            return res.text();
          });
        });

  loadSourcePromise
    .then(async (rawCode) => {
      addLog('info', 'compiler', `Fetched source for "${componentName}.tsx". Preparing in-browser Babel compiler...`, `Source length: ${rawCode.length} characters.`);
      // 2. Dynamically load the Babel compiler script if not already loaded
      if (!(window as any).Babel) {
        addLog('info', 'compiler', 'Loading @babel/standalone compiler script from unpkg CDN...');
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/@babel/standalone/babel.min.js';
          script.onload = () => {
            addLog('success', 'compiler', 'Babel compiler loaded successfully.');
            resolve();
          };
          script.onerror = () => {
            addLog('error', 'compiler', 'CDN script load failed for @babel/standalone');
            reject(new Error('Failed to load in-browser compiler (Babel)'));
          };
          document.head.appendChild(script);
        });
      }

      // 3. Compile/Transpile TSX -> JS inside the browser!
      addLog('info', 'compiler', 'Transpiling TSX to ECMAScript standard...');
      let transpiledCode = '';
      try {
        const result = (window as any).Babel.transform(rawCode, {
          presets: ['react', 'typescript'],
          filename: `${componentName}.tsx` // Required for TSX parser
        });
        transpiledCode = result.code;
        addLog('success', 'compiler', `Transpiled "${componentName}.tsx" successfully. Code size: ${transpiledCode.length} chars.`);
      } catch (babelErr: any) {
        addLog('error', 'compiler', `Babel transpile error on "${componentName}.tsx": ${babelErr.message}`, babelErr.stack || babelErr.toString());
        throw babelErr;
      }

      // 4. Setup sandboxed require map just like your server-based compiler did
      const customRequire = (moduleName: string) => {
        const name = moduleName.toLowerCase();
        if (name === 'react') return React;
        if (name === 'react-dom') return (window as any).ReactDOM || React;
        if (name === 'lucide-react') return LucideIcons;
        if (name === 'motion' || name === 'motion/react' || name === 'framer-motion') return MotionReact;
        if ((window as any)[moduleName]) return (window as any)[moduleName];
        throw new Error(`Module "${moduleName}" is not pre-installed in the dashboard sandbox.`);
      };

      const exports: any = {};
      const module = { exports };

      // 5. Evaluate the browser-transpiled CommonJS code
      addLog('info', 'compiler', `Evaluating sandboxed module scope for "${componentName}"...`);
      try {
        const evaluator = new Function('require', 'module', 'exports', transpiledCode);
        evaluator(customRequire, module, exports);
      } catch (evalErr: any) {
        addLog('error', 'compiler', `Runtime evaluation failed for "${componentName}.tsx": ${evalErr.message}`, evalErr.stack || evalErr.toString());
        throw evalErr;
      }

      const Component = module.exports.default || module.exports;
      if (typeof Component !== 'function' && typeof Component !== 'object') {
        const msg = 'Compiled bundle did not export a valid React component. Ensure you have a default export (e.g. "export default function MyComponent ...").';
        addLog('error', 'compiler', msg);
        throw new Error(msg);
      }

      addLog('success', 'compiler', `Successfully instantiated "${componentName}"! Component is now active.`);
      setCompiledComponent(() => Component);
    })
    .catch((err: any) => {
      console.error('Dynamic browser-loader failed:', err);
      const msg = err.message || 'An error occurred during client-side compilation.';
      setCompileError(msg);
      addLog('error', 'compiler', `Dynamic compilation failed: ${msg}`, err.stack || err.toString());
    })
    .finally(() => {
      setIsLoading(false);
    });
}, [componentName, matchedPath, reloadKey]);

  // Utility to copy error to clipboard
  const copyErrorToClipboard = () => {
    if (!compileError) return;
    navigator.clipboard.writeText(compileError);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Perform dynamic workspace auto-fixing on the source code
  const handleAutoFix = async () => {
    setIsFixing(true);
    setFixStatus({ type: 'idle', msg: '' });
    try {
      const readRes = await fetch('/api/files/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `src/components/${componentName}.tsx` })
      });

      if (!readRes.ok) {
        throw new Error('Failed to read component source file. Please verify that the file exists in /src/components/');
      }

      const fileData = await readRes.json();
      let code = fileData.content || '';
      const appliedFixes: string[] = [];

      // 1. Fix capitalized "React" import
      if (/from\s+['"]React['"]/g.test(code)) {
        code = code.replace(/from\s+['"]React['"]/g, "from 'react'");
        appliedFixes.push("Corrected capitalized package import ('React' -> 'react')");
      }

      // 2. Fix framer-motion imports to motion/react
      if (/from\s+['"]framer-motion['"]/g.test(code)) {
        code = code.replace(/from\s+['"]framer-motion['"]/g, "from 'motion/react'");
        appliedFixes.push("Rewrote legacy 'framer-motion' import to high-performance 'motion/react'");
      }

      // 3. Fix missing export default statement
      if (!/export\s+default\s+/g.test(code)) {
        const namedExportMatch = code.match(/export\s+(?:function|const|class)\s+([a-zA-Z0-9_]+)/);
        if (namedExportMatch && namedExportMatch[1]) {
          const foundName = namedExportMatch[1];
          // Ensure it's uppercase (likely a component) and not a hook or utility
          if (foundName[0] === foundName[0].toUpperCase()) {
            code += `\n\n// Debugger Auto-Fix: Added missing default export\nexport default ${foundName};\n`;
            appliedFixes.push(`Appended missing 'export default ${foundName}' to enable bundler discovery`);
          }
        }
      }

      // 4. Fix deep/incorrect Lucide-react subpath imports
      if (/from\s+['"]lucide-react\/[^\s'"]+['"]/g.test(code)) {
        code = code.replace(/from\s+['"]lucide-react\/[^\s'"]+['"]/g, "from 'lucide-react'");
        appliedFixes.push("Normalized deep nested icon imports to standard package-level 'lucide-react'");
      }

      // 5. Check if there are any fixes to write
      if (appliedFixes.length === 0) {
        setFixStatus({
          type: 'info',
          msg: 'No standard issues (capitalized React, legacy framer-motion, missing default export) detected in code. Please copy the error message to the AI for advanced repair!'
        });
        return;
      }

      // Save the fixed file back
      const writeRes = await fetch('/api/files/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `src/components/${componentName}.tsx`,
          content: code
        })
      });

      if (!writeRes.ok) {
        throw new Error('Failed to write changes back to the workspace file system.');
      }

      setFixStatus({
        type: 'success',
        msg: `Applied successfully:\n${appliedFixes.map(f => `• ${f}`).join('\n')}`
      });

      // Force refreshing the compiled component
      setReloadKey(prev => prev + 1);
    } catch (err: any) {
      setFixStatus({
        type: 'error',
        msg: err.message || 'An error occurred while running the workspace auto-fixer'
      });
    } finally {
      setIsFixing(false);
    }
  };

  // If Vite pre-built it and we haven't hit a compile error, use standard React.lazy
  const LazyComponent = useMemo(() => {
    if (matchedPath && !compiledComponent) {
      return React.lazy(componentsMap[matchedPath] as any);
    }
    return null;
  }, [matchedPath, compiledComponent]);

  // Render the appropriate component
  const ComponentToRender = compiledComponent || LazyComponent;

  // Render loading state
  if (isLoading) {
    return (
      <div className="absolute inset-0 bg-[#0C0C0C] flex flex-col items-center justify-center text-center select-none z-50">
        <div className="relative mb-4">
          <div className="w-12 h-12 rounded-full border-2 border-white/5 border-t-emerald-500 animate-spin"></div>
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono text-emerald-400">JSX</span>
        </div>
        <span className="text-xs font-mono tracking-widest text-white/50 uppercase animate-pulse">
          Compiling & Bundling...
        </span>
        <span className="text-[10px] font-mono text-white/30 mt-1">
          Running on-the-fly esbuild compiler
        </span>
      </div>
    );
  }

  // Render Compile/Evaluation Error screen (with copy-text, clipboard buttons, and auto-debugger)
  if (compileError || (!matchedPath && !ComponentToRender)) {
    const displayError = compileError || `The component file "src/components/${componentName}.tsx" was not found in the bundler's index mapping.`;
    return (
      <div className="p-6 md:p-8 bg-[#0D0D0D] border border-white/5 rounded-lg min-h-[480px] flex flex-col justify-between text-left select-text max-w-4xl mx-auto my-4 shadow-2xl">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-rose-500 font-mono text-xs uppercase tracking-widest border-b border-rose-500/10 pb-3">
            <AlertTriangle className="w-4 h-4" />
            <span>Applet Deployment Exception Detected</span>
          </div>

          <div>
            <h4 className="text-base font-sans font-medium text-white mb-1">
              Could not mount component <span className="font-mono text-emerald-400 text-sm">"{componentName}"</span>
            </h4>
            <p className="text-xs text-white/50 leading-relaxed font-sans mb-3">
              This error occurs because the client bundle index was compiled earlier, or the TSX module has a structural/import syntax mismatch.
            </p>
          </div>

          {/* Copyable code message box */}
          <div className="relative group bg-red-500/5 border border-red-500/15 rounded p-4 font-mono text-xs text-red-400 max-h-48 overflow-auto select-text">
            <div className="absolute right-2 top-2 z-10">
              <button
                onClick={copyErrorToClipboard}
                className="p-1.5 rounded bg-black/40 hover:bg-black/80 border border-white/15 text-white/60 hover:text-white transition-all cursor-pointer flex items-center gap-1 text-[10px]"
                title="Copy error message to clipboard"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="whitespace-pre-wrap font-mono select-text">{displayError}</pre>
          </div>

          {/* Diagnosis / Auto-Fix Tool */}
          <div className="bg-[#141414] border border-white/10 rounded p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-emerald-500 animate-pulse" />
                <span className="text-xs uppercase tracking-wider text-white/80 font-mono font-bold">On-The-Fly Auto-Debugger</span>
              </div>
              <span className="text-[10px] font-mono text-white/40 bg-white/5 px-2 py-0.5 rounded">v1.1 Stable</span>
            </div>

            <p className="text-xs text-white/60 leading-relaxed">
              Our workspace diagnostic engine can analyze <span className="font-mono text-white">src/components/{componentName}.tsx</span> and run automated fixes for common compiler bugs such as lowercase package imports, missing default exports, and legacy imports on the fly.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={handleAutoFix}
                disabled={isFixing}
                className="px-3.5 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-mono text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow"
              >
                {isFixing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {isFixing ? 'Running Auto-Fix...' : 'Analyze & Repair Module'}
              </button>

              <button
                onClick={() => setReloadKey(prev => prev + 1)}
                className="px-3 py-2 rounded bg-[#1C1C1C] hover:bg-[#2A2A2A] text-white/80 hover:text-white border border-white/10 font-mono text-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Recompile Component
              </button>
            </div>

            {/* Auto fix response outputs */}
            {fixStatus.type !== 'idle' && (
              <div className={`p-3 rounded border text-xs font-mono whitespace-pre-wrap ${
                fixStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                fixStatus.type === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                'bg-blue-500/10 border-blue-500/30 text-blue-400'
              }`}>
                <div className="flex items-center gap-1.5 font-bold mb-1 uppercase text-[10px] tracking-wide">
                  {fixStatus.type === 'success' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  {fixStatus.type === 'error' && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
                  {fixStatus.type === 'info' && <FileText className="w-3.5 h-3.5 text-blue-400" />}
                  <span>Diagnostic Output:</span>
                </div>
                {fixStatus.msg}
              </div>
            )}
          </div>
        </div>

        <div className="text-[10px] font-mono text-white/30 border-t border-white/5 pt-4 mt-6 flex items-center justify-between">
          <span>Component name reference: {componentName}</span>
          <span>Tip: Click Copy and paste this directly to your AI Assistant</span>
        </div>
      </div>
    );
  }

  // Render the dynamic component with the styling wrapper
  return (
    <div className={`w-full h-full relative ${useCohesiveInjector ? 'cohesive-style-injector-active' : ''}`}>
      <Suspense fallback={
        <div className="absolute inset-0 bg-[#0C0C0C] flex flex-col items-center justify-center text-center select-none z-50">
          <div className="relative mb-4">
            <div className="w-12 h-12 rounded-full border-2 border-white/5 border-t-emerald-500 animate-spin"></div>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono text-emerald-400">JSX</span>
          </div>
          <span className="text-xs font-mono tracking-widest text-white/50 uppercase animate-pulse">
            Resolving Component State...
          </span>
        </div>
      }>
        {ComponentToRender && React.createElement(ComponentToRender)}
      </Suspense>
    </div>
  );
};
