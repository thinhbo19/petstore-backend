const moment = require("moment");
const qs = require("qs");
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

function buildVnPayPaymentUrl({ amount, bankCode, locale, ipAddr, returnUrl }) {
  const tmnCode = process.env.VNP_TMNCODE;
  const secretKey = process.env.VNP_HASHSECRET;
  const vnpUrl = process.env.VNP_URL;
  const vnpReturnUrl = returnUrl || process.env.VNP_RETURNURL;
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
    vnp_ReturnUrl: vnpReturnUrl,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: createDate,
  };

  console.log(params);

  if (bankCode) {
    params.vnp_BankCode = bankCode;
  }

  const sortedParams = sortObject(params);
  const signData = qs.stringify(sortedParams, { encode: false });
  const hmac = crypto.createHmac("sha512", secretKey);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
  sortedParams.vnp_SecureHash = signed;

  return {
    txnRef,
    paymentUrl: `${vnpUrl}?${qs.stringify(sortedParams, { encode: false })}`,
  };
}

function verifyVnPayReturnQuery(rawQuery) {
  const query = { ...(rawQuery || {}) };
  const secureHash = query.vnp_SecureHash;
  delete query.vnp_SecureHash;
  delete query.vnp_SecureHashType;

  const sortedParams = sortObject(query);
  const signData = qs.stringify(sortedParams, { encode: false });
  const hmac = crypto.createHmac("sha512", process.env.VNP_HASHSECRET);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  return {
    isValid: secureHash === signed,
    txnRef: sortedParams.vnp_TxnRef,
    responseCode: String(rawQuery?.vnp_ResponseCode || ""),
  };
}

function buildCheckoutResultUrl({ kind, status, reason, idKey, idValue }) {
  const params = new URLSearchParams({
    kind: String(kind || ""),
    status: String(status || ""),
  });
  if (reason) {
    params.set("reason", String(reason));
  }
  if (idKey && idValue) {
    params.set(String(idKey), String(idValue));
  }
  return `${process.env.URL_CLIENT}/checkout/result?${params.toString()}`;
}

function getSessionNotFoundRedirectUrl(kind) {
  return buildCheckoutResultUrl({
    kind,
    status: "failed",
    reason: "session_not_found",
  });
}

async function failPaymentSessionAndBuildRedirect({ session, kind, reason }) {
  session.status = "failed";
  session.redirectTo = buildCheckoutResultUrl({
    kind,
    status: "failed",
    reason,
  });
  session.consumedAt = new Date();
  await session.save();
  return session.redirectTo;
}

async function succeedPaymentSessionAndBuildRedirect({
  session,
  kind,
  idKey,
  idValue,
}) {
  session.status = "success";
  session.redirectTo = buildCheckoutResultUrl({
    kind,
    status: "success",
    idKey,
    idValue,
  });
  session.consumedAt = new Date();
  await session.save();
  return session.redirectTo;
}

/** Raw string for MoMo /v2/gateway/api/create (captureWallet). */
function buildMoMoCreateRawSignature({
  accessKey,
  amount,
  extraData,
  ipnUrl,
  orderId,
  orderInfo,
  partnerCode,
  redirectUrl,
  requestId,
}) {
  return `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=captureWallet`;
}

function signMoMoCreateRequest(fields, secretKey) {
  const raw = buildMoMoCreateRawSignature(fields);
  return crypto.createHmac("sha256", secretKey).update(raw).digest("hex");
}

/** Raw string for MoMo redirect / IPN callback signature verification. */
function buildMoMoCallbackRawSignature(params) {
  const accessKey = params.accessKey;
  const amount = params.amount;
  const extraData = params.extraData ?? "";
  const message = params.message ?? "";
  const orderId = params.orderId;
  const orderInfo = params.orderInfo ?? "";
  const orderType = params.orderType ?? "";
  const partnerCode = params.partnerCode;
  const payType = params.payType ?? "";
  const requestId = params.requestId;
  const responseTime = params.responseTime;
  const resultCode = params.resultCode;
  const transId = params.transId ?? "";
  return `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
}

function verifyMomoCallbackSignature(params) {
  const secretKey = process.env.MOMO_SECRET_KEY;
  const signature = params.signature;
  if (!secretKey || !signature || !params.accessKey) {
    return false;
  }
  const raw = buildMoMoCallbackRawSignature(params);
  const expected = crypto.createHmac("sha256", secretKey).update(raw).digest("hex");
  return signature === expected;
}

module.exports = {
  getClientIp,
  buildVnPayPaymentUrl,
  verifyVnPayReturnQuery,
  buildCheckoutResultUrl,
  getSessionNotFoundRedirectUrl,
  failPaymentSessionAndBuildRedirect,
  succeedPaymentSessionAndBuildRedirect,
  signMoMoCreateRequest,
  verifyMomoCallbackSignature,
};
