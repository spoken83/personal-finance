import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#f8f9fb]">
      <Sidebar />
      <main className="flex-1 overflow-auto px-8 py-6">{children}</main>
    </div>
  );
}
