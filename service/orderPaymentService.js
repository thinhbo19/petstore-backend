const moment = require("moment");
const querystring = require("qs");
const crypto = require("crypto");

function sortObject(obj) {
  const sorted = {};
  const keys = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      keys.push(encodeURIComponent(key));
    }
  }
  keys.sort();
  for (let i = 0; i < keys.length; i += 1) {
    const encodedKey = keys[i];
    sorted[encodedKey] = encodeURIComponent(obj[encodedKey]).replace(/%20/g, "+");
  }
  return sorted;
}

function buildTxnRef() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.connection?.socket?.remoteAddress ||
    ""
  );
}

function buildVnPayPaymentUrl({ amount, bankCode, locale, ipAddr }) {
  const tmnCode = process.env.VNP_TMNCODE;
  const secretKey = process.env.VNP_HASHSECRET;
  const vnpUrl = process.env.VNP_URL;
  const returnUrl = process.env.VNP_RETURNURL;
  const txnRef = buildTxnRef();

  const createDate = moment(new Date()).format("YYYYMMDDHHmmss");
  const params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: tmnCode,
    vnp_Locale: locale || "vn",
    vnp_CurrCode: "VND",
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: `Thanh toan cho ma GD:${txnRef}`,
    vnp_OrderType: "other",
    vnp_Amount: amount * 100,
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: createDate,
  };

  if (bankCode) {
    params.vnp_BankCode = bankCode;
  }

  const sortedParams = sortObject(params);
  const signData = querystring.stringify(sortedParams, { encode: false });
  const hmac = crypto.createHmac("sha512", secretKey);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
  sortedParams.vnp_SecureHash = signed;

  return {
    txnRef,
    paymentUrl: `${vnpUrl}?${querystring.stringify(sortedParams, { encode: false })}`,
  };
}

function verifyVnPayReturnQuery(rawQuery) {
  const query = { ...(rawQuery || {}) };
  const secureHash = query.vnp_SecureHash;
  delete query.vnp_SecureHash;
  delete query.vnp_SecureHashType;

  const sortedParams = sortObject(query);
  const signData = querystring.stringify(sortedParams, { encode: false });
  const hmac = crypto.createHmac("sha512", process.env.VNP_HASHSECRET);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  return {
    isValid: secureHash === signed,
    txnRef: sortedParams.vnp_TxnRef,
    responseCode: String(rawQuery?.vnp_ResponseCode || ""),
  };
}

module.exports = {
  getClientIp,
  buildVnPayPaymentUrl,
  verifyVnPayReturnQuery,
};
