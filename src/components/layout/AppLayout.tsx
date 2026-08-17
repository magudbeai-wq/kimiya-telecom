'use client';

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Users,
  Smartphone,
  CreditCard,
  Boxes,
  ArrowLeftRight,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  ShieldCheck,
  HardDrive,
  Bell,
  Sun,
  Moon,
  LogOut,
  CalendarCheck,
  ChevronRight,
  Menu,
  X,
  PackagePlus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const {
    user,
    loading,
    activeSession,
    notifications,
    unreadCount,
    logout,
    markNotificationRead,
    markAllNotificationsRead,
    darkMode,
    toggleDarkMode,
  } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);

  // If on login page or unauthenticated, show raw page
  if (pathname === '/login' || (!user && !loading)) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="text-sm font-semibold tracking-wider text-blue-400">KIMIYA TELECOM LOADING...</p>
        </div>
      </div>
    );
  }

  // Navigation Items per Role
  let navItems: { label: string; href: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [];

  if (user?.role === 'ADMIN') {
    navItems = [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Branches', href: '/branches', icon: Building2 },
      { label: 'Users & RBAC', href: '/users', icon: Users },
      { label: 'SIM Cards', href: '/sim', icon: Smartphone },
      { label: 'Scratch Cards', href: '/scratch', icon: CreditCard },
      { label: 'Inventory & Stock', href: '/inventory', icon: Boxes },
      { label: 'Stock Transfers', href: '/transfers', icon: ArrowLeftRight },
      { label: 'Sales Terminal', href: '/sales', icon: ShoppingCart },
      { label: 'Finance & Expenses', href: '/finance', icon: DollarSign },
      { label: 'Analytics & Trends', href: '/analytics', icon: TrendingUp },
      { label: 'Report Center', href: '/reports', icon: FileSpreadsheet },
      { label: 'Audit Logs', href: '/audit', icon: ShieldCheck },
      { label: 'Backups & DR', href: '/backups', icon: HardDrive },
    ];
  } else if (user?.role === 'FINANCE') {
    navItems = [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Central Store Stock', href: '/inventory', icon: Boxes },
      { label: 'Incoming Stock', href: '/incoming', icon: PackagePlus },
      { label: 'SIM Cards', href: '/sim', icon: Smartphone },
      { label: 'Scratch Cards', href: '/scratch', icon: CreditCard },
      { label: 'Stock Transfers', href: '/transfers', icon: ArrowLeftRight },
      { label: 'Branch Stock Views', href: '/inventory?tab=branches', icon: Building2 },
      { label: 'Sales Records', href: '/sales', icon: ShoppingCart },
      { label: 'Finance & Expenses', href: '/finance', icon: DollarSign },
      { label: 'Analytics & Trends', href: '/analytics', icon: TrendingUp },
      { label: 'Report Center', href: '/reports', icon: FileSpreadsheet },
      { label: 'Audit Logs', href: '/audit', icon: ShieldCheck },
      { label: 'Backups & DR', href: '/backups', icon: HardDrive },
    ];
  } else if (user?.role === 'SHOP_USER') {
    navItems = [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Open / Close Day', href: '/sessions', icon: CalendarCheck },
      { label: 'Pending Approvals', href: '/transfers?tab=pending', icon: ArrowLeftRight, badge: unreadCount },
      { label: 'SIM Sales', href: '/sales?type=SIM', icon: Smartphone },
      { label: 'Scratch Sales', href: '/sales?type=SCRATCH_CARD', icon: CreditCard },
      { label: 'My Branch Stock', href: '/inventory', icon: Boxes },
      { label: "Today's Sales", href: '/sales', icon: ShoppingCart },
      { label: 'SIM Card Hub', href: '/sim', icon: Smartphone },
      { label: 'Scratch Card Hub', href: '/scratch', icon: CreditCard },
      { label: 'Branch Reports', href: '/reports', icon: FileSpreadsheet },
    ];
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 z-30 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-colors shadow-sm">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-200 dark:border-slate-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold shadow-md shadow-blue-500/20">
            KT
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-slate-900 dark:text-white">KIMIYA TELECOM</h1>
            <p className="text-[10px] font-semibold tracking-wider text-blue-600 dark:text-blue-400 uppercase">
              {user?.role === 'ADMIN' ? 'Headquarters Admin' : user?.role === 'FINANCE' ? 'Central Finance' : user?.branch_name || 'Branch Terminal'}
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && item.badge > 0 ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>

        {/* User Card & Logout Bottom */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold truncate text-slate-900 dark:text-white">{user?.full_name}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate capitalize">{user?.role?.toLowerCase()}</p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:pl-64">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 sm:px-6">
          {/* Left: Mobile toggle & Branch Location Badge */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-blue-600"></span>
              <span className="text-xs font-bold tracking-tight text-slate-800 dark:text-slate-200">
                {user?.branch_name ? `${user.branch_name} Branch` : 'Head Office Central Store'}
              </span>
            </div>

            {/* Business Session Status for Branch users */}
            {user?.role === 'SHOP_USER' && (
              <button
                onClick={() => router.push('/sessions')}
                className={`ml-2 hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                  activeSession
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${activeSession ? 'bg-emerald-500 pulse-dot' : 'bg-amber-500'}`}></span>
                <span>{activeSession ? `Day Open (#${activeSession.business_date})` : 'Business Day Closed'}</span>
              </button>
            )}
          </div>

          {/* Right Controls: Notifications, Dark mode, Logout */}
          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <button
              onClick={() => setNotifDrawerOpen(true)}
              className="relative p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {darkMode ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-slate-600" />}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>

      {/* Slide-over Notification Center Drawer */}
      {notifDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-sm">Notification Center</h3>
                {unreadCount > 0 && (
                  <span className="bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-300 text-xs px-2 py-0.5 rounded-full font-bold">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setNotifDrawerOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                  <Bell className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-xs">No notifications yet.</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => markNotificationRead(n.id)}
                    className={`p-3 rounded-lg border text-xs transition-all cursor-pointer ${
                      n.is_read
                        ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        : 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-slate-900 dark:text-white font-medium shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-bold text-xs text-blue-600 dark:text-blue-400">{n.title}</span>
                      <span className="text-[10px] text-slate-400">{n.created_at.substring(11, 16)}</span>
                    </div>
                    <p className="text-xs leading-relaxed">{n.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
