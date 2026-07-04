import { supabase } from "../services/supabase";

export const generateReceiptNumber = async () => {

  const today = new Date();

  const year = today.getFullYear();

  const month = String(
    today.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    today.getDate()
  ).padStart(2, "0");

  const datePart =
    `${year}${month}${day}`;

  const prefix =
    `RCPT-${datePart}`;

  const { data, error } =
    await supabase
      .from("payments")
      .select("receipt_number")
      .like(
        "receipt_number",
        `${prefix}%`
      )
      .order(
        "receipt_number",
        { ascending: false }
      )
      .limit(1);

  if (error) {

    throw error;

  }

  let nextNumber = 1;

  if (
    data &&
    data.length > 0 &&
    data[0].receipt_number
  ) {

    const lastReceipt =
      data[0].receipt_number;

    const lastSequence =
      Number(
        lastReceipt.split("-")[2]
      );

    nextNumber =
      lastSequence + 1;

  }

  const sequence =
    String(nextNumber)
      .padStart(5, "0");

  return `${prefix}-${sequence}`;

};