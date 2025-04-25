import express from 'express';
import {addEmployee,updateEmployee,deleteEmployee,getAllEmployees, getEmployeeBookings, getEmployeesByBranch} from '../controllers/employeeController.js';

const emplyeeRouter = express.Router();

emplyeeRouter.post('/add',addEmployee);
emplyeeRouter.put('/update/:id',updateEmployee);
emplyeeRouter.delete('/delete/:id',deleteEmployee);
emplyeeRouter.get('/list',getAllEmployees);
emplyeeRouter.get('/:id/bookings', getEmployeeBookings);
emplyeeRouter.get("/employee/:branchId", getEmployeesByBranch);


export default emplyeeRouter;