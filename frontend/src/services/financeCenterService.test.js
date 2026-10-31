jest.mock("../supabaseClient", () => ({ supabase: { from: jest.fn() } }));
import { aggregateCenterCollections } from "./financeCenterService";
describe("F6 center attribution", () => {
  const centers = [{ id: "a", center_name: "Alpha" }, { id: "b", center_name: "Beta" }];
  const players = [{ id: "p1", center_id: "a" }, { id: "p2", center_id: "b" }, { id: "p3", center_id: null }];
  test("preserves academy gross and separates signed adjustments", () => {
    const result = aggregateCenterCollections(centers, players, [
      { player_id: "p1", payment_entry_type: "payment", amount_paid: 100 },
      { player_id: "p1", payment_entry_type: "adjustment", amount_paid: -10 },
      { player_id: "p2", payment_entry_type: "payment", amount_paid: 300 }
    ]);
    expect(result.academyGross).toBe(400);
    expect(result.centers[0].centerName).toBe("Beta");
    expect(result.centers[0].contributionPercent).toBe(75);
    expect(result.centers[1].adjustments).toBe(-10);
  });
  test("retains unassigned amounts instead of silently dropping payments", () => {
    const result = aggregateCenterCollections(centers, players, [
      { player_id: "p3", payment_entry_type: "payment", amount_paid: 50 },
      { player_id: "p1", payment_entry_type: "payment", amount_paid: 50 }
    ]);
    expect(result.academyGross).toBe(100);
    expect(result.unattributedGross).toBe(50);
    expect(result.centers[0].contributionPercent).toBe(50);
  });
  test("zero-collection centers stay visible", () => {
    const result = aggregateCenterCollections(centers, players, []);
    expect(result.centers).toHaveLength(2);
    expect(result.centers[0].contributionPercent).toBeNull();
  });
});
