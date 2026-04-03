"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  List,
  Upload,
  Calculator,
  TrendingUp,
  Tags,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Wallet,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const mainNav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/budget", label: "Budget & Runway", icon: Calculator },
  { href: "/transactions", label: "Transactions", icon: List },
  { href: "/transactions/upload", label: "Upload Statement", icon: Upload },
];

const secondaryNav = [
  { href: "/investments", label: "Portfolio & Balances", icon: TrendingUp },
  { href: "/categories", label: "Categories & Rules", icon: Tags },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  }

  const navLinkClass = (isActive: boolean) =>
    cn(
      "flex items-center rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
      collapsed ? "justify-center" : "gap-3",
      isActive
        ? "bg-gray-900 text-white"
        : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
    );

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-gray-200 bg-white transition-all duration-200",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo / Header */}
      <div className="flex h-14 items-center px-4">
        {!collapsed && (
          <div className="flex items-center gap-2 flex-1">
            <Wallet className="h-5 w-5 text-gray-900" />
            <span className="text-sm font-bold tracking-tight text-gray-900">
              FinanceTracker
            </span>
          </div>
        )}
        <button
          onClick={toggle}
          className={cn(
            "flex items-center justify-center rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600",
            collapsed && "mx-auto"
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4">
        {!collapsed && (
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            General
          </p>
        )}
        <div className="space-y-0.5">
          {mainNav.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={navLinkClass(isActive)}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}
        </div>

        <div className="my-4" />

        {!collapsed && (
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Tools
          </p>
        )}
        <div className="space-y-0.5">
          {secondaryNav.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={navLinkClass(isActive)}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 px-3 py-3">
        <div className="space-y-0.5">
          <Link
            href="/settings"
            title={collapsed ? "Settings" : undefined}
            className={cn(
              "flex items-center rounded-lg px-3 py-2 text-[13px] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors",
              collapsed ? "justify-center" : "gap-3"
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {!collapsed && "Settings"}
          </Link>
          <button
            onClick={() => signOut()}
            title={collapsed ? "Sign Out" : undefined}
            className={cn(
              "flex w-full items-center rounded-lg px-3 py-2 text-[13px] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors",
              collapsed ? "justify-center" : "gap-3"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && "Sign Out"}
          </button>
        </div>
      </div>
    </aside>
  );
}
