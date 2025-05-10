import moment from 'moment';
import querystring from 'qs';
import crypto from 'crypto';
import orderModel from '../models/ordersModel.js';
import { sortObject } from '../utils/vnpayUtils.js';

export const createVnpayPaymentUrl = (req, orderId, amount, discountInfo = null) => {
    process.env.TZ = 'Asia/Ho_Chi_Minh';
    let date = new Date();
    let createDate = moment(date).format('YYYYMMDDHHmmss');

    let ipAddr = req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        (req.connection && req.connection.socket ? req.connection.socket.remoteAddress : null); 

    if (ipAddr && ipAddr.includes('::ffff:')) {
        ipAddr = ipAddr.split(':').pop();
    }

    let tmnCode = process.env.VNPAY_TMN_CODE;
    let secretKey = process.env.VNPAY_HASH_SECRET;
    let vnpUrl = process.env.VNPAY_URL;
    let returnUrl = process.env.VNPAY_RETURN_URL; 

    if (!tmnCode || !secretKey || !vnpUrl || !returnUrl || !ipAddr) {
        console.error("Thiếu cấu hình VNPAY hoặc địa chỉ IP.");
        throw new Error("Lỗi cấu hình hệ thống thanh toán.");
    }

    let locale = 'vn';
    let currCode = 'VND';
    let vnp_Params = {};

    // Chuẩn bị orderInfo chi tiết hơn nếu có thông tin giảm giá
    let orderInfo = 'Thanh toan cho don hang ' + orderId.toString();
    if (discountInfo && discountInfo.discountAmount > 0) {
        orderInfo += ` (Giam gia: ${discountInfo.discountAmount}đ`;
        if (discountInfo.voucherCode) {
            orderInfo += `, Ma: ${discountInfo.voucherCode}`;
        }
        orderInfo += ')';
    }

    vnp_Params['vnp_Version'] = '2.1.0';
    vnp_Params['vnp_Command'] = 'pay';
    vnp_Params['vnp_TmnCode'] = tmnCode;
    vnp_Params['vnp_Locale'] = locale;
    vnp_Params['vnp_CurrCode'] = currCode;
    vnp_Params['vnp_TxnRef'] = orderId.toString(); 
    vnp_Params['vnp_OrderInfo'] = orderInfo;
    vnp_Params['vnp_OrderType'] = 'other'; 
    vnp_Params['vnp_Amount'] = Math.round(amount * 100); 
    vnp_Params['vnp_ReturnUrl'] = returnUrl;
    vnp_Params['vnp_IpAddr'] = ipAddr;
    vnp_Params['vnp_CreateDate'] = createDate;
    // vnp_Params['vnp_BankCode'] = 'VNBANK';

    vnp_Params = sortObject(vnp_Params);

    let signData = querystring.stringify(vnp_Params, { encode: false });
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");
    vnp_Params['vnp_SecureHash'] = signed;

    vnpUrl += '?' + querystring.stringify(vnp_Params, { encode: false });
    console.log("VNPAY URL:", vnpUrl); 
    return vnpUrl;
};

export const handleVnpayReturn = async (req, res) => {
    let vnp_Params = req.query;
    let secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);

    let secretKey = process.env.VNPAY_HASH_SECRET;
    let tmnCode = process.env.VNPAY_TMN_CODE; // Cần TmnCode để kiểm tra nếu muốn
    let signData = querystring.stringify(vnp_Params, { encode: false });
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

    const frontendReturnUrl = process.env.CLIENT_URL || "http://localhost:3000";
    const orderId = vnp_Params['vnp_TxnRef'];
    const responseCode = vnp_Params['vnp_ResponseCode'];
    const amount = vnp_Params['vnp_Amount'] / 100;
    const transactionNo = vnp_Params['vnp_TransactionNo'];

    let redirectUrl = `${frontendReturnUrl}/payment-result?paymentMethod=vnpay&orderId=${orderId}`;

    if (secureHash === signed) {
        console.log(`VNPAY Return: Hash hợp lệ cho đơn hàng ${orderId}`);
        if (responseCode == '00') {
            console.log(`VNPAY Return: Giao dịch thành công (mã 00) cho đơn hàng ${orderId}`);
            try {
                await orderModel.findByIdAndUpdate(orderId, { transactionId: transactionNo });
                console.log(`VNPAY Return: Đã lưu transactionId ${transactionNo} cho đơn ${orderId}`);
            } catch (dbError) {
                console.error(`VNPAY Return: Lỗi khi lưu transactionId cho đơn ${orderId}:`, dbError);
            }
            redirectUrl += `&success=true&message=Giao dịch VNPAY thành công (chờ xác nhận)&amount=${amount}&transactionNo=${transactionNo}`;
        } else {
            console.log(`VNPAY Return: Giao dịch thất bại/hủy (mã ${responseCode}) cho đơn hàng ${orderId}`);
            redirectUrl += `&success=false&message=Giao dịch VNPAY thất bại hoặc bị hủy&errorCode=${responseCode}`;
        }
    } else {
        console.error(`VNPAY Return: Sai chữ ký cho đơn hàng ${orderId}`);
        redirectUrl += `&success=false&message=Giao dịch không hợp lệ (sai chữ ký)`;
    }
    console.log("Redirecting to Frontend:", redirectUrl);
    res.redirect(redirectUrl);
};

