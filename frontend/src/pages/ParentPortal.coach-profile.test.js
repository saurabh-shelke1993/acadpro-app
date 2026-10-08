import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ParentPortal from "./ParentPortal";
import {
  getAttendanceSummaries,
  getParentContext,
} from "../services/parentPortalService";

jest.mock("../components/Layout", () => ({ children }) => <>{children}</>);

jest.mock("../services/parentPortalService", () => ({
  getAttendanceSummaries: jest.fn(),
  getParentContext: jest.fn(),
}));

describe("Parent Portal coach profile navigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    getParentContext.mockResolvedValue({
      children: [
        {
          id: "player-1",
          full_name: "TCFC Test Player",
          player_status: "active",
          academy: { academy_name: "Thane City FC" },
          center: { center_name: "Lodha Amara" },
          batch: {
            batch_name: "Juniors",
            age_group: "U14",
            start_time: "18:00:00",
            end_time: "19:00:00",
          },
          coaches: [
            { id: "coach-1", full_name: "Faisal Khan" },
          ],
        },
      ],
      coachError: null,
    });

    getAttendanceSummaries.mockResolvedValue({
      summaries: {
        "player-1": {
          total: 0,
          present: 0,
          absent: 0,
          percentage: 0,
        },
      },
      error: null,
    });
  });

  test("renders the linked coach as a navigable profile control", async () => {
    render(
      <MemoryRouter initialEntries={["/parent-portal"]}>
        <Routes>
          <Route path="/parent-portal" element={<ParentPortal />} />
          <Route path="/coaches/:coachId" element={<div>Coach profile destination</div>} />
        </Routes>
      </MemoryRouter>
    );

    const coachLink = await screen.findByRole("button", {
      name: /Faisal Khan/,
    });

    fireEvent.click(coachLink);

    expect(screen.getByText("Coach profile destination")).toBeInTheDocument();
    expect(getParentContext).toHaveBeenCalledTimes(1);
  });
});
