import "./DashboardCard.css";

const colorMap = {
  blue: "var(--ap-primary-600)",
  green: "var(--ap-success-600)",
  orange: "var(--ap-warning-600)",
  purple: "#9333ea",
  sky: "var(--ap-info-600)",
  red: "var(--ap-danger-600)"
};

function DashboardCard({
  title,
  value,
  icon,
  color = "blue"
}) {
  return (
    <div className="dashboard-card" data-color={color}>
      <div
        className="dashboard-card-icon"
        style={{ backgroundColor: colorMap[color] || colorMap.blue }}
      >
        {icon}
      </div>

      <div className="dashboard-card-content">
        <h4>{title}</h4>
        <h2>{value}</h2>
      </div>
    </div>
  );
}

export default DashboardCard;
