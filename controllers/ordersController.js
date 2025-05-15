import orderModel from "../models/ordersModel.js";
import userModel from "../models/userModel.js";
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const placeOrder = async (req, res) => {
  const frontend_url = process.env.CLIENT_URL || "http://localhost:3000"; // Lấy từ .env hoặc mặc định
  const userId = req.user?._id; // Lấy userId từ middleware auth

  if (!userId) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized. Please log in." });
  }

  try {
    const {
      items,
      shippingAddress,
      paymentMethod,
      note,
      discount = 0, // Lấy discount từ request
    } = req.body;

    if (!items || items.length === 0 || !shippingAddress || !paymentMethod) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required order data." });
    }

    // --- Tính toán tổng tiền (giống code cũ của bạn) ---
    const formattedItems = items.map((item) => ({
      productId: item._id, // Đảm bảo _id được truyền từ frontend
      name: item.name,
      price:
        parseFloat(String(item.price).replace(/\./g, "").replace(",", ".")) ||
        0, // Chuyển giá thành số
      quantity: Number(item.quantity),
      image: item.image,
    }));

    const totalProductAmount = formattedItems.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );

    const shippingFee = 30000; // Phí ship cố định
    const totalAmountBeforeDiscount = totalProductAmount + shippingFee;
    const finalTotalAmount =
      totalAmountBeforeDiscount - (discount > 0 ? discount : 0);

    const newOrder = new orderModel({
      userId,
      items: formattedItems,
      totalAmount: finalTotalAmount, // Lưu tổng tiền cuối cùng
      orderDate: new Date(),
      shippingAddress,
      paymentMethod,
      paymentStatus:
        paymentMethod === "card"
          ? "Thanh toán bằng ngân hàng"
          : "Thanh toán khi nhận hàng",
      note,
      discount: discount > 0 ? discount : 0,
      orderStatus: "Đã thanh toán",
    });
    const savedOrder = await newOrder.save();
    const user = await userModel.findById(userId);
    if (user && user.cartData) {
      const newCartData = { ...user.cartData };
      for (const item of items) {
        delete newCartData[item._id];
      }
      await userModel.findByIdAndUpdate(userId, { cartData: newCartData });
    }
    if (paymentMethod === "cod") {
      savedOrder.paymentStatus = "Thanh toán khi nhận hàng";
      savedOrder.orderStatus = "Đang xử lý";
      await savedOrder.save();
      console.log(`Order ${savedOrder._id} placed with COD.`);
      return res.json({
        success: true,
        message: "Đặt hàng COD thành công",
        orderId: savedOrder._id,
      });
    } else if (paymentMethod === "card") {
      // Stripe
      const itemsWithPrice = items.map((item) => ({
        price_data: {
          currency: "VND",
          product_data: { name: item.name },
          unit_amount: Math.round(
            parseFloat(
              String(item.price).replace(/\./g, "").replace(",", ".")
            ) || 0
          ), // Stripe cần số nguyên
        },
        quantity: Number(item.quantity),
      }));

      const line_items = [
        ...itemsWithPrice,
        {
          price_data: {
            currency: "VND",
            product_data: { name: "Phí vận chuyển" },
            unit_amount: shippingFee, // Phí ship cho Stripe
          },
          quantity: 1,
        },
      ];

      let discounts = [];
      if (discount > 0) {
        try {
          const stripeDiscount = Math.round(discount);
          if (stripeDiscount > 0) {
            const coupon = await stripe.coupons.create({
              name: "Mã giảm giá đơn hàng",
              currency: "VND",
              amount_off: stripeDiscount,
              duration: "once", // Chỉ áp dụng 1 lần
            });
            discounts = [{ coupon: coupon.id }];
          } else {
            console.warn(
              `Discount amount ${discount} is too small for Stripe, skipping coupon.`
            );
          }
        } catch (couponError) {
          console.error("Error creating Stripe coupon:", couponError);
          // Có thể bỏ qua lỗi coupon và tiếp tục thanh toán không giảm giá
        }
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items,
        mode: "payment",
        discounts,
        success_url: `${frontend_url}/verify/success`, // Truyền orderId về
        cancel_url: `${frontend_url}/verify?success=false&orderId=${savedOrder._id}`, // Truyền orderId về
        metadata: {
          orderId: savedOrder._id.toString(),
        },
      });

      console.log(
        `Stripe session created for Order ${savedOrder._id}. URL: ${session.url}`
      );
      res.json({
        success: true,
        session_url: session.url,
      });
    } else if (paymentMethod === "vnpay") {
      await savedOrder.save();
      console.log(`Order ${savedOrder._id} awaiting VNPAY payment initiation.`);
      res.json({
        success: true,
        message: "Order created, proceed to VNPAY payment.",
        orderId: savedOrder._id,
        totalAmount: savedOrder.totalAmount,
        orderDescription: `Thanh toan don hang ${savedOrder._id}`,
      });
    } else {
      await orderModel.findByIdAndDelete(savedOrder._id);
      res
        .status(400)
        .json({
          success: false,
          message: "Phương thức thanh toán không hợp lệ.",
        });
    }
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi đặt hàng: " + error.message,
    });
  }
};

