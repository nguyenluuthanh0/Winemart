// routes/orderRoutes.js
const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const moment = require("moment");
const net = require("net");
const querystring = require("qs");
const { URL } = require("url");

const Order = require("../models/orderModel");
const User = require("../models/userModel");
const { requireLogin } = require("../middleware/authMiddleware");

// ✅ thêm các model sản phẩm để trừ tồn kho
const Product = require("../models/productModel");
const Accessory = require("../models/accessoryModel");
const GiftSet = require("../models/giftSetModel");

const STOCK_MODELS = {
  Product,
  Accessory,
  GiftSet,
};

function ensureHttpsUrl(url, configName) {
  const trimmed = (url || "").trim();
  if (!trimmed) throw new Error(`Thiếu cấu hình ${configName}`);
  if (!/^https:\/\//i.test(trimmed))
    throw new Error(
      `${configName} phải bắt đầu bằng https:// theo yêu cầu của VNPay.`
    );
  return trimmed;
}

function resolveCallbackUrl(req, envKey, fallbackPath) {
  const envUrl = process.env[envKey];
  if (envUrl && envUrl.trim()) return ensureHttpsUrl(envUrl, envKey);

  const publicBaseUrl = process.env.PUBLIC_BASE_URL;
  if (publicBaseUrl && publicBaseUrl.trim()) {
    const normalizedBase = ensureHttpsUrl(publicBaseUrl, "PUBLIC_BASE_URL");
    return new URL(fallbackPath, normalizedBase).toString();
  }

  const protocol = req.headers["x-forwarded-proto"]?.split(",")[0] || req.protocol;
  const host = req.get("host");
  if (!host)
    throw new Error("Không xác định được host để tạo callback URL cho VNPay.");
  if (protocol !== "https")
    throw new Error(
      `Cần HTTPS cho ${fallbackPath}. Thiết lập ${envKey} hoặc PUBLIC_BASE_URL.`
    );
  return `https://${host}${fallbackPath}`;
}

function sortObject(obj) {
  const sorted = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null)
      sorted[key] = encodeURIComponent(obj[key]).replace(/%20/g, "+");
  }
  return sorted;
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const rawIp =
    (typeof forwarded === "string" && forwarded.split(",")[0].trim()) ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    "";
  if (!rawIp) return "127.0.0.1";
  if (rawIp.startsWith("::ffff:")) return rawIp.substring(7);
  if (rawIp === "::1") return "127.0.0.1";
  if (net.isIP(rawIp) === 6) return "127.0.0.1";
  return rawIp;
}

function generateOrderId() {
  const datePart = moment().format("YYMMDDHHmmss");
  const randomPart = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  return (datePart + randomPart).substring(0, 20);
}

// === ROUTES ===

// Checkout
router.get("/checkout", requireLogin, (req, res) => res.render("checkout"));

