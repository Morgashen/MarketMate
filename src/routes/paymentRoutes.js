const express = require("express");
const paymentController = require("../controllers/paymentController");
const { setUser } = require("../middlewares/authMiddleware");
const router = express.Router();


router.route("/pay").post(setUser, paymentController.pay);

module.exports = router;