const verifyOrder = async (req, res) => {
  const { orderId, success } = req.body; // Hoặc lấy từ query params tùy vào cách bạn thiết kế URL trả về
  console.log(`Verifying order: ${orderId}, Success: ${success}`);
  try {
    if (!orderId) {
      return res
        .status(400)
        .json({ success: false, message: "Order ID is required" });
    }

    const order = await orderModel.findById(orderId);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (
      order.paymentMethod === "card" &&
      order.paymentStatus === "Đã thanh toán"
    ) {
      if (success === "true" || success === true) {
        // Kiểm tra cả string và boolean
        await orderModel.findByIdAndUpdate(orderId, {
          paymentStatus: "Đã thanh toán qua Vnpay",
          orderStatus: "Đã thanh toán",
        });
        console.log(`Stripe Order ${orderId} verified as Paid.`);
        return res.json({
          success: true,
          message: "Payment successful (Stripe)",
        });
      } else {
        await orderModel.findByIdAndUpdate(orderId, {
          paymentStatus: "Failed",
        });
        console.log(`Stripe Order ${orderId} verified as Failed.`);
        return res.json({ success: false, message: "Payment failed (Stripe)" });
      }
    } else {
      console.log(
        `Order ${orderId} verification skipped (Method: ${order.paymentMethod}, Status: ${order.paymentStatus})`
      );
      return res.json({
        success: order.paymentStatus === "Paid",
        message: `Order status already ${order.paymentStatus}`,
      });
    }
  } catch (error) {
    console.error("Error in verifyOrder:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Server error during verification",
        error: error.message,
      });
  }
};

const userOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "User ID is missing from req.user" });
    }

    console.log("Fetching orders for userId:", userId.toString());
    const orders = await orderModel.find({ userId });
    console.log("Orders found:", orders);

    // Định dạng lại dữ liệu cho frontend
    const formattedOrders = orders.map((order) => ({
      orderId: order._id.toString(),
      orderDate: new Date(order.orderDate).toLocaleDateString("vi-VN"),
      products: order.items,
      total: order.totalAmount,
      status: order.orderStatus.toLowerCase(),
    }));
    res.json({ success: true, data: formattedOrders });
  } catch (error) {
    console.error("Error in userOrders:", error);
    res.json({
      success: false,
      message: "Error fetching orders",
      error: error.message,
    });
  }
};
const listOrders = async (req, res) => {
  try {
    const orders = await orderModel.find({});
    console.log("All orders:", orders);
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error("Error in listOrders:", error);
    res.json({
      success: false,
      message: "Error fetching orders",
      error: error.message,
    });
  }
};
const updateStatus = async (req, res) => {
  try {
    const { orderId, orderStatus } = req.body;

    if (!orderId || !orderStatus) {
      return res.status(400).json({
        success: false,
        message: "Order ID and status are required",
      });
    }

    const updatedOrder = await orderModel.findByIdAndUpdate(
      orderId,
      { orderStatus }, // Only update orderStatus
      { new: true, runValidators: true } // Return updated doc and run schema validations
    );

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    console.log("Successfully updated order status:", updatedOrder);
    res.json({
      success: true,
      message: "Order status updated successfully",
      data: updatedOrder,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: error.message,
    });
  }
};
const deleteOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res
        .status(400)
        .json({ success: false, message: "Order ID is required" });
    }

    const deletedOrder = await orderModel.findByIdAndDelete(orderId);

    if (!deletedOrder) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    res.json({ success: true, message: "Order deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
export {
  placeOrder,
  verifyOrder,
  userOrders,
  listOrders,
  updateStatus,
  deleteOrder,
};
