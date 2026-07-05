import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ListChecks, LayoutDashboard, Menu, X } from 'lucide-react';

const navItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Jobs', path: '/jobs', icon: ListChecks },
];

function isActive(itemPath: string, pathname: string) {
  return itemPath === '/' ? pathname === '/' : pathname.startsWith(itemPath);
}

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleNav = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const sidebar = (
    <nav className="flex h-full flex-col bg-zinc-900">
      {/* Wordmark */}
      <div className="flex h-14 items-center gap-2.5 border-b border-zinc-800 px-5">
        <ListChecks className="h-5 w-5 text-zinc-400" />
        <span className="text-sm font-semibold tracking-tight text-zinc-100">Jobs</span>
      </div>

      {/* Nav items */}
      <div className="flex flex-col gap-1 px-3 py-3">
        {navItems.map((item) => {
          const active = isActive(item.path, location.pathname);
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => handleNav(item.path)}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen">
      {/* Mobile hamburger */}
      <div className="fixed top-0 right-0 left-0 z-40 flex h-14 items-center border-b border-zinc-800 bg-zinc-950/80 px-4 backdrop-blur md:hidden">
        <button
          type="button"
          aria-label="Open navigation menu"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <div className="ml-3 flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-zinc-400" />
          <span className="text-sm font-semibold text-zinc-100">Jobs</span>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed top-0 bottom-0 left-0 z-50 w-56 md:hidden">
            {sidebar}
          </div>
        </>
      )}

      {/* Desktop sidebar */}
      <div className="fixed top-0 bottom-0 left-0 z-30 hidden w-56 border-r border-zinc-800 md:block">
        {sidebar}
      </div>

      {/* Main content */}
      <main className="pt-14 md:ml-56 md:pt-0">
        <div className="mx-auto max-w-6xl px-6 py-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
