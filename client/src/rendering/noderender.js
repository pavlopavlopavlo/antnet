// client/src/rendering/NodeRenderer.js
import * as THREE from 'three';

/**
 * Handles rendering of nodes in the environment
 */
export default class NodeRenderer {
  /**
   * Create a new node renderer
   * @param {THREE.Scene} scene - Three.js scene to add nodes to
   */
  constructor(scene) {
    this.scene = scene;
    this.nodes = new Map(); // Map of nodeId -> mesh
    
    // Materials for different node types
    this.materials = {
      'NORMAL': new THREE.MeshStandardMaterial({
        color: 0x4477aa,
        emissive: 0x223344,
        roughness: 0.3,
        metalness: 0.7
      }),
      'NEST': new THREE.MeshStandardMaterial({
        color: 0x00aaff,
        emissive: 0x0055aa,
        roughness: 0.2,
        metalness: 0.8
      }),
      'FOOD_SOURCE': new THREE.MeshStandardMaterial({
        color: 0x22aa22,
        emissive: 0x115511,
        roughness: 0.4,
        metalness: 0.6
      })
    };
    
    // Materials for node states
    this.stateMaterials = {
      'BOOSTED': new THREE.MeshStandardMaterial({
        color: 0xffaa00,
        emissive: 0xaa5500,
        roughness: 0.2,
        metalness: 0.8
      }),
      'DISRUPTED': new THREE.MeshStandardMaterial({
        color: 0xff4444,
        emissive: 0xaa0000,
        roughness: 0.5,
        metalness: 0.4
      })
    };
    
    // Create geometries
    this.geometries = {
      small: new THREE.IcosahedronGeometry(1, 1),
      medium: new THREE.IcosahedronGeometry(1.5, 1),
      large: new THREE.IcosahedronGeometry(2, 2)
    };
    
    // Connection line material
    this.lineMaterial = new THREE.LineBasicMaterial({
      color: 0x444466,
      transparent: true,
      opacity: 0.6
    });
    
    this.connectionLines = new THREE.Group();
    this.scene.add(this.connectionLines);
  }
  
  /**
   * Update nodes based on game state
   * @param {Object} nodes - Node data from game state
   */
  update(nodes) {
    // Track existing nodes to remove outdated ones
    const currentNodes = new Set();
    
    // Update or create nodes
    for (const nodeId in nodes) {
      const nodeData = nodes[nodeId];
      currentNodes.add(nodeId);
      
      if (this.nodes.has(nodeId)) {
        // Update existing node
        this.updateNode(nodeId, nodeData);
      } else {
        // Create new node
        this.createNode(nodeId, nodeData);
      }
    }
    
    // Remove nodes that no longer exist
    for (const nodeId of this.nodes.keys()) {
      if (!currentNodes.has(nodeId)) {
        this.removeNode(nodeId);
      }
    }
    
    // Update connections
    this.updateConnections(nodes);
  }
  
  /**
   * Create a new node mesh
   * @param {string} nodeId - Node ID
   * @param {Object} nodeData - Node data
   */
  createNode(nodeId, nodeData) {
    // Determine node size
    let geometry;
    if (nodeData.size === 1) {
      geometry = this.geometries.small;
    } else if (nodeData.size === 2) {
      geometry = this.geometries.medium;
    } else {
      geometry = this.geometries.large;
    }
    
    // Get material based on node type
    const material = this.materials[nodeData.type] || this.materials.NORMAL;
    
    // Create mesh
    const mesh = new THREE.Mesh(geometry, material.clone());
    mesh.position.set(
      nodeData.position.x,
      nodeData.position.y,
      nodeData.position.z
    );
    
    // Add shadow casting
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // Add to scene
    this.scene.add(mesh);
    
    // Store mesh
    this.nodes.set(nodeId, {
      mesh,
      data: nodeData
    });
    
    // Add animations
    this.setupNodeAnimations(nodeId);
  }
  
  /**
   * Update an existing node
   * @param {string} nodeId - Node ID
   * @param {Object} nodeData - Updated node data
   */
  updateNode(nodeId, nodeData) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    
    // Update position (if changed)
    if (
      node.data.position.x !== nodeData.position.x ||
      node.data.position.y !== nodeData.position.y ||
      node.data.position.z !== nodeData.position.z
    ) {
      node.mesh.position.set(
        nodeData.position.x,
        nodeData.position.y,
        nodeData.position.z
      );
    }
    
