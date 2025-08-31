import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fullUrl } from '@/lib/queryClient';

// Simple user type for our file-based auth
interface SimpleUser {
  id: string;
  username: string;
  balance: number;
  holdBalance: number;
  lastDailyRewardClaim?: string;
}

interface AuthContextType {
  user: SimpleUser | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<SimpleUser>) => void;
  updateUsername: (newUsername: string) => Promise<void>;
  placeBet: (betAmount: number) => Promise<void>;
  winBet: (betAmount: number, winnings: number) => Promise<void>;
  loseBet: (betAmount: number) => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored user data on mount
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        localStorage.removeItem("user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await fetch(fullUrl('/api/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (username: string, password: string) => {
    try {
      const response = await fetch(fullUrl('/api/auth/register'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error('Registration failed');
      }

      const data = await response.json();
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await fetch(fullUrl('/api/auth/logout'), { method: 'POST' });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      localStorage.removeItem("user");
    }
  };

  const updateUser = (updates: Partial<SimpleUser>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
    }
  };

  const updateUsername = async (newUsername: string) => {
    if (!user) throw new Error('No user logged in');
    
    try {
      const response = await fetch(fullUrl('/api/auth/update-username'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id, newUsername }),
      });

      if (!response.ok) {
        throw new Error('Username update failed');
      }

      const data = await response.json();
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
    } catch (error) {
      console.error('Username update error:', error);
      throw error;
    }
  };

  const placeBet = async (betAmount: number) => {
    if (!user) throw new Error('No user logged in');
    
    try {
      const response = await fetch(fullUrl('/api/game/place-bet'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id, betAmount }),
      });

      if (!response.ok) {
        throw new Error('Bet placement failed');
      }

      const data = await response.json();
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
    } catch (error) {
      console.error('Bet placement error:', error);
      throw error;
    }
  };

  const winBet = async (betAmount: number, winnings: number) => {
    if (!user) throw new Error('No user logged in');
    
    try {
      const response = await fetch(fullUrl('/api/game/win-bet'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id, betAmount, winnings }),
      });

      if (!response.ok) {
        throw new Error('Bet win processing failed');
      }

      const data = await response.json();
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
    } catch (error) {
      console.error('Bet win error:', error);
      throw error;
    }
  };

  const loseBet = async (betAmount: number) => {
    if (!user) throw new Error('No user logged in');
    
    try {
      const response = await fetch(fullUrl('/api/game/lose-bet'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id, betAmount }),
      });

      if (!response.ok) {
        throw new Error('Bet loss processing failed');
      }

      const data = await response.json();
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
    } catch (error) {
      console.error('Bet loss error:', error);
      throw error;
    }
  };

    return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      register, 
      logout, 
      updateUser,
      updateUsername,
      placeBet,
      winBet,
      loseBet,
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
