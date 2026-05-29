import React, { Component, ErrorInfo, ReactNode } from 'react';
import { safeStorage } from '../services/storage';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("React ErrorBoundary caught an exception:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-red-500 p-8 flex flex-col items-center justify-center font-mono">
          <div className="max-w-2xl w-full bg-slate-900 border-2 border-red-500 rounded-xl p-8 shadow-2xl">
            <h1 className="text-2xl font-bold text-white mb-4">🚨 RUNTIME ERROR DI DETEKSI</h1>
            <p className="text-red-400 mb-6 font-semibold">Error: {this.state.error?.message}</p>
            <p className="text-slate-400 mb-2">Stacktrace:</p>
            <pre className="bg-slate-950 p-4 rounded border border-slate-800 text-xs text-slate-300 max-h-60 overflow-auto whitespace-pre-wrap">
              {this.state.error?.stack || 'No stacktrace available'}
            </pre>
            <button 
              onClick={() => {
                try {
                  safeStorage.clear();
                } catch(e) {}
                window.location.reload();
              }}
              className="mt-6 px-6 py-2.5 bg-red-600 font-bold hover:bg-red-500 text-white rounded transition-colors"
            >
              Reset Cache & Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
