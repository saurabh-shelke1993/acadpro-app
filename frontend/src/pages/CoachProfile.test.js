import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CoachProfile from "./CoachProfile";
import { getCurrentUser } from "../utils/auth";
import {
  createCoachCertification,
  deleteCoachCertification,
  getCoachCertifications,
  getCoachProfile,
  getMyCoachProfile,
  getParentCoachProfiles,
  updateCoachCertification,
  updateMyCoachProfile,
} from "../services/coachProfileService";

jest.mock("../components/Layout", () => ({ children }) => <>{children}</>);

jest.mock("../utils/auth", () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock("../utils/roles", () => ({
  isAcademyOwner: (user) => user?.role === "academy_owner",
  isCoach: (user) => user?.role === "coach",
  isSuperAdmin: (user) => user?.role === "super_admin",
}));

jest.mock("../services/coachProfileService", () => ({
  createCoachCertification: jest.fn(),
  deleteCoachCertification: jest.fn(),
  getCoachCertifications: jest.fn(),
  getCoachProfile: jest.fn(),
  getMyCoachProfile: jest.fn(),
  getParentCoachProfiles: jest.fn(),
  updateCoachCertification: jest.fn(),
  updateMyCoachProfile: jest.fn(),
}));

const baseProfile = {
  id: "coach-1",
  academy_id: "academy-1",
  full_name: "Faisal Khan",
  email: "faisal@example.com",
  phone: "9999999999",
  profile_image: null,
  is_active: true,
  experience_years: 6,
  joining_date: "2026-01-10",
  specialization: "AFC A",
  bio: "Youth development coach.",
  academy: { academy_name: "Thane City FC" },
  assignments: [
    {
      id: "assignment-1",
      batch: {
        batch_name: "Juniors",
        age_group: "U14",
        start_time: "18:00:00",
        end_time: "19:00:00",
      },
      center: { center_name: "Lodha Amara" },
    },
  ],
};

const renderProfile = (user, initialEntry = "/coaches/coach-1") => {
  getCurrentUser.mockResolvedValue(user);

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/coaches/:coachId" element={<CoachProfile />} />
        <Route path="/coach-profile" element={<CoachProfile />} />
        <Route path="/coaches" element={<div>Coach Directory</div>} />
        <Route path="/coach-dashboard" element={<div>Coach Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe("CoachProfile role and behavior regression", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getCoachCertifications.mockResolvedValue([]);
    getParentCoachProfiles.mockResolvedValue([]);
  });

  test("academy owner can view a coach profile and training scope without self-edit controls", async () => {
    getCoachProfile.mockResolvedValue(baseProfile);

    renderProfile({ id: "owner-1", role: "academy_owner" });

    expect(await screen.findByRole("heading", { name: "Faisal Khan" })).toBeInTheDocument();
    expect(screen.getAllByText("AFC A")).toHaveLength(2);
    expect(screen.getByText("Thane City FC")).toBeInTheDocument();
    expect(screen.getByText("Juniors")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Profile" })).not.toBeInTheDocument();
    expect(getCoachProfile).toHaveBeenCalledWith("coach-1");
    expect(getCoachCertifications).toHaveBeenCalledWith("coach-1");
  });

  test("parent can view only a coach returned by the parent-scoped profile RPC", async () => {
    const parentProfile = {
      id: "coach-1",
      full_name: "Faisal Khan",
      specialization: "AFC A",
      is_active: true,
      experience_years: 6,
      bio: "Youth development coach.",
      academy: { academy_name: "Thane City FC" },
      assignments: [],
    };
    getParentCoachProfiles.mockResolvedValue([parentProfile]);

    renderProfile({ id: "parent-1", role: "parent" });

    expect(await screen.findByRole("heading", { name: "Faisal Khan" })).toBeInTheDocument();
    expect(screen.getByText("Youth development coach.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Certifications" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Profile" })).not.toBeInTheDocument();
    expect(getCoachProfile).not.toHaveBeenCalled();
    expect(getCoachCertifications).not.toHaveBeenCalled();
  });

  test("parent cannot load an unrelated coach profile", async () => {
    getParentCoachProfiles.mockResolvedValue([
      {
        id: "linked-coach",
        full_name: "Linked Coach",
        specialization: "AFC C",
        is_active: true,
        assignments: [],
      },
    ]);

    renderProfile({ id: "parent-1", role: "parent" });

    expect(
      await screen.findByRole("heading", { name: "Unable to load profile" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("This coach profile is not available for your linked child.")
    ).toBeInTheDocument();
    expect(getCoachProfile).not.toHaveBeenCalled();
  });

  test("coach can edit only the self-service profile through the update RPC", async () => {
    getMyCoachProfile.mockResolvedValue(baseProfile);
    updateMyCoachProfile.mockResolvedValue({
      ...baseProfile,
      bio: "Updated coach bio.",
    });

    renderProfile({ id: "coach-user-1", role: "coach" }, "/coach-profile");

    expect(await screen.findByRole("heading", { name: "Faisal Khan" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
    fireEvent.change(screen.getByLabelText("Bio"), {
      target: { value: "Updated coach bio." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updateMyCoachProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: "Faisal Khan",
          email: "faisal@example.com",
          specialization: "AFC A",
          bio: "Updated coach bio.",
        })
      );
    });

    expect(await screen.findByText("Profile updated successfully.")).toBeInTheDocument();
    expect(getCoachProfile).not.toHaveBeenCalled();
  });

  test("academy owner can add, edit, and delete a certification", async () => {
    const certification = {
      id: "cert-1",
      coach_id: "coach-1",
      certificate_name: "AFC C License",
      issuing_organization: "AFC",
      certificate_number: "AFC-C-001",
      issue_date: "2026-01-01",
      expiry_date: "2029-01-01",
    };

    getCoachProfile.mockResolvedValue(baseProfile);
    getCoachCertifications
      .mockResolvedValueOnce([])
      .mockResolvedValue([certification]);
    createCoachCertification.mockResolvedValue(certification);
    updateCoachCertification.mockResolvedValue({
      ...certification,
      certificate_name: "AFC C License Updated",
    });
    deleteCoachCertification.mockResolvedValue(undefined);

    renderProfile({ id: "owner-1", role: "academy_owner" });

    await screen.findByRole("heading", { name: "Faisal Khan" });

    fireEvent.change(screen.getByLabelText("Certificate name"), {
      target: { value: "AFC C License" },
    });
    fireEvent.change(screen.getByLabelText("Issuing organization"), {
      target: { value: "AFC" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add certification" }));

    await waitFor(() => {
      expect(createCoachCertification).toHaveBeenCalledWith(
        expect.objectContaining({
          coach_id: "coach-1",
          certificate_name: "AFC C License",
          issuing_organization: "AFC",
        })
      );
    });

    expect(await screen.findByText("AFC C License")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Certificate name"), {
      target: { value: "AFC C License Updated" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update certification" }));

    await waitFor(() => {
      expect(updateCoachCertification).toHaveBeenCalledWith(
        "cert-1",
        expect.objectContaining({
          certificate_name: "AFC C License Updated",
        })
      );
    });

    window.confirm = jest.fn(() => true);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(deleteCoachCertification).toHaveBeenCalledWith("cert-1");
    });
  });
});
