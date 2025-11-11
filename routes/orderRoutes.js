// routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const moment = require('moment');
const net = require('net');
const querystring = require('qs');
const { URL } = require('url');

function ensureHttpsUrl(url, configName) {
  const trimmed = (url || '').trim();
  if (!trimmed) {
    throw new Error(`Thiếu cấu hình ${configName}`);
  }
  if (!/^https:\/\//i.test(trimmed)) {
    throw new Error(`${configName} phải bắt đầu bằng https:// theo yêu cầu của VNPay.`);
  }
  return trimmed;
}

function resolveCallbackUrl(req, envKey, fallbackPath) {
  const envUrl = process.env[envKey];
  if (envUrl && envUrl.trim()) {
    return ensureHttpsUrl(envUrl, envKey);
  }

  const publicBaseUrl = process.env.PUBLIC_BASE_URL;
  if (publicBaseUrl && publicBaseUrl.trim()) {
    const normalizedBase = ensureHttpsUrl(publicBaseUrl, 'PUBLIC_BASE_URL');
    return new URL(fallbackPath, normalizedBase).toString();
  }

  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol =
    (typeof forwardedProto === 'string' && forwardedProto.split(',')[0].trim()) ||
    req.protocol;
  const host = req.get('host');

  if (!host) {
    throw new Error('Không xác định được host để tạo callback URL cho VNPay.');
  }

  if (protocol !== 'https') {
    throw new Error(
      `Không tìm thấy URL HTTPS công khai cho ${fallbackPath}. Hãy thiết lập ${envKey} hoặc PUBLIC_BASE_URL.`
    );
  }

  return `https://${host}${fallbackPath}`;
}

const Order = require('../models/orderModel');
const User = require('../models/userModel');
const { requireLogin } = require('../middleware/authMiddleware');

// === HÀM sortObject CHUẨN TỪ VNPAY DEMO ===
function sortObject(obj) {
  const sorted = {};
  const keys = Object.keys(obj).sort();

  keys.forEach((key) => {
    if (typeof obj[key] === 'undefined' || obj[key] === null) return;
    sorted[key] = encodeURIComponent(obj[key]).replace(/%20/g, '+');
  });

  return sorted;
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp =
    (typeof forwarded === 'string' && forwarded.split(',')[0].trim()) ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.connection?.socket?.remoteAddress ||
    '';

  if (!rawIp) return '127.0.0.1';
  if (rawIp.startsWith('::ffff:')) return rawIp.substring(7);
  if (rawIp === '::1' || rawIp === '0:0:0:0:0:0:0:1') return '127.0.0.1';

  if (net.isIP(rawIp) === 6) {
    // VNPay yêu cầu IPv4, nếu nhận IPv6 thì trả về 127.0.0.1 để tránh lỗi 99
    return '127.0.0.1';
  }

  return rawIp;
}

// VNPay chỉ chấp nhận vnp_TxnRef tối đa 20 ký tự dạng chữ/ số.
function generateOrderId() {
  const datePart = moment().format('YYMMDDHHmmss');
  const randomPart = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
  return (datePart + randomPart).substring(0, 20);
}

// === CÁC ROUTE CHÍNH ===

// GET /order/checkout
router.get('/checkout', requireLogin, (req, res) => {
  res.render('checkout');
});

