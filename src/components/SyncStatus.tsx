import React, { useState } from 'react';
import { useSync } from '@/context/SyncContext';
import { RefreshCw, Cloud, CloudOff, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export function SyncStatus() {
    const { isOnline, isSyncing, pendingCount, lastSyncTime, lastSyncResult, triggerSync } = useSync();
    const [isOpen, setIsOpen] = useState(false);

    const formatLastSync = (timestamp: number | null) => {
        if (!timestamp) return 'Never';
        const diff = Date.now() - timestamp;
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return new Date(timestamp).toLocaleDateString();
    };

    const handleSync = async () => {
        await triggerSync();
        // Keep popover open to show result
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <button
                    className={cn(
                        "relative flex items-center justify-center h-9 w-9 rounded-full transition-all duration-200",
                        "hover:bg-secondary/80 active:scale-95",
                        isOnline ? "text-primary" : "text-muted-foreground"
                    )}
                >
                    {isOnline ? (
                        <Cloud className="h-5 w-5" />
                    ) : (
                        <CloudOff className="h-5 w-5" />
                    )}
                    {pendingCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                            {pendingCount > 9 ? '9+' : pendingCount}
                        </span>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4" align="end">
                <div className="space-y-4">
                    {/* Connection Status */}
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "h-3 w-3 rounded-full",
                            isOnline ? "bg-green-500" : "bg-red-500"
                        )} />
                        <span className="text-sm font-medium">
                            {isOnline ? 'Connected to server' : 'Offline mode'}
                        </span>
                    </div>

                    {/* Pending Changes */}
                    {pendingCount > 0 && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                            <span>{pendingCount} pending {pendingCount === 1 ? 'change' : 'changes'}</span>
                        </div>
                    )}

                    {/* Last Sync */}
                    <div className="text-sm text-muted-foreground">
                        Last synced: {formatLastSync(lastSyncTime)}
                    </div>

                    {/* Sync Result */}
                    {lastSyncResult && (
                        <div className={cn(
                            "text-sm p-2 rounded-lg",
                            lastSyncResult.success
                                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                : "bg-red-500/10 text-red-600 dark:text-red-400"
                        )}>
                            <div className="flex items-center gap-2">
                                {lastSyncResult.success ? (
                                    <Check className="h-4 w-4" />
                                ) : (
                                    <AlertCircle className="h-4 w-4" />
                                )}
                                <span>{lastSyncResult.message}</span>
                            </div>
                        </div>
                    )}

                    {/* Sync Button */}
                    <Button
                        onClick={handleSync}
                        disabled={isSyncing || !isOnline}
                        className="w-full"
                        variant="default"
                    >
                        <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
                        {isSyncing ? 'Syncing...' : 'Sync Now'}
                    </Button>

                    {!isOnline && (
                        <p className="text-xs text-muted-foreground text-center">
                            Connect to your local network to sync
                        </p>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
