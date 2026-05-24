import React, { type ReactNode, type ErrorInfo } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

// React 19 strict types require casting for class component internals
type SelfRef = { state: ErrorBoundaryState; props: ErrorBoundaryProps; setState: (s: Partial<ErrorBoundaryState>) => void };

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        (this as unknown as SelfRef).state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);

        // Auto-reload once for chunk load failures (e.g. after a new deployment)
        const isChunkError =
            error.message?.includes('dynamically imported module') ||
            error.message?.includes('Failed to fetch') ||
            error.message?.includes('Loading chunk') ||
            error.message?.includes('Loading CSS chunk');

        const STORAGE_KEY = 'chunk_error_reload';
        if (isChunkError && !sessionStorage.getItem(STORAGE_KEY)) {
            sessionStorage.setItem(STORAGE_KEY, '1');
            window.location.reload();
            return;
        }
    }

    handleReload = () => {
        window.location.reload();
    };

    handleDismiss = () => {
        (this as unknown as SelfRef).setState({ hasError: false, error: null });
    };

    render() {
        const self = this as unknown as SelfRef;
        if (self.state.hasError) {
            return (
                <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6 dark:bg-gray-950">
                    <div className="w-full max-w-lg rounded-3xl bg-white p-10 text-center shadow-2xl dark:bg-gray-900">
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                            <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                            </svg>
                        </div>
                        <h1 className="mb-3 text-2xl font-bold text-gray-900 dark:text-white">
                            Có lỗi xảy ra
                        </h1>
                        <p className="mb-6 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                            Ứng dụng gặp sự cố không mong muốn. Bạn có thể tải lại trang hoặc thử tiếp tục sử dụng.
                        </p>
                        {self.state.error && (
                            <details className="mb-6 rounded-xl bg-gray-100 p-4 text-left dark:bg-gray-800">
                                <summary className="cursor-pointer text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                                    Chi tiết lỗi
                                </summary>
                                <pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs text-red-600 dark:text-red-400">
                                    {self.state.error.message}
                                </pre>
                            </details>
                        )}
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={this.handleDismiss}
                                className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                                Thử tiếp tục
                            </button>
                            <button
                                type="button"
                                onClick={this.handleReload}
                                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700"
                            >
                                Tải lại trang
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return self.props.children;
    }
}
