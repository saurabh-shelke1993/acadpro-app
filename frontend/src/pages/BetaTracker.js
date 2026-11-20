import { useState } from "react";
import Layout from "../components/Layout";
import {
  betaLaunch, betaPhases, betaStatusLabels, betaTasks,
  getBetaSummary, getBetaTaskStatus,
} from "../data/betaTrackerData";
import "./BetaTracker.css";

const evidenceLabels = {
  NOT_STARTED: "Not started", IN_PROGRESS: "In progress", IMPLEMENTED: "Implemented",
  NOT_RUN: "Not run", PARTIAL: "Partial", PASSED: "Passed", FAILED: "Failed",
  NOT_REVIEWED: "Not reviewed", PENDING: "Pending", REJECTED: "Rejected", APPROVED: "Approved",
  NOT_VERIFIED: "Not verified", NOT_DEPLOYED: "Not deployed", DEPLOYED: "Deployed",
};
const textOr = (value, fallback) => typeof value === "string" && value.trim() ? value : fallback;

function Evidence({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <strong>{evidenceLabels[value?.status] || "Not recorded"}</strong>
        {value?.approvedBy && <p>Approved by: {value.approvedBy}</p>}
        {value?.approvedOn && <p>Approval date: {value.approvedOn}</p>}
        {value?.evidence?.length > 0 ? (
          <ul>{value.evidence.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
        ) : <p>No evidence recorded.</p>}
      </dd>
    </div>
  );
}

export function BetaTaskDetails({ task }) {
  return (
    <div className="beta-tracker-details">
      <dl className="beta-tracker-detail-grid">
        <Evidence label="Implementation status" value={task.implementation} />
        <Evidence label="Automated-test status" value={task.automatedTests} />
        <Evidence label="Manual acceptance" value={task.acceptance} />
        <Evidence label="Deployment verification" value={task.deployment} />
        <div><dt>Branch / commit reference</dt><dd>{textOr(task.branchReference, "Not recorded")}</dd></div>
        <div><dt>Blocker or dependency</dt><dd>{textOr(task.blocker, "Not recorded")}</dd></div>
        <div><dt>Next action</dt><dd>{textOr(task.nextAction, "Not recorded")}</dd></div>
        <div><dt>Last verified date</dt><dd>{task.lastVerifiedOn
          ? <time dateTime={task.lastVerifiedOn}>{task.lastVerifiedOn}</time> : "Not verified"}</dd></div>
      </dl>
      {task.notes?.length > 0 && (
        <div className="beta-tracker-notes"><h3>Evidence notes</h3>
          <ul>{task.notes.map((note, index) => <li key={index}>{note}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

export default function BetaTracker() {
  const [phaseFilter, setPhaseFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const summary = getBetaSummary();
  const filteredTasks = betaTasks.filter((task) => (
    (phaseFilter === "ALL" || task.phaseId === phaseFilter)
    && (statusFilter === "ALL" || getBetaTaskStatus(task) === statusFilter)
  ));

  return (
    <Layout>
      <div className="beta-tracker" id="main-content" tabIndex={-1}>
        <header className="beta-tracker-header">
          <div>
            <span className="beta-tracker-eyebrow">Super Admin / Internal</span>
            <h1>Beta Launch Tracker</h1>
            <p>Kheltriva roadmap, evidence and next actions. Read-only.</p>
          </div>
          <span className="beta-tracker-release">Production {betaLaunch.productionDecision}</span>
        </header>

        <div className="beta-tracker-notice">
          Completion requires explicit manual acceptance approval. Implementation, automated tests
          and deployment are recorded separately. {betaLaunch.releaseDate
            ? `Approved release date: ${betaLaunch.releaseDate}.` : "No release date approved."}
        </div>

        <section aria-labelledby="beta-summary-heading">
          <h2 id="beta-summary-heading">Launch summary</h2>
          <dl className="beta-tracker-metrics">
            <div><dt>Total development tasks</dt><dd>{summary.total}</dd></div>
            <div><dt>Approved completed tasks</dt><dd>{summary.completed}</dd></div>
            <div><dt>Tasks in progress</dt><dd>{summary.inProgress}</dd></div>
            <div><dt>Blocked tasks</dt><dd>{summary.blocked}</dd></div>
            <div className="beta-tracker-active"><dt>Current active milestone</dt>
              <dd>{summary.activeMilestone ? <>
                <strong>{summary.activeMilestone.id}</strong><span>{summary.activeMilestone.name}</span>
              </> : "None remaining"}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="beta-phases-heading">
          <h2 id="beta-phases-heading">Phase progress</h2>
          <div className="beta-tracker-phases">
            {betaPhases.map((phase) => {
              const progress = getBetaSummary(betaTasks.filter((task) => task.phaseId === phase.id));
              const percent = progress.total ? Math.round(progress.completed / progress.total * 100) : 0;
              return (
                <article className="beta-tracker-phase" key={phase.id} aria-labelledby={`${phase.id}-heading`}>
                  <span className="beta-tracker-eyebrow">Phase {phase.number}</span>
                  <h3 id={`${phase.id}-heading`}>{phase.name}</h3>
                  <p>{progress.completed} / {progress.total} approved <strong>{percent}%</strong></p>
                  <progress value={progress.completed} max={progress.total || 1}
                    aria-label={`Phase ${phase.number} approved completion`} />
                  <small>{progress.inProgress} in progress · {progress.blocked} blocked</small>
                </article>
              );
            })}
          </div>
        </section>

        <section className="beta-tracker-workspace" aria-labelledby="beta-tasks-heading">
          <div className="beta-tracker-workspace-header">
            <div><h2 id="beta-tasks-heading">Task workspace</h2><p>Expand a task to review its evidence.</p></div>
            <div className="beta-tracker-filters">
              <label htmlFor="beta-phase-filter">Phase
                <select id="beta-phase-filter" value={phaseFilter} onChange={(event) => setPhaseFilter(event.target.value)}>
                  <option value="ALL">All phases</option>
                  {betaPhases.map((phase) => <option key={phase.id} value={phase.id}>Phase {phase.number} — {phase.name}</option>)}
                </select>
              </label>
              <label htmlFor="beta-status-filter">Status
                <select id="beta-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="ALL">All statuses</option>
                  {Object.entries(betaStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>
          </div>
          <p role="status" className="beta-tracker-result-count">Showing {filteredTasks.length} of {summary.total} tasks</p>
          {filteredTasks.length === 0 && <p className="beta-tracker-empty">No tasks match these filters.</p>}
          {betaPhases.map((phase) => {
            const tasks = filteredTasks.filter((task) => task.phaseId === phase.id);
            if (!tasks.length) return null;
            return (
              <section className="beta-tracker-task-group" key={phase.id} aria-labelledby={`${phase.id}-tasks-heading`}>
                <h3 id={`${phase.id}-tasks-heading`}>Phase {phase.number} — {phase.name}</h3>
                {tasks.map((task) => {
                  const status = getBetaTaskStatus(task);
                  return (
                    <details className="beta-tracker-task" key={task.id}>
                      <summary>
                        <span className="beta-tracker-task-id">{task.id}</span>
                        <span className="beta-tracker-task-name">{task.name}</span>
                        <span className="beta-tracker-badge" data-status={status}>{betaStatusLabels[status]}</span>
                      </summary>
                      <BetaTaskDetails task={task} />
                    </details>
                  );
                })}
              </section>
            );
          })}
        </section>
        <p className="beta-tracker-footer">Source-controlled roadmap · Evidence must be reviewed before acceptance · Separate beta release gates remain required.</p>
      </div>
    </Layout>
  );
}
