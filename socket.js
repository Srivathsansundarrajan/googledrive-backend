const { Server } = require("socket.io");

let io;
const userSocketMap = new Map(); // userId -> socketId

module.exports = {
    init: (httpServer) => {
        io = new Server(httpServer, {
            cors: {
                origin: "http://localhost:5173",
                methods: ["GET", "POST", "PUT", "DELETE"],
                credentials: true
            }
        });

        io.on("connection", (socket) => {
            console.log("Client connected:", socket.id);

            socket.on("register", (userId) => {
                if (userId) {
                    userSocketMap.set(userId, socket.id);
                    console.log(`User ${userId} mapped to socket ${socket.id}`);
                }
            });

            socket.on("disconnect", () => {
                console.log("Client disconnected:", socket.id);
                // Remove user from map
                for (const [userId, socketId] of userSocketMap.entries()) {
                    if (socketId === socket.id) {
                        userSocketMap.delete(userId);
                        break;
                    }
                }
            });
        });

        return io;
    },
    getIO: () => {
        if (!io) {
            throw new Error("Socket.io not initialized!");
        }
        return io;
    },
    getUserSocketId: (userId) => {
        return userSocketMap.get(userId);
    }
};
