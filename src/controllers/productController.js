const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const Product = require("../models/productModel");
const upload = require("../utils/productUtils");
const asyncHandler = require("express-async-handler");

const writeFileAsync = promisify(fs.writeFile);
class ProductController {
  static getProducts = asyncHandler(async (_request, response) => {
    const products = await Product.find({});
    if (products) {
      return response.status(200).send({
        success: true,
        message: "Products retrieved successfully.",
        result: products,
      });
    } else {
      return response.status(200).send({
        success: true,
        message: "No Product found.",
        result: "",
      });
    }
  });

  static getProductBySKU = asyncHandler(async (request, response) => {
    const sku = request.params.sku;

    if (!sku)
      return response.status(400).send({
        success: false,
        message: "Product SKU is required",
        result: "",
      });
    const product = await Product.findOne({ sku });
    if (!product)
      return response.status(404).send({
        success: false,
        message: "Product does not exist",
        result: "",
      });

    return response.status(200).send({
      success: true,
      message: "Product retrieved successfully",
      result: product,
    });
  });

  static createProduct = [
    upload.none(),
    asyncHandler(async (request, response) => {
      const {
        name,
        description,
        price,
        sku,
        numberOfProductsAvailable,
        images,
      } = request.body;

      const missingFields = [];
      if (!name) missingFields.push("name");
      if (!description) missingFields.push("description");
      if (!price) missingFields.push("price");
      if (!sku) missingFields.push("sku");
      if (!numberOfProductsAvailable)
        missingFields.push("numberOfProductsAvailable");
      console.log(request.body);
      if (missingFields.length > 0) {
        return response.status(400).send({
          success: false,
          message: `The following required fields are missing: ${missingFields.join(
            ", "
          )}`,
          result: "",
        });
      }

      const product = await Product.findOne({ sku });
      if (product) {
        return response.status(404).send({
          success: false,
          message: `Product with SKU ${sku} already exists.`,
          result: "",
        });
      }

      try {
        const imagePaths = [];
        if (images && Array.isArray(images)) {
          for (const [index, base64Image] of images.entries()) {
            const matches = base64Image.match(
              /^data:([A-Za-z-+/]+);base64,(.+)$/
            );
            if (!matches || matches.length !== 3) {
              continue;
            }
            const imageBuffer = Buffer.from(matches[2], "base64");
            const imageName = `image_${Date.now()}_${index}.png`; // Generate unique image name
            const imagePath = path.join("uploads", imageName); // Relative path
            await writeFileAsync(imagePath, imageBuffer);
            imagePaths.push(imagePath);
          }
        }

        const newProduct = new Product({
          name,
          description,
          price,
          sku,
          numberOfProductsAvailable,
          images: imagePaths,
        });
        const createProduct = await newProduct.save();
        return response.status(201).send({
          success: true,
          message: "Product created successfully.",
          result: createProduct,
        });
      } catch (error) {
        console.log("Internal Server Error: ", error);
        return response.status(500).send({
          success: false,
          message: "An error occurred",
          result: "",
        });
      }
    }),
  ];

  static updateProduct = [
    upload.array("images", 5),
    asyncHandler(async (request, response) => {
      const sku = request.params.sku;
      const { name, description, price, numberOfProductsAvailable } =
        request.body;

      if (!sku) {
        return response.status(400).send({
          success: false,
          message: "Product SKU is required",
          result: "",
        });
      }

      try {
        const product = await Product.findOne({ sku });

        if (!product) {
          return response.status(404).send({
            success: false,
            message: "Product not found",
            result: "",
          });
        }

        product.name = name || product.name;
        product.description = description || product.description;
        product.price = price || product.price;
        product.numberOfProductsAvailable =
          numberOfProductsAvailable || product.numberOfProductsAvailable;

        if (request.files.length > 0) {
          product.images = request.files.map((file) => file.path);
        }

        const updatedProduct = await product.save();

        return response.status(200).send({
          success: true,
          message: "Product updated successfully",
          result: updatedProduct,
        });
      } catch (error) {
        console.error(error);
        return response.status(500).send({
          success: false,
          message: "Internal Server Error",
          result: "",
        });
      }
    }),
  ];

  static deleteProduct = asyncHandler(async (request, response) => {
    const sku = request.params.sku;

    if (!sku) {
      return response.status(400).send({
        success: false,
        message: "Product SKU is required",
        result: "",
      });
    }

    try {
      const product = await Product.findOne({ sku });

      if (!product) {
        return response.status(404).send({
          success: false,
          message: "Product not found",
          result: "",
        });
      }

      await product.deleteOne();

      return response.status(200).send({
        success: true,
        message: "Product deleted successfully",
        result: "",
      });
    } catch (error) {
      console.error(error);
      return response.status(500).send({
        success: false,
        message: "Internal Server Error",
        result: "",
      });
    }
  });
}

module.exports = ProductController;
