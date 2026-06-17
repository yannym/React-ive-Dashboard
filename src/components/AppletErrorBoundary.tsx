import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  appletName: string;
  onCrash?: (errorMessage: string, stack: string) => void;
  fallback?: ReactNode;
  children: ReactNode;
  key?: string | number;
}

interface State {
  hasError: boolean;
  errorMessage: string;
  errorStack: string;
}

export class AppletErrorBoundary extends React.Component<Props, State> {
  props!: Props;
  state!: State;
  setState!: any;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      errorStack: ''
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { 
      hasError: true, 
      errorMessage: error.message || String(error),
      errorStack: error.stack || ''
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`ErrorBoundary caught error in Applet [${this.props.appletName}]:`, error, errorInfo);
    
    if (this.props.onCrash) {
      const fullStack = `${error.stack || ''}\n\nComponent Stack:\n${errorInfo.componentStack || ''}`;
      this.props.onCrash(error.message || String(error), fullStack);
    }
  }

  public handleReset = () => {
    this.setState({ hasError: false, errorMessage: '', errorStack: '' });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-6 select-none text-red-400 bg-red-950/20 border border-red-900/30 m-4 rounded flex flex-col items-center justify-center font-mono text-xs text-center" id="applet-tile-isolated-crash">
          <AlertCircle className="w-8 h-8 text-red-500/40 mb-2 shrink-0 animate-pulse" />
          <h4 className="font-bold text-white text-xs mb-1 uppercase tracking-widest">Instance Interrupted</h4>
          <p className="max-w-xs text-white/50 text-[10px] leading-relaxed mb-3">
            The component "{this.props.appletName}" threw an unhandled runtime exception.
          </p>
          <div className="bg-black/60 border border-white/5 p-3 rounded text-left w-full select-text overflow-x-auto font-mono text-[9px] text-red-300/90 max-h-28 mb-3 whitespace-pre-wrap">
            <span className="text-white font-bold block mb-1">Reason:</span>
            {this.state.errorMessage}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={this.handleReset}
              className="px-3 py-1.5 bg-red-950 hover:bg-red-900 border border-red-800 text-[9px] font-bold text-white uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Hot Reload Tile
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
