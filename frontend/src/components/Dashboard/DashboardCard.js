import { Link } from "react-router-dom";
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
  color = "blue",
  to
}) {
  const card = (
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

      {to && <span className="dashboard-card-arrow" aria-hidden="true">→</span>}
    </div>
  );

  return to ? (
    <Link className="dashboard-card-link" to={to} aria-label={"Open " + title}>
      {card}
    </Link>
  ) : card;
}

export default DashboardCard;
