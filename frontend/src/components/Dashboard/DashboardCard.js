import "./DashboardCard.css";

function DashboardCard({
  title,
  value,
  icon,
  color = "#2563eb"
}) {
  return (
    <div className="dashboard-card" data-color={color}>
      <div
        className="dashboard-card-icon"
        style={{ backgroundColor: `var(--ap-${color}-600, ${color})` }}
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