// Create Payment
router.post("/create-payment", requireLogin, async (req, res) => {
  let order;
  const paymentMethod = req.body.paymentMethod;

  try {
    const user = await User.findById(req.session.userId).populate("cart.item");
    if (!user || user.cart.length === 0) return res.redirect("/cart");

    // ✅ KIỂM TRA TỒN KHO TRƯỚC KHI TẠO ĐƠN
    const outOfStockMessages = [];
    for (const ci of user.cart) {
      if (!ci.item) {
        outOfStockMessages.push("Một sản phẩm trong giỏ không hợp lệ.");
        continue;
      }
      const stock = typeof ci.item.stock === "number" ? ci.item.stock : 0;
      if (stock < ci.quantity) {
        outOfStockMessages.push(
          `${ci.item.name} chỉ còn ${stock}, bạn đặt ${ci.quantity}`
        );
      }
    }

    if (outOfStockMessages.length > 0) {
      console.warn("Out of stock:", outOfStockMessages);
      const detailHtml = outOfStockMessages
        .map((m) => `• ${m}`)
        .join("<br>");

      return res.status(400).render("error-message", {
        message:
          "Một số sản phẩm trong giỏ không đủ tồn kho. " +
          "Vui lòng quay lại giỏ hàng và điều chỉnh số lượng.<br><br>" +
          detailHtml,
      });
    }

    // TÍNH TIỀN & BUILD ITEMS
    let amount = 0;
    const items = user.cart.map((ci) => {
      if (!ci.item) throw new Error("Sản phẩm trong giỏ hàng không hợp lệ.");

      const price = ci.item.price;
      amount += price * ci.quantity;

      // itemModel: Product / Accessory / GiftSet
      const model = ci.itemModel ?? "Product";

      return {
        item: ci.item._id,
        itemModel: model,
        quantity: ci.quantity,
        price,
      };
    });

    order = new Order({
      orderId: generateOrderId(),
      user: req.session.userId,
      customerInfo: {
        name: req.body.name,
        phone: req.body.phone,
        address: req.body.address,
      },
      items,
      amount: Math.round(amount),
      paymentMethod,
      status: "pending",
    });
    await order.save();

    // COD
    if (paymentMethod === "cod") {
      // ✅ TRỪ TỒN KHO THEO GIỎ HÀNG
      for (const ci of user.cart) {
        if (!ci.item) continue;
        const currentStock =
          typeof ci.item.stock === "number" ? ci.item.stock : 0;
        ci.item.stock = Math.max(0, currentStock - ci.quantity);
        await ci.item.save();
      }

      order.status = "processing";
      await order.save();
      user.cart = [];
      await user.save();
      return res.render("order-success", {
        message: "Đặt hàng thành công! Thanh toán khi nhận hàng.",
      });
    }

    // VNPay
    if (paymentMethod === "vnpay") {
      const tmnCode = process.env.VNPAY_TMNCODE;
      const secretKey = process.env.VNPAY_HASHSECRET;
      let vnpUrl = process.env.VNPAY_URL;
      if (!tmnCode || !secretKey || !vnpUrl)
        throw new Error("Thiếu cấu hình VNPay (TMNCODE, HASHSECRET, URL).");

      const ipAddr = getClientIp(req);
      const returnUrl = resolveCallbackUrl(
        req,
        "VNPAY_RETURNURL",
        "/order/vnpay_return"
      );
      const ipnUrl = resolveCallbackUrl(
        req,
        "VNPAY_IPNURL",
        "/order/vnpay_ipn"
      );

      const createDate = moment()
        .utcOffset(7 * 60)
        .format("YYYYMMDDHHmmss");
      const expireDate = moment()
        .utcOffset(7 * 60)
        .add(15, "minutes")
        .format("YYYYMMDDHHmmss");
      const amountForVnp = (Math.round(amount) * 100).toString();

      let vnp_Params = sortObject({
        vnp_Version: "2.1.0",
        vnp_Command: "pay",
        vnp_TmnCode: tmnCode,
        vnp_Locale: "vn",
        vnp_CurrCode: "VND",
        vnp_TxnRef: order.orderId,
        vnp_OrderInfo: `Thanh toan don hang ${order.orderId}`,
        vnp_OrderType: "other",
        vnp_Amount: amountForVnp,
        vnp_ReturnUrl: returnUrl,
        vnp_IpAddr: ipAddr,
        vnp_CreateDate: createDate,
        vnp_ExpireDate: expireDate,
      });

      const signData = querystring.stringify(vnp_Params, { encode: false });
      const signed = crypto
        .createHmac("sha512", secretKey)
        .update(Buffer.from(signData, "utf-8"))
        .digest("hex");
      vnp_Params["vnp_SecureHash"] = signed;
      vnpUrl += "?" + querystring.stringify(vnp_Params, { encode: false });
      return res.redirect(vnpUrl);
    }

    return res.status(400).send("Phương thức thanh toán không hợp lệ");
  } catch (err) {
    console.error("Lỗi tạo đơn:", err);
    if (order && order.status === "pending") {
      order.status = "failed";
      await order.save();
    }
    return res
      .status(500)
      .render("order-failed", { message: "Lỗi thanh toán." });
  }
});

