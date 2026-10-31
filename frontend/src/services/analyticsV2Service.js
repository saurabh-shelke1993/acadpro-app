import { supabase } from "../supabaseClient";

/**
 * Invoke the preview using the signed-in user's Supabase session.
 * The Edge Function verifies the JWT and derives the Academy Owner scope
 * from public.users; the browser never receives a service-role credential.
 */
export async function getAcademyOwnerAnalyticsV2(user, snapshotMonth, attendanceRange = null, comparisonRange = null) {
  if (!user?.id || !user?.academy_id) {
    throw new Error("Your account is not linked to an academy.");
  }

  const { data, error } = await supabase.functions.invoke(
    "generate-analytics-snapshot",
    {
      body: {
        academyId: user.academy_id,
        scopeType: "academy",
        scopeId: user.academy_id,
        snapshotMonth,
        ...(attendanceRange ? {
          attendanceStartDate: attendanceRange.startDate,
          attendanceEndDate: attendanceRange.endDate
        } : {}),
        ...(comparisonRange ? {
          comparisonStartDate: comparisonRange.startDate,
          comparisonEndDate: comparisonRange.endDate
        } : {})
      }
    }
  );

  if (error) {
    console.error("Analytics V2 request failed:", error);
    const status = error.context?.status;
    if (status === 404) {
      throw new Error(
        "The Analytics preview service has not been deployed to Supabase yet. The page is ready, but monthly data will load after the matching Edge Function is deployed."
      );
    }
    throw new Error("We couldn't retrieve your monthly analytics. Please check your connection and try again.");
  }

  if (!data?.previewOnly || !data?.result) {
    throw new Error("Analytics preview returned an unexpected response.");
  }

  return data.result;
}


/**
 * Load the academy's structural catalogue separately from period attendance.
 * The catalogue is the source of truth for which centers/batches exist; attendance
 * is a period metric and must never decide whether a batch is rendered.
 */
export async function getAcademyCenterBatchCatalog(user) {
  if (!user?.academy_id) throw new Error("Your account is not linked to an academy.");

  // Resolve tenant-owned centers first, then fetch batches through their center
  // relationship. Existing batch rows may not carry academy_id consistently;
  // filtering by that column can silently omit valid academy batches.
  const centersResult = await supabase.from("centers")
    .select("id, center_name, academy_id")
    .eq("academy_id", user.academy_id)
    .order("center_name");

  if (centersResult.error) throw centersResult.error;
  const centers = centersResult.data || [];
  const centerIds = centers.map(center => String(center.id));
  if (!centerIds.length) return { centers: [] };

  const batchesResult = await supabase.from("batches")
    .select("id, batch_name, center_id")
    .in("center_id", centerIds)
    .order("batch_name");

  if (batchesResult.error) throw batchesResult.error;

  const centerById = new Map(centers.map(center => [String(center.id), center]));
  const batches = (batchesResult.data || [])
    .filter(batch => batch.center_id && centerById.has(String(batch.center_id)))
    .map(batch => ({
      batchId: String(batch.id),
      batchName: batch.batch_name || "Unnamed batch",
      centerId: String(batch.center_id),
      centerName: centerById.get(String(batch.center_id)).center_name || "Unnamed center",
      present: 0,
      absent: 0
    }));

  return {
    centers: centers.map(center => ({
      centerId: String(center.id),
      centerName: center.center_name || "Unnamed center",
      batches: batches.filter(batch => batch.centerId === String(center.id))
    }))
  };
}
