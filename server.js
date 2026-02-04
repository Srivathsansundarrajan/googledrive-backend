const mongoose = require("mongoose");
require("dotenv").config();
const app = require("./app");
const http = require("http");
const socket = require("./socket");

const server = http.createServer(app);
socket.init(server);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
    server.listen(process.env.PORT || 5000, () => {
      console.log(`Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

