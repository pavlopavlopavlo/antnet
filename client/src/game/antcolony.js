import Ant from './Ant';

/**
 * Manages a colony of ants and their collective behavior
 * Implements pheromone system and colony-level properties
 */
export default class AntColony {
  /**
   * Create a new ant colony
   * @param {Graph} graph - The graph/environment the colony exists in
   * @param {object} options - Colony configuration options
   */
  constructor(graph, options = {}) {
    this.graph = graph;
    this.ants = [];
    this.nestId = options.nestId || null;
    
    // Find or create nest node
    if (!this.nestId) {
      this.nestId = this.findOrCreateNestNode();
    }
    
    // Pheromone data structure: Map of "fromId,toId,type" -> {level, decayTimer}
    this.pheromones = new Map();
    
    // Colony resources
    this.resources = {
      FOOD: 0
    };
    
    // Colony parameters
    this.params = {
      maxAnts: options.maxAnts || 100,
      pheromoneDecayRate: options.pheromoneDecayRate || 0.05,
      antSpawnRate: options.antSpawnRate || 0.1, // Ants per second
      initialAnts: options.initialAnts || 10,
      spawnRatios: {
        WORKER: options.workerRatio || 0.7,
        SCOUT: options.scoutRatio || 0.2,
        SOLDIER: options.soldierRatio || 0.1
      }
    };
    
    // Timers
    this.spawnTimer = 0;
    
    // Initialize colony
    this.init();
  }
  
  /**
   * Initialize the colony with starting ants
   */
  init() {
    // Calculate distances from all nodes to nest
    this.graph.calculateDistances(this.nestId);
    
    // Initialize starting ants
    for (let i = 0; i < this.params.initialAnts; i++) {
      this.spawnAnt();
    }
  }
  
  /**
   * Find a suitable nest node or create one
   * @returns {string} ID of the nest node
   */
  findOrCreateNestNode() {
    // First check if we already have a nest node
    for (const nodeId in this.graph.nodes) {
      if (this.graph.nodes[nodeId].type === 'NEST') {
        return nodeId;
      }
    }
    
    // Otherwise, pick a good central location
    // For simplicity, use the first node in the graph
    const firstNodeId = Object.keys(this.graph.nodes)[0];
    if (firstNodeId) {
      this.graph.nodes[firstNodeId].type = 'NEST';
      return firstNodeId;
    }
    
    // If no nodes exist, create one
    const nestId = this.graph.addNode({
      type: 'NEST',
      position: { x: 0, y: 0, z: 0 }
    });
    
    return nestId;
  }
  
  /**
   * Update all ants and colony systems
   * @param {number} deltaTime - Time since last update in seconds
   */
  update(deltaTime) {
    // Update all ants
    for (const ant of this.ants) {
      ant.update(deltaTime);
    }
    
    // Spawn new ants if under maximum
    this.updateAntSpawning(deltaTime);
    
    // Update pheromone decay
    this.updatePheromones(deltaTime);
  }
  
  /**
   * Spawn new ants if under the maximum allowed
   * @param {number} deltaTime - Time since last update
   */
  updateAntSpawning(deltaTime) {
    if (this.ants.length >= this.params.maxAnts) return;
    
    this.spawnTimer += deltaTime;
    const spawnInterval = 1 / this.params.antSpawnRate;
    
    if (this.spawnTimer >= spawnInterval) {
      this.spawnTimer = 0;
      this.spawnAnt();
    }
  }
  
  /**
   * Create a new ant with an appropriate role
   */
  spawnAnt() {
    // Determine ant role based on colony needs and spawn ratios
    const role = this.determineAntRole();
    
    // Create ant at nest position
    const ant = new Ant(this, this.nestId, role);
    this.ants.push(ant);
    
    return ant;
  }
  
  /**
   * Determine the appropriate role for a new ant
   * @returns {string} The role (WORKER, SCOUT, or SOLDIER)
   */
  determineAntRole() {
    // Count current ants by role
    const roleCounts = {
      WORKER: 0,
      SCOUT: 0,
      SOLDIER: 0
    };
    
    for (const ant of this.ants) {
      roleCounts[ant.role]++;
    }
    
    // Calculate desired counts based on ratios
    const totalAnts = this.ants.length;
    const desiredCounts = {
      WORKER: Math.floor(totalAnts * this.params.spawnRatios.WORKER),
      SCOUT: Math.floor(totalAnts * this.params.spawnRatios.SCOUT),
      SOLDIER: Math.floor(totalAnts * this.params.spawnRatios.SOLDIER)
    };
    
    // Find the role with the biggest deficit
    let biggestDeficit = 0;
    let roleToSpawn = 'WORKER'; // Default to worker
    
    for (const role in roleCounts) {
      const deficit = desiredCounts[role] - roleCounts[role];
      if (deficit > biggestDeficit) {
        biggestDeficit = deficit;
        roleToSpawn = role;
      }
    }
    
    return roleToSpawn;
  }
  
