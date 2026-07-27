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
            const data = await res.json();
            if (data && data.authenticated && data.user) {
                setCfUser(data.user);
                return data.user;
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
            const cfData = await cfRes.json();
            if (cfData && cfData.email) {
                // Generate simple deterministic ID from email
                const email = cfData.email;
                const user: CfUser = {
                    id: email.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
                    email: email,
                    name: cfData.name || email.split('@')[0],
                };
                setCfUser(user);
                return user;
            }
        }
    } catch (err) {
        console.warn('Failed to fetch /cdn-cgi/access/get-identity:', err);
    }

    return getCfUser();
};
