// src/components/common/ErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error in component:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '32px 20px',
            textAlign: 'center',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1.5px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            margin: '20px auto',
            maxWidth: '480px',
            fontFamily: 'var(--font-jakarta), sans-serif',
            color: '#1E1B4B',
          }}
        >
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
          <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>
            {this.props.fallbackTitle || 'Terjadi Kendala Teknis'}
          </h3>
          <p style={{ fontSize: '14px', opacity: 0.8, marginBottom: '20px' }}>
            {this.state.error?.message || 'Komponen mengalami masalah saat merender.'}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              background: '#4F46E5',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Muat Ulang Komponen
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
