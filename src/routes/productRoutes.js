const express = require("express");

const {
  createProduct,
  getProductBySKU,
  getProducts,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");
const { protect, admin, setUser } = require("../middleware/authMiddleware");
const upload = require("../utils/productUtils");
const router = express.Router();

router
  .route("/new")
  .post(setUser, protect, admin, upload.none(), createProduct);
router
  .route("/update/:sku")
  .put(setUser, protect, admin, upload.array("images", 5), updateProduct);
router.route("/delete/:sku").delete(setUser, protect, admin, deleteProduct);
router.route("/:sku").get(getProductBySKU);
router.route("/").get(getProducts);

module.exports = router;
