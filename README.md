cách cài đặt/
1. Cài đặt thư viên
--- npm install
2. Chạy chương trìn
--- npm run server
3. backend-project/
├── config/                  # Các tệp cấu hình (ví dụ: cơ sở dữ liệu, lưu trữ đám mây)
│   ├── db.js                # Cấu hình kết nối cơ sở dữ liệu (ví dụ: MongoDB)
├── controllers/             # Các controller xử lý các yêu cầu
│   ├── productController.js # Xử lý logic liên quan đến sản phẩm
│   ├── userController.js    # Xử lý xác thực người dùng và quản lý người dùng
│   ├── cartController.js    # Xử lý logic giỏ hàng
│   .............
├── models/                  # Các mô hình MongoDB (Schema)
│   ├── product.js           # Schema và model cho sản phẩm
│   ├── user.js              # Schema và model cho người dùng
│   ├── cart.js              # Schema và model cho giỏ hàng
│   .............
├── routes/                  # Các định nghĩa route của Express
│   ├── productRoutes.js     # Routes liên quan đến sản phẩm
│   ├── userRoutes.js        # Routes xác thực người dùng
│   ├── cartRoutes.js        # Routes giỏ hàng
│   ..................
├── middleware/              # Middleware tùy chỉnh (ví dụ: xác thực)
├── utils/                   # Các hàm tiện ích
├── uploads/                 # Thư mục chứa các tệp tải lên
├── .env                     # Các biến môi trường (ví dụ: URL cơ sở dữ liệu, JWT secret)
├── server.js                # Điểm nhập chính của ứng dụng
├── package.json             # Metadata của dự án và các phụ thuộc
├── package-lock.json        # Các phiên bản chính xác của các phụ thuộc
└── README.md                # Tài liệu mô tả dự án
