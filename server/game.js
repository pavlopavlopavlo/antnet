/**
 * Server-side game manager for AntNet
 * Handles game state, player actions, and simulation
 */
const Graph = require('./graph');
const { v4: uuidv4 } = require('uuid');

class GameManager {
  /**
   * Create a new game
   * @param {string} id - Game ID
   */
  constructor(id) {
    this.id = id;
    this.players = new Map();
    this.graph = new Graph();
    this.antColony = null;
    this.objective = 'FOOD_COLLECTION';
    this.lastUpdateTime = Date.now();
    this.gameState = {
      nodes: {},
      pheromones: [],
      resources: {},
      objective: this.objective
    };
    
    // Initialize game environment
    this.initializeEnvironment();
    
    // Start game loop
    this.startGameLoop();
  }
  
  /**
   * Initialize the game environment (graph, nodes, etc.)
   */
  initializeEnvironment() {
    // Create basic graph structure
    this.createDefaultGraph();
    
    // Initialize game state
    this.updateGameState();
  }
  
  /**
   * Create a default graph for testing and initial gameplay
   */
  createDefaultGraph() {
    // Create nest node (center)
    const nestId = this.graph.addNode({
      type: 'NEST',
      position: { x: 0, y: 0, z: 0 },
      size: 2,
      capacity: 20,
      resources: 0
    });
    
    // Create a grid of nodes around the nest
    const gridSize = 5;
    const spacing = 10;
    
    const nodeIds = [];
    
    // Create nodes in a grid
    for (let x = -gridSize; x <= gridSize; x++) {
      for (let z = -gridSize; z <= gridSize; z++) {
        // Skip center (already have nest)
        if (x === 0 && z === 0) continue;
        
        const distance = Math.sqrt(x*x + z*z);
        
        // Determine node type based on position
        let nodeType = 'NORMAL';
        let resources = 0;
        
        // Corners are food sources
        if (Math.abs(x) >= gridSize-1 && Math.abs(z) >= gridSize-1) {
          nodeType = 'FOOD_SOURCE';
          resources = 100;
        }
        
        // Create node
        const nodeId = this.graph.addNode({
          type: nodeType,
          position: { 
            x: x * spacing, 
            y: Math.sin(distance) * 2, // Add some height variation
            z: z * spacing 
          },
          size: 1,
          capacity: 10,
          resources
        });
        
        nodeIds.push(nodeId);
        
        // Connect to adjacent nodes
        if (x > -gridSize) {
          const leftNodeId = this.graph.getNodeIdByPosition({
            x: (x-1) * spacing,
            z: z * spacing
          });
          if (leftNodeId) {
            this.graph.addEdge(nodeId, leftNodeId);
          }
        }
        
        if (z > -gridSize) {
          const topNodeId = this.graph.getNodeIdByPosition({
            x: x * spacing,
            z: (z-1) * spacing
          });
          if (topNodeId) {
            this.graph.addEdge(nodeId, topNodeId);
          }
        }
        
        // Connect to nest if adjacent
        if (Math.abs(x) <= 1 && Math.abs(z) <= 1) {
          this.graph.addEdge(nodeId, nestId);
        }
      }
    }
    
    // Add some random connections for more interesting pathfinding
    const randomConnectionCount = Math.floor(nodeIds.length * 0.2);
    for (let i = 0; i < randomConnectionCount; i++) {
      const node1 = nodeIds[Math.floor(Math.random() * nodeIds.length)];
      const node2 = nodeIds[Math.floor(Math.random() * nodeIds.length)];
      
      if (node1 !== node2) {
        this.graph.addEdge(node1, node2);
      }
    }
    
    // Calculate distances from all nodes to nest
    this.graph.calculateDistances(nestId);
  }
  
  /**
   * Start the game update loop
   */
  startGameLoop() {
    const updateInterval = 100; // 10 updates per second
    
    this.gameLoopInterval = setInterval(() => {
      this.update();
    }, updateInterval);
  }
  
  /**
   * Stop the game update loop
   */
  stopGameLoop() {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
  }
  
  /**
   * Add a player to the game
   * @param {string} id - Player ID (socket ID)
   * @param {string} name - Player name
   * @returns {Object} Player object
   */
  addPlayer(id, name) {
    const player = {
      id,
      name: name || `Player ${this.players.size + 1}`,
      resources: {
        energy: 100
      },
      color: this.getRandomPlayerColor(),
      score: 0
    };
    
    this.players.set(id, player);
    return player;
  }
  
