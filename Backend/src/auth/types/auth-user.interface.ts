// src/auth/types/auth-user.interface.ts
export interface AuthUser {
    sub: string;        // JWT subject (usually the user ID)
  email?: string;     // Make email optional if not always required
  role: string;       // User role
  phoneNumber?: string; // Your custom property
  username?: string;
}