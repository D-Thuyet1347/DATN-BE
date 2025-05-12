// config/vnpay.js
import crypto from 'crypto';

class VNPay {
    constructor({
        tmnCode = '',
        hashSecret = '',
        vnpayHost = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html ',
        returnUrl = '/api/vnpay/return',
        ipnUrl = '/api/vnpay/ipn',
    }) {
        this.tmnCode = tmnCode;
        this.hashSecret = hashSecret;
        this.vnpayHost = vnpayHost;
        this.returnUrl = returnUrl;
        this.ipnUrl = ipnUrl;
    }

    generateSecureHash(data) {
        const keys = Object.keys(data).sort();
        const query = keys.map(k => `${k}=${data[k]}`).join('&');
        const hmac = crypto.createHmac('sha512', this.hashSecret);
        return hmac.update(Buffer.from(query, 'utf-8')).digest('hex');
    }

    buildPaymentUrl(orderData) {
        const data = {
            vnp_Version: '2.1.0',
            vnp_Command: 'pay',
            vnp_TmnCode: this.tmnCode,
            vnp_Amount: orderData.amount * 100, // VND -> xu
            vnp_CreateDate: new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14),
            vnp_CurrCode: 'VND',
            vnp_IpAddr: orderData.ip || '127.0.0.1',
            vnp_Locale: 'vn',
            vnp_OrderInfo: orderData.orderInfo || 'Thanh toan don hang',
            vnp_OrderType: 'other',
            vnp_ReturnUrl: this.returnUrl,
            vnp_TxnRef: orderData.txnRef,
        };

        const secureHash = this.generateSecureHash(data);
        data.vnp_SecureHash = secureHash;

        const queryString = new URLSearchParams(data).toString();
        return `${this.vnpayHost}?${queryString}`;
    }

    verifyReturnUrl(params) {
        const secureHash = params.vnp_SecureHash;
        delete params.vnp_SecureHash;

        const sortedParams = {};
        Object.keys(params)
            .sort()
            .forEach((key) => {
                sortedParams[key] = params[key];
            });

        const query = Object.entries(sortedParams)
            .map(([k, v]) => `${k}=${v}`)
            .join('&');

        const hmac = crypto.createHmac('sha512', this.hashSecret);
        const calculatedHash = hmac.update(Buffer.from(query, 'utf-8')).digest('hex');

        return {
            isVerified: calculatedHash === secureHash,
            isSuccess: params.vnp_ResponseCode === '00',
            ...params,
        };
    }
}

export default new VNPay({
    tmnCode: process.env.VNPAY_TMN_CODE,
    hashSecret: process.env.VNPAY_HASH_SECRET,
    vnpayHost: process.env.VNPAY_URL,
    returnUrl: process.env.VNPAY_RETURN_URL,
});