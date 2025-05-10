import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    applicableFor: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});

const CategoryModel = mongoose.models.Category || mongoose.model("Category", categorySchema);

export default CategoryModel;