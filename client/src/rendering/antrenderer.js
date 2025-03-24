// client/src/rendering/AntRenderer.js
import * as THREE from 'three';

/**
 * Handles rendering of ants in the environment
 */
export default class AntRenderer {
  /**
   * Create a new ant renderer
   * @param {THREE.Scene} scene - Three.js scene to add ants to
   */
  constructor(scene) {
    this.scene = scene;
    this.ants = new Map(); // Map of antId -> mesh
    
    // Create ant geometry
    this.createAntGeometry();
    
    // Materials for different ant types
    this.materials = {
      'WORKER': new THREE.MeshStandardMaterial({
        color: 0xffaa00,
        emissive: 0x552200,
        roughness: 0.5,
        metalness: 0.2
      }),
      'SCOUT': new THREE.MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x005555,
        roughness: 0.4,
        metalness: 0.3
      }),
      'SOLDIER': new THREE.MeshStandardMaterial({
        color: 0xff5555,
        emissive: 0x550000,
        roughness: 0.6,
        metalness: 0.1
      })
    };
    
    // Container for all ants
    this.antGroup = new THREE.Group();
    this.scene.add(this.antGroup);
  }
  
  /**
   * Create ant geometry
   * Uses a simplified ant shape
   */
  createAntGeometry() {
    // Create a simple ant shape
    const bodyGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    const headGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const legGeometry = new THREE.CylinderGeometry(0.05, 0.03, 0.5, 4);
    
    // Merge geometries to create a single ant geometry
    this.antGeometry = new THREE.BufferGeometry();
    
    // Position adjustments for parts
    const head = headGeometry.clone();
    head.translate(0, 0, 0.4);
    
    const body = bodyGeometry.clone();
    
    // Legs
    const frontLeftLeg = legGeometry.clone();
    frontLeftLeg.rotateX(Math.PI / 4);
    frontLeftLeg.rotateZ(-Math.PI / 4);
    frontLeftLeg.translate(0.3, 0, 0.3);
    
    const frontRightLeg = legGeometry.clone();
    frontRightLeg.rotateX(Math.PI / 4);
    frontRightLeg.rotateZ(Math.PI / 4);
    frontRightLeg.translate(-0.3, 0, 0.3);
    
    const midLeftLeg = legGeometry.clone();
    midLeftLeg.rotateZ(-Math.PI / 3);
    midLeftLeg.translate(0.35, 0, 0);
    
    const midRightLeg = legGeometry.clone();
    midRightLeg.rotateZ(Math.PI / 3);
    midRightLeg.translate(-0.35, 0, 0);
    
    const backLeftLeg = legGeometry.clone();
    backLeftLeg.rotateX(-Math.PI / 4);
    backLeftLeg.rotateZ(-Math.PI / 4);
    backLeftLeg.translate(0.3, 0, -0.3);
    
    const backRightLeg = legGeometry.clone();
    backRightLeg.rotateX(-Math.PI / 4);
    backRightLeg.rotateZ(Math.PI / 4);
    backRightLeg.translate(-0.3, 0, -0.3);
    
    // Combine all parts
    const geometries = [
      head, body, 
      frontLeftLeg, frontRightLeg,
      midLeftLeg, midRightLeg,
      backLeftLeg, backRightLeg
    ];
    
    this.antGeometry = THREE.BufferGeometryUtils.mergeBufferGeometries(geometries);
  }
  
  /**
   * Update ants based on render data
   * @param {Array} antData - Ant render data
   */
  update(antData) {
    // Track existing ants to remove outdated ones
    const currentAnts = new Set();
    
    // Update or create ants
    for (const ant of antData) {
      currentAnts.add(ant.id);
      
      if (this.ants.has(ant.id)) {
        // Update existing ant
        this.updateAnt(ant.id, ant);
      } else {
        // Create new ant
        this.createAnt(ant.id, ant);
      }
    }
    
    // Remove ants that no longer exist
    for (const antId of this.ants.keys()) {
      if (!currentAnts.has(antId)) {
        this.removeAnt(antId);
      }
    }
  }
  
  /**
   * Create a new ant mesh
   * @param {string} antId - Ant ID
   * @param {Object} antData - Ant data
   */
  createAnt(antId, antData) {
    // Get material based on ant role
    const material = this.materials[antData.role] || this.materials.WORKER;
    
    // Create mesh
    const mesh = new THREE.Mesh(this.antGeometry, material.clone());
    
    // Set position and rotation
    mesh.position.copy(antData.position);
    if (antData.rotation) {
      mesh.quaternion.copy(antData.rotation);
    }
    
    // Set scale
    const scale = antData.scale || 1;
    mesh.scale.set(scale, scale, scale);
    
    // Add shadow casting
    mesh.castShadow = true;
    
    // Create carrier object (for food carrying visualization)
    const carrierGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    const carrierMaterial = new THREE.MeshStandardMaterial({
      color: 0x22dd22,
      emissive: 0x115511
    });
    
    const carrier = new THREE.Mesh(carrierGeometry, carrierMaterial);
    carrier.position.set(0, 0.3, 0);
    carrier.visible = antData.carrying === 'FOOD';
    
    mesh.add(carrier);
    
    // Add to group
    this.antGroup.add(mesh);
    
    // Store reference
    this.ants.set(antId, {
      mesh,
      carrier,
      data: antData
    });
  }
  
  /**
   * Update an existing ant
   * @param {string} antId - Ant ID
   * @param {Object} antData - Updated ant data
   */
  updateAnt(antId, antData) {
    const ant = this.ants.get(antId);
    if (!ant) return;
    
    // Update position
    ant.mesh.position.copy(antData.position);
    
    // Update rotation
    if (antData.rotation) {
      ant.mesh.quaternion.copy(antData.rotation);
    }
    
    // Update scale
    if (antData.scale !== ant.data.scale) {
      const scale = antData.scale || 1;
      ant.mesh.scale.set(scale, scale, scale);
    }
    
    // Update carrier visibility based on carrying state
    ant.carrier.visible = antData.carrying === 'FOOD';
    
    // Update material if role changed
    if (antData.role !== ant.data.role) {
      const material = this.materials[antData.role] || this.materials.WORKER;
      ant.mesh.material = material.clone();
    }
    
    // Update stored data
    ant.data = antData;
  }
  
  /**
   * Remove an ant
   * @param {string} antId - Ant ID to remove
   */
  removeAnt(antId) {
    const ant = this.ants.get(antId);
    if (!ant) return;
    
    // Remove from group
    this.antGroup.remove(ant.mesh);
    
    // Remove from storage
    this.ants.delete(antId);
  }
  
  /**
   * Dispose of resources
   */
  dispose() {
    // Remove all ants
    for (const antId of this.ants.keys()) {
      this.removeAnt(antId);
    }
    
    // Remove ant group
    this.scene.remove(this.antGroup);
    
    // Dispose of geometries and materials
    this.antGeometry.dispose();
    
    for (const material of Object.values(this.materials)) {
      material.dispose();
    }
  }
}
