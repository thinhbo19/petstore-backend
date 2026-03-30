const Product = require("../collection/Product/model");
const Pet = require("../collection/Pets/model");

function firstImageFromField(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "";
  const x = arr[0];
  if (typeof x === "string") return x;
  if (x && typeof x === "object") {
    return x.url || x.secure_url || x.path || "";
  }
  return "";
}

/**
 * Bổ sung name, price, img, catalogType (pet | product), myRating (đánh giá của viewer nếu có).
 */
async function enrichProductLine(line, viewerId) {
  const plain =
    line && typeof line.toObject === "function"
      ? line.toObject()
      : { ...(line || {}) };
  const id = plain.id;
  if (!id) return plain;

  let productDoc = await Product.findById(id).lean();
  let petDoc = null;
  if (!productDoc) {
    petDoc = await Pet.findById(id).lean();
  }

  const doc = productDoc || petDoc;
  if (!doc) return plain;

  plain.catalogType = productDoc ? "product" : "pet";

  const catalogName = productDoc ? doc.nameProduct : doc.namePet;
  const catalogPrice = doc.price;
  const catalogImg = productDoc
    ? firstImageFromField(doc.images)
    : firstImageFromField(doc.imgPet);

  if (!plain.name || String(plain.name).trim() === "") {
    plain.name = catalogName;
  }
  const p = Number(plain.price);
  if (!Number.isFinite(p) || p <= 0) {
    plain.price = catalogPrice != null ? Number(catalogPrice) : 0;
  }
  if (!plain.img || String(plain.img).trim() === "") {
    plain.img = catalogImg || "";
  }

  if (viewerId && Array.isArray(doc.rating)) {
    const mine = doc.rating.find(
      (r) => String(r.postBy) === String(viewerId),
    );
    if (mine) {
      plain.myRating = {
        star: mine.star,
        comment: mine.comment || "",
        feedback_img: Array.isArray(mine.feedback_img) ? mine.feedback_img : [],
      };
    } else {
      plain.myRating = null;
    }
  } else {
    plain.myRating = null;
  }

  return plain;
}

async function enrichOrderProductsLines(products, viewerId) {
  if (!Array.isArray(products)) return [];
  return Promise.all(products.map((p) => enrichProductLine(p, viewerId)));
}

/**
 * @param {object} order
 * @param {{ viewerId?: string }} [options] — userId để gắn myRating từng dòng
 */
async function enrichOrderDoc(order, options = {}) {
  if (!order) return order;
  const obj = order.toObject ? order.toObject({ virtuals: false }) : { ...order };
  const viewerId = options.viewerId ? String(options.viewerId) : "";
  obj.products = await enrichOrderProductsLines(order.products || [], viewerId);
  return obj;
}

module.exports = {
  enrichOrderDoc,
  enrichOrderProductsLines,
};
