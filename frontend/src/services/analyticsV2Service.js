import { supabase } from "../supabaseClient";

/**
 * Invoke the preview using the signed-in user's Supabase session.
 * The Edge Function verifies the JWT and derives the Academy Owner scope
 * from public.users; the browser never receives a service-role credential.
 */
export async function getAcademyOwnerAnalyticsV2(user, snapshotMonth) {
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
        snapshotMonth
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
