import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Players from "./Players";
import { supabase } from "../services/supabase";
import { getLoggedInUser } from "../utils/auth";
import {
  getAccessibleAcademies,
  getAccessibleCenters,
  getAccessibleBatches,
  getCoachAssignedBatchIds,
} from "../utils/dataScope";
import { getPlayerProfileSnapshot } from "../services/playerProfileService";

jest.mock("../components/Layout", () => ({ children }) => <>{children}</>);
jest.mock("../components/PlayerImport", () => () => null);
jest.mock("../services/supabase", () => ({ supabase: { from: jest.fn() } }));
jest.mock("../services/playerService", () => ({
  createPlayerTransactional: jest.fn(),
  updatePlayerTransactional: jest.fn(),
}));
jest.mock("../services/playerScheduleService", () => ({
  getActiveSchedulesForBatch: jest.fn(async () => []),
  getPlayerScheduleEnrollments: jest.fn(async () => []),
  enrollPlayerInSchedule: jest.fn(),
  deactivatePlayerScheduleEnrollment: jest.fn(),
}));
jest.mock("../utils/auth", () => ({
  getLoggedInUser: jest.fn(),
  isSuperAdmin: (user) => user?.role === "super_admin",
}));
jest.mock("../utils/roles", () => ({
  isAcademyOwner: (user) => user?.role === "academy_owner",
  isCoach: (user) => user?.role === "coach",
}));
jest.mock("../utils/dataScope", () => ({
  getAccessibleAcademies: jest.fn(),
  getAccessibleCenters: jest.fn(),
  getAccessibleBatches: jest.fn(),
  getCoachAssignedBatchIds: jest.fn(),
}));
jest.mock("../services/playerProfileService", () => ({
  getPlayerProfileSnapshot: jest.fn(),
}));
jest.mock("../services/playerPhotoService", () => ({
  getPlayerPhotoUrl: jest.fn(async () => null),
  uploadPlayerPhoto: jest.fn(),
}));
jest.mock("../services/playerSessionDefaults", () => ({ selectPlayerSessionIds: jest.fn(() => []) }));
jest.mock("../services/centerPresentation", () => ({ suggestCenterCode: jest.fn(() => "GB") }));

const player = {
  id: "player-1",
  full_name: "Arjun Shelke",
  academy_id: "academy-1",
  center_id: "center-1",
  batch_id: "batch-1",
  is_active: true,
  player_status: "Active",
  profile_image: null,
  dob: "2025-05-13",
  joining_date: "2026-06-09",
  gender: "Male",
  academies: { academy_name: "Thane City FC" },
  centers: { center_name: "GawandBaugh" },
  batches: { batch_name: "Juniors" },
  parents: {
    parent_name: "Test Parent",
    phone: "8787676767",
    email: "parent@example.test",
    address: "Sample address",
  },
};
const otherAcademyPlayer = {
  ...player,
  id: "player-2",
  full_name: "Other Academy Player",
  academy_id: "academy-2",
  center_id: "center-2",
  batch_id: "batch-2",
  academies: { academy_name: "Other Academy" },
  centers: { center_name: "Other Center" },
  batches: { batch_name: "U8 Toddlers" },
};

const snapshot = {
  schedule: [
    { id: "s-1", day: "Monday", timeLabel: "5:00 PM – 6:00 PM", centerName: "GawandBaugh", batchName: "Juniors" },
    { id: "s-2", day: "Wednesday", timeLabel: "5:00 PM – 6:00 PM", centerName: "Other Center", batchName: "Juniors" },
  ],
  attendance: { rate: 75, present: 3, absent: 1, recordedSessions: 4 },
  monthlyPayments: [{ key: "2026-11", label: "Nov 2026", formattedAmount: "₹1,000" }],
};

const allPlayers = [player, otherAcademyPlayer];

