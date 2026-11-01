import { compareBatchListRows } from "./batchListSort";

const batch = (id, center, name = id, academy = "Academy") => ({
  id, center_id: center, batch_name: name,
  academies: { academy_name: academy }
});
const centers = [
  { id: "c1", center_name: "Lodha Amara" },
  { id: "c2", center_name: "GawandBaugh" }
];
const schedules = {
  a: [{ dayOfWeek: 3, startTime: "17:00" }],
  b: [{ dayOfWeek: 1, startTime: "18:00" }],
  c: [{ dayOfWeek: 1, startTime: "17:00" }],
  d: [{ dayOfWeek: 1, startTime: "16:00" }]
};
test("groups centers first, then earliest weekday and start time", () => {
  const list = [
    batch("a", "c2"),
    batch("b", "c1"),
    batch("c", "c1"),
    batch("d", "c1")
  ];
  expect(list.sort((l, r) => compareBatchListRows(l, r, schedules, centers))
    .map(item => item.id)).toEqual(["a", "d", "c", "b"]);
});
test("unscheduled batches sort last and ties sort by batch name", () => {
  const list = [batch("z", "c1", "Zebra"), batch("a", "c1", "Alpha"), batch("b", "c1", "Beta")];
  expect(list.sort((l,r) => compareBatchListRows(l,r,{},centers)).map(item=>item.batch_name))
    .toEqual(["Alpha", "Beta", "Zebra"]);
});
test("uses academy sorting before center sorting when superadmin views multiple academies", () => {
  expect(compareBatchListRows(batch("a","c2","A","A Academy"),
    batch("b","c1","B","B Academy"),{},centers)).toBeLessThan(0);
});
