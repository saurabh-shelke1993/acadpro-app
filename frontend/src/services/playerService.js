import { supabase } from "./supabase";

// ============================================
// GET PLAYERS
// ============================================

export const getPlayers = async (
  academyId = null
) => {

  let query = supabase
    .from("players")
    .select(`
      *,
      academies(
        academy_name
      ),
      centers(
        center_name
      ),
      batches(
        batch_name
      ),
      parents(
        parent_name,
        phone,
        email
      )
    `)
    .eq("is_active", true);

  if (academyId) {
    query = query.eq(
      "academy_id",
      academyId
    );
  }

  const {
    data,
    error
  } = await query.order(
    "full_name",
    {
      ascending: true
    }
  );

  if (error) throw error;

  return data || [];
};

// ============================================
// CREATE PARENT
// ============================================

export const createParent = async (
  parentData
) => {

  const {
    data,
    error
  } = await supabase
    .from("parents")
    .insert([
      parentData
    ])
    .select()
    .single();

  if (error) throw error;

  return data;
};

// ============================================
// CREATE PLAYER
// ============================================

export const createPlayer = async (
  playerData
) => {

  const {
    data,
    error
  } = await supabase
    .from("players")
    .insert([
      playerData
    ])
    .select()
    .single();

  if (error) throw error;

  return data;
};

// ============================================
// UPDATE PLAYER
// ============================================

export const updatePlayer = async (
  playerId,
  playerData
) => {

  const {
    data,
    error
  } = await supabase
    .from("players")
    .update(playerData)
    .eq("id", playerId)
    .select()
    .single();

  if (error) throw error;

  return data;
};

// ============================================
// UPDATE PARENT
// ============================================

export const updateParent = async (
  parentId,
  parentData
) => {

  const {
    data,
    error
  } = await supabase
    .from("parents")
    .update(parentData)
    .eq("id", parentId)
    .select()
    .single();

  if (error) throw error;

  return data;
};

// ============================================
// DEACTIVATE PLAYER
// ============================================

export const deactivatePlayer =
  async (playerId) => {

    const {
      data,
      error
    } = await supabase
      .from("players")
      .update({
        is_active: false,
        player_status: "inactive"
      })
      .eq("id", playerId)
      .select()
      .single();

    if (error) throw error;

    return data;
  };

// ============================================
// CHECK DUPLICATE PLAYER
// ============================================

export const checkDuplicatePlayer =
  async (
    academyId,
    fullName,
    parentPhone
  ) => {

    const {
      data,
      error
    } = await supabase
      .from("players")
      .select(`
        id,
        full_name,
        parents!inner(
          phone
        )
      `)
      .eq(
        "academy_id",
        academyId
      )
      .eq(
        "full_name",
        fullName
      )
      .eq(
        "parents.phone",
        parentPhone
      )
      .eq(
        "is_active",
        true
      );

    if (error) throw error;

    return (
      data &&
      data.length > 0
    );
  };

// ============================================
// CREATE PLAYER BATCH MAP
// ============================================

export const assignPlayerBatch =
  async (
    playerId,
    batchId
  ) => {

    const {
      data,
      error
    } = await supabase
      .from("player_batches")
      .insert([
        {
          player_id: playerId,
          batch_id: batchId
        }
      ]);

    if (error) throw error;

    return data;
  };