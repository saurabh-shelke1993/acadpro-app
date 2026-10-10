import React, {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import { supabase } from "../services/supabase";
import {
  getLoggedInUser,
  isSuperAdmin
} from "../utils/auth";
import {
  isAcademyOwner,
  isCoach
} from "../utils/roles";
import {
  getAccessibleCenters,
  getAccessibleBatches,
  getAccessibleAcademies
} from "../utils/dataScope";
import {
  getAccessibleBatchSchedules,
  createBatchSchedule,
  updateBatchSchedule,
  deactivateBatchSchedule,
  getDayName
} from "../services/batchScheduleService";
import "./Batches.css";

const DAYS = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 7, label: "Sunday", short: "Sun" }
];

const AGE_GROUPS = [
  "U6",
  "U8",
  "U10",
  "U12",
  "U14",
  "U16",
  "U18",
  "Adults",
  "Elite"
];

const createEmptySession = (dayOfWeek = 1) => ({
  id: null,
  dayOfWeek,
  startTime: "",
  endTime: "",
  sessionLabel: ""
});

const normalizeTime = (value) => String(value || "").slice(0, 5);

const formatBatchTime = (time) => {
  if (!time) return "—";
  const [hourPart, minutePart] = String(time).split(":");
  const hour = Number(hourPart);
  const minute = Number(minutePart || 0);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return time;
  }

  const date = new Date();
  date.setHours(hour, minute, 0, 0);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
};

const formatSessionTime = (session) => {
  if (!session?.startTime || !session?.endTime) return "Time not set";
  return `${formatBatchTime(session.startTime)} – ${formatBatchTime(session.endTime)}`;
};

const formatScheduleRows = (rows) =>
  [...rows].sort(
    (a, b) =>
      Number(a.dayOfWeek) - Number(b.dayOfWeek) ||
      String(a.startTime).localeCompare(String(b.startTime))
  );

