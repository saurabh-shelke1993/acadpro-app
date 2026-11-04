import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AcademyOwnerDashboardC27 from "./AcademyOwnerDashboardC27";
import { recordedMarkSummary } from "./academyOwnerC25Adapter";

const fixture = {
  academyName: "Demo Football Academy",
  totals: {players:22,centers:2,batches:3},
  centers: [
    {id:"center-a",academyId:"academy-a",name:"North Ground",players:15,
      ageGroups:[{name:"Juniors (U10)",players:15},{name:"Seniors (U16)",players:0}]},
    {id:"center-b",academyId:"academy-a",name:"South Ground",players:7,
      ageGroups:[{name:"Under 12",players:7}]}
  ],
  todaySessions: [
    {id:"s1",centerId:"center-a",batchId:"b1",centerName:"North Ground",batchName:"Juniors",startTime:"17:00",endTime:"18:00",attendanceRecorded:true},
    {id:"s2",centerId:"center-a",batchId:"b2",centerName:"North Ground",batchName:"Seniors",startTime:"18:00",endTime:"19:00",attendanceRecorded:false},
    {id:"s3",centerId:"center-b",batchId:"b3",centerName:"South Ground",batchName:"Under 12",startTime:"17:00",endTime:"18:00",attendanceRecorded:false},
    {id:"s4",centerId:"center-b",batchId:"b4",centerName:"South Ground",batchName:"Under 14",startTime:"18:00",endTime:"19:00",attendanceRecorded:false},
    {id:"s5",centerId:"center-a",batchId:"b5",centerName:"North Ground",batchName:"Under 8",startTime:"16:00",endTime:"17:00",attendanceRecorded:false}
  ],
  attendanceByBatch: [
    {id:"b1",centerName:"North Ground",batchName:"Juniors",presentRecords:8,totalRecords:10},
    {id:"b2",centerName:"North Ground",batchName:"Seniors",presentRecords:1,totalRecords:2},
    {id:"b3",centerName:"South Ground",batchName:"Under 12",presentRecords:0,totalRecords:0}
  ],
  financial: {
    totalBilledThisMonth:20000,collectionsThisMonth:12000,expensesThisMonth:1000,
    outstandingAmount:8000,pendingDues:3,partialDues:1,paidDues:4,collectionRate:60
  },
  enquirySummary: {
    total:6, groups:[
      {centerId:"center-a",centerName:"North Ground",total:4},
      {centerId:"center-b",centerName:"South Ground",total:2}
    ]
  }
};
const mount = (data = fixture) => render(
  <MemoryRouter><AcademyOwnerDashboardC27 data={data}/></MemoryRouter>
);
const section = name => screen.getByRole("region", {name});

