## Cài đặt & Chạy ứng dụng

```bash
npm install       # Cài đặt thư viện
npm run server    # Chạy chương trình

backend-project/
├── config/                  # Các tệp cấu hình (ví dụ: cơ sở dữ liệu, lưu trữ đám mây)
│   └── db.js                # Cấu hình kết nối cơ sở dữ liệu (MongoDB)
├── controllers/             # Các controller xử lý các yêu cầu
│   ├── productController.js # Xử lý logic sản phẩm
│   ├── userController.js    # Xử lý người dùng
│   └── cartController.js    # Xử lý giỏ hàng
├── models/                  # Các mô hình MongoDB
│   ├── product.js
│   ├── user.js
│   └── cart.js
├── routes/                  # Các định nghĩa route của Express
│   ├── productRoutes.js
│   ├── userRoutes.js
│   └── cartRoutes.js
├── middleware/              # Middleware tùy chỉnh
├── utils/                   # Các hàm tiện ích
├── uploads/                 # Thư mục chứa file upload
├── .env                     # Biến môi trường
├── server.js                # Điểm khởi chạy chính
├── package.json             # Thông tin dự án và phụ thuộc
├── package-lock.json        # Phiên bản chính xác của phụ thuộc
└── README.md                # Tài liệu dự án