    // Update size (if changed)
    if (node.data.size !== nodeData.size) {
      // Remove old mesh
      this.scene.remove(node.mesh);
      
      // Determine new geometry
      let geometry;
      if (nodeData.size === 1) {
        geometry = this.geometries.small;
      } else if (nodeData.size === 2) {
        geometry = this.geometries.medium;
      } else {
        geometry = this.geometries.large;
      }
      
      // Create new mesh with same material
      const newMesh = new THREE.Mesh(geometry, node.mesh.material);
      newMesh.position.copy(node.mesh.position);
      newMesh.castShadow = true;
      newMesh.receiveShadow = true;
      
      // Add to scene
      this.scene.add(newMesh);
      
      // Update reference
      node.mesh = newMesh;
    }
    
    // Update material (if state changed)
    if (
      node.data.boosted !== nodeData.boosted ||
      node.data.disrupted !== nodeData.disrupted ||
      node.data.type !== nodeData.type
    ) {
      let material;
      
      if (nodeData.disrupted) {
        material = this.stateMaterials.DISRUPTED;
      } else if (nodeData.boosted) {
        material = this.stateMaterials.BOOSTED;
      } else {
        material = this.materials[nodeData.type] || this.materials.NORMAL;
      }
      
      node.mesh.material = material.clone();
    }
    
    // Update stored data
    node.data = nodeData;
  }
  
  /**
   * Remove a node
   * @param {string} nodeId - Node ID to remove
   */
  removeNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    
    // Remove from scene
    this.scene.remove(node.mesh);
    
    // Remove from storage
    this.nodes.delete(nodeId);
  }
  
  /**
   * Update connection lines between nodes
   * @param {Object} nodes - All nodes data
   */
  updateConnections(nodes) {
    // Remove old connections
    this.scene.remove(this.connectionLines);
    this.connectionLines = new THREE.Group();
    
    // Track processed connections to avoid duplicates
    const processedConnections = new Set();
    
    // Create lines for all connections
    for (const nodeId in nodes) {
      const nodeData = nodes[nodeId];
      const neighbors = nodeData.neighbors || [];
      
      for (const neighborId of neighbors) {
        // Create unique connection ID (sorted to avoid duplicates)
        const connectionKey = [nodeId, neighborId].sort().join('-');
        
        // Skip if already processed
        if (processedConnections.has(connectionKey)) continue;
        processedConnections.add(connectionKey);
        
        // Get node positions
        const node1 = this.nodes.get(nodeId);
        const node2 = this.nodes.get(neighborId);
        
        if (!node1 || !node2) continue;
        
        // Create line geometry
        const geometry = new THREE.BufferGeometry().setFromPoints([
          node1.mesh.position,
          node2.mesh.position
        ]);
        
        // Create line
        const line = new THREE.Line(geometry, this.lineMaterial);
        this.connectionLines.add(line);
      }
    }
    
    // Add connections to scene
    this.scene.add(this.connectionLines);
  }
  
  /**
   * Set up animations for a node
   * @param {string} nodeId - Node ID
   */
  setupNodeAnimations(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    
    // Add a subtle animation based on node type
    if (node.data.type === 'NEST') {
      // Pulsating animation for nest
      node.animation = {
        pulse: 0,
        update: (deltaTime) => {
          node.animation.pulse += deltaTime;
          const scale = 1 + 0.05 * Math.sin(node.animation.pulse * 2);
          node.mesh.scale.set(scale, scale, scale);
        }
      };
    } else if (node.data.type === 'FOOD_SOURCE') {
      // Gentle rotation for food sources
      node.animation = {
        rotation: 0,
        update: (deltaTime) => {
          node.animation.rotation += deltaTime * 0.5;
          node.mesh.rotation.y = node.animation.rotation;
        }
      };
    }
  }
  
  /**
   * Update all node animations
   * @param {number} deltaTime - Time since last frame
   */
  updateAnimations(deltaTime) {
    for (const node of this.nodes.values()) {
      if (node.animation && node.animation.update) {
        node.animation.update(deltaTime);
      }
    }
  }
  
  /**
   * Dispose of resources
   */
  dispose() {
    // Remove all nodes
    for (const nodeId of this.nodes.keys()) {
      this.removeNode(nodeId);
    }
    
    // Remove connection lines
    this.scene.remove(this.connectionLines);
    
    // Dispose of geometries
    for (const geometry of Object.values(this.geometries)) {
      geometry.dispose();
    }
    
    // Dispose of materials
    for (const material of Object.values(this.materials)) {
      material.dispose();
    }
    
    for (const material of Object.values(this.stateMaterials)) {
      material.dispose();
    }
    
    this.lineMaterial.dispose();
  }
}
