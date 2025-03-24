// client/src/game/Game.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import io from 'socket.io-client';
import AntColony from './AntColony';
import Renderer from '../rendering/Renderer';
import NodeRenderer from '../rendering/NodeRenderer';
import AntRenderer from '../rendering/AntRenderer';
import PheromoneSystem from '../rendering/PheromoneSystem';
import UI from '../ui/UI';

class Game {
  constructor() {
    this.initialized = false;
    this.socket = null;
    this.gameId = null;
    this.playerId = null;
    
    // Game state
    this.lastUpdateTime = 0;
    this.running = false;
    
    // Initialize the game
    this.init();
  }
  
  async init() {
    if (this.initialized) return;
    
    // Get container element
    this.container = document.getElementById('game-container');
    
    // Remove loading message if exists
    const loadingEl = this.container.querySelector('.loading');
    if (loadingEl) {
      this.container.removeChild(loadingEl);
    }
    
    // Set up renderer
    this.renderer = new Renderer(this.container);
    this.scene = this.renderer.scene;
    this.camera = this.renderer.camera;
    
    // Set up renderers for game elements
    this.nodeRenderer = new NodeRenderer(this.scene);
    this.antRenderer = new AntRenderer(this.scene);
    this.pheromoneSystem = new PheromoneSystem(this.scene);
    
    // Set up UI
    this.ui = new UI(this);
    
    // Connect to server
    await this.connectToServer();
    
    // Start game loop
    this.start();
    
    this.initialized = true;
    console.log('Game initialized');
  }
  
  async connectToServer() {
    return new Promise((resolve) => {
      // Connect to Socket.IO server
      this.socket = io();
      
      // Handle connection events
      this.socket.on('connect', () => {
        console.log('Connected to server');
        
        // Join or create a game
        this.socket.emit('join_game', {
// client/src/game/Game.js (continued)
        this.socket.emit('join_game', { playerName: 'Player' }, (response) => {
          if (response.success) {
            this.gameId = response.gameId;
            this.playerId = response.playerId;
            
            // Update UI
            this.ui.updateGameInfo(response.game);
            
            // Initialize game with received data
            this.initializeGameState(response.game);
            
            resolve();
          } else {
            console.error('Failed to join game:', response.error);
            this.ui.showMessage('Failed to connect to game server');
          }
        });
      });
      
      // Handle game updates
      this.socket.on('game_updated', (data) => {
        this.updateGameState(data.gameState);
      });
      
      // Handle player joins
      this.socket.on('player_joined', (data) => {
        console.log(`Player joined: ${data.playerName}`);
        this.ui.showMessage(`Player ${data.playerName} joined`);
      });
      
      // Handle player leaves
      this.socket.on('player_left', (data) => {
        console.log(`Player left: ${data.playerId}`);
        this.ui.showMessage(`Player left`);
      });
      
      // Handle disconnection
      this.socket.on('disconnect', () => {
        console.log('Disconnected from server');
        this.ui.showMessage('Disconnected from server', 5000);
      });
    });
  }
  
  initializeGameState(gameState) {
    if (!gameState) return;
    
    console.log('Initializing game state:', gameState);
    
    // Update node renderer
    if (gameState.nodes) {
      this.nodeRenderer.update(gameState.nodes);
    }
    
    // Update pheromone system
    if (gameState.pheromones) {
      this.pheromoneSystem.update(gameState.pheromones, 0);
    }
    
    // Create ant colony if it doesn't exist
    if (!this.antColony) {
      this.antColony = new AntColony({ nestId: this.findNestNodeId(gameState.nodes) });
    }
    
    // Update UI
    this.ui.updateGameInfo(gameState);
  }
  
  updateGameState(gameState) {
    if (!gameState) return;
    
    // Update node renderer
    if (gameState.nodes) {
      this.nodeRenderer.update(gameState.nodes);
    }
    
    // Update pheromone system
    if (gameState.pheromones) {
      this.pheromoneSystem.update(gameState.pheromones, 0.016);
    }
    
    // Update ant renderer if we have ant data
    if (this.antColony && this.antColony.getAntRenderData) {
      const antData = this.antColony.getAntRenderData();
      this.antRenderer.update(antData);
    }
    
    // Update UI
    this.ui.updateGameInfo(gameState);
  }
  
  findNestNodeId(nodes) {
    if (!nodes) return null;
    
    for (const nodeId in nodes) {
      if (nodes[nodeId].type === 'NEST') {
        return nodeId;
      }
    }
    
    return null;
  }
  
  start() {
    this.running = true;
    this.lastUpdateTime = performance.now();
    this.update();
  }
  
  update() {
    if (!this.running) return;
    
    // Request next frame
    requestAnimationFrame(() => this.update());
    
    // Calculate delta time
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = currentTime;
    
    // Update renderer
    this.renderer.render(deltaTime);
    
    // Update node animations
    this.nodeRenderer.updateAnimations(deltaTime);
    
    // Update ant colony if it exists
    if (this.antColony && this.antColony.update) {
      this.antColony.update(deltaTime);
      
      // Update ant renderer with new ant data
      if (this.antColony.getAntRenderData) {
        const antData = this.antColony.getAntRenderData();
        this.antRenderer.update(antData);
      }
    }
  }
  
  // Player actions
  
  /**
   * Place pheromone between two nodes
   * @param {string} fromNodeId - Source node ID
   * @param {string} toNodeId - Destination node ID
   * @param {string} type - Pheromone type
   * @param {number} amount - Amount to place
   */
  placePheromone(fromNodeId, toNodeId, type = 'EXPLORATION', amount = 1.0) {
    if (!this.socket) return;
    
    this.socket.emit('place_pheromone', {
      fromNodeId,
      toNodeId,
      type,
      amount
    });
  }
  
  /**
   * Boost a node
   * @param {string} nodeId - Node ID to boost
   */
  boostNode(nodeId) {
    if (!this.socket) return;
    
    this.socket.emit('boost_node', {
      nodeId
    });
  }
  
  /**
   * Disrupt a node
   * @param {string} nodeId - Node ID to disrupt
   */
  disruptNode(nodeId) {
    if (!this.socket) return;
    
    this.socket.emit('disrupt_node', {
      nodeId
    });
  }
  
  /**
   * Expand a node
   * @param {string} nodeId - Node ID to expand
   */
  expandNode(nodeId) {
    if (!this.socket) return;
    
    this.socket.emit('expand_node', {
      nodeId
    });
  }
}

// Create and export game instance
const game = new Game();
export default game;