test("renders Academy Owner identity and existing total-links without new service calls",()=>{
  mount();
  expect(screen.getByRole("heading",{name:"Academy overview"})).toBeInTheDocument();
  expect(screen.getByText(/Demo Football Academy/)).toBeInTheDocument();
  const totals = screen.getByRole("navigation",{name:"Academy totals"});
  expect(within(totals).getByText("22")).toBeInTheDocument();
  expect(within(totals).getByText("2")).toBeInTheDocument();
  expect(within(totals).getByText("3")).toBeInTheDocument();
  expect(within(totals).getByRole("link",{name:/Players/i})).toHaveAttribute("href","/players");
  expect(within(totals).getByRole("link",{name:/Centers/i})).toHaveAttribute("href","/centers");
  expect(within(totals).getByRole("link",{name:/Batches/i})).toHaveAttribute("href","/batches");
});
test("distinguishes center memberships from unique players",()=>{
  mount({...fixture,totals:{...fixture.totals,players:21}});
  expect(within(section("Players by center")).getByText(/Assignments, not unique players/i)).toBeInTheDocument();
  expect(within(screen.getByRole("navigation",{name:"Academy totals"})).getByText("21")).toBeInTheDocument();
});
test("center selector changes batch panel and retains zero-player batches",()=>{
  mount();
  const overview = section("Players by center");
  expect(within(overview).getByText("Seniors (U16)")).toBeInTheDocument();
  expect(within(overview).getByText("Seniors (U16)").closest(".c27-batch-row")).toHaveTextContent("0");
  fireEvent.click(within(overview).getByRole("button",{name:/South Ground/}));
  expect(within(overview).getByText("Under 12")).toBeInTheDocument();
  expect(within(overview).queryByText("Seniors (U16)")).not.toBeInTheDocument();
  const link=within(overview).getByRole("link",{name:/View center players/i});
  expect(link.getAttribute("href")).toContain("centerId=center-b");
  expect(link.getAttribute("href")).toContain("academyId=academy-a");
});
test("all scheduled sessions remain visible as directly actionable links",()=>{
  mount();
  const training=section("Today's training sessions");
  expect(within(training).getAllByRole("link",{name:/Open attendance for/})).toHaveLength(5);
  expect(within(training).getByText("Under 8")).toBeInTheDocument();
  expect(within(training).queryByRole("button",{name:/Show all/i})).not.toBeInTheDocument();
  expect(within(training).getByRole("link",{name:/Open attendance for Juniors at North Ground/}).getAttribute("href"))
    .toContain("batchId=b1");
});
test("session mark labels do not overclaim complete batch coverage",()=>{
  mount();
  const training=section("Today's training sessions");
  expect(within(training).getByText("Recorded")).toBeInTheDocument();
  expect(within(training).getAllByText("No marks")).toHaveLength(4);
  expect(within(training).getByText(/not that the full batch is complete/)).toBeInTheDocument();
});
test("weighted recorded attendance is separate from number of batches with marks",()=>{
  mount();
  const attendance=section("Weekly attendance by batch");
  expect(within(attendance).getByText("75%")).toBeInTheDocument();
  expect(within(attendance).getByText("2/3")).toBeInTheDocument();
  expect(within(attendance).getByText(/not scheduled training sessions/)).toBeInTheDocument();
  expect(recordedMarkSummary(fixture.attendanceByBatch).marked).toBe(12);
});
test("center attendance filter controls only visible rows, not global totals",()=>{
  mount();
  const attendance=section("Weekly attendance by batch");
  const filter=within(attendance).getByRole("combobox",{name:"Filter attendance by center"});
  fireEvent.change(filter,{target:{value:"South Ground"}});
  expect(within(attendance).getByText("Under 12")).toBeInTheDocument();
  expect(within(attendance).queryByText("Juniors")).not.toBeInTheDocument();
  expect(within(attendance).getByText("75%")).toBeInTheDocument();
  fireEvent.change(filter,{target:{value:"all"}});
  expect(within(attendance).getByText("Juniors")).toBeInTheDocument();
});
test("attendance absent marks show no-data rather than zero percent",()=>{
  mount({...fixture,attendanceByBatch:[]});
  expect(within(section("Weekly attendance by batch")).getByText("No recorded attendance marks")).toBeInTheDocument();
});
test("financial metric links retain monetary definitions and due counts",()=>{
  mount();
  const finance=section("Monthly finances");
  expect(within(finance).getByText("Collected this month")).toBeInTheDocument();
  expect(within(finance).getByText("Current outstanding")).toBeInTheDocument();
  expect(within(finance).getByText("Billed this month")).toBeInTheDocument();
  expect(within(finance).getByText("Expenses this month")).toBeInTheDocument();
  expect(within(finance).getByText("₹12,000")).toBeInTheDocument();
  expect(within(finance).getByText("₹8,000")).toBeInTheDocument();
  expect(within(finance).getByText("60%")).toBeInTheDocument();
  expect(within(finance).getByText("Pending")).toBeInTheDocument();
  expect(within(finance).getByText("Partial")).toBeInTheDocument();
  expect(within(finance).getByText("Paid")).toBeInTheDocument();
});
test("zero billed month makes rate N/A while outstanding remains visible",()=>{
  mount({...fixture,financial:{...fixture.financial,totalBilledThisMonth:0,collectionsThisMonth:0,collectionRate:0,outstandingAmount:1400}});
  const finance=section("Monthly finances");
  expect(within(finance).getByText("N/A")).toBeInTheDocument();
  expect(within(finance).getByText("₹1,400")).toBeInTheDocument();
  expect(within(finance).getByText(/no dues billed this month/)).toBeInTheDocument();
});
test("missing finances are never mislabeled as zero amounts",()=>{
  mount({...fixture,financial:null});
  expect(within(section("Monthly finances")).getByText("Finances unavailable")).toBeInTheDocument();
});
test("enquiries links preserve centerId scope",()=>{
  mount();
  const admissions=section("Admissions and enquiries");
  expect(within(admissions).getByText("6")).toBeInTheDocument();
  expect(within(admissions).getByRole("link",{name:"View enquiries for North Ground"}).getAttribute("href"))
    .toContain("centerId=center-a");
});
test("compare links retain old preview and original dashboard",()=>{
  mount();
  expect(screen.getByRole("link",{name:"Previous preview"})).toHaveAttribute("href","/ui-c2-5-preview");
  expect(screen.getByRole("link",{name:/Current dashboard/i})).toHaveAttribute("href","/dashboard");
});
test("empty academy renders without false numbers",()=>{
  mount({...fixture,centers:[],todaySessions:[],attendanceByBatch:[],enquirySummary:{total:0,groups:[]}});
  expect(within(section("Players by center")).getByText("No centers configured")).toBeInTheDocument();
  expect(within(section("Today's training sessions")).getByText("No training scheduled today")).toBeInTheDocument();
  expect(within(section("Weekly attendance by batch")).getByText("No recorded attendance marks")).toBeInTheDocument();
});
test("no dashboard source data renders an explicit failure state",()=>{
  mount(null);
  expect(screen.getByRole("status")).toHaveTextContent("Dashboard unavailable");
});


