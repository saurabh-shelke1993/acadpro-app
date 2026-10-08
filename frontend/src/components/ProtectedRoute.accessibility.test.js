import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { getCurrentUser } from "../utils/auth";

jest.mock("../utils/auth", () => ({
  getCurrentUser: jest.fn(),
}));

const renderProtectedRoute = (user, allowedRoles) => {
  getCurrentUser.mockResolvedValue(user);

  return render(
    <MemoryRouter initialEntries={["/protected"]}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute allowedRoles={allowedRoles}>
              <main aria-label="Protected content">Protected content</main>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<main aria-label="Login page">Login</main>} />
      </Routes>
    </MemoryRouter>
  );
};

describe("ProtectedRoute cross-role accessibility regression", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    ["super_admin", ["super_admin", "academy_owner"]],
    ["academy_owner", ["super_admin", "academy_owner"]],
    ["coach", ["coach"]],
    ["parent", ["parent"]],
  ])("allows the %s role to reach an allowed route", async (role, allowedRoles) => {
    renderProtectedRoute({ id: "user-1", role }, allowedRoles);

    expect(screen.getByRole("status", { name: "" })).toHaveTextContent("Loading...");

    await waitFor(() => {
      expect(screen.getByRole("main", { name: "Protected content" })).toBeInTheDocument();
    });

    expect(screen.queryByRole("main", { name: "Login page" })).not.toBeInTheDocument();
  });

  test.each([
    ["super_admin", ["academy_owner"]],
    ["academy_owner", ["coach"]],
    ["coach", ["parent"]],
    ["parent", ["super_admin"]],
  ])("redirects the %s role when the route is outside its role scope", async (role, allowedRoles) => {
    renderProtectedRoute({ id: "user-1", role }, allowedRoles);

    await waitFor(() => {
      expect(screen.getByRole("main", { name: "Login page" })).toBeInTheDocument();
    });

    expect(screen.queryByRole("main", { name: "Protected content" })).not.toBeInTheDocument();
  });

  test("redirects unauthenticated users without rendering protected content", async () => {
    renderProtectedRoute(null, ["super_admin"]);

    await waitFor(() => {
      expect(screen.getByRole("main", { name: "Login page" })).toBeInTheDocument();
    });

    expect(screen.queryByRole("main", { name: "Protected content" })).not.toBeInTheDocument();
  });

  test("exposes the loading state as an accessible live status", () => {
    getCurrentUser.mockImplementation(() => new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute allowedRoles={["super_admin"]}>
                <main aria-label="Protected content">Protected content</main>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status")).toHaveTextContent("Loading...");
  });
});
