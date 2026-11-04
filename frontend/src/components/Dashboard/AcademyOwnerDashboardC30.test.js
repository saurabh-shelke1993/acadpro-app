import {fireEvent,render,screen,within} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import AcademyOwnerDashboardC27 from "./AcademyOwnerDashboardC27";

const fixture={
  academyName:"Test Football FC",
  totals:{players:12,centers:2,batches:3},
  centers:[
    {id:"north",academyId:"academy-1",name:"North Ground",players:8,
      ageGroups:[{name:"Juniors (U10)",players:8},{name:"Seniors (U16)",players:0}]},
    {id:"south",academyId:"academy-1",name:"South Ground",players:4,
      ageGroups:[{name:"Under 12",players:4}]}
  ],
  todaySessions:[
    {id:"s1",centerId:"north",batchId:"batch-1",centerName:"North Ground",batchName:"Juniors",startTime:"17:00",endTime:"18:00",attendanceRecorded:false}
  ],
  attendanceByBatch:[
    {id:"batch-1",centerName:"North Ground",batchName:"Juniors",presentRecords:7,totalRecords:10},
    {id:"batch-2",centerName:"South Ground",batchName:"Under 12",presentRecords:0,totalRecords:0}
  ],
  financial:{
    totalBilledThisMonth:10000,collectionsThisMonth:7000,expensesThisMonth:900,
    outstandingAmount:3000,pendingDues:2,partialDues:1,paidDues:3,collectionRate:70
  },
  enquirySummary:{total:3,groups:[{centerId:"north",centerName:"North Ground",total:3}]}
};
const mount=(data=fixture)=>render(
  <MemoryRouter><AcademyOwnerDashboardC27 data={data} pitchsideSelected /></MemoryRouter>
);
const section=name=>screen.getByRole("region",{name});

test("Pitchside Emerald is selected on the new preview and cannot be switched",()=>{
  mount();
  const page=document.querySelector(".c27-dashboard");
  expect(page).toHaveClass("c30-pitchside");
  expect(page).toHaveAttribute("data-palette","pitchside");
  expect(screen.getByText(/PITCHSIDE EMERALD.*SELECTED THEME/)).toBeInTheDocument();
  expect(screen.queryByRole("group",{name:"Preview dashboard color palette"})).not.toBeInTheDocument();
  expect(screen.queryByRole("group",{name:"Select a dashboard design theme"})).not.toBeInTheDocument();
  expect(document.body).not.toHaveAttribute("data-palette");
});
test("selected theme changes only chart colors while retaining unique count and empty batches",()=>{
  mount();
  const overview=section("Players by center");
  const north=within(overview).getByRole("button",{name:/North Ground/});
  const color=north.querySelector(".c27-center-dot").style.background;
  expect(color).toBe("rgb(8, 124, 110)");
  expect(within(overview).getByText("Seniors (U16)")).toBeInTheDocument();
  const totals=screen.getByRole("navigation",{name:"Academy totals"});
  expect(within(totals).getByText("12")).toBeInTheDocument();
  fireEvent.click(within(overview).getByRole("button",{name:/South Ground/}));
  expect(within(overview).getByText("Under 12")).toBeInTheDocument();
  expect(within(overview).getByRole("link",{name:/View center players/}).getAttribute("href"))
    .toContain("centerId=south");
});
test("training attendance deep link and unmarked state remain available",()=>{
  mount();
  const training=section("Today's training sessions");
  expect(within(training).getByText("No marks")).toBeInTheDocument();
  expect(within(training).getByRole("link",{name:/Open attendance for Juniors at North Ground/}).getAttribute("href"))
    .toContain("batchId=batch-1");
  expect(within(training).getByRole("link",{name:/Attendance workspace/})).toHaveAttribute("href","/attendance");
});
test("weighted attendance and no-data statuses are preserved",()=>{
  mount();
  const attendance=section("Weekly attendance by batch");
  expect(within(attendance).getByText("70%")).toBeInTheDocument();
  expect(within(attendance).getByText("1/2")).toBeInTheDocument();
  expect(within(attendance).getByText("7/10 present")).toBeInTheDocument();
  expect(within(attendance).getByText("Not recorded")).toBeInTheDocument();
});
test("finance and enquiries use the same money values and scoped links",()=>{
  mount();
  const finance=section("Monthly finances");
  expect(within(finance).getByText("₹7,000")).toBeInTheDocument();
  expect(within(finance).getByText("₹3,000")).toBeInTheDocument();
  const enquiries=section("Admissions and enquiries");
  expect(within(enquiries).getByRole("link",{name:"View enquiries for North Ground"}).getAttribute("href"))
    .toContain("centerId=north");
});
test("a zero-billed month retains outstanding and displays N/A collection rate",()=>{
  mount({...fixture,financial:{...fixture.financial,totalBilledThisMonth:0,collectionsThisMonth:0,collectionRate:0}});
  const finance=section("Monthly finances");
  expect(within(finance).getByText("N/A")).toBeInTheDocument();
  expect(within(finance).getByText("₹3,000")).toBeInTheDocument();
});
test("selected theme links to existing comparison preview and original dashboard",()=>{
  mount();
  expect(screen.getByRole("link",{name:"Compare earlier themes"})).toHaveAttribute("href","/ui-c2-7-preview");
  expect(screen.getByRole("link",{name:/Current dashboard/})).toHaveAttribute("href","/dashboard");
});
test("unavailable data is handled without rendering fictional academy numbers",()=>{
  mount(null);
  expect(screen.getByRole("status")).toHaveTextContent("Dashboard unavailable");
});