  /**
   * Remove a player from the game
   * @param {string} id - Player ID
   */
  removePlayer(id) {
    this.players.delete(id);
  }
  
  /**
   * Get a list of all players
   * @returns {Array} Array of player objects
   */
  getPlayers() {
    return Array.from(this.players.values());
  }
  
  /**
   * Generate a random color for a player
   * @returns {Object} RGB color object
   */
  getRandomPlayerColor() {
    // Generate distinct colors for players
    const colors = [
      { r: 1.0, g: 0.2, b: 0.2 }, // Red
      { r: 0.2, g: 0.6, b: 1.0 }, // Blue
      { r: 0.2, g: 0.8, b: 0.2 }, // Green
      { r: 1.0, g: 0.6, b: 0.0 }, // Orange
      { r: 0.8, g: 0.2, b: 0.8 }, // Purple
      { r: 0.0, g: 0.8, b: 0.8 }, // Teal
      { r: 1.0, g: 0.8, b: 0.2 }, // Yellow
      { r: 0.8, g: 0.4, b: 0.6 }  // Pink
    ];
    
    const usedColors = new Set();
    this.players.forEach(player => {
      const colorStr = `${player.color.r},${player.color.g},${player.color.b}`;
      usedColors.add(colorStr);
    });
    
    // Find an unused color
    for (const color of colors) {
      const colorStr = `${color.r},${color.g},${color.b}`;
      if (!usedColors.has(colorStr)) {
        return color;
      }
    }
    
    // If all predefined colors are used, generate a random one
    return {
      r: Math.random() * 0.8 + 0.2,
      g: Math.random() * 0.8 + 0.2,
      b: Math.random() * 0.8 + 0.2
    };
  }
  