const Batches = () => {
  const [searchParams] = useSearchParams();
  const academyContextId = searchParams.get("academyId") || "";
  const centerContextId = searchParams.get("centerId") || "";
  const batchContextId = searchParams.get("batchId") || "";

  const [academies, setAcademies] = useState([]);
  const [user, setUser] = useState(null);
  const [centers, setCenters] = useState([]);
  const [filteredCenters, setFilteredCenters] = useState([]);
  const [batches, setBatches] = useState([]);
  const [batchSchedules, setBatchSchedules] = useState({});

  const [selectedAcademy, setSelectedAcademy] = useState(academyContextId);
  const [selectedCenter, setSelectedCenter] = useState(centerContextId);
  const [batchName, setBatchName] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [scheduleRows, setScheduleRows] = useState([]);

  const [batchSearchTerm, setBatchSearchTerm] = useState("");
  const [batchColumnFilters, setBatchColumnFilters] = useState({
    academy: [],
    center: [],
    ageGroup: []
  });
  const [openFilter, setOpenFilter] = useState(null);

  const [editingBatchId, setEditingBatchId] = useState(null);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [saving, setSaving] = useState(false);

  const PAGE_SIZE = 6;

  const filteredBatches = useMemo(() => batches.filter((batch) => {
    const matchesContext =
      (!academyContextId || batch.academy_id === academyContextId) &&
      (!centerContextId || batch.center_id === centerContextId) &&
      (!batchContextId || batch.id === batchContextId);

    const matchesBatch =
      !batchSearchTerm.trim() ||
      String(batch.batch_name || "")
        .toLowerCase()
        .includes(batchSearchTerm.trim().toLowerCase());

    const matchesColumn = (column, value) =>
      batchColumnFilters[column].length === 0 ||
      batchColumnFilters[column].includes(value);

    return (
      matchesContext &&
      matchesBatch &&
      matchesColumn("academy", batch.academies?.academy_name || "—") &&
      matchesColumn("center", batch.centers?.center_name || "—") &&
      matchesColumn("ageGroup", batch.age_group || "—")
    );
  }), [
    batches,
    academyContextId,
    centerContextId,
    batchContextId,
    batchSearchTerm,
    batchColumnFilters
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredBatches.length / PAGE_SIZE)
  );

  const pageStartIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedBatches = filteredBatches.slice(
    pageStartIndex,
    pageStartIndex + PAGE_SIZE
  );

  useEffect(() => {
    const load = async () => {
      const currentUser = await getLoggedInUser();
      setUser(currentUser);

      if (
        currentUser &&
        !isSuperAdmin(currentUser) &&
        currentUser.academy_id &&
        !academyContextId
      ) {
        setSelectedAcademy(currentUser.academy_id);
      }
    };

    load();
  }, [academyContextId]);

  const fetchAcademies = useCallback(async () => {
    if (!user) return;

    try {
      const data = await getAccessibleAcademies(user);
      setAcademies(data || []);

      if (
        !isSuperAdmin(user) &&
        user.academy_id &&
        !selectedAcademy
      ) {
        setSelectedAcademy(user.academy_id);
      }
    } catch (error) {
      console.error("Failed to load accessible academies:", error);
      setAcademies([]);
    }
  }, [user, selectedAcademy]);

  const fetchCenters = useCallback(async () => {
    if (!user) return;

    try {
      const data = await getAccessibleCenters(user);
      const accessibleCenters = data || [];

      setCenters(accessibleCenters);
      setFilteredCenters(
        selectedAcademy
          ? accessibleCenters.filter(
              (center) => center.academy_id === selectedAcademy
            )
          : accessibleCenters
      );

      setSelectedCenter((currentCenter) => {
        if (
          currentCenter &&
          !accessibleCenters.some((center) => center.id === currentCenter)
        ) {
          return "";
        }

        return currentCenter;
      });
    } catch (error) {
      console.error("Failed to load accessible centers:", error);
      setCenters([]);
      setFilteredCenters([]);
    }
  }, [user, selectedAcademy]);

  const fetchBatches = useCallback(async () => {
    if (!user) return;

    try {
      let data = [];

      if (isSuperAdmin(user)) {
        const response = await supabase
          .from("batches")
          .select("*")
          .eq("is_active", true)
          .order("batch_name");

        if (response.error) throw response.error;
        data = response.data || [];
      } else {
        data = await getAccessibleBatches(user, null);
      }

      const centerById = new Map(
        centers.map((center) => [center.id, center])
      );
      const academyById = new Map(
        academies.map((academy) => [academy.id, academy])
      );

      const displayBatches = data.map((batch) => ({
        ...batch,
        centers: centerById.get(batch.center_id) || null,
        academies: academyById.get(batch.academy_id) || null
      }));

      setBatches(displayBatches);
      setCurrentPage(1);
      setSelectedBatchId(
        batchContextId &&
        displayBatches.some((batch) => batch.id === batchContextId)
          ? batchContextId
          : null
      );

      const scheduleAcademyId = isSuperAdmin(user)
        ? ""
        : user.academy_id || "";

      const schedules = await getAccessibleBatchSchedules({
        academyId: scheduleAcademyId
      });

      const scheduleMap = {};
      (schedules || []).forEach((schedule) => {
        if (!scheduleMap[schedule.batch_id]) {
          scheduleMap[schedule.batch_id] = [];
        }

        scheduleMap[schedule.batch_id].push({
          id: schedule.id,
          dayOfWeek: Number(schedule.day_of_week),
          startTime: normalizeTime(schedule.start_time),
          endTime: normalizeTime(schedule.end_time),
          sessionLabel: schedule.session_label || "",
          centerId: schedule.center_id,
          academyId: schedule.academy_id,
          batchId: schedule.batch_id
        });
      });

      Object.keys(scheduleMap).forEach((batchId) => {
        scheduleMap[batchId] = formatScheduleRows(scheduleMap[batchId]);
      });

      setBatchSchedules(scheduleMap);
    } catch (error) {
      console.error("Failed to load batches:", error);
      setBatches([]);
      setBatchSchedules({});
      setCurrentPage(1);
      setSelectedBatchId(null);
    }
  }, [
    user,
    centers,
    academies,
    batchContextId
  ]);

  useEffect(() => {
    if (!user) return;
    fetchAcademies();
  }, [user, fetchAcademies]);

  useEffect(() => {
    if (!user) return;
    fetchCenters();
  }, [user, fetchCenters]);

  useEffect(() => {
    if (!user) return;
    fetchBatches();
  }, [user, fetchBatches]);

  const handleAcademyChange = (academyId) => {
    setSelectedAcademy(academyId);
    setSelectedCenter("");

    setFilteredCenters(
      (centers || []).filter(
        (center) => center.academy_id === academyId
      )
    );
  };

  const resetForm = () => {
    setEditingBatchId(null);
    setBatchName("");
    setAgeGroup("");
    setScheduleRows([]);
    setSelectedCenter("");

    if (isSuperAdmin(user)) {
      setSelectedAcademy(academyContextId || "");
      setFilteredCenters(
        centers.filter(
          (center) => center.academy_id === (academyContextId || "")
        )
      );
    } else {
      setSelectedAcademy(user?.academy_id || "");
      setFilteredCenters(
        centers.filter(
          (center) => center.academy_id === user?.academy_id
        )
      );
    }
  };

  const addScheduleRow = (dayOfWeek = 1) => {
    setScheduleRows((current) => [
      ...current,
      createEmptySession(dayOfWeek)
    ]);
  };

  const updateScheduleRow = (index, field, value) => {
    setScheduleRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? { ...row, [field]: value }
          : row
      )
    );
  };

  const removeScheduleRow = (index) => {
    setScheduleRows((current) =>
      current.filter((_, rowIndex) => rowIndex !== index)
    );
  };

  const toggleDay = (dayOfWeek) => {
    const exists = scheduleRows.some(
      (row) => Number(row.dayOfWeek) === dayOfWeek
    );

    if (exists) {
      setScheduleRows((current) =>
        current.filter(
          (row) => Number(row.dayOfWeek) !== dayOfWeek
        )
      );
      return;
    }

    addScheduleRow(dayOfWeek);
  };

  const validateScheduleRows = () => {
    if (scheduleRows.length === 0) {
      return "Add at least one training session.";
    }

    for (const row of scheduleRows) {
      if (!row.dayOfWeek || !row.startTime || !row.endTime) {
        return "Complete the day, start time, and end time for every training session.";
      }

      if (row.startTime >= row.endTime) {
        return `${getDayName(row.dayOfWeek)}: end time must be after start time.`;
      }
    }

    const seen = new Set();

    for (const row of scheduleRows) {
      const key = `${row.dayOfWeek}|${row.startTime}|${row.endTime}`;

      if (seen.has(key)) {
        return "The same day and time session cannot be added twice.";
      }

      seen.add(key);
    }

    return "";
  };

  const reconcileSchedules = async ({
    academyId,
    batchId,
    centerId,
    existingSchedules
  }) => {
    const retainedIds = new Set();
    const createdIds = [];

    try {
      for (const row of scheduleRows) {
        const payload = {
          academyId,
          batchId,
          centerId,
          dayOfWeek: Number(row.dayOfWeek),
          startTime: row.startTime,
          endTime: row.endTime,
          sessionLabel: row.sessionLabel
        };

        if (row.id) {
          await updateBatchSchedule(row.id, payload);
          retainedIds.add(row.id);
        } else {
          const created = await createBatchSchedule(payload);
          createdIds.push(created.id);
          retainedIds.add(created.id);
        }
      }

      const schedulesToDeactivate = (existingSchedules || []).filter(
        (schedule) => schedule.id && !retainedIds.has(schedule.id)
      );

      for (const schedule of schedulesToDeactivate) {
        await deactivateBatchSchedule(schedule.id);
      }
    } catch (error) {
      await Promise.all(
        createdIds.map((scheduleId) =>
          deactivateBatchSchedule(scheduleId).catch(() => null)
        )
      );
      throw error;
    }
  };

  const handleSaveBatch = async () => {
    if (!isSuperAdmin(user) && !isAcademyOwner(user)) {
      alert("You do not have permission to manage batches.");
      return;
    }

    const resolvedAcademyId = isSuperAdmin(user)
      ? selectedAcademy
      : user?.academy_id;

    if (!resolvedAcademyId || !selectedCenter || !batchName.trim() || !ageGroup) {
      alert("Please fill all required batch details.");
      return;
    }

    const scheduleError = validateScheduleRows();

    if (scheduleError) {
      alert(scheduleError);
      return;
    }

    if (saving) return;

    const duplicateBatch = batches.find(
      (batch) =>
        batch.center_id === selectedCenter &&
        String(batch.batch_name || "").trim().toLowerCase() ===
          batchName.trim().toLowerCase() &&
        batch.id !== editingBatchId
    );

    if (duplicateBatch) {
      alert("Batch already exists in this center.");
      return;
    }

    setSaving(true);

    try {
      const firstSchedule = formatScheduleRows(scheduleRows)[0];

      if (editingBatchId) {
        const { error } = await supabase
          .from("batches")
          .update({
            center_id: selectedCenter,
            batch_name: batchName.trim(),
            age_group: ageGroup,
            start_time: firstSchedule.startTime,
            end_time: firstSchedule.endTime
          })
          .eq("id", editingBatchId);

        if (error) throw error;

        await reconcileSchedules({
          academyId: resolvedAcademyId,
          batchId: editingBatchId,
          centerId: selectedCenter,
          existingSchedules: batchSchedules[editingBatchId] || []
        });

        alert("Batch updated successfully.");
      } else {
        const { data: createdBatch, error } = await supabase
          .from("batches")
          .insert({
            academy_id: resolvedAcademyId,
            center_id: selectedCenter,
            batch_name: batchName.trim(),
            age_group: ageGroup,
            start_time: firstSchedule.startTime,
            end_time: firstSchedule.endTime,
            is_active: true
          })
          .select("id")
          .single();

        if (error) throw error;

        try {
          await reconcileSchedules({
            academyId: resolvedAcademyId,
            batchId: createdBatch.id,
            centerId: selectedCenter,
            existingSchedules: []
          });
        } catch (scheduleError) {
          await supabase
            .from("batches")
            .update({ is_active: false })
            .eq("id", createdBatch.id);

          throw scheduleError;
        }

        alert("Batch created successfully.");
      }

      resetForm();
      await fetchBatches();
    } catch (error) {
      console.error("Failed to save batch:", error);
      alert(error?.message || "Unable to save the batch.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (batch) => {
    if (!isSuperAdmin(user) && !isAcademyOwner(user)) {
      return;
    }

    setEditingBatchId(batch.id);
    setBatchName(batch.batch_name || "");
    setAgeGroup(batch.age_group || "");
    setSelectedAcademy(batch.academy_id || user?.academy_id || "");
    setSelectedCenter(batch.center_id || "");

    const schedules = batchSchedules[batch.id] || [];

    if (schedules.length > 0) {
      setScheduleRows(
        formatScheduleRows(
          schedules.map((schedule) => ({
            id: schedule.id,
            dayOfWeek: Number(schedule.dayOfWeek),
            startTime: normalizeTime(schedule.startTime),
            endTime: normalizeTime(schedule.endTime),
            sessionLabel: schedule.sessionLabel || ""
          }))
        )
      );
    } else {
      // Legacy batches may still have batches.start_time/end_time, but
      // those values do not tell us which weekday(s) the batch runs.
      // Do not invent a weekday; let the admin configure the recurring sessions.
      setScheduleRows([]);
    }

    setFilteredCenters(
      centers.filter(
        (center) =>
          center.academy_id ===
          (batch.academy_id || user?.academy_id)
      )
    );

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!isSuperAdmin(user) && !isAcademyOwner(user)) {
      alert("You do not have permission to manage batches.");
      return;
    }

    if (!window.confirm("Deactivate this batch?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("batches")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;

      const schedules = batchSchedules[id] || [];

      await Promise.all(
        schedules.map((schedule) =>
          deactivateBatchSchedule(schedule.id)
        )
      );

      if (selectedBatchId === id) {
        setSelectedBatchId(null);
      }

      if (editingBatchId === id) {
        resetForm();
      }

      await fetchBatches();
    } catch (error) {
      console.error("Failed to deactivate batch:", error);
      alert(error?.message || "Unable to deactivate the batch.");
    }
  };

  const getUniqueFilterValues = (getter) =>
    [...new Set(batches.map(getter).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b)));

  const batchFilterOptions = {
    academy: getUniqueFilterValues(
      (batch) => batch.academies?.academy_name || "—"
    ),
    center: getUniqueFilterValues(
      (batch) => batch.centers?.center_name || "—"
    ),
    ageGroup: getUniqueFilterValues(
      (batch) => batch.age_group || "—"
    )
  };

  const toggleBatchFilterValue = (column, value) => {
    setBatchColumnFilters((current) => ({
      ...current,
      [column]: current[column].includes(value)
        ? current[column].filter((item) => item !== value)
        : [...current[column], value]
    }));
    setCurrentPage(1);
  };

  const clearBatchColumnFilter = (column) => {
    setBatchColumnFilters((current) => ({
      ...current,
      [column]: []
    }));
    setCurrentPage(1);
  };

  const clearAllBatchFilters = () => {
    setBatchSearchTerm("");
    setBatchColumnFilters({
      academy: [],
      center: [],
      ageGroup: []
    });
    setCurrentPage(1);
    setOpenFilter(null);
  };

  const activeBatchFilterCount =
    (batchSearchTerm.trim() ? 1 : 0) +
    Object.values(batchColumnFilters).filter(
      (values) => values.length > 0
    ).length;

  const renderBatchColumnFilter = (
    column,
    label,
    options,
    type = "list"
  ) => {
    const isOpen = openFilter === column;
    const selectedValues = batchColumnFilters[column] || [];

    return (
      <div className="batches-column-filter">
        <button
          type="button"
          className={
            "batches-filter-trigger" +
            (
              selectedValues.length ||
              (column === "batch" && batchSearchTerm.trim())
                ? " batches-filter-trigger-active"
                : ""
            )
          }
          onClick={() => setOpenFilter(isOpen ? null : column)}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-label={"Filter " + label}
        >
          <span>{label}</span>
          <span aria-hidden="true">⌄</span>
        </button>

        {isOpen && (
          <div
            className="batches-filter-popover"
            role="dialog"
            aria-label={label + " filter"}
          >
            {type === "text" ? (
              <div className="batches-filter-search">
                <input
                  autoFocus
                  type="search"
                  placeholder={"Search " + label.toLowerCase() + "..."}
                  value={batchSearchTerm}
                  onChange={(event) => {
                    setBatchSearchTerm(event.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            ) : (
              <>
                <div className="batches-filter-popover-header">
                  <strong>Filter {label}</strong>
                  {selectedValues.length > 0 && (
                    <button
                      type="button"
                      className="batches-filter-clear-button"
                      onClick={() => clearBatchColumnFilter(column)}
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="batches-filter-options">
                  {options.length === 0 ? (
                    <span className="batches-filter-empty">
                      No values available
                    </span>
                  ) : (
                    options.map((option) => (
                      <label
                        key={option}
                        className="batches-filter-option"
                      >
                        <input
                          type="checkbox"
                          checked={selectedValues.includes(option)}
                          onChange={() =>
                            toggleBatchFilterValue(column, option)
                          }
                        />
                        <span>{option}</span>
                      </label>
                    ))
                  )}
                </div>
              </>
            )}

            <div className="batches-filter-popover-footer">
              <button
                type="button"
                className="batches-filter-done-button"
                onClick={() => setOpenFilter(null)}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const getBatchSessions = (batchId) =>
    formatScheduleRows(batchSchedules[batchId] || []);

  const getBatchDays = (batchId) => {
    const sessions = getBatchSessions(batchId);

    return [...new Set(
      sessions.map((session) => Number(session.dayOfWeek))
    )]
      .sort((a, b) => a - b)
      .map((day) => DAYS.find((item) => item.value === day)?.short || getDayName(day))
      .join(", ") || "—";
  };

  const getBatchScheduleSummary = (batchId) => {
    const sessions = getBatchSessions(batchId);

    if (sessions.length === 0) {
      return "Schedule not configured";
    }

    const grouped = new Map();

    sessions.forEach((session) => {
      const day = Number(session.dayOfWeek);
      if (!grouped.has(day)) grouped.set(day, []);
      grouped.get(day).push(session);
    });

    return [...grouped.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([day, daySessions]) => {
        const dayName =
          DAYS.find((item) => item.value === day)?.short ||
          getDayName(day);

        const times = daySessions
          .map((session) => formatSessionTime(session))
          .join(", ");

        return `${dayName} ${times}`;
      })
      .join(" · ");
  };

  const selectedDays = new Set(
    scheduleRows.map((row) => Number(row.dayOfWeek))
  );

  const dayCounts = scheduleRows.reduce((counts, row) => {
    const day = Number(row.dayOfWeek);
    counts[day] = (counts[day] || 0) + 1;
    return counts;
  }, {});

  useEffect(() => {
    if (!openFilter) return;

    const handleOutsideClick = (event) => {
      if (!event.target.closest(".batches-column-filter")) {
        setOpenFilter(null);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") setOpenFilter(null);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openFilter]);

  if (!user) {
    return (
      <Layout>
        <div className="batches-page-loading">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div
        className={
          "batches-page" +
          (isCoach(user) ? " batches-page-coach" : "") +
          (isAcademyOwner(user) ? " batches-page-owner" : "")
        }
      >
        <div className="batches-page-header">
          <div>
            <span className="batches-page-eyebrow">Academy management</span>
            <h1>Batches</h1>
            <p>
              Create batches and define their recurring weekly training
              sessions in one place.
            </p>
          </div>
          <div className="batches-page-count">
            <strong>{batches.length}</strong>
            <span>visible batches</span>
          </div>
        </div>

        {(isSuperAdmin(user) || isAcademyOwner(user)) && (
          <section className="batches-form-card batches-create-card">
            <div className="batches-section-heading">
              <div>
                <span className="batches-section-kicker">
                  {editingBatchId ? "Batch management" : "Create batch"}
                </span>
                <h2>
                  {editingBatchId ? "Edit Batch" : "New Batch"}
                </h2>
              </div>
              <p>
                {editingBatchId
                  ? "Update the batch details and its weekly training sessions."
                  : "Set up the batch and its weekly training sessions together."}
              </p>
            </div>

            <div className="batches-form-grid batches-basic-form-grid">
              {isSuperAdmin(user) && (
                <div className="batches-field">
                  <label htmlFor="batch-academy">Academy *</label>
                  <select
                    id="batch-academy"
                    value={selectedAcademy}
                    onChange={(event) =>
                      handleAcademyChange(event.target.value)
                    }
                    aria-required="true"
                  >
                    <option value="">Select academy</option>
                    {academies.map((academy) => (
                      <option key={academy.id} value={academy.id}>
                        {academy.academy_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="batches-field">
                <label htmlFor="batch-center">Center *</label>
                <select
                  id="batch-center"
                  value={selectedCenter}
                  onChange={(event) =>
                    setSelectedCenter(event.target.value)
                  }
                  disabled={!selectedAcademy && isSuperAdmin(user)}
                  aria-required="true"
                >
                  <option value="">Select center</option>
                  {(isSuperAdmin(user)
                    ? filteredCenters
                    : centers.filter(
                        (center) =>
                          center.academy_id === user?.academy_id
                      )
                  ).map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.center_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="batches-field">
                <label htmlFor="batch-name">Batch name *</label>
                <input
                  id="batch-name"
                  type="text"
                  placeholder="e.g. Juniors"
                  value={batchName}
                  onChange={(event) =>
                    setBatchName(event.target.value)
                  }
                  aria-required="true"
                />
              </div>

              <div className="batches-field">
                <label htmlFor="batch-age-group">Age group *</label>
                <select
                  id="batch-age-group"
                  value={ageGroup}
                  onChange={(event) =>
                    setAgeGroup(event.target.value)
                  }
                  aria-required="true"
                >
                  <option value="">Select age group</option>
                  {AGE_GROUPS.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="batches-schedule-builder">
              <div className="batches-schedule-builder-header">
                <div>
                  <span className="batches-section-kicker">
                    Weekly training schedule
                  </span>
                  <h3>When does this batch run?</h3>
                  <p>
                    Select the training days, then set the time for each
                    session. A day can have more than one session.
                  </p>
                </div>
                <span className="batches-session-count">
                  {scheduleRows.length}{" "}
                  {scheduleRows.length === 1 ? "session" : "sessions"}
                </span>
              </div>

              <div
                className="batches-day-picker"
                aria-label="Training days"
              >
                {DAYS.map((day) => {
                  const selected = selectedDays.has(day.value);
                  const count = dayCounts[day.value] || 0;

                  return (
                    <label
                      key={day.value}
                      className={
                        "batches-day-option" +
                        (selected ? " batches-day-option-selected" : "")
                      }
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleDay(day.value)}
                      />
                      <span className="batches-day-check" aria-hidden="true">
                        {selected ? "✓" : ""}
                      </span>
                      <span className="batches-day-name">
                        {day.label}
                      </span>
                      {count > 1 && (
                        <span className="batches-day-count">
                          {count} sessions
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>

              {scheduleRows.length > 0 && (
                <div className="batches-schedule-rows">
                  {formatScheduleRows(scheduleRows).map((row, sortedIndex) => {
                    const originalIndex = scheduleRows.findIndex(
                      (candidate) =>
                        candidate === row
                    );

                    return (
                      <div
                        className="batches-schedule-row"
                        key={
                          row.id ||
                          `${row.dayOfWeek}-${row.startTime}-${sortedIndex}`
                        }
                      >
                        <div className="batches-schedule-day">
                          <strong>{getDayName(row.dayOfWeek)}</strong>
                          {dayCounts[row.dayOfWeek] > 1 && (
                            <span>
                              Session {sortedIndex + 1}
                            </span>
                          )}
                        </div>

                        <div className="batches-field">
                          <label htmlFor={`schedule-start-${sortedIndex}`}>
                            Start time
                          </label>
                          <input
                            id={`schedule-start-${sortedIndex}`}
                            type="time"
                            value={row.startTime}
                            onChange={(event) =>
                              updateScheduleRow(
                                originalIndex,
                                "startTime",
                                event.target.value
                              )
                            }
                          />
                        </div>

                        <div className="batches-field">
                          <label htmlFor={`schedule-end-${sortedIndex}`}>
                            End time
                          </label>
                          <input
                            id={`schedule-end-${sortedIndex}`}
                            type="time"
                            value={row.endTime}
                            onChange={(event) =>
                              updateScheduleRow(
                                originalIndex,
                                "endTime",
                                event.target.value
                              )
                            }
                          />
                        </div>

                        <div className="batches-field batches-session-label-field">
                          <label htmlFor={`schedule-label-${sortedIndex}`}>
                            Session label
                          </label>
                          <input
                            id={`schedule-label-${sortedIndex}`}
                            type="text"
                            placeholder="e.g. Morning"
                            value={row.sessionLabel}
                            onChange={(event) =>
                              updateScheduleRow(
                                originalIndex,
                                "sessionLabel",
                                event.target.value
                              )
                            }
                          />
                        </div>

                        <button
                          type="button"
                          className="batches-remove-session-button"
                          onClick={() =>
                            removeScheduleRow(originalIndex)
                          }
                          aria-label={
                            "Remove " + getDayName(row.dayOfWeek) + " session"
                          }
                          title="Remove session"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                className="batches-add-session-button"
                onClick={() => {
                  const existingDay = scheduleRows[0]?.dayOfWeek || 1;
                  addScheduleRow(Number(existingDay));
                }}
              >
                + Add another session
              </button>

              {scheduleRows.length === 0 && (
                <p className="batches-schedule-empty">
                  Select at least one training day to add the batch schedule.
                </p>
              )}
            </div>

            <div className="batches-form-actions">
              {editingBatchId && (
                <button
                  type="button"
                  className="batches-secondary-button"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancel
                </button>
              )}

              <button
                type="button"
                className="batches-primary-button"
                onClick={handleSaveBatch}
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingBatchId
                    ? "Save Batch"
                    : "Create Batch"}
              </button>
            </div>
          </section>
        )}

        <section className="batches-results-section">
          <div className="batches-results-header">
            <div>
              <span className="batches-section-kicker">Active batches</span>
              <h2>Batch List</h2>
            </div>
            <div className="batches-list-filter-summary">
              {activeBatchFilterCount > 0 && (
                <>
                  <span>
                    {activeBatchFilterCount} active filter
                    {activeBatchFilterCount === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    className="batches-secondary-button"
                    onClick={clearAllBatchFilters}
                  >
                    Clear all
                  </button>
                </>
              )}
              <span>
                {filteredBatches.length}{" "}
                {filteredBatches.length === 1
                  ? "batch"
                  : "batches"} shown
              </span>
              <span>
                Page {currentPage} of {totalPages}
              </span>
            </div>
          </div>

          <div className="batches-table-wrap">
            <table className="batches-table">
              <caption className="sr-only">
                Active batches, academy, center, age group, training days,
                schedule, and available management actions
              </caption>
              <thead>
                <tr>
                  <th scope="col">
                    {renderBatchColumnFilter(
                      "academy",
                      "Academy",
                      batchFilterOptions.academy
                    )}
                  </th>
                  <th scope="col">
                    {renderBatchColumnFilter(
                      "center",
                      "Center",
                      batchFilterOptions.center
                    )}
                  </th>
                  <th scope="col">
                    {renderBatchColumnFilter(
                      "batch",
                      "Batch",
                      [],
                      "text"
                    )}
                  </th>
                  <th scope="col">
                    {renderBatchColumnFilter(
                      "ageGroup",
                      "Age Group",
                      batchFilterOptions.ageGroup
                    )}
                  </th>
                  <th scope="col">Days</th>
                  <th scope="col">Schedule</th>
                  {(isSuperAdmin(user) || isAcademyOwner(user)) && (
                    <th
                      scope="col"
                      className="batches-actions-heading"
                    >
                      Actions
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {filteredBatches.length === 0 ? (
                  <tr>
                    <td
                      className="batches-empty-state"
                      colSpan={
                        isSuperAdmin(user) || isAcademyOwner(user)
                          ? 7
                          : 6
                      }
                    >
                      <strong>No active batches</strong>
                      <span>
                        {activeBatchFilterCount > 0
                          ? "No batches match the current filters."
                          : "No active batches are available."}
                      </span>
                    </td>
                  </tr>
                ) : (
                  paginatedBatches.map((batch) => {
                    const academyName =
                      batch.academies?.academy_name ||
                      academies.find(
                        (academy) => academy.id === batch.academy_id
                      )?.academy_name ||
                      user?.academy_name ||
                      "—";

                    const centerName =
                      batch.centers?.center_name ||
                      centers.find(
                        (center) => center.id === batch.center_id
                      )?.center_name ||
                      "—";

                    const isSelected =
                      selectedBatchId === batch.id;

                    return (
                      <React.Fragment key={batch.id}>
                        <tr
                          className={
                            isSelected
                              ? "batches-row-selected"
                              : ""
                          }
                          tabIndex={0}
                          onClick={() =>
                            setSelectedBatchId(batch.id)
                          }
                          onKeyDown={(event) => {
                            if (
                              event.key === "Enter" ||
                              event.key === " "
                            ) {
                              event.preventDefault();
                              setSelectedBatchId(batch.id);
                            }
                          }}
                        >
                          <td className="batches-academy-cell">
                            {academyName}
                          </td>

                          <td className="batches-center-cell">
                            {centerName}
                          </td>

                          <td className="batches-name-cell">
                            <Link
                              className="batches-drilldown-link"
                              to={
                                "/players?academyId=" +
                                batch.academy_id +
                                "&centerId=" +
                                batch.center_id +
                                "&batchId=" +
                                batch.id
                              }
                              onClick={(event) =>
                                event.stopPropagation()
                              }
                              aria-label={
                                "Open players in " +
                                (batch.batch_name || "batch")
                              }
                            >
                              {batch.batch_name || "—"}
                            </Link>
                          </td>

                          <td>
                            {batch.age_group || "—"}
                          </td>

                          <td className="batches-days-cell">
                            {getBatchDays(batch.id)}
                          </td>

                          <td className="batches-schedule-cell">
                            {getBatchScheduleSummary(batch.id)}
                          </td>

                          {(isSuperAdmin(user) ||
                            isAcademyOwner(user)) && (
                            <td className="batches-actions-cell">
                              <div className="batches-row-actions">
                                <button
                                  type="button"
                                  className="batches-edit-button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleEdit(batch);
                                  }}
                                  aria-label={
                                    "Edit " +
                                    (batch.batch_name || "batch")
                                  }
                                >
                                  <span
                                    className="batches-action-icon"
                                    aria-hidden="true"
                                  >
                                    ✎
                                  </span>
                                  <span className="batches-action-label">
                                    Edit
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  className="batches-delete-button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleDelete(batch.id);
                                  }}
                                  aria-label={
                                    "Deactivate " +
                                    (batch.batch_name || "batch")
                                  }
                                >
                                  <span
                                    className="batches-action-icon"
                                    aria-hidden="true"
                                  >
                                    ×
                                  </span>
                                  <span className="batches-action-label">
                                    Deactivate
                                  </span>
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>

                        {(isSuperAdmin(user) ||
                          isAcademyOwner(user)) &&
                          isSelected && (
                            <tr className="batches-mobile-actions-row">
                              <td
                                colSpan={
                                  isSuperAdmin(user) ? 7 : 6
                                }
                                className="batches-mobile-actions-cell"
                              >
                                <div
                                  className="batches-mobile-row-actions"
                                  aria-label={
                                    "Actions for " +
                                    (batch.batch_name || "batch")
                                  }
                                >
                                  <button
                                    type="button"
                                    className="batches-edit-button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleEdit(batch);
                                    }}
                                    aria-label={
                                      "Edit " +
                                      (batch.batch_name || "batch")
                                    }
                                    title="Edit batch"
                                  >
                                    <span aria-hidden="true">
                                      ✏️
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    className="batches-delete-button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleDelete(batch.id);
                                    }}
                                    aria-label={
                                      "Deactivate " +
                                      (batch.batch_name || "batch")
                                    }
                                    title="Deactivate batch"
                                  >
                                    <span aria-hidden="true">
                                      🗑️
                                    </span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>

            {filteredBatches.length > 0 && (
              <div
                className="batches-pagination"
                aria-label="Batches pagination"
              >
                <span className="batches-pagination-summary">
                  Showing {pageStartIndex + 1}–
                  {Math.min(
                    pageStartIndex + PAGE_SIZE,
                    filteredBatches.length
                  )}{" "}
                  of {filteredBatches.length} batches
                </span>

                <div className="batches-pagination-controls">
                  <button
                    type="button"
                    className="batches-pagination-button"
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.max(1, page - 1)
                      )
                    }
                    disabled={currentPage === 1}
                    aria-label="Previous batches page"
                  >
                    Previous
                  </button>

                  <span className="batches-pagination-page">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    className="batches-pagination-button"
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.min(totalPages, page + 1)
                      )
                    }
                    disabled={currentPage === totalPages}
                    aria-label="Next batches page"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default Batches;
