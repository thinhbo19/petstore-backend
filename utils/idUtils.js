const mongoose = require("mongoose");

const extractObjectId = (value) => {
  if (!value) return "";
  const text = String(value).trim();
  const objectIdMatch = text.match(/ObjectId\(['"]([a-fA-F0-9]{24})['"]\)/);
  if (objectIdMatch) return objectIdMatch[1];
  const plainIdMatch = text.match(/\b([a-fA-F0-9]{24})\b/);
  if (plainIdMatch) return plainIdMatch[1];
  return "";
};

const normalizeId = (id) => {
  if (!id) return "";
  if (typeof id === "string") {
    return extractObjectId(id) || id.trim();
  }
  if (typeof id === "number" || typeof id === "boolean" || typeof id === "bigint")
    return String(id);
  if (typeof id === "object") {
    if (typeof id.toHexString === "function") return id.toHexString();
    if (typeof id.$oid === "string") return extractObjectId(id.$oid) || id.$oid;
    if (id._id && id._id !== id) return normalizeId(id._id);
    if (id.id && id.id !== id && typeof id.id !== "function") {
      const nested = normalizeId(id.id);
      if (nested && nested !== "[object Object]") return nested;
    }
    if (typeof id.toString === "function") {
      const asText = id.toString();
      if (asText && asText !== "[object Object]") return asText;
    }
    return "";
  }
  return String(id);
};

const hasMember = (members = [], userId) =>
  members.some((memberId) => normalizeId(memberId) === normalizeId(userId));

const getIdCandidates = (id) => {
  const normalized = normalizeId(id);
  const values = [normalized];
  if (mongoose.Types.ObjectId.isValid(normalized)) {
    values.push(new mongoose.Types.ObjectId(normalized));
  }
  return values;
};

module.exports = {
  extractObjectId,
  normalizeId,
  hasMember,
  getIdCandidates,
};
