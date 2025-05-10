import express from 'express';
import {
    addCategory,
    listCategory,
    updateCategory,
    removeCategory,
    getCategoryById,
    searchCategory
} from '../controllers/categorycontroller.js'

const categoryRoutes = express.Router();
categoryRoutes.post('/add', addCategory);
categoryRoutes.get('/list', listCategory);
categoryRoutes.put('/update', updateCategory);
categoryRoutes.delete('/remove', removeCategory);
categoryRoutes.get('/get/:id', getCategoryById);
categoryRoutes.get('/search', searchCategory);

export default categoryRoutes;
