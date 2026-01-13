import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { syncWithServer, syncApi, checkServerConnection } from '@/lib/sync';
import { useAuth } from './AuthContext';

interface SyncState {
    isOnline: boolean;
    isSyncing: boolean;
    pendingCount: number;
    lastSyncTime: number | null;
    lastSyncResult: { success: boolean; message: string } | null;
    isStorageBlocked: boolean;
}

// Callback type for sync completion notification
type SyncCompleteCallback = () => void;

interface SyncContextType extends SyncState {
    triggerSync: () => Promise<void>;
    refreshStatus: () => Promise<void>;
    registerSyncCallback: (callback: SyncCompleteCallback) => void;
    unregisterSyncCallback: (callback: SyncCompleteCallback) => void;
}

const SyncContext = createContext<SyncContextType | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
    const { householdId } = useAuth();
    const [state, setState] = useState<SyncState>({
        isOnline: navigator.onLine,
        isSyncing: false,
        pendingCount: 0,
        lastSyncTime: null,
        lastSyncResult: null,
        isStorageBlocked: false,
    });

    // Store registered callbacks for sync completion
    const syncCallbacksRef = useRef<Set<SyncCompleteCallback>>(new Set());
    // Track if initial auto-sync has been done
    const hasInitialSync = useRef(false);

    const registerSyncCallback = useCallback((callback: SyncCompleteCallback) => {
        syncCallbacksRef.current.add(callback);
    }, []);

    const unregisterSyncCallback = useCallback((callback: SyncCompleteCallback) => {
        syncCallbacksRef.current.delete(callback);
    }, []);

    // Notify all registered callbacks that sync is complete
    const notifySyncComplete = useCallback(() => {
        syncCallbacksRef.current.forEach(callback => {
            try {
                callback();
            } catch (err) {
                console.error('Sync callback error:', err);
            }
        });
    }, []);

    const refreshStatus = useCallback(async () => {
        try {
            const [status, serverReachable] = await Promise.all([
                syncApi.getSyncStatus(),
                checkServerConnection()
            ]);

            setState(prev => ({
                ...prev,
                pendingCount: status.pendingCount,
                lastSyncTime: status.lastSyncTime,
                isOnline: status.isOnline && serverReachable,
                isStorageBlocked: !!status.isStorageBlocked,
            }));
        } catch (error) {
            console.error('Failed to refresh sync status:', error);
            // If it's a security error or unknown error, mark storage as blocked
            const isSecurityError = error instanceof Error &&
                (error.name === 'SecurityError' || error.name === 'UnknownError' || error.message.includes('denied'));

            setState(prev => ({ ...prev, isStorageBlocked: isSecurityError || prev.isStorageBlocked }));
        }
    }, []);

    const triggerSync = useCallback(async () => {
        if (state.isStorageBlocked) return;

        setState(prev => ({ ...prev, isSyncing: true, lastSyncResult: null }));

        try {
            const result = await syncWithServer(householdId);
            setState(prev => ({
                ...prev,
                isSyncing: false,
                pendingCount: result.success ? 0 : prev.pendingCount,
                lastSyncTime: result.success ? Date.now() : prev.lastSyncTime,
                lastSyncResult: {
                    success: result.success,
                    message: result.success
                        ? `Synced: ${result.pushed} pushed, ${result.pulled} updated`
                        : result.errors.join(', '),
                },
            }));

            // Notify registered callbacks after successful sync
            if (result.success) {
                notifySyncComplete();
            }
        } catch (err) {
            setState(prev => ({
                ...prev,
                isSyncing: false,
                lastSyncResult: {
                    success: false,
                    message: err instanceof Error ? err.message : 'Sync failed',
                },
            }));
        }

        await refreshStatus();
    }, [refreshStatus, notifySyncComplete, householdId, state.isStorageBlocked]);

    // Initialize on mount and trigger auto-sync
    useEffect(() => {
        const init = async () => {
            try {
                await refreshStatus();

                // Auto-sync on app open if server is available (but only once)
                if (!hasInitialSync.current && householdId && !state.isStorageBlocked) {
                    hasInitialSync.current = true;
                    const serverAvailable = await checkServerConnection();
                    if (serverAvailable) {
                        // Small delay to let UI render first
                        setTimeout(async () => {
                            setState(prev => ({ ...prev, isSyncing: true }));
                            try {
                                const result = await syncWithServer(householdId);
                                setState(prev => ({
                                    ...prev,
                                    isSyncing: false,
                                    pendingCount: result.success ? 0 : prev.pendingCount,
                                    lastSyncTime: result.success ? Date.now() : prev.lastSyncTime,
                                    lastSyncResult: null, // Don't show result for auto-sync
                                }));
                                // Notify callbacks after auto-sync
                                if (result.success) {
                                    notifySyncComplete();
                                }
                            } catch {
                                setState(prev => ({ ...prev, isSyncing: false }));
                            }
                            await refreshStatus();
                        }, 500);
                    }
                }
            } catch (err) {
                console.error('Initialization error:', err);
            }
        };
        init();
    }, [refreshStatus, notifySyncComplete, householdId, state.isStorageBlocked]);


    // Listen for online/offline changes
    useEffect(() => {
        const handleOnline = () => refreshStatus();
        const handleOffline = () => setState(prev => ({ ...prev, isOnline: false }));

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [refreshStatus]);

    // Refresh status periodically (every 30 seconds)
    useEffect(() => {
        const interval = setInterval(refreshStatus, 30000);
        return () => clearInterval(interval);
    }, [refreshStatus]);

    return (
        <SyncContext.Provider value={{ ...state, triggerSync, refreshStatus, registerSyncCallback, unregisterSyncCallback }}>
            {children}
        </SyncContext.Provider>
    );
}

export function useSync() {
    const context = useContext(SyncContext);
    if (!context) {
        throw new Error('useSync must be used within a SyncProvider');
    }
    return context;
}
