const escapeRegex = (s = "") => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getPagination = (query = {}) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(1000, Math.max(1, Number(query.limit) || 1000));
  return { page, limit, skip: (page - 1) * limit };
};

const getSort = (query = {}, allowed = [], fallback = "createdAt") => {
  const raw = String(query.sort || "").trim();
  if (!raw) return fallback;
  const dir = raw.startsWith("-") ? -1 : 1;
  const field = raw.replace(/^-/, "");
  if (!allowed.includes(field)) return fallback;
  return { [field]: dir };
};

const getFields = (query = {}, allowed = []) => {
  const raw = String(query.fields || "").trim();
  if (!raw) return "";
  const picked = raw
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x && allowed.includes(x));
  return picked.join(" ");
};

module.exports = {
  escapeRegex,
  getPagination,
  getSort,
  getFields,
};
