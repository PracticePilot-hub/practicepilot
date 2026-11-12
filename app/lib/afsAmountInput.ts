/** Normalise completed amount entry. Incomplete typing must never become zero. */
export function completedAmount(
  raw: string,
  min?: number | string,
  max?: number | string,
): { value: string; error?: string } {
  let value = raw
    .trim()
    .replace(/^R\s*/i, "")
    .replace(/[\s\u00a0\u202f]/g, "");
  if (!value) return { value: "" };
  const bracketed = value.startsWith("(") && value.endsWith(")");
  if (bracketed) value = "-" + value.slice(1, -1);
  value=value.replace(/^([+-]?)R/i,"$1");
  if (value.includes(",") && value.includes(".")) {
    value =
      value.lastIndexOf(",") > value.lastIndexOf(".")
        ? value.replace(/\./g, "").replace(",", ".")
        : value.replace(/,/g, "");
  } else if (
    (value.match(/,/g) || []).length > 1 &&
    /^[-+]?\d{1,3}(,\d{3})+$/.test(value)
  )
    value = value.replace(/,/g, "");
  else value = value.replace(",", ".");
  if (
    !/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) ||
    !Number.isFinite(Number(value))
  )
    return { value: raw, error: "Enter a valid amount, or clear the field." };
  const number = Number(value);
  if (
    min !== undefined &&
    min !== "" &&
    Number.isFinite(Number(min)) &&
    number < Number(min)
  )
    return { value: raw, error: `Enter an amount of at least ${min}.` };
  if (
    max !== undefined &&
    max !== "" &&
    Number.isFinite(Number(max)) &&
    number > Number(max)
  )
    return { value: raw, error: `Enter an amount no greater than ${max}.` };
  return { value: String(number) };
}
