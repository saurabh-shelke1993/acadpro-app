import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PlayerPerformanceReport from "./PlayerPerformanceReport";
import { getCurrentUser } from "../utils/auth";
import { supabase } from "../supabaseClient";

jest.mock("../components/Layout", () => ({ children }) => <>{children}</>);
jest.mock("../utils/auth", () => ({ getCurrentUser: jest.fn() }));
jest.mock("../supabaseClient", () => ({ supabase: { from: jest.fn() } }));
jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: () => null,
  LineChart: () => null,
  Bar: () => null,
  Line: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

const players = [
  {
    id: "player-top", full_name: "Top Player",
    academy_id: "academy-1", center_id: "center-1", batch_id: "batch-1",
    academies: { academy_name: "Thane City FC" },
    centers: { center_name: "Lodha Amara" },
    batches: { batch_name: "Juniors", age_group: "U14" },
  },
  {
    id: "player-other", full_name: "Other Player",
    academy_id: "academy-1", center_id: "center-1", batch_id: "batch-1",
    academies: { academy_name: "Thane City FC" },
    centers: { center_name: "Lodha Amara" },
    batches: { batch_name: "Juniors", age_group: "U14" },
  },
];

const assessment = (playerId, score) => ({
  id: `assessment-${playerId}`,
  player_id: playerId,
  assessment_date: "2026-10-31",
  created_at: "2026-10-31T12:00:00Z",
  ball_control_score: score,
  passing_score: score,
  dribbling_score: score,
  shooting_score: score,
  defending_score: score,
  speed_score: score,
  stamina_score: score,
  teamwork_score: score,
  discipline_score: score,
  coach_remarks: "Good progress",
});

const mockTables = (availableAssessments) => {
  supabase.from.mockImplementation((table) => {
    const filters = {};
    const query = {
      select: () => query,
      eq: (key, value) => { filters[key] = value; return query; },
      in: (key, value) => { filters[key] = value; return query; },
      order: () => query,
      then: (resolve, reject) => {
        let data = table === "players" ? players : availableAssessments;
        if (table === "player_performance_assessments" && filters.player_id) {
          const allowed = Array.isArray(filters.player_id) ? filters.player_id : [filters.player_id];
          data = availableAssessments.filter((item) => allowed.includes(item.player_id));
        }
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return query;
  });
};

const renderReport = (route = "/player-performance-report") =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <PlayerPerformanceReport />
    </MemoryRouter>
  );

beforeEach(() => {
  jest.clearAllMocks();
  getCurrentUser.mockResolvedValue({
    id: "owner-1", role: "academy_owner", academy_id: "academy-1",
  });
});

test("PM2 automatically opens the top assessed player's full report", async () => {
  mockTables([assessment("player-top", 9), assessment("player-other", 7)]);

  renderReport();

  expect(await screen.findByRole("heading", { name: "Top Player" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Skill-wise scores" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Assessment history" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /View performance report for Top Player/ }))
    .toHaveAttribute("aria-pressed", "true");
});

test("PM2 preserves an authorized deep link instead of replacing it with the highest scorer", async () => {
  mockTables([assessment("player-top", 9), assessment("player-other", 7)]);

  renderReport("/player-performance-report?player=player-other");

  expect(await screen.findByRole("heading", { name: "Other Player" })).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /View performance report for Other Player/ }))
      .toHaveAttribute("aria-pressed", "true");
  });
  expect(screen.getByRole("button", { name: /View performance report for Top Player/ }))
    .toHaveAttribute("aria-pressed", "false");
});

test("PM2 shows helpful guidance without fabricating scores when there are no assessments", async () => {
  mockTables([]);

  renderReport();

  expect(await screen.findByRole("heading", { name: "No scored performance assessments yet" }))
    .toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Skill-wise scores" })).not.toBeInTheDocument();
});
