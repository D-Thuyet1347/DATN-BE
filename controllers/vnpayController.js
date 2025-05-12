// controllers/vnpayController.js
import crypto from 'crypto';
import moment from 'moment';
import qs from 'qs';
import orderModel from '../models/ordersModel.js'; // Đảm bảo đường dẫn đúng
import dotenv from 'dotenv';

dotenv.config(); // Load biến môi trường

// Hàm sắp xếp object theo key alpahabet
function sortObject(obj) {
    let sorted = {};
    let str = [];
    let key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) {
            str.push(encodeURIComponent(key));
        }
    }
    str.sort();
    for (key = 0; key < str.length; key++) {
        sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
    }
    return sorted;
}

// Hàm tạo URL thanh toán
export const createPaymentUrl = async (req, res) => {
    try {
        // Lấy thông tin từ request body (orderId, amount,...)
        // Thông tin này nên được gửi từ frontend SAU KHI đơn hàng đã được tạo ở trạng thái "Pending VNPAY"
        const { orderId, amount, bankCode = '', language = 'vn', orderDescription, orderType = 'other' } = req.body;

        if (!orderId || !amount || !orderDescription) {
            return res.status(400).json({ success: false, message: 'Missing required parameters' });
        }

        process.env.TZ = 'Asia/Ho_Chi_Minh'; // Set múi giờ Việt Nam
        let date = new Date();
        let createDate = moment(date).format('YYYYMMDDHHmmss');

        let ipAddr = req.headers['x-forwarded-for'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            (req.connection.socket ? req.connection.socket.remoteAddress : null);

        let tmnCode = process.env.VNPAY_TMN_CODE;
        let secretKey = process.env.VNPAY_HASH_SECRET;
        let vnpUrl = process.env.VNPAY_URL;
        let returnUrl = process.env.VNPAY_RETURN_URL;
        let txnRef = orderId + '_' + createDate; // Đảm bảo mã tham chiếu là duy nhất cho mỗi lần tạo URL
        let vnp_Amount = amount * 100; // VNPAY yêu cầu amount * 100

        let vnp_Params = {};
        vnp_Params['vnp_Version'] = '2.1.0';
        vnp_Params['vnp_Command'] = 'pay';
        vnp_Params['vnp_TmnCode'] = tmnCode;
        vnp_Params['vnp_Locale'] = language;
        vnp_Params['vnp_CurrCode'] = 'VND';
        vnp_Params['vnp_TxnRef'] = txnRef; // Mã tham chiếu giao dịch (duy nhất)
        vnp_Params['vnp_OrderInfo'] = orderDescription; // Thông tin mô tả đơn hàng
        vnp_Params['vnp_OrderType'] = orderType; // Loại hàng hóa
        vnp_Params['vnp_Amount'] = vnp_Amount;
        vnp_Params['vnp_ReturnUrl'] = returnUrl;
        vnp_Params['vnp_IpAddr'] = ipAddr;
        vnp_Params['vnp_CreateDate'] = createDate;

        // Thêm bankCode nếu có
        if (bankCode !== null && bankCode !== '') {
            vnp_Params['vnp_BankCode'] = bankCode;
        }

        // Sắp xếp params và tạo query string
        vnp_Params = sortObject(vnp_Params);
        let signData = qs.stringify(vnp_Params, { encode: false });

        // Tạo chữ ký bảo mật
        let hmac = crypto.createHmac("sha512", secretKey);
        let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");
        vnp_Params['vnp_SecureHash'] = signed;

        // Tạo URL thanh toán hoàn chỉnh
        vnpUrl += '?' + qs.stringify(vnp_Params, { encode: false });

        console.log("VNPAY URL:", vnpUrl);
        res.json({ success: true, payment_url: vnpUrl });

    } catch (error) {
        console.error("Error creating VNPAY URL:", error);
        res.status(500).json({ success: false, message: "Failed to create VNPAY payment URL" });
    }
};

// Hàm xử lý VNPAY Return URL
export const vnpayReturn = async (req, res) => {
    let vnp_Params = req.query;
    const secureHash = vnp_Params['vnp_SecureHash'];

    // Xoá các param hash để kiểm tra chữ ký
    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);

    const secretKey = process.env.VNPAY_HASH_SECRET;
    const signData = qs.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

    const clientReturnUrlBase = process.env.CLIENT_URL || 'http://localhost:3000';
    let redirectUrl = `${clientReturnUrlBase}/payment-status`;
    let success = false;
    let message = '';

    if (secureHash === signed) {
        const vnpTxnRef = vnp_Params['vnp_TxnRef'];
        if (!vnpTxnRef || !vnpTxnRef.includes('_')) {
            console.log('VNPAY Return - Invalid vnp_TxnRef:', vnpTxnRef);
            message = 'Mã đơn hàng không hợp lệ';
            return res.redirect(`${redirectUrl}/failed?message=${encodeURIComponent(message)}`);
        }

        const orderId = vnpTxnRef.split('_')[0];
        const rspCode = vnp_Params['vnp_ResponseCode'];

        console.log(`VNPAY Return - OrderId: ${orderId}, RspCode: ${rspCode}`);

        try {
            const order = await orderModel.findById(orderId);
            if (order) {
                if (rspCode === '00') {
                    if (order.paymentStatus !== 'Paid') {
                        order.paymentStatus = 'Thanh toán qua VNPAY';
                        order.orderStatus = 'Đã thanh toán'; // Cập nhật trạng thái đơn hàng
                        await order.save();
                        console.log(`VNPAY Return - Order ${orderId} updated to Paid.`);
                    } else {
                        console.log(`VNPAY Return - Order ${orderId} already Paid.`);
                    }
                    message = 'Giao dịch thành công';
                    success = true;
                } else {
                    if (order.paymentStatus !== 'Paid') {
                        order.paymentStatus = 'Failed';
                        // Có thể cập nhật orderStatus nếu muốn
                        await order.save();
                        console.log(`VNPAY Return - Order ${orderId} updated to Failed.`);
                    }
                    message = 'Giao dịch thất bại';
                }
            } else {
                console.log(`VNPAY Return - Order ${orderId} not found.`);
                message = 'Không tìm thấy đơn hàng';
            }
        } catch (err) {
            console.error(`VNPAY Return - DB Error for Order ${orderId}:`, err);
            message = 'Lỗi cập nhật đơn hàng';
        }

        if (success) {
            return res.redirect(`${redirectUrl}/success?message=${encodeURIComponent(message)}`);
        } else {
            return res.redirect(`${redirectUrl}/failed?message=${encodeURIComponent(message)}`);
        }
    } else {
        console.log(`VNPAY Return - Invalid Signature. Expected: ${signed}, Received: ${secureHash}`);
        message = 'Chữ ký không hợp lệ';
        return res.redirect(`${redirectUrl}/failed?message=${encodeURIComponent(message)}`);
    }
};

