/**
 * Represents an individual ant agent in the simulation
 * Implements realistic ant behavior based on research
 */
export default class Ant {
  /**
   * Create a new ant
   * @param {AntColony} colony - The colony this ant belongs to
   * @param {string} currentNodeId - Starting node for this ant
   * @param {string} role - The ant's role in the colony
   */
  constructor(colony, currentNodeId, role = 'WORKER') {
    this.id = Math.random().toString(36).substring(2, 10);
    this.colony = colony;
    this.currentNodeId = currentNodeId;
    this.previousNodeId = null;
    this.role = role;
    this.state = 'EXPLORING';
    this.carrying = null;
    this.memory = [currentNodeId]; // Short term memory to avoid loops
    this.memorySize = 5;
    this.fatigue = 0;
    this.path = []; // Path taken since last at nest
    
    // Movement properties
    this.position = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();
    this.movementProgress = 0;
    this.movementSpeed = 0.05; // Base speed, will be affected by role, pheromones, etc.
    
    // Visual properties
    this.scale = 1.0;
    this.color = new THREE.Color(0xFFFFFF);
    
    // Role-specific property initialization
    this.initRoleProperties();
  }
  
  /**
   * Initialize properties based on ant role
   */
  initRoleProperties() {
    switch(this.role) {
      case 'SCOUT':
        this.movementSpeed *= 1.5;
        this.memorySize = 8;
        this.color.setHex(0x00FFFF); // Cyan for scouts
        break;
      case 'WORKER':
        this.scale = 0.9;
        this.color.setHex(0xFFAA00); // Orange for workers
        break;
      case 'SOLDIER':
        this.scale = 1.2;
        this.movementSpeed *= 0.8;
        this.color.setHex(0xFF5555); // Red for soldiers
        break;
      default:
        break;
    }
  }
  
  /**
   * Update the ant's state and position
   * @param {number} deltaTime - Time since last update in seconds
   */
  update(deltaTime) {
    // Update fatigue
    this.updateFatigue(deltaTime);
    
    // If currently moving between nodes
    if (this.movementProgress < 1) {
      this.updateMovement(deltaTime);
      return;
    }
    
    // State machine for ant behavior
    switch(this.state) {
      case 'EXPLORING':
        this.explore();
        break;
      case 'RETURNING':
        this.returnToNest();
        break;
      case 'RESTING':
        this.rest(deltaTime);
        break;
      case 'FOLLOWING':
        this.followTrail();
        break;
      default:
        this.explore();
    }
  }
  
  /**
   * Update ant's fatigue level
   * @param {number} deltaTime - Time since last update
   */
  updateFatigue(deltaTime) {
    // Increase fatigue over time, faster when carrying something
    const fatigueRate = this.carrying ? 0.1 : 0.05;
    this.fatigue += fatigueRate * deltaTime;
    
    // If fatigue exceeds threshold, go to resting state
    if (this.fatigue > 10 && this.state !== 'RESTING') {
      this.state = 'RESTING';
    }
  }
  
  /**
   * Update ant's position during movement between nodes
   * @param {number} deltaTime - Time since last update
   */
  updateMovement(deltaTime) {
    // Update movement progress based on speed
    this.movementProgress += this.movementSpeed * deltaTime;
    if (this.movementProgress > 1) this.movementProgress = 1;
    
    // Linear interpolation between current and target position
    this.position.lerpVectors(
      this.colony.graph.getNodePosition(this.previousNodeId),
      this.colony.graph.getNodePosition(this.currentNodeId),
      this.movementProgress
    );
    
    // Deposit pheromone along the path
    if (this.shouldDepositPheromone()) {
      this.depositPheromone();
    }
  }
  
  /**
   * Check if ant should deposit pheromone based on state and role
   * @returns {boolean} Whether pheromone should be deposited
   */
  shouldDepositPheromone() {
    // Different states have different pheromone deposition rules
    switch (this.state) {
      case 'RETURNING':
        return true; // Always deposit when returning with food
      case 'EXPLORING':
        return Math.random() < 0.1; // Occasionally deposit while exploring
      case 'FOLLOWING':
        return this.carrying !== null; // Deposit only if carrying something
      default:
        return false;
    }
  }
  
  /**
   * Deposit appropriate pheromone based on ant state
   */
  depositPheromone() {
    if (!this.previousNodeId || !this.currentNodeId) return;
    
    let pheromoneType = 'EXPLORATION';
    let strength = 0.1;
    
    if (this.carrying) {
      pheromoneType = 'FOOD';
      strength = 0.5;
    }
    
    this.colony.depositPheromone(
      this.previousNodeId, 
      this.currentNodeId, 
      pheromoneType, 
      strength
    );
  }
  
  /**
   * Explore the environment based on pheromones and probabilities
   */
  explore() {
    const neighbors = this.colony.graph.getNeighbors(this.currentNodeId);
    if (neighbors.length === 0) {
      this.state = 'RETURNING';
      return;
    }
    
    // Calculate probabilities for each neighbor
    let probabilities = this.calculateMovementProbabilities(neighbors);
    
    // Select next node based on probabilities
    const selectedNode = this.selectBasedOnProbability(probabilities);
    if (!selectedNode) return;
    
    // Move to selected node
    this.moveToNode(selectedNode);
    
    // Check if node has resource
    this.checkForResources();
  }
  
