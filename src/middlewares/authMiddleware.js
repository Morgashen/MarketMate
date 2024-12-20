const asyncHandler = require("express-async-handler");
const { v4: uuidv4 } = require("uuid");
const redisClient = require("../utils/redisClient");


/**
 * Sets request.user for current user
 *
 */
const setUser = asyncHandler(async (request, response, next) => {
  const token = request.cookies["Z-Token"];

  if (token) {
    const userDetails = await redisClient.getValue(token);
    if (!userDetails) {
      console.log("Invalid token, user details not found.");
    } else {
      request.user = JSON.parse(userDetails);
      console.log("Middleware", request.user);
    }
  }
  next();
});

/**
 * Defines Auth Middleware
 * - Ensures that only authenticated users are allowed
 */
const protect = (request, response, next) => {
  if (!request.user) {
    return response.status(401).json({
      success: false,
      message: "Unauthorized. You are not logged in ",
      result: "",
    });
  }
  next();
};


/**
 * Defines Admin Middleware
 * - Ensures that only Admin users are allowed.
 */
const admin = (request, response, next) => {
  console.log("Admin middleware", request.user)
  if (request.user && request.user.isAdmin) {
    next();
  } else {
    response.status(403);
    response.json({
      success: false,
      message: "Access Forbidden. You are not an Admin",
      result: "",
    });
  }
};

// /**
//  * Handles Session id for unauthenticated users;
//  * @param {} request
//  * @param {*} response
//  * @param {*} next
//  */
// const checkSessionId = (request, response, next) => {
//     if (request.path.startsWith('/api/auth')) {
//         return next();
//       }
//   if (!request.user) {
//     if (!request.cookies["session-id"]) {
//       const sessionId = uuidv4();
//       response.cookie("session-id", sessionId, {
//         httpOnly: true,
//         maxAge: 24 * 3600 * 1000, // 1day
//       });
//       request.sessionId = sessionId;
//     } else {
//       request.sessionId = request.cookies["session-id"];
//     }
//   }
//   next();
// };

module.exports = { setUser, protect, admin };
