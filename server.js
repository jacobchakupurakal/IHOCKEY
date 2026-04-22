const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// REQUIRED for Render
const PORT = process.env.PORT || 3000;

// Health check route (VERY IMPORTANT)
app.get("/healthz", (req, res) => {
    res.send("OK");
});

// Optional root route
const path = require("path");

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

const io = new Server(server, {
    cors: { origin: "*" }
});

let players = {};
let gameState = "lobby";

io.on("connection", (socket) => {
    console.log("→ Player connected:", socket.id);
    
    if (Object.keys(players).length >= 2) {
        socket.emit("full");
        socket.disconnect();
        return;
    }
    
    const role = Object.keys(players).length === 0 ? "p1" : "p2";
    players[socket.id] = {
        id: socket.id,
        role: role,
        ready: false,
        color: role === "p1" ? "#00f2ff" : "#ff0055",
        ability: "engine"
    };
    
    socket.emit("playerAssign", role);
    broadcastLobby();
    
    socket.on("setColor", (color) => {
        if (players[socket.id]) players[socket.id].color = color;
        broadcastLobby();
    });
    
    socket.on("setAbility", (ability) => {
        if (players[socket.id] && ABILITIES[ability]) players[socket.id].ability = ability;
        broadcastLobby();
    });
    
    socket.on("setReady", (ready) => {
        if (players[socket.id]) players[socket.id].ready = ready;
        broadcastLobby();
        
        const all = Object.values(players);
        if (all.length === 2 && all.every(p => p.ready)) {
            gameState = "playing";
            io.emit("gameStart", { 
                p1: all.find(p => p.role === "p1"), 
                p2: all.find(p => p.role === "p2") 
            });
        }
    });
    
    socket.on("updateState", (data) => {
        if (gameState !== "playing") return;
        socket.broadcast.emit("opponentUpdate", data);
    });
    
    socket.on("requestRematch", () => {
        gameState = "lobby";
        Object.values(players).forEach(p => p.ready = false);
        io.emit("backToLobby");
    });
    
    socket.on("disconnect", () => {
        delete players[socket.id];
        if (Object.keys(players).length === 0) gameState = "lobby";
        broadcastLobby();
    });
});

const ABILITIES = { engine:1, magnet:1, heavy:1 };

function broadcastLobby() {
    const data = Object.values(players).map(p => ({
        role: p.role,
        ready: p.ready,
        color: p.color,
        ability: p.ability
    }));
    io.emit("lobbyUpdate", data);
}

// START SERVER (IMPORTANT CHANGE)
server.listen(PORT, () => {
    console.log("🚀 Server running on port " + PORT);
});