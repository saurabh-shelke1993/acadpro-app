export const applyAcademyFilter = (
  query,
  user
) => {
  if (user?.role === "super_admin") {
    return query;
  }

  return query.eq(
    "academy_id",
    user.academy_id
  );
};