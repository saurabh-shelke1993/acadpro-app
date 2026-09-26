import Sidebar from "./Sidebar";

function Layout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />

      <main className="app-main">
        <div className="app-content">{children}</div>
      </main>
    </div>
  );
}

export default Layout;
