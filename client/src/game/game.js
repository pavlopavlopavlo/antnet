// client/src/game/Game.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import AntColony from './AntColony';
import PheromoneSystem from '../rendering/PheromoneSystem';
import io from 'socket.io-client';

class Game {
  constructor() {
    this.initialized = false;
    this.socket = null;
    this.gameId = null;
    this.playerId = null;
    
    // Three.js components
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    
    // Game components
    this.graph = null;
    this.antColony = null;
    this.pheromoneSystem = null;
    
    // Game state
    this.lastUpdateTime = 0;
    this.running = false;
    
    // Initialize the game
    this.init();
  }
  
  async init() {
    if (this.initialized) return;
    
    // Set up Three.js scene
    this.setupScene();
    
    // Set up UI
    this.setupUI();
    
    // Connect to server
    await this.connectToServer();
    
    // Start game loop
    this.start();
    
    this.initialized = true;
  }
  
  setupScene() {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111122);
    
    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      75, window.innerWidth / window.innerHeight, 0.1, 1000
    );
    this.camera.position.set(0, 30, 30);
    this.camera.lookAt(0, 0, 0);
    
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('game-container').appendChild(this.renderer.domElement);
    
    // Add orbit controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040);
    this.scene.add(ambientLight);
    
    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);
    
    // Add resize handler
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Add test objects (temporary)
    this.addTestObjects();
  }
  
  addTestObjects() {
    // Add grid helper
    const gridHelper = new THREE.GridHelper(50, 50);
    this.scene.add(gridHelper);
    
    // Add a sphere to represent the nest
    const nestGeometry = new THREE.SphereGeometry(2, 32, 32);
    const nestMaterial = new THREE.MeshStandardMaterial({ color: 0x00aaff });
    const nestMesh = new THREE.Mesh(nestGeometry, nestMaterial);
    this.scene.add(nestMesh);
  }
  
  setupUI() {
    // Create a simple UI for testing
    const uiContainer = document.createElement('div');
    uiContainer.style.position = 'absolute';
    uiContainer.style.top = '10px';
    uiContainer.style.left = '10px';
    uiContainer.style.color = 'white';
    uiContainer.style.fontFamily = 'Arial, sans-serif';
    uiContainer.innerHTML = '<h3>AntNet</h3><div id="game-info">Connecting to server...</div>';
    document.body.appendChild(uiContainer);
  }
  
  async connectToServer() {
    return new Promise((resolve) => {
      // Connect to Socket.IO server
      this.socket = io();
      
      // Handle connection events
      this.socket.on('connect', () => {
        console.log('Connected to server');
        
        // Join or create a game
        this.socket.emit('join_game', { playerName: 'Player' }, (response) => {
          if (response.success) {
            this.gameId = response.gameId;
            this.playerId = response.playerId;
            
            // Update UI
            const gameInfo = document.getElementById('game-info');
            gameInfo.textContent = `Game ID: ${this.gameId} | Player ID: ${this.playerId}`;
            
            // Initialize game with received data
            this.initializeGameState(response.game);
            
            resolve();
          } else {
            console.error('Failed to join game:', response.error);
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
      });
      
      // Handle player leaves
      this.socket.on('player_left', (data) => {
        console.log(`Player left: ${data.playerId}`);
      });
      
      // Handle disconnection
      this.socket.on('disconnect', () => {
        console.log('Disconnected from server');
      });
    });
  }
  
  initializeGameState(gameState) {
    // Create ant colony with initial state
    this.antColony = new AntColony(gameState.graph);
    
    // Create pheromone system
    this.pheromoneSystem = new PheromoneSystem(this.scene);
    
    // TODO: Create node renderers
    // TODO: Create ant renderers
  }
  
  updateGameState(gameState) {
    // Update pheromones
    if (gameState.pheromones) {
      this.pheromoneSystem.update(gameState.pheromones, 0.016);
    }
    
    // TODO: Update nodes
    // TODO: Update ants
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
    
    // Update controls
    this.controls.update();
    
    // Update game components
    if (this.antColony) {
      this.antColony.update(deltaTime);
    }
    
    // Render scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Create and export game instance
const game = new Game();
export default game;
