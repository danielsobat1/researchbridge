// lib/auth.ts - Simple auth utilities

export type UserProfile = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  age?: number;
  university?: string;
  interests: string[];
  verified: boolean;
  createdAt: string;
  lastForYouView?: string; // ISO date string of last time user viewed for-you page
  lastInterestsHash?: string; // Hash of interests to detect changes
  resumeKeywords?: string[]; // Keywords extracted from user's uploaded resume
};

const STORAGE_KEY = "rb_user";
const VERIFICATION_TOKENS_KEY = "rb_verify_tokens";
const HAS_SUPABASE = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export function saveUser(user: UserProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function updateUser(updates: Partial<UserProfile>): UserProfile | null {
  const user = getUser();
  if (!user) return null;
  
  const updated = { ...user, ...updates };
  saveUser(updated);
  return updated;
}

export function getUser(): UserProfile | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : null;
}

export function logout(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidUsername(username: string): boolean {
  // Username must be 3-20 chars, alphanumeric + underscore/hyphen
  return /^[a-zA-Z0-9_-]{3,20}$/.test(username);
}

export function generateUserId(): string {
  return "user_" + Math.random().toString(36).substring(2, 11);
}

export function generateVerificationToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export async function saveUserToDatabase(user: UserProfile): Promise<boolean> {
  if (!HAS_SUPABASE) return true; // skip when Supabase env not configured
  try {
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        age: user.age,
        university: user.university,
        interests: user.interests,
      }),
    });

    if (!response.ok) {
      // If user already exists, that's okay
      if (response.status === 409) {
        return true;
      }
      console.error("Failed to save user to database");
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error saving user to database:", error);
    return false;
  }
}

export async function updateUserInDatabase(user: UserProfile): Promise<boolean> {
  if (!HAS_SUPABASE) return true; // skip when Supabase env not configured
  try {
    const response = await fetch("/api/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email,
        firstName: user.firstName,
        age: user.age,
        university: user.university,
        interests: user.interests,
      }),
    });

    if (!response.ok) {
      console.error("Failed to update user in database");
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error updating user in database:", error);
    return false;
  }
}

export async function fetchUserFromDatabase(email: string): Promise<UserProfile | null> {
  if (!HAS_SUPABASE) return null; // skip when Supabase env not configured
  try {
    const response = await fetch(`/api/users?email=${encodeURIComponent(email)}`);

    if (!response.ok) {
      return null;
    }

    const { user } = await response.json();
    return user;
  } catch (error) {
    console.error("Error fetching user from database:", error);
    return null;
  }
}

export function createUser(email: string, username: string, firstName: string): UserProfile {
  return {
    id: generateUserId(),
    email,
    username,
    firstName,
    interests: [],
    verified: false,
    createdAt: new Date().toISOString(),
  };
}

export function saveVerificationToken(email: string, token: string): void {
  if (typeof window === "undefined") return;
  const tokens = JSON.parse(localStorage.getItem(VERIFICATION_TOKENS_KEY) || "{}");
  tokens[email] = { token, createdAt: Date.now() };
  localStorage.setItem(VERIFICATION_TOKENS_KEY, JSON.stringify(tokens));
}

export function getVerificationToken(email: string): string | null {
  if (typeof window === "undefined") return null;
  const tokens = JSON.parse(localStorage.getItem(VERIFICATION_TOKENS_KEY) || "{}");
  const data = tokens[email];
  if (!data) return null;
  
  // Token expires after 24 hours
  if (Date.now() - data.createdAt > 24 * 60 * 60 * 1000) {
    delete tokens[email];
    localStorage.setItem(VERIFICATION_TOKENS_KEY, JSON.stringify(tokens));
    return null;
  }
  
  return data.token;
}

export function verifyEmailToken(email: string, token: string): boolean {
  const stored = getVerificationToken(email);
  return stored === token;
}
