import { suggestCenterCode, groupCoachesByCenter } from "./centerPresentation";
test("center initials suggest LA GB HE", () => {
  expect(suggestCenterCode("Lodha Amara")).toBe("LA");
  expect(suggestCenterCode("GawandBaug")).toBe("GA");
  expect(suggestCenterCode("Hiranandani Estate")).toBe("HE");
});
test("active schedule assignments deduplicate coaches per center and academy", () => {
  const assignment = (id, center, academy="a", active=true) => ({
    academy_id: academy, is_active: active,
    coaches: { id, full_name: id, is_active: true },
    batch_schedules: { center_id: center, is_active: true }
  });
  expect(groupCoachesByCenter([assignment("coach1","center1"),assignment("coach1","center1"),assignment("coach2","center1"),assignment("coach3","center2","b")],"a"))
    .toEqual({center1:[{id:"coach1",name:"coach1"},{id:"coach2",name:"coach2"}]});
});
