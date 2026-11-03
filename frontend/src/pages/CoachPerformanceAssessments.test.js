import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CoachPerformanceAssessments from "./CoachPerformanceAssessments";
import { getCurrentUser } from "../utils/auth";
import { getCoachAssignedBatchIds } from "../utils/dataScope";
import { supabase } from "../supabaseClient";

jest.mock("../components/Layout", () => ({ children }) => <>{children}</>);
jest.mock("../components/PerformanceWorkspaceTabs", () => () => <div>Performance workspace</div>);
jest.mock("../utils/auth", () => ({ getCurrentUser: jest.fn() }));
jest.mock("../utils/dataScope", () => ({ getCoachAssignedBatchIds: jest.fn() }));
jest.mock("../supabaseClient", () => ({ supabase: { from: jest.fn() } }));

const player = {
  id: "player-1",
  full_name: "Test Junior",
  academy_id: "academy-1",
  batch_id: "batch-1",
  batches: { batch_name: "Juniors", is_active: true },
};

const coachRecord = {
  id: "coach-1",
  user_id: "coach-user-1",
  academy_id: "academy-1",
  full_name: "Test Coach",
};

const priorAssessment = {
  id: "assessment-1",
  player_id: "player-1",
  assessment_date: "2026-10-31",
  created_at: "2026-10-31T09:00:00Z",
  coach_id: "coach-1",
  coaches: { full_name: "Test Coach" },
  coach_remarks: "Keep practicing passing.",
  ball_control_score: 7,
  passing_score: 6,
  dribbling_score: 8,
  shooting_score: 7,
  defending_score: 6,
  speed_score: 8.5,
  stamina_score: 7,
  teamwork_score: 9,
  discipline_score: 8,
};

const mutations = {
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockQueries = (history = []) => {
  supabase.from.mockImplementation((table) => {
    const filters = {};
    const query = {
      select: () => query,
      eq: (field, value) => { filters[field] = value; return query; },
      in: (field, values) => { filters[field] = values; return query; },
      order: () => query,
      maybeSingle: () => Promise.resolve({ data: coachRecord, error: null }),
      insert: (payload) => {
        mutations.insert(payload);
        return Promise.resolve({ data: null, error: null });
      },
      update: (payload) => {
        mutations.update(payload);
        return query;
      },
      delete: () => {
        mutations.delete();
        return query;
      },
      then: (resolve, reject) => {
        let data;
        if (table === "players") {
          data = [player];
        } else if (table === "coaches") {
          data = [coachRecord];
        } else if (table === "player_performance_assessments") {
          data = history.filter((entry) => (
            !filters.player_id || filters.player_id === entry.player_id
          ));
        } else {
          data = [];
        }
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return query;
  });
};

const selectPlayer = async () => {
  fireEvent.click(await screen.findByRole("button", { name: /Search or select a player/ }));
  fireEvent.click(screen.getByRole("option", { name: /Test Junior/ }));
  await screen.findByRole("heading", { name: "Assessment entry" });
};

beforeEach(() => {
  jest.clearAllMocks();
  getCurrentUser.mockResolvedValue({
    id: "owner-1",
    role: "academy_owner",
    academy_id: "academy-1",
  });
  getCoachAssignedBatchIds.mockResolvedValue(["batch-1"]);
});

test("PM3 starts with a compact entry panel and visible history", async () => {
  mockQueries([priorAssessment]);
  render(<CoachPerformanceAssessments />);

  await selectPlayer();

  expect(screen.queryByLabelText("Assessment date")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Assessment history" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "+ Record assessment" }))
    .toHaveAttribute("aria-expanded", "false");
});

test("PM3 groups nine score fields and Cancel discards an unsaved entry", async () => {
  mockQueries([]);
  render(<CoachPerformanceAssessments />);
  await selectPlayer();

  fireEvent.click(screen.getByRole("button", { name: "+ Record assessment" }));

  expect(screen.getByRole("form", { name: "Record player assessment" })).toBeInTheDocument();
  expect(screen.getByLabelText("Assessment date")).toHaveFocus();
  expect(screen.getByRole("heading", { name: "Technical" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Physical" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Team & discipline" })).toBeInTheDocument();
  expect(document.querySelectorAll(".score-card input[type=number]")).toHaveLength(9);

  fireEvent.change(screen.getByLabelText("Passing"), { target: { value: "8.2" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(screen.queryByLabelText("Passing")).not.toBeInTheDocument();
  expect(mutations.insert).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "+ Record assessment" }));
  expect(screen.getByLabelText("Passing")).toHaveValue(null);
});

test("PM3 Edit in history opens the same editor with existing data", async () => {
  mockQueries([priorAssessment]);
  render(<CoachPerformanceAssessments />);
  await selectPlayer();

  fireEvent.click(await screen.findByRole("button", { name: /31 Oct 2026/ }));
  fireEvent.click(screen.getByRole("button", { name: "Edit assessment dated 31 Oct 2026" }));

  expect(screen.getByRole("form", { name: "Edit player assessment" })).toBeInTheDocument();
  expect(screen.getByLabelText("Assessment date")).toHaveFocus();
  expect(screen.getByLabelText("Passing")).toHaveValue(6);
  expect(screen.getByRole("button", { name: "Update assessment" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.getByRole("heading", { name: "Assessment entry" })).toBeInTheDocument();
});

test("PM3 saves through the existing owner-scoped create flow and closes the editor", async () => {
  mockQueries([]);
  render(<CoachPerformanceAssessments />);
  await selectPlayer();

  fireEvent.click(screen.getByRole("button", { name: "+ Record first assessment" }));
  fireEvent.change(screen.getByLabelText("Assessment coach"), { target: { value: "coach-1" } });
  fireEvent.change(screen.getByLabelText("Speed"), { target: { value: "8.5" } });
  fireEvent.click(screen.getByRole("button", { name: "Save assessment" }));

  await waitFor(() => {
    expect(mutations.insert).toHaveBeenCalledWith(expect.objectContaining({
      player_id: "player-1",
      academy_id: "academy-1",
      coach_id: "coach-1",
      speed_score: 8.5,
      passing_score: null,
    }));
  });
  await waitFor(() => expect(screen.queryByLabelText("Speed")).not.toBeInTheDocument());
  expect(screen.getByText("Assessment saved successfully.")).toBeInTheDocument();
});

test("PM3 does not expose the management form to an unauthorized Parent", async () => {
  getCurrentUser.mockResolvedValue({ id: "parent-1", role: "parent" });
  mockQueries([]);
  render(<CoachPerformanceAssessments />);

  expect(await screen.findByRole("alert"))
    .toHaveTextContent("Your account is not authorized to manage performance assessments.");
  expect(screen.queryByRole("button", { name: "+ Record assessment" })).not.toBeInTheDocument();
  expect(mutations.insert).not.toHaveBeenCalled();
});
