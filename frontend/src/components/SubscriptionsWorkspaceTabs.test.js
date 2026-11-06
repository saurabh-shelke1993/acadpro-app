import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import SubscriptionsWorkspaceTabs from "./SubscriptionsWorkspaceTabs";

function Url() {
  const location = useLocation();
  return <output data-testid="route-url">{location.pathname + location.search}</output>;
}
function setup(currentView, hasUnsavedChanges = false) {
  return render(
    <MemoryRouter initialEntries={[`/subscriptions?view=${currentView}`]}>
      <SubscriptionsWorkspaceTabs currentView={currentView} hasUnsavedChanges={hasUnsavedChanges} />
      <Url />
    </MemoryRouter>
  );
}
beforeEach(() => jest.restoreAllMocks());

test.each(["players", "plans"])("SM2 %s has accessible view links and correct selected state", (view) => {
  setup(view);
  const players = screen.getByRole("link", { name: "Player Subscriptions" });
  const plans = screen.getByRole("link", { name: "Subscription Plans" });
  expect(players).toHaveAttribute("href", "/subscriptions?view=players");
  expect(plans).toHaveAttribute("href", "/subscriptions?view=plans");
  expect(screen.getAllByRole("link", { current: "page" })).toHaveLength(1);
  expect(screen.getByRole("link", { name: view === "players" ? "Player Subscriptions" : "Subscription Plans" }))
    .toHaveAttribute("aria-current", "page");
});
test("SM2 switching between clean forms navigates without prompting", () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  setup("players");
  fireEvent.click(screen.getByRole("link", { name: "Subscription Plans" }));
  expect(screen.getByTestId("route-url")).toHaveTextContent("view=plans");
  expect(confirm).not.toHaveBeenCalled();
});
test("SM2 unsaved form prompt keeps the current view if user cancels", () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  setup("players", true);
  fireEvent.click(screen.getByRole("link", { name: "Subscription Plans" }));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("route-url")).toHaveTextContent("view=players");
});
test("SM2 unsaved form prompt permits switching when confirmed", () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
  setup("plans", true);
  fireEvent.click(screen.getByRole("link", { name: "Player Subscriptions" }));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("route-url")).toHaveTextContent("view=players");
});
test("SM2 clicking the currently active card does not prompt", () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  setup("plans", true);
  fireEvent.click(screen.getByRole("link", { name: "Subscription Plans" }));
  expect(confirm).not.toHaveBeenCalled();
});
