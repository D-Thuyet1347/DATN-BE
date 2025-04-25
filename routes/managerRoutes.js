import express from 'express';
import {
    addManager,
    updateManager,
    deleteManager,
    getAllManagers
} from '../controllers/managerController.js';

const managerRouter = express.Router();

managerRouter.post('/add', addManager);
managerRouter.put('/update/:id', updateManager);
managerRouter.delete('/delete/:id', deleteManager);
managerRouter.get('/list', getAllManagers);

export default managerRouter;
