import Sidebar from "./Sidebar";

function Layout({ children }) {

  return (

    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "#e5e7eb",
      }}
    >

      {/* SIDEBAR */}

      <Sidebar />

      {/* PAGE CONTENT */}

      <div
        style={{
          flex: 1,
          padding: "30px",
        }}
      >
        {children}
      </div>

    </div>
  );
}

export default Layout;