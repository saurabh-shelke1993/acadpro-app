import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { authorizeAnalyticsProfile } from "./authorizationUtils.ts";

const userId = "11111111-1111-4111-8111-111111111111";
const academyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherAcademyId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

Deno.test("authorizes matching Academy Owner profile and academy scope", () => {
  assertEquals(
    authorizeAnalyticsProfile({ id: userId, role: "academy_owner", academy_id: academyId }, userId, academyId),
    { authorized: true },
  );
});

Deno.test("rejects missing profile", () => {
  assertEquals(
    authorizeAnalyticsProfile(null, userId, academyId),
    { authorized: false, reason: "Analytics access is not configured for this user." },
  );
});

Deno.test("rejects profile identity mismatch", () => {
  assertEquals(
    authorizeAnalyticsProfile({ id: otherAcademyId, role: "academy_owner", academy_id: academyId }, userId, academyId),
    { authorized: false, reason: "Analytics access is not configured for this user." },
  );
});

Deno.test("rejects roles other than Academy Owner", () => {
  for (const role of ["super_admin", "coach", "parent", "unknown"]) {
    assertEquals(
      authorizeAnalyticsProfile({ id: userId, role, academy_id: academyId }, userId, academyId),
      { authorized: false, reason: "Analytics preview is available to Academy Owners only." },
    );
  }
});

Deno.test("rejects profiles without academy assignment", () => {
  assertEquals(
    authorizeAnalyticsProfile({ id: userId, role: "academy_owner", academy_id: null }, userId, academyId),
    { authorized: false, reason: "Your account is not linked to an academy." },
  );
});

Deno.test("rejects cross-academy request scope", () => {
  assertEquals(
    authorizeAnalyticsProfile({ id: userId, role: "academy_owner", academy_id: academyId }, userId, otherAcademyId),
    { authorized: false, reason: "The requested academy is outside your account scope." },
  );
});
