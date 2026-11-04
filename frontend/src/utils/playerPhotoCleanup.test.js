import { getPreviousPlayerPhotoCleanupPath } from "./playerPhotoCleanup";

const player = {
  id: "11111111-1111-4111-8111-111111111111",
  academy_id: "22222222-2222-4222-8222-222222222222",
};
const current = `${player.academy_id}/${player.id}/new.webp`;
const old = `${player.academy_id}/${player.id}/old-photo.png`;

test("accepts a previous photo belonging to exactly the same academy and player", () => {
  expect(getPreviousPlayerPhotoCleanupPath({ player, previousPath: old, newPath: current })).toBe(old);
  expect(getPreviousPlayerPhotoCleanupPath({
    player, previousPath: old.replace(".png", ".jpg"), newPath: current,
  })).toMatch(/\.jpg$/);
});

test("rejects a different academy or player prefix", () => {
  expect(getPreviousPlayerPhotoCleanupPath({
    player, previousPath: `other-academy/${player.id}/old.png`, newPath: current,
  })).toBeNull();
  expect(getPreviousPlayerPhotoCleanupPath({
    player, previousPath: `${player.academy_id}/other-player/old.png`, newPath: current,
  })).toBeNull();
});

test("rejects the active path, no original photo or external links", () => {
  expect(getPreviousPlayerPhotoCleanupPath({ player, previousPath: current, newPath: current })).toBeNull();
  expect(getPreviousPlayerPhotoCleanupPath({ player, previousPath: null, newPath: current })).toBeNull();
  expect(getPreviousPlayerPhotoCleanupPath({
    player, previousPath: "https://example.org/avatar.jpg", newPath: current,
  })).toBeNull();
});

test("rejects nested folders, traversal, unsupported extensions and malformed paths", () => {
  for (const previousPath of [
    `${player.academy_id}/${player.id}/extra/old.webp`,
    `${player.academy_id}/${player.id}/../old.webp`,
    `${player.academy_id}/${player.id}/photo.svg`,
    `${player.academy_id}/${player.id}/.webp`,
    `${player.academy_id}/${player.id}/foo..webp`,
    `${player.academy_id}/${player.id}/`,
  ]) {
    expect(getPreviousPlayerPhotoCleanupPath({ player, previousPath, newPath: current })).toBeNull();
  }
});