test("preview palette switches among three named themes without global state",()=>{
  mount();
  const preview = document.querySelector(".c27-dashboard");
  const picker = screen.getByRole("group",{name:"Preview dashboard color palette"});
  expect(preview).toHaveAttribute("data-palette","classic");
  expect(within(picker).getByRole("button",{name:"Classic Blue"})).toHaveAttribute("aria-pressed","true");
  fireEvent.click(within(picker).getByRole("button",{name:"Pitchside Emerald"}));
  expect(preview).toHaveAttribute("data-palette","pitchside");
  expect(within(picker).getByRole("button",{name:"Pitchside Emerald"})).toHaveAttribute("aria-pressed","true");
  fireEvent.click(within(picker).getByRole("button",{name:"Floodlight Indigo"}));
  expect(preview).toHaveAttribute("data-palette","floodlight");
  fireEvent.click(within(picker).getByRole("button",{name:"Classic Blue"}));
  expect(preview).toHaveAttribute("data-palette","classic");
  expect(document.body).not.toHaveAttribute("data-palette");
});
test("weekly training pulse shows actual present/recorded counts not a decorative 100-percent bar",()=>{
  mount();
  const attendance=section("Weekly attendance by batch");
  expect(within(attendance).getByText("Training batch pulse")).toBeInTheDocument();
  expect(within(attendance).getByText("8/10 present")).toBeInTheDocument();
  expect(within(attendance).getByText("1/2 present")).toBeInTheDocument();
  expect(within(attendance).getByText("Not recorded")).toBeInTheDocument();
  const segments=attendance.querySelectorAll(".c28-attendance-segment");
  expect(segments).toHaveLength(20);
  expect(within(attendance).getByRole("img",{name:/Juniors: 80% of recorded marks present, 8 of 10/})).toBeInTheDocument();
  expect(within(attendance).getByText(/No marks.*does not mean 0% attendance/)).toBeInTheDocument();
});
test("center selection preserves academy-wide recorded-mark rate and mark counts",()=>{
  mount();
  const attendance=section("Weekly attendance by batch");
  fireEvent.change(within(attendance).getByRole("combobox",{name:"Filter attendance by center"}),{target:{value:"South Ground"}});
  expect(within(attendance).getByText("75%")).toBeInTheDocument();
  expect(within(attendance).getByText("2/3")).toBeInTheDocument();
  expect(within(attendance).getByText("Not recorded")).toBeInTheDocument();
});
test("touchline action remains scoped to existing attendance navigation",()=>{
  mount();
  const training=section("Today's training sessions");
  expect(within(training).getByRole("link",{name:/Attendance workspace/})).toHaveAttribute("href","/attendance");
  expect(within(training).getByText("4 sessions have no marks recorded yet")).toBeInTheDocument();
  expect(within(training).getAllByRole("link",{name:/Open attendance for/})).toHaveLength(5);
});
