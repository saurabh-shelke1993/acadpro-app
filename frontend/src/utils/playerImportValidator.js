const normalizeText = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");

const normalizePhone = (value) =>
  String(value ?? "")
    .replace(/[^\d]/g, "")
    .trim();

const normalizeKey = (value) =>
  normalizeText(value).toLowerCase();

const createError = (row, message) => ({
  sourceRowNumber: row.sourceRowNumber,
  message,
});

const validateEmail = (email) => {
  if (!email) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const findCenterMatches = (centers, academyId, centerName) => {
  const normalizedCenterName = normalizeKey(centerName);

  return (centers || []).filter(
    (center) =>
      center.is_active !== false &&
      center.academy_id === academyId &&
      normalizeKey(center.center_name) === normalizedCenterName
  );
};

const findBatchMatches = (
  batches,
  academyId,
  centerId,
  batchName
) => {
  const normalizedBatchName = normalizeKey(batchName);

  return (batches || []).filter(
    (batch) =>
      batch.is_active !== false &&
      batch.academy_id === academyId &&
      batch.center_id === centerId &&
      normalizeKey(batch.batch_name) === normalizedBatchName
  );
};

const findParentMatches = (
  parents,
  academyId,
  parentPhone
) => {
  const normalizedParentPhone = normalizePhone(parentPhone);

  return (parents || []).filter(
    (parent) =>
      parent.is_active !== false &&
      parent.academy_id === academyId &&
      normalizePhone(parent.phone) === normalizedParentPhone
  );
};

const findExistingPlayerMatches = (
  players,
  academyId,
  playerName,
  parentPhone
) => {
  const normalizedPlayerName = normalizeKey(playerName);
  const normalizedParentPhone = normalizePhone(parentPhone);

  return (players || []).filter(
    (player) =>
      player.is_active !== false &&
      player.academy_id === academyId &&
      normalizeKey(player.full_name) === normalizedPlayerName &&
      normalizePhone(
        player.parent_phone ?? player.parents?.phone
      ) === normalizedParentPhone
  );
};

export const validatePlayerImportRows = (
  rows,
  {
    academyId,
    centers = [],
    batches = [],
    parents = [],
    players = [],
  } = {}
) => {
  const errors = [];
  const validRows = [];

  if (!academyId) {
    return {
      isValid: false,
      totalRows: rows?.length || 0,
      validRows: [],
      errors: [
        {
          sourceRowNumber: null,
          message: "Please select an academy before validating the import.",
        },
      ],
    };
  }

  const seenRows = new Map();

  (rows || []).forEach((row) => {
    const rowErrors = [];

    const playerName = normalizeText(row.playerName);
    const dateOfBirth = normalizeText(row.dateOfBirth);
    const parentName = normalizeText(row.parentName);
    const parentPhone = normalizePhone(row.parentPhone);
    const centerName = normalizeText(row.center);
    const batchName = normalizeText(row.batch);
    const gender = normalizeText(row.gender);
    const joiningDate = normalizeText(row.joiningDate);
    const parentEmail = normalizeText(row.parentEmail).toLowerCase();

    if (!playerName) {
      rowErrors.push("Player Name is required.");
    }

    if (!dateOfBirth) {
      rowErrors.push("Date of Birth is required.");
    }

    if (!parentName) {
      rowErrors.push("Parent Name is required.");
    }

    if (!/^\d{10}$/.test(parentPhone)) {
      rowErrors.push("Parent Phone must be exactly 10 digits.");
    }

    if (!centerName) {
      rowErrors.push("Center is required.");
    }

    if (!batchName) {
      rowErrors.push("Batch is required.");
    }

    if (!validateEmail(parentEmail)) {
      rowErrors.push("Parent Email Address is invalid.");
    }

    if (
      gender &&
      !["male", "female"].includes(gender.toLowerCase())
    ) {
      rowErrors.push("Gender must be Male or Female when provided.");
    }

    const duplicateKey = [
      normalizeKey(playerName),
      parentPhone,
    ].join("|");

    if (playerName && parentPhone) {
      const previousRowNumber = seenRows.get(duplicateKey);

      if (previousRowNumber) {
        rowErrors.push(
          `Duplicate player in the import file; same Player Name and Parent Phone already appear on row ${previousRowNumber}.`
        );
      } else {
        seenRows.set(
          duplicateKey,
          row.sourceRowNumber
        );
      }
    }

    let center = null;
    let batch = null;
    let parent = null;

    if (centerName) {
      const centerMatches = findCenterMatches(
        centers,
        academyId,
        centerName
      );

      if (centerMatches.length === 0) {
        rowErrors.push(
          `Center "${centerName}" was not found in the selected academy.`
        );
      } else if (centerMatches.length > 1) {
        rowErrors.push(
          `Center "${centerName}" is ambiguous in the selected academy.`
        );
      } else {
        center = centerMatches[0];
      }
    }

    if (center && batchName) {
      const batchMatches = findBatchMatches(
        batches,
        academyId,
        center.id,
        batchName
      );

      if (batchMatches.length === 0) {
        rowErrors.push(
          `Batch "${batchName}" was not found in center "${center.center_name}".`
        );
      } else if (batchMatches.length > 1) {
        rowErrors.push(
          `Batch "${batchName}" is ambiguous in center "${center.center_name}".`
        );
      } else {
        batch = batchMatches[0];
      }
    }

    if (parentPhone && /^\d{10}$/.test(parentPhone)) {
      const parentMatches = findParentMatches(
        parents,
        academyId,
        parentPhone
      );

      if (parentMatches.length > 1) {
        rowErrors.push(
          `Multiple active parents already use phone "${parentPhone}" in the selected academy.`
        );
      } else if (parentMatches.length === 1) {
        parent = parentMatches[0];

        if (
          parentEmail &&
          parent.email &&
          normalizeKey(parent.email) !== normalizeKey(parentEmail)
        ) {
          rowErrors.push(
            "Parent Email Address does not match the existing parent with this phone number."
          );
        }
      }
    }

    if (playerName && parentPhone) {
      const existingPlayerMatches =
        findExistingPlayerMatches(
          players,
          academyId,
          playerName,
          parentPhone
        );

      if (existingPlayerMatches.length > 0) {
        rowErrors.push(
          `Player "${playerName}" already exists in the selected academy with this parent phone.`
        );
      }
    }

    if (rowErrors.length > 0) {
      errors.push(
        ...rowErrors.map((message) =>
          createError(row, message)
        )
      );
      return;
    }

    validRows.push({
      ...row,
      playerName,
      dateOfBirth,
      parentName,
      parentPhone,
      center: centerName,
      batch: batchName,
      gender,
      joiningDate,
      parentEmail,
      resolvedCenterId: center.id,
      resolvedBatchId: batch.id,
      existingParentId: parent?.id || null,
    });
  });

  return {
    isValid: errors.length === 0 && validRows.length > 0,
    totalRows: rows?.length || 0,
    validRows,
    errors,
  };
};