  /**
   * Calculate probabilities for moving to each neighboring node
   * @param {Array} neighbors - List of neighboring node IDs
   * @returns {Array} Array of nodes with their probabilities
   */
  calculateMovementProbabilities(neighbors) {
    return neighbors.map(nodeId => {
      // Skip if the node is in recent memory (avoid loops)
      const memoryFactor = this.memory.includes(nodeId) ? 0.1 : 1;
      
      // Get pheromone levels on the edge
      const foodPheromone = this.colony.getPheromoneLevel(this.currentNodeId, nodeId, 'FOOD');
      const explorationPheromone = this.colony.getPheromoneLevel(this.currentNodeId, nodeId, 'EXPLORATION');
      
      // Calculate probability based on pheromones and memory
      let probability;
      if (this.state === 'EXPLORING') {
        // When exploring, prefer unexplored paths
        probability = (explorationPheromone * 0.5 + 0.5) * memoryFactor;
      } else if (this.state === 'FOLLOWING') {
        // When following, strongly prefer food pheromones
        probability = (foodPheromone * 2 + explorationPheromone * 0.5) * memoryFactor;
      } else {
        probability = memoryFactor;
      }
      
      // Adjust by node type (some nodes might be more attractive)
      const node = this.colony.graph.getNode(nodeId);
      if (node.type === 'FOOD_SOURCE') probability *= 3;
      if (node.type === 'NEST') probability *= (this.carrying ? 3 : 0.5);
      
      return { nodeId, probability };
    });
  }
  
  /**
   * Select a node based on probability distribution
   * @param {Array} probabilities - Array of nodes with their probabilities
   * @returns {string} Selected node ID
   */
  selectBasedOnProbability(probabilities) {
    // Normalize probabilities
    const sum = probabilities.reduce((acc, item) => acc + item.probability, 0);
    if (sum === 0) return probabilities[0]?.nodeId;
    
    const normalized = probabilities.map(item => ({
      nodeId: item.nodeId,
      probability: item.probability / sum
    }));
    
    // Select based on probability
    const random = Math.random();
    let cumulativeProbability = 0;
    
    for (const item of normalized) {
      cumulativeProbability += item.probability;
      if (random <= cumulativeProbability) {
        return item.nodeId;
      }
    }
    
    // Fallback in case of rounding errors
    return normalized[normalized.length - 1]?.nodeId;
  }
  
  /**
   * Move ant to a new node
   * @param {string} nodeId - Target node ID
   */
  moveToNode(nodeId) {
    if (!nodeId) return;
    
    this.previousNodeId = this.currentNodeId;
    this.currentNodeId = nodeId;
    this.path.push(nodeId);
    
    // Update memory of visited nodes (limited size)
    this.memory.push(nodeId);
    if (this.memory.length > this.memorySize) {
      this.memory.shift();
    }
    
    // Reset movement progress to start animation
    this.movementProgress = 0;
    this.targetPosition = this.colony.graph.getNodePosition(nodeId);
  }
  
  /**
   * Check if current node has resources and collect them
   */
  checkForResources() {
    const node = this.colony.graph.getNode(this.currentNodeId);
    
    if (node.type === 'FOOD_SOURCE' && node.resources > 0 && !this.carrying) {
      // Collect resource
      this.carrying = 'FOOD';
      node.resources--;
      
      // Switch to returning state
      this.state = 'RETURNING';
    }
    
    if (node.type === 'NEST' && this.carrying) {
      // Deposit resource at nest
      this.colony.addResource(this.carrying);
      this.carrying = null;
      
      // Reset path and switch to following state
      this.path = [this.currentNodeId];
      this.state = 'FOLLOWING';
    }
  }
  
  /**
   * Return to the nest using shortest known path
   */
  returnToNest() {
    const neighbors = this.colony.graph.getNeighbors(this.currentNodeId);
    
    // Find the neighbor closest to nest
    let bestNode = null;
    let shortestDistance = Infinity;
    
    for (const nodeId of neighbors) {
      const node = this.colony.graph.getNode(nodeId);
      if (node.distanceToNest < shortestDistance) {
        shortestDistance = node.distanceToNest;
        bestNode = nodeId;
      }
    }
    
    if (bestNode) {
      this.moveToNode(bestNode);
    } else if (neighbors.length > 0) {
      // If no path to nest is known, just pick a random neighbor
      this.moveToNode(neighbors[Math.floor(Math.random() * neighbors.length)]);
    }
  }
  
  /**
   * Rest to recover from fatigue
   * @param {number} deltaTime - Time since last update
   */
  rest(deltaTime) {
    this.fatigue -= 0.2 * deltaTime;
    
    if (this.fatigue <= 0) {
      this.fatigue = 0;
      this.state = this.carrying ? 'RETURNING' : 'EXPLORING';
    }
  }
  
  /**
   * Follow pheromone trail
   */
  followTrail() {
    const neighbors = this.colony.graph.getNeighbors(this.currentNodeId);
    
    // Calculate probabilities heavily weighted by food pheromone
    let probabilities = neighbors.map(nodeId => {
      const foodPheromone = this.colony.getPheromoneLevel(this.currentNodeId, nodeId, 'FOOD');
      
      return {
        nodeId,
        probability: Math.pow(foodPheromone + 0.1, 3)
      };
    });
    
    const selectedNode = this.selectBasedOnProbability(probabilities);
    
    if (selectedNode) {
      this.moveToNode(selectedNode);
    } else {
      this.state = 'EXPLORING';
    }
    
    // Check for resources at current node
    this.checkForResources();
  }
}
