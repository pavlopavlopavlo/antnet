/**
 * Main server entry point for AntNet
 * Handles HTTP server setup and Socket.IO initialization
 */
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const GameManager = require('./game');

// Create Express app, HTTP server, and Socket.IO server
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  // In server/index.js
const io = socketIO(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});
});

// Add to your server/index.js file
const path = require('path');

// After setting up your Express app, add:
if (process.env.NODE_ENV === 'production') {
  // Serve static files from the React app
  app.use(express.static(path.join(__dirname, '../dist')));
  
  // The "catchall" handler: for any request that doesn't
  // match one above, send back React's index.html file.
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// Serve static files from dist directory in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// Game rooms storage
const games = new Map();

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);
  
  // Handle player joining a game
  socket.on('join_game', ({ gameId, playerName }, callback) => {
    try {
      let game;
      
      // Create new game if gameId not provided
      if (!gameId) {
        const newGameId = uuidv4().substring(0, 8);
        game = new GameManager(newGameId);
        games.set(newGameId, game);
        gameId = newGameId;
        console.log(`Created new game: ${gameId}`);
      } else {
        // Get existing game
        game = games.get(gameId);
        if (!game) {
          return callback({ 
            success: false, 
            error: 'Game not found' 
          });
        }
      }
      
      // Add player to game
      const playerId = socket.id;
      const player = game.addPlayer(playerId, playerName);
      
      // Join socket room for this game
      socket.join(gameId);
      
      // Store game info in socket for disconnect handling
      socket.gameData = {
        gameId,
        playerId
      };
      
      // Send success response
      callback({ 
        success: true, 
        gameId, 
        playerId, 
        game: game.getGameState() 
      });
      
      // Notify other players
      socket.to(gameId).emit('player_joined', { 
        playerId, 
        playerName,
        players: game.getPlayers()
      });
      
    } catch (error) {
      console.error('Error joining game:', error);
      callback({ success: false, error: error.message });
    }
  });
  
  // Handle player action: place pheromone
  socket.on('place_pheromone', ({ fromNodeId, toNodeId, type, amount }) => {
    const { gameId, playerId } = socket.gameData || {};
    if (!gameId || !playerId) return;
    
    const game = games.get(gameId);
    if (!game) return;
    
    game.placePheromone(playerId, fromNodeId, toNodeId, type, amount);
    
    // Broadcast updated state to all players in the game
    io.to(gameId).emit('game_updated', { 
      action: 'pheromone_placed',
      playerId,
      pheromoneData: {
        fromNodeId,
        toNodeId,
        type,
        amount
      },
      gameState: game.getGameState()
    });
  });
  
  // Handle player action: node boost
  socket.on('boost_node', ({ nodeId }) => {
    const { gameId, playerId } = socket.gameData || {};
    if (!gameId || !playerId) return;
    
    const game = games.get(gameId);
    if (!game) return;
    
    const success = game.boostNode(playerId, nodeId);
    
    if (success) {
      io.to(gameId).emit('game_updated', {
        action: 'node_boosted',
        playerId,
        nodeId,
        gameState: game.getGameState()
      });
    }
  });
  
  // Handle player action: node disrupt
  socket.on('disrupt_node', ({ nodeId }) => {
    const { gameId, playerId } = socket.gameData || {};
    if (!gameId || !playerId) return;
    
    const game = games.get(gameId);
    if (!game) return;
    
    const success = game.disruptNode(playerId, nodeId);
    
    if (success) {
      io.to(gameId).emit('game_updated', {
        action: 'node_disrupted',
        playerId,
        nodeId,
        gameState: game.getGameState()
      });
    }
  });
  
  // Handle player action: node expand
  socket.on('expand_node', ({ nodeId }) => {
    const { gameId, playerId } = socket.gameData || {};
    if (!gameId || !playerId) return;
    
    const game = games.get(gameId);
    if (!game) return;
    
    const success = game.expandNode(playerId, nodeId);
    
    if (success) {
      io.to(gameId).emit('game_updated', {
        action: 'node_expanded',
        playerId,
        nodeId,
        gameState: game.getGameState()
      });
    }
  });
  
  // Handle player disconnection
  socket.on('disconnect', () => {
    const { gameId, playerId } = socket.gameData || {};
    if (!gameId || !playerId) return;
    
    const game = games.get(gameId);
    if (!game) return;
    
    game.removePlayer(playerId);
    
    // Notify other players
    io.to(gameId).emit('player_left', {
      playerId,
      players: game.getPlayers()
    });
    
    // Delete game if no players left
    if (game.getPlayers().length === 0) {
      games.delete(gameId);
      console.log(`Game deleted: ${gameId}`);
    }
  });
});

// Start HTTP server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Server shutting down');
  server.close(() => {
    process.exit(0);
  });
});

// At the top of your file, with other requires

// Inside your server setup code
// Serve static files from dist directory in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// Update your port configuration
const PORT = process.env.PORT || 5000;
