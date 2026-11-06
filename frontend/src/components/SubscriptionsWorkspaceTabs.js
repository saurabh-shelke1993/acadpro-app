import { Link } from "react-router-dom";
import "./SubscriptionsWorkspaceTabs.css";

const VIEWS = [
  {
    value: "players",
    label: "Player Subscriptions",
    description: "Assign and manage plans for enrolled players",
    icon: "▤",
  },
  {
    value: "plans",
    label: "Subscription Plans",
    description: "Create and manage academy billing plans",
    icon: "◇",
  },
];

/** Link-based navigation preserves both original page components and data flows. */
export default function SubscriptionsWorkspaceTabs({ currentView, hasUnsavedChanges = false }) {
  const confirmSwitch = (event, targetView) => {
    if (currentView === targetView || !hasUnsavedChanges) return;
    if (!window.confirm("You have unsaved subscription changes. Switch views and discard them?")) {
      event.preventDefault();
    }
  };

  return (
    <nav className="subscriptions-workspace-nav" aria-label="Subscription views">
      <div className="subscriptions-workspace-views">
        {VIEWS.map(({ value, label, description, icon }) => {
          const selected = currentView === value;
          return (
            <Link
              key={value}
              to={`/subscriptions?view=${value}`}
              aria-label={label}
              aria-current={selected ? "page" : undefined}
              onClick={(event) => confirmSwitch(event, value)}
              className={`subscriptions-workspace-view${selected ? " subscriptions-workspace-view-active" : ""}`}
            >
              <span className="subscriptions-workspace-icon" aria-hidden="true">{icon}</span>
              <span className="subscriptions-workspace-copy">
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
              {selected && <span className="subscriptions-workspace-selected" aria-hidden="true">Selected</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
