// routes/vnpayRoutes.js
import express from 'express';
import { createPaymentUrl, vnpayReturn, vnpayIpn } from '../controllers/vnpayController.js'; 
import authMiddleware from '../middleware/auth.js'; 

const vnpayRouter = express.Router();

vnpayRouter.post('/create_payment_url', authMiddleware, createPaymentUrl); 
vnpayRouter.get('/vnpay_return', vnpayReturn); 
vnpayRouter.get('/vnpay_ipn', vnpayIpn);       

export default vnpayRouter;