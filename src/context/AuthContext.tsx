'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthSessionUser, Notification, BusinessSession } from '@/lib/types';

interface AuthContextType {
  user: AuthSessionUser | null;
  loading: boolean;
  activeSession: BusinessSession | null;
  notifications: Notification[];
  unreadCount: number;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<BusinessSession | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Initialize theme from local storage or OS preference
  useEffect(() => {
    const isDark =
      localStorage.getItem('kimiya_theme') === 'dark' ||
      (!('kimiya_theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('kimiya_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('kimiya_theme', 'light');
    }
  };

  // Fetch current user and business session
  const refreshSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);

          // If user belongs to a branch, check active session
          if (data.user.branch_id) {
            const sessRes = await fetch(`/api/sessions?branchId=${data.user.branch_id}&activeOnly=true`);
            if (sessRes.ok) {
              const sessData = await sessRes.json();
              setActiveSession(sessData.activeSession || null);
            }
          }
          await refreshNotifications();
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      }
    } catch {
      // Ignore notification fetch error
    }
  };

  const markNotificationRead = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'MARK_READ', notificationId: id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Ignore
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'MARK_ALL_READ' }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    refreshSession();
    // Poll notifications every 20 seconds
    const interval = setInterval(refreshNotifications, 20000);
    return () => clearInterval(interval);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      let data: any = null;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        return {
          success: false,
          error: !res.ok
            ? `Server returned error (${res.status}). Please check server logs.`
            : 'Unexpected server response format.',
        };
      }

      if (data && data.success && data.user) {
        setUser(data.user);
        await refreshSession();
        router.push('/dashboard');
        return { success: true };
      }
      return { success: false, error: data?.error || 'Invalid username or password.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network communication error.' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setActiveSession(null);
      router.push('/login');
    } catch {
      router.push('/login');
    }
  };

  // Route protection
  useEffect(() => {
    if (!loading) {
      if (!user && pathname !== '/login') {
        router.push('/login');
      } else if (user && pathname === '/login') {
        router.push('/dashboard');
      }
    }
  }, [user, loading, pathname, router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        activeSession,
        notifications,
        unreadCount,
        login,
        logout,
        refreshSession,
        refreshNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        darkMode,
        toggleDarkMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
