/** Presentation helpers for the existing player profile. No data access or permission changes. */
export const formatPlayerProfileDate = (value) => {
  if (!value) return "—";
  const normalized = String(value);
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  let date;
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) return "—";
  } else {
    date = new Date(value);
  }
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

export const shouldShowProfileSessionContext = (session, player) =>
  session.centerName !== (player.centers?.center_name || "—") ||
  session.batchName !== (player.batches?.batch_name || "—");
