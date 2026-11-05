import { supabase } from "../supabaseClient";

// =======================================
// SAVE ATTENDANCE
// =======================================

export const saveAttendanceRecords = async (
  attendanceRows
) => {

  const { error } = await supabase
    .from("attendance")
    .insert(attendanceRows);

  if (error) throw error;

};

// =======================================
// UPDATE ATTENDANCE
// =======================================

export const updateAttendanceStatus = async (
  attendanceId,
  status
) => {

  const { data, error } = await supabase
    .from("attendance")
    .update({
      status
    })
    .eq("id", attendanceId)
    .select("id");

  if (error) throw error;
  // Supabase RLS can filter an UPDATE to zero rows without returning an error.
  if (!Array.isArray(data) || data.length !== 1) {
    throw new Error("Attendance update was not applied. Check edit permissions and refresh.");
  }

};

// =======================================
// SOFT DELETE
// =======================================

export const softDeleteAttendance = async (
  attendanceId,
  userId
) => {

  const { error } = await supabase
    .from("attendance")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: userId
    })
    .eq("id", attendanceId);

  if (error) throw error;

};