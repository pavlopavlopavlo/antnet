// client/src/ui/UI.js
export default class UI {
  /**
   * Create and manage game UI
   * @param {Game} game - Main game instance
   */
  constructor(game) {
    this.game = game;
    
    // DOM elements
    this.gameInfo = document.getElementById('game-info');
    this.boostBtn = document.getElementById('boost-btn');
    this.disruptBtn = document.getElementById('disrupt-btn');
    this.expandBtn = document.getElementById('expand-btn');
    
    // UI state
    this.selectedNodeId = null;
    
    // Initialize UI
    this.init();
  }
  
  /**
   * Initialize UI elements and event listeners
   */
  init() {
    // Initialize button event listeners
    this.boostBtn.addEventListener('click', () => {
      if (this.selectedNodeId) {
        this.game.boostNode(this.selectedNodeId);
      } else {
        this.showMessage('Select a node first');
      }
    });
    
    this.disruptBtn.addEventListener('click', () => {
      if (this.selectedNodeId) {
        this.game.disruptNode(this.selectedNodeId);
      } else {
        this.showMessage('Select a node first');
      }
    });
    
    this.expandBtn.addEventListener('click', () => {
      if (this.selectedNodeId) {
        this.game.expandNode(this.selectedNodeId);
      } else {
        this.showMessage('Select a node first');
      }
    });
    
    // Initialize raycaster for node selection
    this.initNodeSelection();
    
    // Add energy display
    this.createEnergyDisplay();
  }
  
  /**
   * Initialize node selection with raycaster
   */
  initNodeSelection() {
    // Create raycaster
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    // Add click event listener
    window.addEventListener('click', (event) => {
      // Update mouse position
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      // Update raycaster
      this.raycaster.setFromCamera(this.mouse, this.game.camera);
      
      // Get all node meshes
      const nodeMeshes = [];
      for (const node of this.game.nodeRenderer.nodes.values()) {
        nodeMeshes.push(node.mesh);
      }
      
      // Find intersections
      const intersects = this.raycaster.intersectObjects(nodeMeshes);
      
      if (intersects.length > 0) {
        // Find node ID from mesh
        for (const [nodeId, node] of this.game.nodeRenderer.nodes.entries()) {
          if (node.mesh === intersects[0].object) {
            this.selectNode(nodeId);
            break;
          }
        }
      } else {
        // Deselect if clicking empty space
        this.deselectNode();
      }
    });
  }
  
  /**
   * Select a node
   * @param {string} nodeId - Node ID to select
   */
  selectNode(nodeId) {
    // Deselect previous node if any
    this.deselectNode();
    
    // Select new node
    this.selectedNodeId = nodeId;
    
    // Get node data
    const node = this.game.nodeRenderer.nodes.get(nodeId);
    if (!node) return;
    
    // Highlight selected node
    const originalMaterial = node.mesh.material;
    node.originalMaterial = originalMaterial;
    
    const highlightMaterial = originalMaterial.clone();
    highlightMaterial.emissive = new THREE.Color(0xffffff);
    highlightMaterial.emissiveIntensity = 0.5;
    node.mesh.material = highlightMaterial;
    
    // Update UI with node info
    this.updateNodeInfo(node.data);
  }
  
  /**
   * Deselect the currently selected node
   */
  deselectNode() {
    if (!this.selectedNodeId) return;
    
    // Get node data
    const node = this.game.nodeRenderer.nodes.get(this.selectedNodeId);
    if (!node) return;
    
    // Restore original material
    if (node.originalMaterial) {
      node.mesh.material = node.originalMaterial;
      node.originalMaterial = null;
    }
    
    // Clear selection
    this.selectedNodeId = null;
    
    // Update UI
    this.clearNodeInfo();
  }
  
  /**
   * Update UI with node information
   * @param {Object} nodeData - Node data
   */
  updateNodeInfo(nodeData) {
    if (!nodeData) return;
    
    // Create node info element if it doesn't exist
    if (!this.nodeInfo) {
      this.nodeInfo = document.createElement('div');
      this.nodeInfo.className = 'node-info';
      document.querySelector('.ui-container').appendChild(this.nodeInfo);
    }
    
    // Update content
    this.nodeInfo.innerHTML = `
      <h3>Node Info</h3>
      <p>Type: ${nodeData.type}</p>
      <p>Size: ${nodeData.size}</p>
      <p>Resources: ${nodeData.resources || 0}</p>
      <p>Capacity: ${nodeData.capacity || 0}</p>
      <p>Status: ${nodeData.boosted ? 'BOOSTED' : nodeData.disrupted ? 'DISRUPTED' : 'NORMAL'}</p>
    `;
    
    // Show node info
    this.nodeInfo.style.display = 'block';
  }
  
  /**
   * Clear node information
   */
  clearNodeInfo() {
    if (this.nodeInfo) {
      this.nodeInfo.style.display = 'none';
    }
  }
  
  /**
   * Create energy display
   */
  createEnergyDisplay() {
    this.energyDisplay = document.createElement('div');
    this.energyDisplay.className = 'energy-display';
    document.querySelector('.ui-container').appendChild(this.energyDisplay);
    
    // Initial update
    this.updateEnergyDisplay(100);
  }
  
  /**
   * Update energy display
   * @param {number} energy - Current energy level
   */
  updateEnergyDisplay(energy) {
    this.energyDisplay.innerHTML = `
      <h3>Energy: ${Math.floor(energy)}</h3>
      <div class="energy-bar">
        <div class="energy-fill" style="width: ${energy}%"></div>
      </div>
    `;
  }
  
  /**
   * Update game information
   * @param {Object} gameState - Current game state
   */
  updateGameInfo(gameState) {
    if (!gameState) return;
    
    // Update game info
    if (this.gameInfo) {
      this.gameInfo.textContent = `Game ID: ${this.game.gameId} | Players: ${gameState.players?.length || 0} | Objective: ${gameState.objective || 'None'}`;
    }
    
    // Update energy display
    const player = gameState.players?.find(p => p.id === this.game.playerId);
    if (player && this.energyDisplay) {
      this.updateEnergyDisplay(player.resources.energy);
    }
  }
  
  /**
   * Show a temporary message
   * @param {string} message - Message to display
   * @param {number} duration - Duration in milliseconds
   */
  showMessage(message, duration = 2000) {
    // Create message element if it doesn't exist
    if (!this.messageEl) {
      this.messageEl = document.createElement('div');
      this.messageEl.className = 'message';
      document.body.appendChild(this.messageEl);
      
      // Style the message
      this.messageEl.style.position = 'absolute';
      this.messageEl.style.top = '20px';
      this.messageEl.style.left = '50%';
      this.messageEl.style.transform = 'translateX(-50%)';
      this.messageEl.style.background = 'rgba(0, 0, 0, 0.7)';
      this.messageEl.style.color = 'white';
      this.messageEl.style.padding = '10px 20px';
      this.messageEl.style.borderRadius = '5px';
      this.messageEl.style.zIndex = '1000';
      this.messageEl.style.display = 'none';
    }
    
    // Show message
    this.messageEl.textContent = message;
    this.messageEl.style.display = 'block';
    
    // Hide after duration
    clearTimeout(this.messageTimeout);
    this.messageTimeout = setTimeout(() => {
      this.messageEl.style.display = 'none';
    }, duration);
  }
}
