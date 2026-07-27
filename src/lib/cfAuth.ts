/**
 * Cloudflare Access Auth Helper
 * Manages user identity resolved from Cloudflare Access / Google OAuth
 */

export interface CfUser {
    id: string;
    email: string;
    name?: string;
    role?: string;
}

let cachedUser: CfUser | null = null;

export const setCfUser = (user: CfUser | null) => {
    cachedUser = user;
    if (user) {
        try {
            localStorage.setItem('cf_auth_user', JSON.stringify(user));
        } catch (e) {
            console.warn('Unable to store cf_auth_user in localStorage', e);
        }
    } else {
        try {
            localStorage.removeItem('cf_auth_user');
        } catch (e) {
            console.warn('Unable to remove cf_auth_user from localStorage', e);
        }
    }
};

export const getCfUser = (): CfUser | null => {
    if (cachedUser) return cachedUser;
    try {
        const stored = localStorage.getItem('cf_auth_user');
        if (stored) {
            cachedUser = JSON.parse(stored);
            return cachedUser;
        }
    } catch {
        // Fallback if parsing fails
    }
    return null;
};

// Generate valid UUID string from email for Postgres UUID column compatibility
export const emailToValidUuid = (email: string): string => {
    let hash1 = 0;
    let hash2 = 0;
    for (let i = 0; i < email.length; i++) {
        const char = email.charCodeAt(i);
        hash1 = ((hash1 << 5) - hash1) + char;
        hash1 |= 0;
        hash2 = ((hash2 << 7) - hash2) + char;
        hash2 |= 0;
    }
    const hex1 = Math.abs(hash1).toString(16).padStart(8, '0');
    const hex2 = Math.abs(hash2).toString(16).padStart(8, '0');
    return `${hex1.slice(0, 8)}-4000-8000-${hex2.slice(0, 4)}-${hex2.padStart(12, '0').slice(-12)}`;
};

/**
 * Fetch authenticated identity from serverless endpoint /api/auth/me or Cloudflare Access identity endpoint
 */
export const fetchCfIdentity = async (): Promise<CfUser | null> => {
    try {
        const res = await fetch('/api/auth/me', {
            headers: {
                'Accept': 'application/json',
            },
            credentials: 'include',
        });

        if (res.ok) {
            const contentType = res.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await res.json();
                if (data && data.authenticated && data.user) {
                    setCfUser(data.user);
                    return data.user;
                }
            }
        }
    } catch (err) {
        console.warn('Failed to fetch /api/auth/me:', err);
    }

    // Secondary fallback: Try Cloudflare Access native identity endpoint
    try {
        const cfRes = await fetch('/cdn-cgi/access/get-identity', {
            headers: { 'Accept': 'application/json' },
            credentials: 'include',
        });
        if (cfRes.ok) {
            const contentType = cfRes.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const cfData = await cfRes.json();
                if (cfData && cfData.email) {
                    const email = cfData.email;
                    const user: CfUser = {
                        id: emailToValidUuid(email),
                        email: email,
                        name: cfData.name || email.split('@')[0],
                    };
                    setCfUser(user);
                    return user;
                }
            }
        }
    } catch (err) {
        console.warn('Failed to fetch /cdn-cgi/access/get-identity:', err);
    }

    const fallbackUser = getCfUser();
    if (fallbackUser) return fallbackUser;

    // Default dev user if running unauthenticated locally
    const defaultDevEmail = "dixit.arush@gmail.com";
    const devUser: CfUser = {
        id: emailToValidUuid(defaultDevEmail),
        email: defaultDevEmail,
        name: "Arush",
    };
    setCfUser(devUser);
    return devUser;
};
