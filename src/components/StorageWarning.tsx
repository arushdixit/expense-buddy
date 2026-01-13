import React from 'react';
import { useSync } from '@/context/SyncContext';
import { AlertCircle, Database } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export const StorageWarning: React.FC = () => {
    const { isStorageBlocked } = useSync();

    if (!isStorageBlocked) return null;

    return (
        <div className="p-4 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
            <Alert variant="destructive" className="border-red-500/50 bg-red-500/10 backdrop-blur-md">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Storage Access Denied</AlertTitle>
                <AlertDescription className="text-xs space-y-2">
                    <p>
                        Your browser is blocking access to local storage (IndexedDB).
                        This usually happens in Incognito mode or when "Third-party cookies" are blocked in browser settings.
                    </p>
                    <p>
                        The app will not work correctly without storage. Please enable storage to continue.
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 h-7 text-[10px]"
                        onClick={() => window.location.reload()}
                    >
                        Try Refreshing
                    </Button>
                </AlertDescription>
            </Alert>
        </div>
    );
};
