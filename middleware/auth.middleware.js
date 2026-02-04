const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    // Expect header: Authorization: Bearer <token>
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.query.token) {
      // Allow token in query param (for downloads)
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ message: "Authorization header missing" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user info to request
    req.user = decoded;

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
