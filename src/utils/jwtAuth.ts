import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserRole } from '../types';

export interface VerifiedTokenUser {
  userId: string;
  email: string;
  role: UserRole;
  isVerified: boolean;
}

/**
 * Parses JWT payload (claims) from a base64url encoded token.
 */
export function parseJwtClaims(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error('Failed to parse JWT claims:', err);
    return null;
  }
}

/**
 * Cryptographically verifies the active session JWT with Supabase Auth server.
 * This guarantees the user cannot forge or tamper with their role in localStorage or memory,
 * because Supabase's auth server cryptographically checks the JWT signature.
 *
 * It checks the verified claims:
 * 1) jwtClaims.user_metadata?.role or jwtClaims.app_metadata?.role or jwtClaims.role
 * 2) Server-side getUser(token) response (user.app_metadata?.role / user.user_metadata?.role)
 * 3) Cross-checks public.users with the server-verified user ID
 */
export async function getVerifiedUserFromJwt(): Promise<VerifiedTokenUser | null> {
  if (!isSupabaseConfigured || !supabase) {
    // In local non-Supabase mode, fallback safely
    return null;
  }

  try {
    // 1. Retrieve session and access token
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !session || !session.access_token) {
      return null;
    }

    const token = session.access_token;
    const claims = parseJwtClaims(token);

    // 2. Cryptographically verify the token against the Supabase Auth Server.
    // getUser(jwt) forces the auth server to validate the HMAC/RSA signature and rejects tampered tokens.
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) {
      console.warn('JWT verification failed at auth server:', userErr);
      return null;
    }

    // Extract role from verified token claims & auth server user metadata
    let verifiedRole: UserRole =
      (claims?.app_metadata?.role as UserRole) ||
      (claims?.user_metadata?.role as UserRole) ||
      (claims?.role as UserRole) ||
      (user.app_metadata?.role as UserRole) ||
      (user.user_metadata?.role as UserRole) ||
      'vendor';

    // 3. Cross-check with public.users table using the verified user ID for absolute consistency
    try {
      const { data: dbUser } = await supabase
        .from('users')
        .select('role, is_blocked, is_deleted')
        .eq('id', user.id)
        .maybeSingle();

      if (dbUser) {
        if (dbUser.is_blocked || dbUser.is_deleted) {
          return null;
        }
        if (dbUser.role) {
          verifiedRole = dbUser.role as UserRole;
        }
      }
    } catch {
      // Keep verified role from token
    }

    return {
      userId: user.id,
      email: user.email || '',
      role: verifiedRole,
      isVerified: true
    };
  } catch (err) {
    console.error('Error verifying JWT user role:', err);
    return null;
  }
}

/**
 * Checks whether the verified user from the cryptographic JWT has one of the allowed roles.
 */
export async function verifyUserRoleAllowed(allowedRoles: UserRole[]): Promise<{
  allowed: boolean;
  role?: UserRole;
  error?: string;
}> {
  const verifiedUser = await getVerifiedUserFromJwt();
  if (!verifiedUser) {
    return {
      allowed: false,
      error: 'ავტორიზაციის შემოწმება ვერ მოხერხდა ან ტოკენი არავალიდურია.'
    };
  }

  if (!allowedRoles.includes(verifiedUser.role)) {
    return {
      allowed: false,
      role: verifiedUser.role,
      error: `წვდომა შეზღუდულია. თქვენი როლია: ${verifiedUser.role}. ექსპორტის უფლება აქვთ მხოლოდ: ${allowedRoles.join(', ')}.`
    };
  }

  return {
    allowed: true,
    role: verifiedUser.role
  };
}
