import { createContext, useContext } from 'react';
import type { AppUser, Role } from '../types';

export type AuthContextValue = {
  user: AppUser | null;
  isLoading: boolean;
  authError: string | null;
  login: (email: string, password: string) => Promise<AppUser>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  loginAsLocalTestUser: (role: Role) => Promise<AppUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('Auth context is not available');
  }

  return context;
}

export { AuthContext };