// Hàm xử lý VNPAY IPN URL (Quan trọng hơn Return URL để xác nhận thanh toán)
export const vnpayIpn = async (req, res) => {
    let vnp_Params = req.query;
    let secureHash = vnp_Params['vnp_SecureHash'];

    // Xóa param hash để kiểm tra chữ ký
    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);
    let secretKey = process.env.VNPAY_HASH_SECRET;
    let signData = qs.stringify(vnp_Params, { encode: false });
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

    let orderId = vnp_Params['vnp_TxnRef'].split('_')[0]; // Lấy orderId
    let rspCode = vnp_Params['vnp_ResponseCode'];
    let vnpAmount = parseInt(vnp_Params['vnp_Amount']) / 100; // Lấy số tiền từ VNPAY


    // Kiểm tra chữ ký
    if (secureHash === signed) {
        try {
            const order = await orderModel.findById(orderId);

            // 1. Kiểm tra xem đơn hàng có tồn tại không?
            if (!order) {
                console.log(`VNPAY IPN - Order ${orderId} not found.`);
                return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
            }

            // 2. Kiểm tra số tiền
            if (order.totalAmount !== vnpAmount) {
                console.log(`VNPAY IPN - Amount mismatch for Order ${orderId}. Expected: ${order.totalAmount}, Received: ${vnpAmount}`);
                return res.status(200).json({ RspCode: '04', Message: 'Invalid amount' });
            }

            // 3. Kiểm tra trạng thái đơn hàng đã được xử lý chưa (tránh xử lý IPN nhiều lần)
            if (order.paymentStatus === 'Paid') {
                console.log(`VNPAY IPN - Order ${orderId} already confirmed as Paid.`);
                return res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' });
            }

            // 4. Xử lý kết quả giao dịch từ VNPAY
            if (rspCode === '00') {
                order.paymentStatus = 'Paid';
                order.orderStatus = 'Đã xác nhận'; // Cập nhật trạng thái phù hợp
                await order.save();
                console.log(`VNPAY IPN - Order ${orderId} updated to Paid.`);
                res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
            } else {
                // Giao dịch thất bại hoặc bị hủy
                order.paymentStatus = 'Failed';
                // order.orderStatus = 'Đã hủy'; // Cân nhắc cập nhật
                await order.save();
                console.log(`VNPAY IPN - Order ${orderId} marked as Failed (RspCode: ${rspCode}).`);
                // Vẫn trả về '00' cho VNPAY vì đã xử lý IPN thành công (dù giao dịch thất bại)
                res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
            }

        } catch (dbError) {
            console.error(`VNPAY IPN - DB Error processing Order ${orderId}:`, dbError);
            // Lỗi trong quá trình xử lý DB, không thể xác nhận đơn hàng
            res.status(200).json({ RspCode: '99', Message: 'Unknown error' }); // Hoặc mã lỗi phù hợp khác
        }
    } else {
        console.log(`VNPAY IPN - Invalid Signature for Order ${orderId}`);
        res.status(200).json({ RspCode: '97', Message: 'Invalid Checksum' }); // Phản hồi lỗi chữ ký
    }
};