import { selectPlayerSessionIds } from "./playerSessionDefaults";

const schedules = [{id:"s1",is_active:true},{id:"s2",is_active:true},{id:"s3",is_active:false}];

test("new player defaults to all active batch sessions", () => {
  expect(selectPlayerSessionIds({ schedules, editing:false, batchId:"b1" })).toEqual(["s1","s2"]);
});
test("editing preserves only actual active matching enrollments", () => {
  const enrollments = [
    { batch_schedule_id:"s2",is_active:true,batch_schedules:{batch_id:"b1"} },
    { batch_schedule_id:"s1",is_active:false,batch_schedules:{batch_id:"b1"} },
    { batch_schedule_id:"s3",is_active:true,batch_schedules:{batch_id:"b1"} },
    { batch_schedule_id:"s1",is_active:true,batch_schedules:{batch_id:"other"} }
  ];
  expect(selectPlayerSessionIds({ schedules, enrollments, editing:true, batchId:"b1" })).toEqual(["s2"]);
});
test("empty batch schedule never invents enrollment", () => {
  expect(selectPlayerSessionIds({ schedules:[], editing:false })).toEqual([]);
  expect(selectPlayerSessionIds({ schedules:[], editing:true, enrollments:[] })).toEqual([]);
});
