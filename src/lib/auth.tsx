import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import {
  readAnonPredictions,
  clearAnonPredictions,
} from "./anonPredictions";

/** Migrate any locally-stored anonymous predictions into the user's account. */
async function migrateAnonPredictions(userId: string): Promise<void> {
  const anon = readAnonPredictions();
  if (anon.length === 0) return;
  const now = new Date().toISOString();
  const rows = anon.map((p) => ({
    user_id: userId,
    match_id: p.match_id,
    competition_id: p.competition_id,
    home_score: p.home_score,
    away_score: p.away_score,
    quick_pick: p.quick_pick,
    is_joker: p.is_joker,
    confidence: p.confidence,
    updated_at: now,
  }));
  const { error } = await supabase
    .from("yc_predictions")
    .upsert(rows, { onConflict: "user_id,competition_id,match_id" });
  if (error) {
    console.error("Failed to migrate anon predictions:", error.message);
    return;
  }
  clearAnonPredictions();
}

export interface Profile {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, handle: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, handle, display_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.error("Failed to fetch profile:", error.message);
      return;
    }
    setProfile(data);
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) fetchProfile(s.user.id);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id);
        // Only migrate on actual sign-in events, not on session restore /
        // token refresh. Avoids re-running migration every page reload.
        if (event === "SIGNED_IN") {
          migrateAnonPredictions(s.user.id);
        }
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }, []);

  const signUp = useCallback(async (email: string, password: string, handle: string) => {
    const normalizedHandle = handle.toLowerCase();

    // Check handle availability before creating auth user
    const { data: existing } = await supabase
      .from("profiles")
      .select("handle")
      .eq("handle", normalizedHandle)
      .maybeSingle();
    if (existing) return "Handle already taken. Try a different one.";

    // Create auth user
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return error.message;
    if (!data.user) return "Sign up failed";

    // Create profile row (unified YancoVerse profile)
    // profiles_public is auto-synced by trg_sync_profiles_public_from_profiles trigger
    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      handle: normalizedHandle,
      display_name: handle,
    });
    if (profileError) return profileError.message;

    return null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, session, loading, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
