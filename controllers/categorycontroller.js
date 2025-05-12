import categoryModel from "../models/categoryModel.js";
import ProductModel from "../models/productModel.js";
import ServiceModel from "../models/serviceModel.js";

//them danh muc
const addCategory = async (req, res) => {
    try {
        const newCategory = new categoryModel(req.body);
        await newCategory.save();
        res.status(201).json({ sucsess: true, data: newCategory })
    } catch (error) {
        res.status(500).json({ sucsess: false, message: 'Lỗi khi thêm category' })
    }

}

const listCategory = async (req, res) => {
    try {
        const categories = await categoryModel.find();
        res.status(200).json({ success: true, data: categories });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Error retrieving categories' });
    }

}

const updateCategory = async (req, res) => {
    try {
        const { id, ...updateData } = req.body;
        const updateCategory = await categoryModel.findByIdAndUpdate(id, updateData, { new: true })
        if (!updateCategory) {
            return res.status(404).json({ success: false, message: "Không tìm thấy danh mục" })
        }
        res.status(200).json({ sucsess: true, data: updateCategory })
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Lỗi khi cập nhật danh mục' })
    }
}

const removeCategory = async (req, res) => {
    try {
        const categoryId = req.body.id;
        const category = await categoryModel.findByIdAndDelete(categoryId);

        if (!category) {
            return res.status(404).json({ success: false, message: "Không tìm thấy danh mục để xóa" });
        }

        const categoryName = category.name;

        await ProductModel.deleteMany({ Category: categoryName });

        // Xóa tất cả dịch vụ có category trùng tên
        await ServiceModel.deleteMany({ category: categoryName });

        res.status(200).json({ 
            success: true, 
            message: "Xóa danh mục và tất cả sản phẩm/dịch vụ liên quan thành công", 
            data: category 
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Lỗi khi xóa danh mục' });
    }
};


const getCategoryById = async (req, res) => {
    try {
        const category = await categoryModel.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ success: false, message: "Không tìm thấy danh mục" });
        }
        res.status(200).json({ success: true, data: category });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Lỗi khi lấy danh mục' });
    }
};
const searchCategory = async (req, res) => {
    const { q, page = 1, limit = 10 } = req.query;
    try {
        const query = {
            $or: [
                { name: { $regex: q, $options: 'i' } },
                { description: { $regex: q, $options: 'i' } },
            ],
        };
        const category = await categoryModel.find(query)
            .limit(limit * 1)
            .skip((page - 1) * limit);
        const total = await categoryModel.countDocuments(query);
        res.json({
            success: true,
            data: category,
            total,
            page,
            pages: Math.ceil(total / limit),
        });
    } catch (error) {
        console.error('Error searching category:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi tìm kiếm danh mục' });
    }
};

export { addCategory, listCategory, updateCategory, removeCategory, getCategoryById, searchCategory };