// POST /order/create-payment
router.post('/create-payment', requireLogin, async (req, res) => {
  let order;
  const selectedPaymentMethod = req.body.paymentMethod;

  try {
    const user = await User.findById(req.session.userId).populate('cart.item');
    if (!user || user.cart.length === 0) {
      return res.redirect('/cart');
    }

    const customerInfo = {
      name: req.body.name,
      phone: req.body.phone,
      address: req.body.address,
    };

    let amount = 0;
    const items = user.cart.map((cartItem) => {
      if (!cartItem.item) throw new Error('Sản phẩm trong giỏ hàng không hợp lệ.');
      const itemPrice = cartItem.item.price;
      amount += itemPrice * cartItem.quantity;
      return {
        item: cartItem.item._id,
        itemModel: cartItem.itemModel,
        quantity: cartItem.quantity,
        price: itemPrice,
      };
    });

    const normalizedAmount = Math.round(amount);

    order = new Order({
      orderId: generateOrderId(),
      user: req.session.userId,
      customerInfo,
      items,
      amount: normalizedAmount,
      paymentMethod: selectedPaymentMethod,
      status: 'pending',
    });
    await order.save();

    if (selectedPaymentMethod === 'cod') {
      order.status = 'processing';
      await order.save();
      user.cart = [];
      await user.save();
      return res.render('order-success', {
        message: 'Đặt hàng thành công! Bạn sẽ thanh toán khi nhận hàng.',
      });
    }

    if (selectedPaymentMethod === 'vnpay') {
      const tmnCode = process.env.VNPAY_TMNCODE;
      const secretKey = process.env.VNPAY_HASHSECRET;
      let vnpUrl = process.env.VNPAY_URL;

      if (!tmnCode || !secretKey || !vnpUrl) {
        throw new Error(
          'Thiếu cấu hình VNPay (VNPAY_TMNCODE, VNPAY_HASHSECRET hoặc VNPAY_URL)'
        );
      }

      const ipAddr = getClientIp(req);

      const returnUrl = resolveCallbackUrl(req, 'VNPAY_RETURNURL', '/order/vnpay_return');
      const ipnUrl = resolveCallbackUrl(req, 'VNPAY_IPNURL', '/order/vnpay_ipn');
      console.info('[VNPay] Return URL:', returnUrl);
      console.info('[VNPay] IPN URL đã cấu hình:', ipnUrl);

      const createDate = moment().utcOffset(7 * 60).format('YYYYMMDDHHmmss');
      const expireDate = moment().utcOffset(7 * 60).add(15, 'minutes').format('YYYYMMDDHHmmss');

      const amountForVnp = (normalizedAmount * 100).toString();

      let vnp_Params = {};
      vnp_Params['vnp_Version'] = '2.1.0';
      vnp_Params['vnp_Command'] = 'pay';
      vnp_Params['vnp_TmnCode'] = tmnCode;
      vnp_Params['vnp_Locale'] = 'vn';
      vnp_Params['vnp_CurrCode'] = 'VND';
      vnp_Params['vnp_TxnRef'] = order.orderId;
      vnp_Params['vnp_OrderInfo'] = 'Thanh toan don hang ' + order.orderId;
      vnp_Params['vnp_OrderType'] = 'other';
      vnp_Params['vnp_Amount'] = amountForVnp;
      vnp_Params['vnp_ReturnUrl'] = returnUrl;
      vnp_Params['vnp_IpAddr'] = ipAddr;
      vnp_Params['vnp_CreateDate'] = createDate;
      vnp_Params['vnp_ExpireDate'] = expireDate;

      // 1) Sắp xếp & encode
      vnp_Params = sortObject(vnp_Params);
      // 2) Chuỗi ký
      const signData = querystring.stringify(vnp_Params, { encode: false });
      // 3) Tạo chữ ký
      const hmac = crypto.createHmac('sha512', secretKey);
      const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
      vnp_Params['vnp_SecureHash'] = signed;
      // 4) Redirect
      vnpUrl += '?' + querystring.stringify(vnp_Params, { encode: false });
      return res.redirect(vnpUrl);
    }

    // Nếu không phải COD/VNPAY:
    return res.status(400).send('Phương thức thanh toán không hợp lệ');
  } catch (error) {
    console.error('Lỗi khi tạo thanh toán:', error);

    if (order && order.status === 'pending') {
      try {
        order.status = 'failed';
        await order.save();
      } catch (saveError) {
        console.error('Không thể cập nhật trạng thái đơn hàng khi lỗi VNPay:', saveError);
      }
    }

    if (selectedPaymentMethod === 'vnpay') {
      return res.status(500).render('order-success', {
        message:
          'Thanh toán VNPay hiện chưa hoàn tất. Bạn có thể thử lại sau hoặc chọn phương thức thanh toán khi nhận hàng.',
        responseCode: '99',
      });
    }

    return res.status(500).send('Đã có lỗi xảy ra');
  }
});

