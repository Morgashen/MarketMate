const express = require("express");
const cartController = require("../controllers/cartController");
const { setUser } = require("../middlewares/authMiddleware");
const router = express.Router();

router.route("/add").post(setUser, cartController.addToCart);
router.route("/reset").delete(setUser, cartController.deleteCart);
router
  .route("/remove/:sku")
  .delete(setUser, cartController.removeFromCart);
router.route("/").get(setUser, cartController.getCart);

module.exports = router;
