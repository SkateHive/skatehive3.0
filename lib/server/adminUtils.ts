// Server-side admin utilities - NEVER expose this to client
// This file should only be used in API routes

// Support both server-only and public-prefixed env var names. The project
// uses NEXT_PUBLIC_ADMIN_USERS in production; ADMIN_USERS is kept as a
// fallback so a server-only override still works.
const ADMIN_USERS = (
  process.env.ADMIN_USERS ||
  process.env.NEXT_PUBLIC_ADMIN_USERS ||
  ''
)
  .split(',')
  .map((u) => u.trim().toLowerCase())
  .filter(Boolean);

export const isServerSideAdmin = (username: string): boolean => {
    if (!username) return false;
    return ADMIN_USERS.includes(username.toLowerCase());
};

export const logSecurityAttempt = (
    username: string | undefined,
    operation: string,
    request: Request,
    success: boolean = false
) => {
    const logData = {
        username: username || 'anonymous',
        operation,
        success,
        timestamp: new Date().toISOString(),
        ip: request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
    };

    if (success) {
    } else {
        console.warn('🚫 [SECURITY] Unauthorized admin attempt:', logData);
    }
};

export const createUnauthorizedResponse = () => {
    return Response.json(
        {
            success: false,
            message: 'Access Denied: Admin privileges required. This attempt has been logged.'
        },
        { status: 403 }
    );
};