const setupQueries = () => {
  supabase.from.mockImplementation((table) => {
    const filters = {};
    const query = {
      select: () => query,
      eq: (field, value) => { filters[field] = value; return query; },
      in: (field, values) => { filters[field] = values; return query; },
      order: () => query,
      then: (resolve, reject) => {
        let data = [];
        if (table === "players") {
          data = allPlayers.filter((entry) =>
            (!filters.is_active || entry.is_active === filters.is_active) &&
            (!filters.academy_id || entry.academy_id === filters.academy_id) &&
            (!filters.center_id || entry.center_id === filters.center_id) &&
            (!filters.batch_id || entry.batch_id === filters.batch_id) &&
            (!filters["player_batches.batch_id"] ||
              filters["player_batches.batch_id"].includes(entry.batch_id))
          );
        }
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return query;
  });
};

const renderPage = async (role = "academy_owner") => {
  getLoggedInUser.mockResolvedValue({
    id: "user-1",
    role,
    academy_id: role === "super_admin" ? null : "academy-1",
  });
  const result = render(
    <MemoryRouter initialEntries={["/players"]}>
      <Players />
    </MemoryRouter>
  );
  const row = await screen.findByRole("row", { name: "View profile for Arjun Shelke" });
  return { ...result, row };
};

const openProfile = async (role = "academy_owner") => {
  const page = await renderPage(role);
  fireEvent.click(page.row);
  const dialog = await screen.findByRole("dialog", { name: "Arjun Shelke" });
  await waitFor(() => expect(getPlayerProfileSnapshot).toHaveBeenCalledWith(
    "player-1", { includeFees: role !== "coach" }
  ));
  return { ...page, dialog };
};

beforeEach(() => {
  jest.clearAllMocks();
  getAccessibleAcademies.mockResolvedValue([
    { id: "academy-1", academy_name: "Thane City FC" },
    { id: "academy-2", academy_name: "Other Academy" },
  ]);
  getAccessibleCenters.mockResolvedValue([
    { id: "center-1", academy_id: "academy-1", center_name: "GawandBaugh" },
  ]);
  getAccessibleBatches.mockResolvedValue([]);
  getCoachAssignedBatchIds.mockResolvedValue(["batch-1"]);
  getPlayerProfileSnapshot.mockResolvedValue(snapshot);
  setupQueries();
});

test("PP5 owner sees a single accessible profile identity with editing, upload and fee summary", async () => {
  const { dialog } = await openProfile();
  expect(within(dialog).getAllByRole("heading", { name: "Arjun Shelke" })).toHaveLength(1);
  expect(within(dialog).getByRole("heading", { name: "Player information" })).toBeInTheDocument();
  expect(within(dialog).getByRole("heading", { name: "Parent & contact" })).toBeInTheDocument();
  expect(within(dialog).getByText("13 May 2025")).toBeInTheDocument();
  expect(within(dialog).getByText("09 Jun 2026")).toBeInTheDocument();
  expect(within(dialog).getByText("parent@example.test")).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Edit Arjun Shelke" })).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Deactivate Arjun Shelke" })).toBeInTheDocument();
  expect(within(dialog).getByText(/original up to 10 MB/)).toBeInTheDocument();
  expect(within(dialog).getByRole("heading", { name: "Fees paid" })).toBeInTheDocument();
  expect(await within(dialog).findByText("₹1,000")).toBeInTheDocument();
  expect(screen.queryByRole("row", { name: "View profile for Other Academy Player" })).not.toBeInTheDocument();
});

