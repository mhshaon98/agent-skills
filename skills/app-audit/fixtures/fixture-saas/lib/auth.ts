import { createSupabaseServerClient } from './supabase/server';

export type SessionUser = {
  id: string;
  email: string;
};

/** Returns the signed-in user, or null for anonymous callers. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;

  return { id: data.user.id, email: data.user.email ?? '' };
}

/** Throws a 401-shaped error when there is no session. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const err = new Error('Not authenticated') as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  return user;
}