// Hàm xử lý VNPAY IPN (VNPAY gọi vào Backend) - **QUAN TRỌNG NHẤT**
export const handleVnpayIPN = async (req, res) => {
    console.log("Received VNPAY IPN:", req.query);
    let vnp_Params = req.query;
    let secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);
    let secretKey = process.env.VNPAY_HASH_SECRET;
    let signData = querystring.stringify(vnp_Params, { encode: false });
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

    let orderId = vnp_Params['vnp_TxnRef'];
    let rspCode = vnp_Params['vnp_ResponseCode'];
    let amount = parseInt(vnp_Params['vnp_Amount']) / 100;
    let transactionNo = vnp_Params['vnp_TransactionNo']; // Mã giao dịch VNPAY
    let bankCode = vnp_Params['vnp_BankCode']; // Ngân hàng thanh toán
    let payDate = vnp_Params['vnp_PayDate'];   // Thời gian thanh toán

    try {
        if (secureHash === signed) {
            console.log(`VNPAY IPN: Checksum hợp lệ cho đơn hàng ${orderId}`);
            const order = await orderModel.findById(orderId);

            if (!order) {
                console.log(`VNPAY IPN: Không tìm thấy đơn hàng ${orderId}`);
                return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
            }

            // Tính tổng tiền sau giảm giá
            const calculatedAmount = order.totalAmount;
            
            // So sánh số tiền đã trừ voucher với số tiền nhận từ VNPAY
            if (Math.abs(calculatedAmount - amount) > 1) { // Allow small deviation (e.g., 1 VND)
                console.log(`VNPAY IPN: Sai số tiền. Order: ${calculatedAmount}, VNPAY: ${amount}`);
                return res.status(200).json({ RspCode: '04', Message: 'Invalid amount' });
            }

            if (order.paymentStatus === 'Đã thanh toán') {
                console.log(`VNPAY IPN: Đơn hàng ${orderId} đã được xác nhận thanh toán trước đó.`);
                return res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' }); // Theo tài liệu VNPAY
            }
            if (order.paymentStatus === 'Đã hủy') {
                console.log(`VNPAY IPN: Đơn hàng ${orderId} đã bị hủy.`);
                return res.status(200).json({ RspCode: '99', Message: 'Order cancelled' }); // Hoặc mã lỗi phù hợp
            }


            const paymentInfo = { 
                transactionNo: transactionNo,
                bankCode: bankCode,
                payDate: payDate,
                amount: amount,
                responseCode: rspCode,
                ipnReceivedAt: new Date()
            };

            if (rspCode === '00') {
                // Giao dịch thành công
                console.log(`VNPAY IPN: Xác nhận thanh toán thành công cho đơn hàng ${orderId}.`);
                await orderModel.findByIdAndUpdate(orderId, {
                    paymentStatus: 'Đã thanh toán',
                    orderStatus: 'Đã xác nhận', 
                    transactionId: transactionNo, 
                    paymentInfo: paymentInfo 
                });
                console.log(`VNPAY IPN: Đã cập nhật trạng thái thành công cho đơn ${orderId}.`);

                return res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
            } else {
                console.log(`VNPAY IPN: Xác nhận thanh toán thất bại cho đơn hàng ${orderId} (Mã ${rspCode}).`);
                await orderModel.findByIdAndUpdate(orderId, {
                    paymentStatus: 'Thất bại',
                    transactionId: transactionNo,
                    paymentInfo: paymentInfo
                });
                console.log(`VNPAY IPN: Đã cập nhật trạng thái thất bại cho đơn ${orderId}.`);

                return res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
            }
        } else {
            console.error(`VNPAY IPN: Sai chữ ký cho đơn hàng ${orderId}`);
            return res.status(200).json({ RspCode: '97', Message: 'Invalid Checksum' });
        }
    } catch (error) {
        console.error('VNPAY IPN - Lỗi xử lý:', error);
        // Phản hồi lỗi chung nếu server gặp sự cố
        return res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
    }
};