test("PP5 coach sees scoped training and attendance without owner-only actions or financial totals", async () => {
  const { dialog } = await openProfile("coach");
  expect(within(dialog).queryByRole("button", { name: /Edit Arjun/ })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: /Deactivate Arjun/ })).not.toBeInTheDocument();
  expect(within(dialog).queryByText(/original up to 10 MB/)).not.toBeInTheDocument();
  expect(within(dialog).queryByRole("heading", { name: "Fees paid" })).not.toBeInTheDocument();
  expect(within(dialog).getByRole("heading", { name: "Overall attendance" })).toBeInTheDocument();
  expect(await within(dialog).findByText("3 of 4 recorded sessions attended")).toBeInTheDocument();
  expect(within(dialog).getByText("75%")).toBeInTheDocument();
  expect(await within(dialog).findByText("2 weekly sessions")).toBeInTheDocument();
  // Different center appears under its session; identical center/batch is not repeated.
  expect(within(dialog).getByText("Other Center · Juniors")).toBeInTheDocument();
  expect(within(dialog).queryByText("GawandBaugh · Juniors")).not.toBeInTheDocument();
  expect(getCoachAssignedBatchIds).toHaveBeenCalled();
  expect(screen.queryByRole("row", { name: "View profile for Other Academy Player" })).not.toBeInTheDocument();
});

test("PP5 Super Admin retains academy visibility and read-only profile controls with fee access", async () => {
  const { dialog } = await openProfile("super_admin");
  expect(screen.getByRole("row", { name: "View profile for Other Academy Player" })).toBeInTheDocument();
  expect(within(dialog).getByRole("heading", { name: "Fees paid" })).toBeInTheDocument();
  // Preserve current UX: only Academy Owner gets profile-header edit/deactivate/upload.
  expect(within(dialog).queryByRole("button", { name: "Edit Arjun Shelke" })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: "Deactivate Arjun Shelke" })).not.toBeInTheDocument();
});

test("PP5 links the selected player to the existing authorized Performance Report route", async () => {
  const { dialog } = await openProfile("coach");
  const link = within(dialog).getByRole("link", { name: /View performance report/ });
  expect(link).toHaveAttribute("href", "/player-performance-report?player=player-1");
});

test("PP5 distinguishes truly empty schedule, attendance and fees from loading or failures", async () => {
  getPlayerProfileSnapshot.mockResolvedValueOnce({
    schedule: [],
    attendance: { rate: 0, present: 0, absent: 0, recordedSessions: 0 },
    monthlyPayments: [],
  });
  const { dialog } = await openProfile();
  expect(await within(dialog).findByText("No active weekly sessions assigned.")).toBeInTheDocument();
  expect(within(dialog).getByText("No recorded present/absent sessions yet.")).toBeInTheDocument();
  expect(within(dialog).getByText("No payment summary available for this period.")).toBeInTheDocument();
});

test("PP5 snapshot failure reports unavailable data without inventing zero attendance", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  getPlayerProfileSnapshot.mockRejectedValueOnce(new Error("Snapshot unavailable"));
  try {
    const { dialog } = await openProfile();
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Some profile metrics could not be loaded");
    expect(within(dialog).getByText("Training schedule currently unavailable.")).toBeInTheDocument();
    expect(within(dialog).getByText("Attendance currently unavailable.")).toBeInTheDocument();
    expect(within(dialog).getByText("Payment totals currently unavailable.")).toBeInTheDocument();
    expect(within(dialog).queryByText("0%")).not.toBeInTheDocument();
  } finally {
    log.mockRestore();
  }
});

test("PP5 Escape closes the modal and restores focus to the opening player row", async () => {
  const { row, dialog } = await openProfile("coach");
  expect(document.body.style.overflow).toBe("hidden");
  expect(within(dialog).getByRole("button", { name: "Close player details" })).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "Arjun Shelke" })).not.toBeInTheDocument();
  expect(row).toHaveFocus();
  expect(document.body.style.overflow).not.toBe("hidden");
});

test("PP5 traps forward and reverse tab navigation within the open player profile", async () => {
  const { dialog } = await openProfile("coach");
  const close = within(dialog).getByRole("button", { name: "Close player details" });
  const performance = within(dialog).getByRole("link", { name: /View performance report/ });
  expect(close).toHaveFocus();
  fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
  expect(performance).toHaveFocus();
  fireEvent.keyDown(document, { key: "Tab" });
  expect(close).toHaveFocus();
});