  /**
   * Update pheromone levels (decay over time)
   * @param {number} deltaTime - Time since last update
   */
  updatePheromones(deltaTime) {
    for (const [key, data] of this.pheromones.entries()) {
      // Decay pheromone based on time
      data.level *= (1 - this.params.pheromoneDecayRate * deltaTime);
      
      // Remove pheromone if level is negligible
      if (data.level < 0.01) {
        this.pheromones.delete(key);
      }
    }
  }
  
  /**
   * Deposit pheromone between two nodes
   * @param {string} fromId - Source node ID
   * @param {string} toId - Destination node ID
   * @param {string} type - Pheromone type (e.g., 'FOOD', 'EXPLORATION')
   * @param {number} amount - Amount of pheromone to deposit
   */
  depositPheromone(fromId, toId, type, amount) {
    const key = `${fromId},${toId},${type}`;
    const reverseKey = `${toId},${fromId},${type}`;
    
    // Get current pheromone level
    const current = this.pheromones.get(key) || { level: 0 };
    
    // Update pheromone level (not just add, to prevent unbounded growth)
    current.level = Math.min(current.level + amount, 5.0);
    
    // Store updated value
    this.pheromones.set(key, current);
    
    // Also set reverse direction (undirected graph)
    const reverseCurrent = this.pheromones.get(reverseKey) || { level: 0 };
    reverseCurrent.level = Math.min(reverseCurrent.level + amount * 0.5, 5.0);
    this.pheromones.set(reverseKey, reverseCurrent);
  }
  
  /**
   * Get pheromone level between two nodes
   * @param {string} fromId - Source node ID
   * @param {string} toId - Destination node ID
   * @param {string} type - Pheromone type
   * @returns {number} Pheromone level
   */
  getPheromoneLevel(fromId, toId, type) {
    const key = `${fromId},${toId},${type}`;
    const data = this.pheromones.get(key);
    return data ? data.level : 0;
  }
  
  /**
   * Add a resource to the colony's stores
   * @param {string} resourceType - Type of resource
   * @param {number} amount - Amount to add (default 1)
   */
  addResource(resourceType, amount = 1) {
    if (!this.resources[resourceType]) {
      this.resources[resourceType] = 0;
    }
    
    this.resources[resourceType] += amount;
  }
  
  /**
   * Get all pheromone data for rendering
   * @returns {Array} Array of pheromone objects with positions and levels
   */
  getPheromoneRenderData() {
    const renderData = [];
    
    for (const [key, data] of this.pheromones.entries()) {
      const [fromId, toId, type] = key.split(',');
      
      const fromPos = this.graph.getNodePosition(fromId);
      const toPos = this.graph.getNodePosition(toId);
      
      if (!fromPos || !toPos) continue;
      
      let color;
      switch (type) {
        case 'FOOD':
          color = new THREE.Color(0x00FF00); // Green for food
          break;
        case 'EXPLORATION':
          color = new THREE.Color(0x0088FF); // Blue for exploration
          break;
        default:
          color = new THREE.Color(0xFFFFFF); // White default
      }
      
      renderData.push({
        from: fromPos.clone(),
        to: toPos.clone(),
        level: data.level,
        type,
        color
      });
    }
    
    return renderData;
  }
  
  /**
   * Get all ant data for rendering
   * @returns {Array} Array of ant objects with positions and properties
   */
  getAntRenderData() {
    return this.ants.map(ant => ({
      position: ant.position.clone(),
      rotation: this.calculateAntRotation(ant),
      scale: ant.scale,
      color: ant.color,
      carrying: ant.carrying,
      role: ant.role,
      state: ant.state
    }));
  }
  
  /**
   * Calculate rotation for an ant based on its movement direction
   * @param {Ant} ant - The ant to calculate rotation for
   * @returns {THREE.Quaternion} Rotation quaternion
   */
  calculateAntRotation(ant) {
    if (!ant.previousNodeId || !ant.currentNodeId) {
      return new THREE.Quaternion();
    }
    
    const fromPos = this.graph.getNodePosition(ant.previousNodeId);
    const toPos = this.graph.getNodePosition(ant.currentNodeId);
    
    if (!fromPos || !toPos) {
      return new THREE.Quaternion();
    }
    
    // Calculate direction vector
    const direction = new THREE.Vector3().subVectors(toPos, fromPos).normalize();
    
    // Create rotation quaternion to point in that direction
    // Assuming ant's forward is along the z-axis
    const quaternion = new THREE.Quaternion();
    const upVector = new THREE.Vector3(0, 1, 0);
    
    // Check if direction is parallel to up vector
    if (Math.abs(direction.y) > 0.99) {
      // Special case: pointing straight up or down
      quaternion.setFromAxisAngle(
        new THREE.Vector3(1, 0, 0), 
        direction.y > 0 ? Math.PI / 2 : -Math.PI / 2
      );
    } else {
      const rotationMatrix = new THREE.Matrix4();
      rotationMatrix.lookAt(new THREE.Vector3(), direction, upVector);
      quaternion.setFromRotationMatrix(rotationMatrix);
    }
    
    return quaternion;
  }
}
