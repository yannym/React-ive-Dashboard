import React, { Suspense } from 'react';

// Grab all .tsx files from /src/components directory dynamically
const componentsMap = (import.meta as any).glob('/src/components/*.tsx');

interface Props {
  componentName: string;
  useCohesiveInjector?: boolean;
}

export const DynamicComponentLoader: React.FC<Props> = ({ componentName, useCohesiveInjector = true }) => {
  // Try to find a exact or case-insensitive match for the componentName in our dynamic modules list
  const matchedPath = Object.keys(componentsMap).find(path => {
    const filename = path.split('/').pop() || '';
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
    return nameWithoutExt.toLowerCase() === componentName.toLowerCase();
  });

  if (!matchedPath) {
    return (
      <div className="p-10 select-none bg-black/40 min-h-[400px] flex flex-col justify-center items-center text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4 font-mono text-lg">⚠️</div>
        <h4 className="text-sm font-sans font-semibold text-white mb-1">Applet Component Not Loaded</h4>
        <p className="text-xs text-white/40 max-w-md font-mono mb-4">
          The file "/src/components/{componentName}.tsx" could not be mapped by the local bundler index.
        </p>
        <div className="bg-white/5 border border-white/10 rounded p-4 max-w-sm text-left">
          <span className="text-[9px] uppercase tracking-wider text-white/30 font-mono block mb-2">Available TSX Modules:</span>
          <div className="max-h-32 overflow-y-auto font-mono text-[10px] text-emerald-400/80 space-y-1">
            {Object.keys(componentsMap).map((k) => (
              <div key={k} className="truncate">
                • {k.split('/').pop()}
              </div>
            ))}
            {Object.keys(componentsMap).length === 0 && (
              <span className="text-white/20 italic">No custom TSX files uploaded.</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Memoize the lazy loaded component reference so that parent re-renders don't cause React to see it as a new component type and force re-mounting/suspending
  const LazyComponent = React.useMemo(() => {
    return React.lazy(componentsMap[matchedPath] as any);
  }, [matchedPath]);

  return (
    <div className={`w-full h-full relative ${useCohesiveInjector ? 'cohesive-style-injector-active' : ''}`}>
      <Suspense fallback={
        <div className="absolute inset-0 bg-[#0A0A0A] flex flex-col items-center justify-center text-center select-none z-50">
          <div className="relative mb-4">
            <div className="w-12 h-12 rounded-full border-2 border-white/5 border-t-indigo-500 animate-spin"></div>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-indigo-400">JSX</span>
          </div>
          <span className="text-xs font-mono tracking-widest text-white/40 uppercase animate-pulse">
            Compiling and packing module...
          </span>
          <span className="text-[9px] font-mono text-white/20 mt-1">
            Resolving Vite Hot-Deployment Chunks
          </span>
        </div>
      }>
        <LazyComponent />
      </Suspense>
    </div>
  );
};
