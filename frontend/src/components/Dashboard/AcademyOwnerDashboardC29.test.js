import {fireEvent, render, screen, within} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import AcademyOwnerDashboardC27 from "./AcademyOwnerDashboardC27";

const fixture = {
  academyName:"Test Football FC",
  totals:{players:12,centers:2,batches:3},
  centers:[
    {id:"north",academyId:"academy-1",name:"North Ground",players:8,
      ageGroups:[{name:"Juniors (U10)",players:8},{name:"Seniors (U16)",players:0}]},
    {id:"south",academyId:"academy-1",name:"South Ground",players:4,
      ageGroups:[{name:"Under 12",players:4}]}
  ],
  todaySessions:[
    {id:"session-1",centerId:"north",batchId:"batch-1",centerName:"North Ground",batchName:"Juniors",startTime:"17:00",endTime:"18:00",attendanceRecorded:false}
  ],
  attendanceByBatch:[
    {id:"batch-1",centerName:"North Ground",batchName:"Juniors",presentRecords:7,totalRecords:10},
    {id:"batch-2",centerName:"South Ground",batchName:"Under 12",presentRecords:0,totalRecords:0}
  ],
  financial:{
    totalBilledThisMonth:10000,collectionsThisMonth:7000,expensesThisMonth:900,outstandingAmount:3000,
    pendingDues:2,partialDues:1,paidDues:3,collectionRate:70
  },
  enquirySummary:{total:3,groups:[{centerId:"north",centerName:"North Ground",total:3}]}
};
const mount = () => render(<MemoryRouter><AcademyOwnerDashboardC27 data={fixture} paletteLab /></MemoryRouter>);
const gallery = () => screen.getByRole("group",{name:"Select a dashboard design theme"});

test("five palettes are available and none repeats the previous three themes",()=>{
  mount();
  expect(within(gallery()).getAllByRole("button")).toHaveLength(5);
  const names=["Stadium Scarlet","Heritage Maroon","Terracotta & Sand","Amethyst & Blush","Onyx & Gold"];
  names.forEach(name=>expect(within(gallery()).getByRole("button",{name:"Preview "+name})).toBeInTheDocument());
  expect(within(gallery()).queryByRole("button",{name:/Classic Blue|Pitchside Emerald|Floodlight Indigo/})).not.toBeInTheDocument();
});
test("changing all five palette choices alters the dashboard only",()=>{
  mount();
  const root=document.querySelector(".c29-lab");
  expect(root).toHaveAttribute("data-palette","scarlet");
  for(const [name,id] of [
    ["Heritage Maroon","maroon"],
    ["Terracotta & Sand","terracotta"],
    ["Amethyst & Blush","amethyst"],
    ["Onyx & Gold","onyx"],
    ["Stadium Scarlet","scarlet"]]){
      fireEvent.click(within(gallery()).getByRole("button",{name:"Preview "+name}));
      expect(root).toHaveAttribute("data-palette",id);
      expect(within(gallery()).getByRole("button",{name:"Preview "+name})).toHaveAttribute("aria-pressed","true");
  }
  expect(document.body).not.toHaveAttribute("data-palette");
});
test("center donut and legend palette adapt while real counts stay unchanged",()=>{
  mount();
  const overview=screen.getByRole("region",{name:"Players by center"});
  const north=within(overview).getByRole("button",{name:/North Ground/});
  const previous=north.querySelector(".c27-center-dot").style.background;
  expect(within(overview).getByText("Seniors (U16)")).toBeInTheDocument();
  fireEvent.click(within(gallery()).getByRole("button",{name:"Preview Amethyst & Blush"}));
  const changed=north.querySelector(".c27-center-dot").style.background;
  expect(changed).not.toBe(previous);
  expect(within(overview).getByText("Seniors (U16)")).toBeInTheDocument();
  expect(within(overview).getAllByText("8").length).toBeGreaterThan(0);
});
test("palettes preserve training attendance links and unrecorded status",()=>{
  mount();
  const training=screen.getByRole("region",{name:"Today's training sessions"});
  const attendance=within(training).getByRole("link",{name:/Open attendance for Juniors at North Ground/});
  const href=attendance.getAttribute("href");
  expect(href).toContain("batchId=batch-1");
  fireEvent.click(within(gallery()).getByRole("button",{name:"Preview Onyx & Gold"}));
  expect(within(training).getByRole("link",{name:/Open attendance for Juniors at North Ground/})).toHaveAttribute("href",href);
  expect(within(training).getByText("No marks")).toBeInTheDocument();
});
test("financial values and due counts do not change when design theme changes",()=>{
  mount();
  const finances=screen.getByRole("region",{name:"Monthly finances"});
  expect(within(finances).getByText("₹7,000")).toBeInTheDocument();
  expect(within(finances).getByText("₹3,000")).toBeInTheDocument();
  expect(within(finances).getByText("70%")).toBeInTheDocument();
  fireEvent.click(within(gallery()).getByRole("button",{name:"Preview Heritage Maroon"}));
  expect(within(finances).getByText("₹7,000")).toBeInTheDocument();
  expect(within(finances).getByText("₹3,000")).toBeInTheDocument();
  expect(within(finances).getByText("70%")).toBeInTheDocument();
});
test("design gallery does not interfere with attendance center filtering",()=>{
  mount();
  const attendance=screen.getByRole("region",{name:"Weekly attendance by batch"});
  const selector=within(attendance).getByRole("combobox",{name:"Filter attendance by center"});
  fireEvent.change(selector,{target:{value:"South Ground"}});
  expect(within(attendance).getByText("Under 12")).toBeInTheDocument();
  fireEvent.click(within(gallery()).getByRole("button",{name:"Preview Terracotta & Sand"}));
  expect(selector).toHaveValue("South Ground");
  expect(within(attendance).getByText("Under 12")).toBeInTheDocument();
});
test("old dashboard and three-palette preview remain navigable",()=>{
  mount();
  expect(screen.getByRole("link",{name:"Existing palettes"})).toHaveAttribute("href","/ui-c2-7-preview");
  expect(screen.getByRole("link",{name:/Current dashboard/})).toHaveAttribute("href","/dashboard");
});
