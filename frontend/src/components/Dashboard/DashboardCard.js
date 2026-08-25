import "./DashboardCard.css";

function DashboardCard({
  title,
  value,
  icon,
  color = "#2563eb"
}) {
  return (
    <div className="dashboard-card">
      <div
        className="dashboard-card-icon"
        style={{ backgroundColor: color }}
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