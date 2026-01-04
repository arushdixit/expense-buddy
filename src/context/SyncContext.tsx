import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { syncWithServer, initializeLocalData, syncApi, checkServerConnection } from '@/lib/sync';

interface SyncState {
    isOnline: boolean;
    isSyncing: boolean;
    pendingCount: number;
    lastSyncTime: number | null;
    lastSyncResult: { success: boolean; message: string } | null;
}

interface SyncContextType extends SyncState {
    triggerSync: () => Promise<void>;
    refreshStatus: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<SyncState>({
        isOnline: navigator.onLine,
        isSyncing: false,
        pendingCount: 0,
        lastSyncTime: null,
        lastSyncResult: null,
    });

    const refreshStatus = useCallback(async () => {
        const status = await syncApi.getSyncStatus();
        const serverReachable = await checkServerConnection();
        setState(prev => ({
            ...prev,
            isOnline: status.isOnline && serverReachable,
            pendingCount: status.pendingCount,
            lastSyncTime: status.lastSyncTime,
        }));
    }, []);

    const triggerSync = useCallback(async () => {
        setState(prev => ({ ...prev, isSyncing: true, lastSyncResult: null }));

        try {
            const result = await syncWithServer();
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
    }, [refreshStatus]);

    // Initialize on mount
    useEffect(() => {
        const init = async () => {
            await initializeLocalData();
            await refreshStatus();
        };
        init();
    }, [refreshStatus]);

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
        <SyncContext.Provider value={{ ...state, triggerSync, refreshStatus }}>
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
