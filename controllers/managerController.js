import ManagerModel from "../models/managerModel.js";
import UserModel from "../models/userModel.js";
import BranchModel from "../models/branchModel.js";

const addManager = async (req, res) => {
    try {
        const { BranchID, UserID, Role, Position } = req.body;

        const user = await UserModel.findById(UserID);
        if (!user) {
            return res.status(404).json({ message: "Người dùng không tồn tại" });
        }

        const branch = await BranchModel.findById(BranchID);
        if (!branch) {
            return res.status(404).json({ message: "Chi nhánh không tồn tại" });
        }

        const newManager = new ManagerModel({
            BranchID,
            UserID,
            Role,
            Position
        });

        await newManager.save();
        res.status(201).json({ message: "Quản lý đã được thêm thành công", manager: newManager });
    } catch (error) {
        console.error("Lỗi khi thêm quản lý:", error);
        res.status(500).json({ message: "Lỗi khi thêm quản lý", error });
    }
};

const updateManager = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const updatedManager = await ManagerModel.findByIdAndUpdate(id, updateData, { new: true });

        if (!updatedManager) {
            return res.status(404).json({ message: "Không tìm thấy quản lý để cập nhật" });
        }

        res.status(200).json({ message: "Quản lý được cập nhật thành công", manager: updatedManager });
    } catch (error) {
        console.error("Lỗi khi cập nhật quản lý:", error);
        res.status(500).json({ message: "Lỗi khi cập nhật quản lý", error });
    }
};

const deleteManager = async (req, res) => {
    try {
        const { id } = req.params;

        const manager = await ManagerModel.findById(id);
        if (!manager) {
            return res.status(404).json({ message: "Không tìm thấy quản lý" });
        }

        if (manager.Status !== "active") {
            await ManagerModel.findByIdAndDelete(id);
            return res.status(200).json({ message: "Quản lý đã được xóa thành công" });
        } else {
            return res.status(400).json({ message: "Không thể xóa quản lý đang hoạt động" });
        }
    } catch (error) {
        console.error("Lỗi khi xóa quản lý:", error);
        return res.status(500).json({ message: "Lỗi khi xóa quản lý", error: error.message });
    }
};

const getAllManagers = async (req, res) => {
    try {
        const managers = await ManagerModel.aggregate([
            {
                $lookup: {
                    from: 'branches',
                    localField: 'BranchID',
                    foreignField: '_id',
                    as: 'Branch'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'UserID',
                    foreignField: '_id',
                    as: 'User'
                }
            },
            { $unwind: '$Branch' },
            { $unwind: '$User' }
        ]);

        res.status(200).json({ success: true, data: managers });
    } catch (error) {
        console.error("Lỗi khi lấy danh sách quản lý:", error);
        res.status(500).json({ message: "Lỗi khi lấy danh sách quản lý", error });
    }
};

export { addManager, updateManager, deleteManager, getAllManagers };
