import { useEffect, useRef, useState } from "react";
import Sidebar from "./Sidebar";

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const closeButtonRef = useRef(null);

  const closeSidebar = () => {
    setSidebarOpen(false);
    requestAnimationFrame(() => {
      menuButtonRef.current?.focus();
    });
  };

  useEffect(() => {
    if (!sidebarOpen) {
      return undefined;
    }

    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    if (!isMobile) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSidebar();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const sidebar = document.querySelector(".app-sidebar-open");
      if (!sidebar) {
        return;
      }

      const focusable = sidebar.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      if (!focusable.length) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.classList.add("app-sidebar-open");

    requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("app-sidebar-open");
    };
  }, [sidebarOpen]);

  useEffect(() => {
    const handleViewportChange = () => {
      if (window.matchMedia("(min-width: 641px)").matches && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleViewportChange);
    return () => window.removeEventListener("resize", handleViewportChange);
  }, [sidebarOpen]);

  return (
    <div className="app-shell">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        closeButtonRef={closeButtonRef}
      />

      <main className="app-main">
        <header className="app-mobile-header">
          <button
            type="button"
            className="app-menu-button"
            ref={menuButtonRef}
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
            aria-controls="acadpro-sidebar"
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