// VNPay Return — Xóa giỏ + fallback update + trừ tồn kho nếu cần
router.get("/vnpay_return", async (req, res) => {
  let vnp_Params = req.query;
  const secureHash = vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"];
  vnp_Params = sortObject(vnp_Params);

  const secretKey = process.env.VNPAY_HASHSECRET;
  const signData = querystring.stringify(vnp_Params, { encode: false });
  const signed = crypto
    .createHmac("sha512", secretKey)
    .update(Buffer.from(signData, "utf-8"))
    .digest("hex");

  const orderId = vnp_Params["vnp_TxnRef"];
  const bankCode = vnp_Params["vnp_BankCode"];
  const resultCode = vnp_Params["vnp_ResponseCode"];
  const valid = secureHash === signed;

  let order = null;
  if (orderId) order = await Order.findOne({ orderId });

  try {
    if (req.session) req.session.cart = [];
    res.clearCookie && res.clearCookie("cart");
  } catch (_) {}

  if (valid && resultCode === "00" && order) {
    // ✅ Nếu chưa paid thì trừ tồn kho (fallback trong trường hợp IPN không vào)
    if (!order.paid) {
      for (const line of order.items) {
        const Model = STOCK_MODELS[line.itemModel];
        if (!Model) continue;
        await Model.updateOne(
          { _id: line.item },
          { $inc: { stock: -line.quantity } }
        );
      }
    }

    order.paid = true;
    order.paidAt = new Date();
    order.status = "completed";
    await order.save();
    if (order.user)
      await User.updateOne({ _id: order.user }, { $set: { cart: [] } });
    return res.render("order-success", {
      message: "Thanh toán thành công!",
      orderId,
      bankCode,
      responseCode: "00",
    });
  }

  return res.render("order-failed", {
    message: "Thanh toán không thành công hoặc không hợp lệ.",
    orderId,
    bankCode,
  });
});

// VNPay IPN — cập nhật trạng thái & trừ tồn kho (idempotent)
router.all("/vnpay_ipn", async (req, res) => {
  let vnp_Params =
    req.method === "POST" && Object.keys(req.body || {}).length
      ? req.body
      : req.query;
  const secureHash = vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"];
  vnp_Params = sortObject(vnp_Params);

  const secretKey = process.env.VNPAY_HASHSECRET;
  const signData = querystring.stringify(vnp_Params, { encode: false });
  const signed = crypto
    .createHmac("sha512", secretKey)
    .update(Buffer.from(signData, "utf-8"))
    .digest("hex");
  if (secureHash !== signed)
    return res.status(200).json({ RspCode: "97", Message: "Invalid signature" });

  const orderId = vnp_Params["vnp_TxnRef"];
  const resultCode = vnp_Params["vnp_ResponseCode"];

  try {
    const order = await Order.findOne({ orderId });
    if (!order)
      return res.status(200).json({ RspCode: "01", Message: "Order not found" });

    if (resultCode === "00") {
      // Nếu trước đó chưa paid (Return chưa xử lý) thì trừ tồn kho
      if (!order.paid) {
        for (const line of order.items) {
          const Model = STOCK_MODELS[line.itemModel];
          if (!Model) continue;
          await Model.updateOne(
            { _id: line.item },
            { $inc: { stock: -line.quantity } }
          );
        }
      }

      order.paymentMethod = "vnpay";
      order.paid = true;
      order.paidAt = new Date();
      order.status = "completed";
      await order.save();
      if (order.user)
        await User.updateOne({ _id: order.user }, { $set: { cart: [] } });
    } else {
      order.status = "failed";
      order.paymentMethod = "vnpay";
      await order.save();
    }
    return res.status(200).json({ RspCode: "00", Message: "Success" });
  } catch (err) {
    console.error("IPN error:", err);
    return res
      .status(200)
      .json({ RspCode: "99", Message: "Unknown error" });
  }
});

// Order Detail
router.get("/detail/:orderId", requireLogin, async (req, res) => {
  try {
    const order = await Order.findOne({
      orderId: req.params.orderId,
      user: req.session.userId,
    }).populate("items.item");
    if (!order) return res.redirect("/my-orders");

    // Auto complete COD sau 10s
    const tenSecondsAgo = Date.now() - 10 * 1000;
    if (
      order.paymentMethod === "cod" &&
      order.status === "processing" &&
      order.createdAt.getTime() < tenSecondsAgo
    ) {
      order.status = "completed";
      await order.save();
    }

    // Vá mềm VNPay
    if (order.paymentMethod === "vnpay" && order.paid && order.status !== "completed") {
      order.status = "completed";
      await order.save();
    }

    return res.render("order-status", { order });
  } catch (e) {
    console.error("Lỗi khi xem chi tiết:", e);
    return res.redirect("/my-orders");
  }
});

module.exports = router;