  /**
   * Update the game state
   */
  update() {
    const currentTime = Date.now();
    const deltaTime = (currentTime - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = currentTime;
    
    // Update pheromones (decay)
    this.updatePheromones(deltaTime);
    
    // Update node states
    this.updateNodes(deltaTime);
    
    // Update player resources
    this.updatePlayers(deltaTime);
    
    // Update game state object
    this.updateGameState();
  }
  
  /**
   * Update pheromone levels (decay over time)
   * @param {number} deltaTime - Time since last update
   */
  updatePheromones(deltaTime) {
    // Simple pheromone decay
    for (const [key, data] of this.graph.pheromones.entries()) {
      // Decay pheromone levels
      data.level *= (1 - 0.1 * deltaTime);
      
      // Remove pheromone if level is negligible
      if (data.level < 0.01) {
        this.graph.pheromones.delete(key);
      }
    }
  }
  
  /**
   * Update node states
   * @param {number} deltaTime - Time since last update
   */
  updateNodes(deltaTime) {
    for (const nodeId in this.graph.nodes) {
      const node = this.graph.nodes[nodeId];
      
      // Update boost timer
      if (node.boosted) {
        node.boostTimer -= deltaTime;
        if (node.boostTimer <= 0) {
          node.boosted = false;
          node.boostTimer = 0;
        }
      }
      
      // Update disrupt timer
      if (node.disrupted) {
        node.disruptTimer -= deltaTime;
        if (node.disruptTimer <= 0) {
          node.disrupted = false;
          node.disruptTimer = 0;
        }
      }
      
      // Resource regeneration for food sources
      if (node.type === 'FOOD_SOURCE' && node.resources < node.capacity) {
        node.resourceTimer = (node.resourceTimer || 0) + deltaTime;
        if (node.resourceTimer >= 5) { // 5 seconds per resource
          node.resourceTimer = 0;
          node.resources = Math.min(node.resources + 1, node.capacity);
        }
      }
    }
  }
  
  /**
   * Update player resources and states
   * @param {number} deltaTime - Time since last update
   */
  updatePlayers(deltaTime) {
    this.players.forEach(player => {
      // Energy regeneration (slow)
      player.resources.energy = Math.min(
        player.resources.energy + 2 * deltaTime,
        100
      );
    });
  }
  
  /**
   * Update the game state object for clients
   */
  updateGameState() {
    // Update nodes
    const nodes = {};
    for (const nodeId in this.graph.nodes) {
      nodes[nodeId] = {
        ...this.graph.nodes[nodeId],
        neighbors: this.graph.getNeighbors(nodeId)
      };
    }
    
    // Update pheromones
    const pheromones = [];
    for (const [key, data] of this.graph.pheromones.entries()) {
      const [fromId, toId, type] = key.split(',');
      
      if (data.level > 0.01) {
        pheromones.push({
          fromId,
          toId,
          type,
          level: data.level,
          playerId: data.playerId
        });
      }
    }
    
    // Update game state
    this.gameState = {
      nodes,
      pheromones,
      players: this.getPlayers(),
      objective: this.objective
    };
  }
  
  /**
   * Get the current game state
   * @returns {Object} Game state object
   */
  getGameState() {
    return this.gameState;
  }
  
  /**
   * Place pheromone on an edge
   * @param {string} playerId - Player ID
   * @param {string} fromNodeId - Source node ID
   * @param {string} toNodeId - Destination node ID
   * @param {string} type - Pheromone type
   * @param {number} amount - Amount of pheromone to place
   * @returns {boolean} Success
   */
  placePheromone(playerId, fromNodeId, toNodeId, type, amount) {
    const player = this.players.get(playerId);
    if (!player) return false;
    
    // Check if nodes exist and are connected
    if (!this.graph.hasEdge(fromNodeId, toNodeId)) {
      return false;
    }
    
    // Check if player has enough energy
    const energyCost = amount * 5;
    if (player.resources.energy < energyCost) {
      return false;
    }
    
    // Deduct energy
    player.resources.energy -= energyCost;
    
    // Add pheromone
    const key = `${fromNodeId},${toNodeId},${type}`;
    const reverseKey = `${toNodeId},${fromNodeId},${type}`;
    
    // Get current pheromone level
    const current = this.graph.pheromones.get(key) || { level: 0 };
    const reverseCurrent = this.graph.pheromones.get(reverseKey) || { level: 0 };
    
    // Update pheromone level
    current.level = Math.min(current.level + amount, 5.0);
    current.playerId = playerId;
    
    reverseCurrent.level = Math.min(reverseCurrent.level + amount * 0.5, 5.0);
    reverseCurrent.playerId = playerId;
    
    // Store updated values
    this.graph.pheromones.set(key, current);
    this.graph.pheromones.set(reverseKey, reverseCurrent);
    
    return true;
  }
  
  /**
   * Boost a node to increase its effectiveness
   * @param {string} playerId - Player ID
   * @param {string} nodeId - Node ID
   * @returns {boolean} Success
   */
  boostNode(playerId, nodeId) {
    const player = this.players.get(playerId);
    if (!player) return false;
    
    const node = this.graph.nodes[nodeId];
    if (!node) return false;
    
    // Check if node is already boosted
    if (node.boosted) return false;
    
    // Check if player has enough energy
    const energyCost = 30;
    if (player.resources.energy < energyCost) {
      return false;
    }
    
    // Deduct energy
    player.resources.energy -= energyCost;
    
    // Boost node
    node.boosted = true;
    node.boostTimer = 30; // 30 seconds boost
    node.boostPlayerId = playerId;
    
    return true;
  }
  
  /**
   * Disrupt a node to temporarily block it
   * @param {string} playerId - Player ID
   * @param {string} nodeId - Node ID
   * @returns {boolean} Success
   */
  disruptNode(playerId, nodeId) {
    const player = this.players.get(playerId);
    if (!player) return false;
    
    const node = this.graph.nodes[nodeId];
    if (!node) return false;
    
    // Can't disrupt nest nodes
    if (node.type === 'NEST') return false;
    
    // Check if node is already disrupted
    if (node.disrupted) return false;
    
    // Check if player has enough energy
    const energyCost = 40;
    if (player.resources.energy < energyCost) {
      return false;
    }
    
    // Deduct energy
    player.resources.energy -= energyCost;
    
    // Disrupt node
    node.disrupted = true;
    node.disruptTimer = 20; // 20 seconds disruption
    node.disruptPlayerId = playerId;
    
    return true;
  }
  
  /**
   * Expand a node to increase its capacity
   * @param {string} playerId - Player ID
   * @param {string} nodeId - Node ID
   * @returns {boolean} Success
   */
  expandNode(playerId, nodeId) {
    const player = this.players.get(playerId);
    if (!player) return false;
    
    const node = this.graph.nodes[nodeId];
    if (!node) return false;
    
    // Check if node is at max capacity
    if (node.size >= 3) return false;
    
    // Check if player has enough energy
    const energyCost = 50;
    if (player.resources.energy < energyCost) {
      return false;
    }
    
    // Deduct energy
    player.resources.energy -= energyCost;
    
    // Expand node
    node.size += 1;
    node.capacity *= 1.5;
    
    return true;
  }
}

module.exports = GameManager;
