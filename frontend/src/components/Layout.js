import { useState } from "react";
import Sidebar from "./Sidebar";

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="app-main">
        <header className="app-mobile-header">
          <button
            type="button"
            className="app-menu-button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
            aria-expanded={sidebarOpen}
          >
            <span />
            <span />
            <span />
          </button>

          <div className="app-mobile-brand">
            <span className="app-mobile-brand-mark">⚽</span>
            <span>AcadPro</span>
          </div>
        </header>

        <div className="app-content">{children}</div>
      </main>
    </div>
  );
}

export default Layout;
