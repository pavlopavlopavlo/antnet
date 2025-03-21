/**
 * Graph representation for the ant environment
 * Handles nodes, edges, and pathfinding
 */
class Graph {
  constructor() {
    this.nodes = {};
    this.edges = {};
    this.pheromones = new Map();
  }
  
  /**
   * Add a node to the graph
   * @param {Object} nodeData - Node properties
   * @returns {string} - The ID of the created node
   */
  addNode(nodeData) {
    const id = nodeData.id || this.generateId();
    
    this.nodes[id] = {
      id,
      type: nodeData.type || 'NORMAL',
      position: nodeData.position || { x: 0, y: 0, z: 0 },
      size: nodeData.size || 1,
      capacity: nodeData.capacity || 10,
      resources: nodeData.resources || 0,
      distanceToNest: Infinity,
      boosted: false,
      disrupted: false,
      boostTimer: 0,
      disruptTimer: 0
    };
    
    this.edges[id] = [];
    
    return id;
  }
  
  /**
   * Generate a unique ID for a node
   * @returns {string} - A unique ID
   */
  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }
  
  /**
   * Add an edge between two nodes
   * @param {string} node1Id - First node ID
   * @param {string} node2Id - Second node ID
   * @returns {boolean} - Success
   */
  addEdge(node1Id, node2Id) {
    if (!this.nodes[node1Id] || !this.nodes[node2Id]) {
      return false;
    }
    
    // Don't add duplicate edges
    if (this.hasEdge(node1Id, node2Id)) {
      return true;
    }
    
    this.edges[node1Id].push(node2Id);
    this.edges[node2Id].push(node1Id);
    
    return true;
  }
  
  /**
   * Check if an edge exists between two nodes
   * @param {string} node1Id - First node ID
   * @param {string} node2Id - Second node ID
   * @returns {boolean} - True if edge exists
   */
  hasEdge(node1Id, node2Id) {
    return this.edges[node1Id]?.includes(node2Id);
  }
  
  /**
   * Get all neighbors of a node
   * @param {string} nodeId - Node ID
   * @returns {Array} - Array of neighbor node IDs
   */
  getNeighbors(nodeId) {
    return this.edges[nodeId] || [];
  }
  
  /**
   * Get all edges in the graph
   * @returns {Array} - Array of edge objects
   */
  getEdges() {
    const edgeList = [];
    
    for (const fromId in this.edges) {
      for (const toId of this.edges[fromId]) {
        // Only add each edge once (undirected graph)
        if (fromId < toId) {
          edgeList.push({
            from: fromId,
            to: toId
          });
        }
      }
    }
    
    return edgeList;
  }
  
  /**
   * Get a node by its ID
   * @param {string} nodeId - Node ID
   * @returns {Object} - Node object
   */
  getNode(nodeId) {
    return this.nodes[nodeId];
  }
  
  /**
   * Get a node position by its ID
   * @param {string} nodeId - Node ID
   * @returns {Object} - Position object
   */
  getNodePosition(nodeId) {
    const node = this.nodes[nodeId];
    return node ? node.position : null;
  }
  
  /**
   * Calculate distances from all nodes to a target node (typically nest)
   * Uses Dijkstra's algorithm
   * @param {string} targetNodeId - Target node ID
   */
  calculateDistances(targetNodeId) {
    // Reset all distances
    for (const nodeId in this.nodes) {
      this.nodes[nodeId].distanceToNest = Infinity;
    }
    
    // Set target distance to 0
    if (this.nodes[targetNodeId]) {
      this.nodes[targetNodeId].distanceToNest = 0;
    }
    
    // Queue for Dijkstra's algorithm
    const queue = [targetNodeId];
    const visited = new Set();
    
    while (queue.length > 0) {
      const currentId = queue.shift();
      
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      
      const currentDistance = this.nodes[currentId].distanceToNest;
      const neighbors = this.getNeighbors(currentId);
      
      for (const neighborId of neighbors) {
        // Skip visited nodes
        if (visited.has(neighborId)) continue;
        
        const neighbor = this.nodes[neighborId];
        
        // Calculate new distance
        const newDistance = currentDistance + 1; // Each edge has weight 1
        
        // Update if new distance is shorter
        if (newDistance < neighbor.distanceToNest) {
          neighbor.distanceToNest = newDistance;
          queue.push(neighborId);
        }
      }
    }
  }
  
  /**
   * Find a node ID by its position
   * @param {Object} position - Position to search for
   * @returns {string} - Node ID or null if not found
   */
  getNodeIdByPosition(position) {
    for (const nodeId in this.nodes) {
      const node = this.nodes[nodeId];
      
      // Check if positions match (with small tolerance)
      if (this.arePositionsEqual(node.position, position)) {
        return nodeId;
      }
    }
    
    return null;
  }
  
  /**
   * Check if two positions are approximately equal
   * @param {Object} pos1 - First position
   * @param {Object} pos2 - Second position
   * @returns {boolean} - True if positions are approximately equal
   */
  arePositionsEqual(pos1, pos2) {
    const tolerance = 0.1;
    
    return (
      Math.abs(pos1.x - pos2.x) < tolerance &&
      Math.abs(pos1.z - pos2.z) < tolerance
    );
  }
  
  /**
   * Find the shortest path between two nodes
   * Uses A* algorithm
   * @param {string} startNodeId - Start node ID
   * @param {string} endNodeId - End node ID
   * @returns {Array} - Array of node IDs forming the path
   */
  findPath(startNodeId, endNodeId) {
    // A* implementation
    const openSet = [startNodeId];
    const cameFrom = {};
    
    // Cost from start to node
    const gScore = {};
    gScore[startNodeId] = 0;
    
    // Estimated total cost from start to goal through node
    const fScore = {};
    fScore[startNodeId] = this.heuristic(startNodeId, endNodeId);
    
    while (openSet.length > 0) {
      // Find node with lowest fScore
      let current = openSet[0];
      let lowestFScore = fScore[current];
      let lowestIndex = 0;
      
      for (let i = 1; i < openSet.length; i++) {
        const nodeId = openSet[i];
        if (fScore[nodeId] < lowestFScore) {
          lowestFScore = fScore[nodeId];
          current = nodeId;
          lowestIndex = i;
        }
      }
      
      // Remove current from openSet
      openSet.splice(lowestIndex, 1);
      
      // If current is end, reconstruct path
      if (current === endNodeId) {
        return this.reconstructPath(cameFrom, current);
      }
      
      // Check neighbors
      const neighbors = this.getNeighbors(current);
      
      for (const neighborId of neighbors) {
        const node = this.nodes[neighborId];
        
        // Skip disrupted nodes
        if (node.disrupted) continue;
        
        // Calculate tentative gScore
        const tentativeGScore = gScore[current] + 1; // Each edge has weight 1
        
        if (!gScore[neighborId] || tentativeGScore < gScore[neighborId]) {
          // This path is better
          cameFrom[neighborId] = current;
          gScore[neighborId] = tentativeGScore;
          fScore[neighborId] = gScore[neighborId] + this.heuristic(neighborId, endNodeId);
          
          // Add to openSet if not there
          if (!openSet.includes(neighborId)) {
            openSet.push(neighborId);
          }
        }
      }
    }
    
    // No path found
    return [];
  }
  
  /**
   * Heuristic function for A* algorithm
   * Uses Euclidean distance
   * @param {string} node1Id - First node ID
   * @param {string} node2Id - Second node ID
   * @returns {number} - Estimated distance
   */
  heuristic(node1Id, node2Id) {
    const pos1 = this.nodes[node1Id].position;
    const pos2 = this.nodes[node2Id].position;
    
    return Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) +
      Math.pow(pos1.y - pos2.y, 2) +
      Math.pow(pos1.z - pos2.z, 2)
    );
  }
  
  /**
   * Reconstruct path from A* result
   * @param {Object} cameFrom - Map of node IDs to previous node IDs
   * @param {string} current - Current node ID
   * @returns {Array} - Array of node IDs forming the path
   */
  reconstructPath(cameFrom, current) {
    const path = [current];
    
    while (cameFrom[current]) {
      current = cameFrom[current];
      path.unshift(current);
    }
    
    return path;
  }
}

module.exports = Graph;
