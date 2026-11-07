import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home, ShieldAlert, Trash2 } from 'lucide-react';
import { clearAdminToken } from '../utils/api';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleClearSessionAndReload = () => {
    try {
      clearAdminToken();
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = window.location.pathname.startsWith('/admin') ? '/admin' : '/';
      }
    } catch {
      window.location.reload();
    }
  };

  private handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  public render() {
    if (this.state.hasError) {
      const isCritical = Boolean(this.state.error);
      const title = this.props.fallbackTitle || 'Administrator Portal Encountered an Issue';

      return (
        <div className="min-h-[400px] w-full flex items-center justify-center p-4 sm:p-6 bg-[#030c1d] text-slate-100">
          <div className="w-full max-w-lg rounded-2xl bg-[#061533] border border-red-500/50 shadow-2xl p-6 sm:p-8 text-center animate-fade-in">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-950/60 border border-red-600/40 text-red-400 flex items-center justify-center">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-black text-white mb-2">{title}</h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
              A temporary runtime error was prevented from breaking your screen. You can safely reload the portal or clear the cached session.
            </p>

            {this.state.error && (
              <div className="mb-6 p-3 rounded-xl bg-slate-950/80 border border-red-900/60 text-left font-mono text-[11px] text-red-300 overflow-x-auto max-h-32">
                <div className="font-bold text-red-400 mb-1 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{this.state.error.name}: {this.state.error.message}</span>
                </div>
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-[10px] text-slate-500 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack.slice(0, 300)}...
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="tap-bounce px-4 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-yellow-400/20"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Page</span>
              </button>

              <button
                type="button"
                onClick={this.handleClearSessionAndReload}
                className="tap-bounce px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
                title="Clears corrupted localStorage cache and reloads"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
                <span>Reset Local Session</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="tap-bounce px-4 py-2.5 rounded-xl bg-blue-950/80 hover:bg-blue-900/80 text-blue-200 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 border border-blue-800/60 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Giveaway Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
