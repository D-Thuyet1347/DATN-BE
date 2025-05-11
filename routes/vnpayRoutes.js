import express from 'express';
import { handleVnpayIPN, handleVnpayReturn } from '../controllers/vnpayController.js';

const vnpayRouter = express.Router();

vnpayRouter.get('/vnpay_return', handleVnpayReturn);

vnpayRouter.get('/vnpay_ipn', handleVnpayIPN);

export default vnpayRouter;