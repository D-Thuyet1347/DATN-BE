import mongoose from "mongoose";

const managerSchema = new mongoose.Schema({
    BranchID: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    UserID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    Role: { type: String, default: 'Manager' },
    Position: { type: String, required: true },
}, { timestamps: true });

const ManagerModel = mongoose.models.Manager || mongoose.model("Manager", managerSchema);

export default ManagerModel;
