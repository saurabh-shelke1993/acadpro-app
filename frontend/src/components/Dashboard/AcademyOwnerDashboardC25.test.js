import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AcademyOwnerDashboardC25 from "./AcademyOwnerDashboardC25";
import {
  adaptOwnerData, recordedMarkSummary, centerPlayersPath,
  attendancePath, enquiriesPath, formatMoney
} from "./academyOwnerC25Adapter";

const fixture = {
  academyName: "Demo Football Academy",
  totals: {players:22,centers:2,batches:3},
  centers:[
    {id:"center-a",academyId:"academy-a",name:"North Ground",players:15,ageGroups:[{name:"Juniors (U10)",players:15},{name:"Seniors (U16)",players:0}]},
    {id:"center-b",academyId:"academy-a",name:"South Ground",players:7,ageGroups:[{name:"Under 12",players:7}]}
  ],
  todaySessions:[
    {id:"s1",centerId:"center-a",batchId:"b1",centerName:"North Ground",batchName:"Juniors",startTime:"17:00",endTime:"18:00"},
    {id:"s2",centerId:"center-a",batchId:"b2",centerName:"North Ground",batchName:"Seniors",startTime:"18:00",endTime:"19:00"},
    {id:"s3",centerId:"center-b",batchId:"b3",centerName:"South Ground",batchName:"Under 12",startTime:"17:00",endTime:"18:00"},
    {id:"s4",centerId:"center-b",batchId:"b4",centerName:"South Ground",batchName:"Under 14",startTime:"18:00",endTime:"19:00"},
    {id:"s5",centerId:"center-a",batchId:"b5",centerName:"North Ground",batchName:"Under 8",startTime:"16:00",endTime:"17:00"}
  ],
  attendanceByBatch:[
    {id:"b1",centerName:"North Ground",batchName:"Juniors",presentRecords:8,totalRecords:10},
    {id:"b2",centerName:"North Ground",batchName:"Seniors",presentRecords:1,totalRecords:2},
    {id:"b3",centerName:"South Ground",batchName:"Under 12",presentRecords:0,totalRecords:0}
  ],
  financial:{totalBilledThisMonth:20000,collectionsThisMonth:12000,expensesThisMonth:1000,outstandingAmount:8000,pendingDues:3,partialDues:1,paidDues:4,collectionRate:60},
  enquirySummary:{total:6,groups:[{centerId:"center-a",centerName:"North Ground",total:4},{centerId:"center-b",centerName:"South Ground",total:2}]}
};

const mount = (data=fixture) => render(<MemoryRouter><AcademyOwnerDashboardC25 data={data}/></MemoryRouter>);

test("uses existing data contract without replacing zero-player batches",()=>{
  const x=adaptOwnerData(fixture);
  expect(x.centers[0].batches[1]).toEqual(expect.objectContaining({name:"Seniors (U16)",players:0}));
  expect(x.totals.players).toBe(22);
});
test("attendance is weighted by recorded present/absent marks and excludes no-data batches",()=>{
  expect(recordedMarkSummary(fixture.attendanceByBatch)).toEqual(expect.objectContaining({rate:75,marked:12,recordedBatches:2,totalBatches:3}));
  expect(recordedMarkSummary([]).rate).toBeNull();
});
test("missing financial data and zero are distinct",()=>{
  expect(formatMoney(null)).toBe("—");
  expect(formatMoney(0)).toBe("₹0");
});
test("preserves exact scoped navigation parameter names",()=>{
  expect(centerPlayersPath(fixture.centers[0])).toContain("academyId=academy-a");
  expect(centerPlayersPath(fixture.centers[0])).toContain("centerId=center-a");
  expect(attendancePath(fixture.todaySessions[0])).toContain("batchId=b1");
  expect(enquiriesPath(fixture.enquirySummary.groups[0])).toContain("centerId=center-a");
});
test("renders all original finance amount labels and status counts",()=>{
  mount();
  expect(screen.getByText("Billed this month")).toBeInTheDocument();
  expect(screen.getByText("Collected this month")).toBeInTheDocument();
  expect(screen.getByText("Expenses this month")).toBeInTheDocument();
  expect(screen.getByText("Current outstanding")).toBeInTheDocument();
  expect(screen.getByText("Pending")).toBeInTheDocument();
  expect(screen.getByText("Partial")).toBeInTheDocument();
  expect(screen.getByText("Paid")).toBeInTheDocument();
});
test("center selection updates batch breakdown, including empty age groups",()=>{
  mount();
  expect(screen.getByText("Seniors (U16)")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:/South Ground/}));
  expect(screen.getAllByText("Under 12").length).toBeGreaterThan(0);
  expect(screen.queryByText("Seniors (U16)")).not.toBeInTheDocument();
});
test("all scheduled sessions are visible without expansion",()=>{
  mount();
  expect(screen.getByText("Under 8")).toBeInTheDocument();
  expect(screen.getAllByRole("link",{name:/Open attendance for/})).toHaveLength(5);
  expect(screen.queryByRole("button",{name:/Show all/})).not.toBeInTheDocument();
});
test("marks-exist state is distinct from no marks without claiming complete coverage",()=>{
  mount({...fixture,todaySessions:fixture.todaySessions.map((s,i)=>({...s,attendanceRecorded:i===0}))});
  expect(screen.getByText("Marks recorded")).toBeInTheDocument();
  expect(screen.getAllByText("No marks yet")).toHaveLength(4);
  expect(screen.getByText(/does not confirm every player/)).toBeInTheDocument();
});
test("unbilled month displays N/A collection rate, without rewriting outstanding",()=>{
  mount({...fixture,financial:{...fixture.financial,totalBilledThisMonth:0,collectionsThisMonth:0,collectionRate:0,outstandingAmount:1400}});
  expect(screen.getByText("N/A")).toBeInTheDocument();
  expect(screen.getByText("₹1,400")).toBeInTheDocument();
  expect(screen.getByText(/no dues were billed this month/i)).toBeInTheDocument();
});
test("attendance summary distinguishes recorded-mark rate from batch coverage",()=>{
  mount();
  expect(screen.getByText("75%")).toBeInTheDocument();
  expect(screen.getByText("2 of 3")).toBeInTheDocument();
  expect(screen.getByText(/not training-session coverage/i)).toBeInTheDocument();
});
test("preview remains isolated from production dashboard and links back",()=>{
  mount();
  expect(screen.getByRole("link",{name:/Current dashboard/i})).toHaveAttribute("href","/dashboard");
  expect(screen.getByText("UI-C2.6 preview")).toBeInTheDocument();
});
test("zero attendance is shown as unavailable rather than zero percent",()=>{
  mount({...fixture,attendanceByBatch:[]});
  expect(screen.getByText("No attendance marks")).toBeInTheDocument();
});
