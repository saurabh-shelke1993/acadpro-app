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

  const { error } = await supabase
    .from("attendance")
    .update({
      status
    })
    .eq("id", attendanceId);

  if (error) throw error;

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