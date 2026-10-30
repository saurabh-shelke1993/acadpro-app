import type { Scope } from "./requestUtils.ts";
export type CenterRecord = { id: string; academy_id: string };
export type BatchRecord = { id: string; academy_id: string; center_id: string | null };
export interface ScopeOwnershipLookup {
  academyExists(academyId: string): Promise<boolean>;
  findCenter(centerId: string): Promise<CenterRecord | null>;
  findBatch(batchId: string): Promise<BatchRecord | null>;
}
/** Validates tenant ownership using records loaded by a trusted server-side adapter. */
export async function validateScopeOwnership(scope: Scope, lookup: ScopeOwnershipLookup): Promise<void> {
  if (!await lookup.academyExists(scope.academyId)) throw new Error("Academy does not exist.");
  if (scope.scopeType === "academy") {
    if (scope.scopeId !== scope.academyId) throw new Error("Academy scope ID must match academy ID.");
    return;
  }
  if (scope.scopeType === "center") {
    const center = await lookup.findCenter(scope.scopeId);
    if (!center || center.academy_id !== scope.academyId) throw new Error("Center is not owned by the requested academy.");
    return;
  }
  const batch = await lookup.findBatch(scope.scopeId);
  if (!batch || batch.academy_id !== scope.academyId) throw new Error("Batch is not owned by the requested academy.");
  if (batch.center_id) {
    const center = await lookup.findCenter(batch.center_id);
    if (!center || center.academy_id !== scope.academyId) throw new Error("Batch center does not belong to the requested academy.");
  }
}