// GET /order/vnpay_return
router.get('/vnpay_return', async (req, res) => {
  let vnp_Params = req.query;
  const secureHash = vnp_Params['vnp_SecureHash'];

  delete vnp_Params['vnp_SecureHash'];
  delete vnp_Params['vnp_SecureHashType'];

  vnp_Params = sortObject(vnp_Params);

  const secretKey = process.env.VNPAY_HASHSECRET;
  const signData = querystring.stringify(vnp_Params, { encode: false });
  const hmac = crypto.createHmac('sha512', secretKey);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

  const orderId = vnp_Params['vnp_TxnRef'];
  const bankCode = vnp_Params['vnp_BankCode'];

  if (secureHash === signed) {
    const resultCode = vnp_Params['vnp_ResponseCode'];
    if (resultCode === '00') {
      return res.render('order-success', {
        message: 'Thanh toán thành công! Đơn hàng của bạn đang được xử lý.',
        responseCode: resultCode,
        orderId,
        bankCode,
      });
    }
    return res.render('order-success', {
      message: 'Thanh toán không thành công. Bạn có thể thử lại hoặc chọn thanh toán khi nhận hàng.',
      responseCode: resultCode,
      orderId,
      bankCode,
    });
  }

  return res.render('order-success', {
    message: 'Giao dịch không hợp lệ (chữ ký không khớp).',
    responseCode: '97',
    orderId,
    bankCode,
  });
});

// GET/POST /order/vnpay_ipn  (đÃ SỬA CÚ PHÁP BỊ VỠ)
router.all('/vnpay_ipn', async (req, res) => {
  let vnp_Params =
    req.method === 'POST' && Object.keys(req.body || {}).length ? req.body : req.query;
  const secureHash = vnp_Params['vnp_SecureHash'];

  delete vnp_Params['vnp_SecureHash'];
  delete vnp_Params['vnp_SecureHashType'];

  vnp_Params = sortObject(vnp_Params);

  const secretKey = process.env.VNPAY_HASHSECRET;
  const signData = querystring.stringify(vnp_Params, { encode: false });
  const hmac = crypto.createHmac('sha512', secretKey);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

  if (secureHash !== signed) {
    return res.status(200).json({ RspCode: '97', Message: 'Invalid signature' });
  }

  const orderId = vnp_Params['vnp_TxnRef'];
  const resultCode = vnp_Params['vnp_ResponseCode'];
  const amount = parseInt(vnp_Params['vnp_Amount'], 10) / 100;

  try {
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
    }

    if (order.status !== 'pending') {
      return res
        .status(200)
        .json({ RspCode: '02', Message: 'This order has been updated to the payment status' });
    }

    if (order.amount !== amount) {
      return res.status(200).json({ RspCode: '04', Message: 'Invalid amount' });
    }

    // Cập nhật trạng thái theo ResponseCode
    if (resultCode === '00') {
      order.status = 'processing';
      order.paymentMethod = 'vnpay';
    } else {
      order.status = 'failed';
      order.paymentMethod = 'vnpay';
    }
    await order.save();

    return res.status(200).json({ RspCode: '00', Message: 'Success' });
  } catch (err) {
    console.error('IPN error:', err);
    return res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
  }
});

// Xem chi tiết đơn hàng
router.get('/detail/:orderId', requireLogin, async (req, res) => {
  try {
    const order = await Order.findOne({
      orderId: req.params.orderId,
      user: req.session.userId,
    }).populate('items.item');

    if (!order) {
      return res.redirect('/my-orders');
    }

    // Logic 2 giờ cho COD
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    if (
      order.paymentMethod === 'cod' &&
      order.status === 'processing' &&
      order.createdAt.getTime() < twoHoursAgo
    ) {
      order.status = 'completed';
    }

    return res.render('order-status', { order });
  } catch (error) {
    console.error('Lỗi khi xem chi tiết đơn hàng:', error);
    return res.redirect('/my-orders');
  }
});

module.exports = router;
