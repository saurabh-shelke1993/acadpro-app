export type AnalyticsAuthorizationDecision =
  | { authorized: true }
  | { authorized: false; reason: string };

type AnalyticsProfile = {
  id?: unknown;
  role?: unknown;
  academy_id?: unknown;
} | null | undefined;

/**
 * Analytics V2 preview is currently an Academy Owner capability.
 * Identity must match the Auth-verified user and tenant scope must come
 * from the trusted public.users profile, never from client claims.
 */
export function authorizeAnalyticsProfile(
  profile: AnalyticsProfile,
  authenticatedUserId: string,
  requestedAcademyId: string,
): AnalyticsAuthorizationDecision {
  if (!profile || profile.id !== authenticatedUserId) {
    return { authorized: false, reason: "Analytics access is not configured for this user." };
  }
  if (profile.role !== "academy_owner") {
    return { authorized: false, reason: "Analytics preview is available to Academy Owners only." };
  }
  if (typeof profile.academy_id !== "string" || profile.academy_id.length === 0) {
    return { authorized: false, reason: "Your account is not linked to an academy." };
  }
  if (profile.academy_id !== requestedAcademyId) {
    return { authorized: false, reason: "The requested academy is outside your account scope." };
  }
  return { authorized: true };
}

/** Extract a bearer access token without accepting API keys or malformed headers. */
export function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}
