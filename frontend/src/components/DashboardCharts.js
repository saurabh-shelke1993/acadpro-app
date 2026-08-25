import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const formatCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN")}`;

function DashboardCharts({
  attendanceTrend = [],
  collectionsTrend = []
}) {
  const hasAttendanceData = attendanceTrend.some(
    (item) =>
      Number(item.present || 0) > 0 ||
      Number(item.absent || 0) > 0
  );

  const hasCollectionsData = collectionsTrend.some(
    (item) => Number(item.collections || 0) > 0
  );

  const totalPresent = attendanceTrend.reduce(
  (total, item) => total + Number(item.present || 0),
  0
);

const totalAbsent = attendanceTrend.reduce(
  (total, item) => total + Number(item.absent || 0),
  0
);

const totalAttendance = totalPresent + totalAbsent;

const hasAttendanceSummary = totalAttendance > 0;

const attendanceRate = hasAttendanceSummary
  ? Math.round((totalPresent / totalAttendance) * 100)
  : 0;

const totalCollections = collectionsTrend.reduce(
  (total, item) => total + Number(item.collections || 0),
  0
);

const averageMonthlyCollections = collectionsTrend.length
  ? Math.round(totalCollections / collectionsTrend.length)
  : 0;

  return (
    <>
    <div className="dashboard-insights">
<div className="dashboard-insight-card">
  <span className="dashboard-insight-label">
    Attendance Rate — Last 7 Days
  </span>

<strong
  className={
    hasAttendanceSummary
      ? "dashboard-insight-value"
      : "dashboard-insight-value dashboard-insight-no-data"
  }
>
  {hasAttendanceSummary ? `${attendanceRate}%` : "—"}
</strong>
 <span className="dashboard-insight-description">
    Present attendance percentage
  </span>
</div>

  <div className="dashboard-insight-card">
    <span className="dashboard-insight-label">
      Present — Last 7 Days
    </span>
<strong
  className={
    hasAttendanceSummary
      ? "dashboard-insight-value"
      : "dashboard-insight-value dashboard-insight-no-data"
  }
>
  {hasAttendanceSummary ? totalPresent : "—"}
</strong>
<span className="dashboard-insight-description">
  Total present attendance records
</span>
  </div>

  <div className="dashboard-insight-card">
    <span className="dashboard-insight-label">
      Absent — Last 7 Days
    </span>
<strong
  className={
    hasAttendanceSummary
      ? "dashboard-insight-value"
      : "dashboard-insight-value dashboard-insight-no-data"
  }
>
  {hasAttendanceSummary ? totalAbsent : "—"}
</strong>
<span className="dashboard-insight-description">
  Total absent attendance records
</span>
  </div>

  <div className="dashboard-insight-card">
    <span className="dashboard-insight-label">
      Collections — Last 6 Months
    </span>
    <strong>{formatCurrency(totalCollections)}</strong>
    <span className="dashboard-insight-description">
  Total payments collected
</span>
  </div>

  <div className="dashboard-insight-card">
    <span className="dashboard-insight-label">
      Avg. Monthly — Last 6 Months
    </span>
    <strong>{formatCurrency(averageMonthlyCollections)}</strong>
    <span className="dashboard-insight-description">
  Six-month collection average
</span>
  </div>
</div>

    <div className="dashboard-charts">
      {/* Attendance Trend */}
      <div className="dashboard-chart-card">
        <h2>Attendance Trend</h2>

        <p className="dashboard-chart-description">
          Present and absent attendance over the last 7 days
        </p>

        <div className="dashboard-chart">
          {hasAttendanceData ? (
            <ResponsiveContainer width="100%" height={300}>
  <ComposedChart data={attendanceTrend}>
    <CartesianGrid strokeDasharray="3 3" />

    <XAxis dataKey="label" />

    <YAxis
      yAxisId="count"
      allowDecimals={false}
    />

    <YAxis
      yAxisId="percentage"
      orientation="right"
      domain={[0, 100]}
      tickFormatter={(value) => `${value}%`}
    />

    <Tooltip
      formatter={(value, name) => {
        if (name === "Present %") {
          return [`${value}%`, name];
        }

        return [value, name];
      }}
    />

    <Legend />

    <Bar
      yAxisId="count"
      dataKey="present"
      name="Present"
      fill="#22c55e"
      radius={[4, 4, 0, 0]}
    />

    <Bar
      yAxisId="count"
      dataKey="absent"
      name="Absent"
      fill="#ef4444"
      radius={[4, 4, 0, 0]}
    />

    <Line
      yAxisId="percentage"
      type="monotone"
      dataKey="attendancePercentage"
      name="Present %"
      stroke="#8b5cf6"
      strokeWidth={2}
      dot={{ r: 4 }}
      activeDot={{ r: 6 }}
    />
  </ComposedChart>
</ResponsiveContainer>
          ) : (
            <div className="dashboard-chart-empty">
              <strong>No attendance data available</strong>
              <span>
                Attendance has not been recorded during the last 7 days.
              </span>
            </div>
          )}
        </div>
      </div>

{/* Collections Trend */}
<div className="dashboard-chart-card">
  <h2>Collections Trend</h2>

  <p className="dashboard-chart-description">
    Monthly payment collections over the last 6 months
  </p>

  <div className="dashboard-chart">
    {hasCollectionsData ? (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={collectionsTrend}
          margin={{
            top: 25,
            right: 10,
            left: 10,
            bottom: 10
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />

          <XAxis
            dataKey="month"
            tick={{ fontSize: 12 }}
          />

          <YAxis
            tickFormatter={formatCurrency}
          />

<Tooltip
  formatter={(value) => [
    formatCurrency(value),
    "Collections"
  ]}
  labelFormatter={(label) => `Month: ${label}`}
/>

          <Legend />

          <Bar
            dataKey="collections"
            name="Collections"
            fill="#16a34a"
            radius={[4, 4, 0, 0]}
          >
            <LabelList
              dataKey="collections"
              position="top"
              formatter={(value) =>
                Number(value || 0) > 0
                  ? formatCurrency(value)
                  : ""
              }
              fontSize={11}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    ) : (
      <div className="dashboard-chart-empty">
        <strong>No collections data available</strong>
        <span>
          No payments have been collected during the last 6 months.
        </span>
      </div>
    )}
  </div>
</div>
    </div>
    </>
  );
}

export default DashboardCharts;