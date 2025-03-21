/**
 * Main rendering manager for AntNet
 * Handles scene setup and main rendering loop
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export default class Renderer {
  /**
   * Create a new renderer
   * @param {HTMLElement} container - DOM container for the renderer
   */
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    
    // Initialize components
    this.initScene();
    this.initCamera();
    this.initRenderer();
    this.initControls();
    this.initLights();
    
    // Set up window resize handler
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }
  
  /**
   * Initialize the scene
   */
  initScene() {
    this.scene.background = new THREE.Color(0x111122);
    
    // Add a grid helper for reference
    const grid = new THREE.GridHelper(100, 100);
    this.scene.add(grid);
  }
  
  /**
   * Initialize the camera
   */
  initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      75, window.innerWidth / window.innerHeight, 0.1, 1000
    );
    this.camera.position.set(0, 30, 30);
    this.camera.lookAt(0, 0, 0);
  }
  
  /**
   * Initialize the WebGL renderer
   */
  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    
    this.container.appendChild(this.renderer.domElement);
  }
  
  /**
   * Initialize camera controls
   */
  initControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
  }
  
  /**
   * Initialize scene lighting
   */
  initLights() {
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040);
    this.scene.add(ambientLight);
    
    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    
    // Configure shadow properties
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    
    this.scene.add(directionalLight);
  }
  
  /*
