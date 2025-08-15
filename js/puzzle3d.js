// puzzle3d.js - Sistema completo de tangram con animaciones
import { PIECES, TANGRAM_PIECES } from './data.js';

// Constantes de escala (30% más chico => 70% del tamaño original)
const TANGRAM_SCALE = 2.1;       // antes 3
const SCATTER_RADIUS = 8.4;      // antes 12
const BASE_GROUP_SCALE = 4.2;    // antes 6
const FINAL_GROUP_SCALE = 6.3;   // antes 9

class Puzzle3D {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.pieces = new Map();
    this.obtainedPieces = {};
    this.container = null;
    this.animationFrame = null;
    this.initialized = false;
    this.isAssembling = false;
    this.finalSquarePosition = { x: 0, y: 0, z: 0 };
    
    // Inicializar con retry
    this.initWithRetry();
  }

  initWithRetry() {
    // Esperar a que todo esté listo
    const tryInit = () => {
      if (typeof THREE === 'undefined') {
        console.log('🔄 Esperando THREE.js...');
        setTimeout(tryInit, 500);
        return;
      }
      
      this.container = document.getElementById('puzzle-3d-canvas');
      if (!this.container) {
        console.log('🔄 Esperando contenedor 3D...');
        setTimeout(tryInit, 500);
        return;
      }
      
      console.log('✅ Inicializando 3D...');
      this.init();
    };
    
    // Empezar después de que el DOM esté listo
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', tryInit);
    } else {
      tryInit();
    }
  }

  init() {
    try {
      // Limpiar contenedor
      this.container.innerHTML = '';
      
      // Scene setup con fondo transparente
      this.scene = new THREE.Scene();
      this.scene.background = null; // Fondo transparente

      // Camera setup - ORTOGRÁFICA COMO EN EL EJEMPLO
      const aspect = this.container.clientWidth / this.container.clientHeight || 1;
      const frustumSize = 13.5; // Ajustado para cuadrado de 4x4 unidades con escala 3x (4*3 = 12, más margen)
      this.camera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        frustumSize / -2,
        1,
        1000
      );
      this.camera.position.set(0, 0, 5); // Posición similar al ejemplo
      this.scene.add(this.camera);

      // Renderer setup optimizado para objetos sólidos
      this.renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance"
      });
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.setSize(this.container.clientWidth || 400, this.container.clientHeight || 300);
      this.renderer.shadowMap.enabled = false;
      this.renderer.sortObjects = false; // Desactivar sorting que puede causar problemas
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limitar pixel ratio
      
      // Configuraciones adicionales para evitar artefactos
  this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  this.renderer.toneMappingExposure = 1.25;
  this.renderer.physicallyCorrectLights = true;
      
      // Agregar canvas al contenedor
      this.container.appendChild(this.renderer.domElement);

      // Lighting
      this.setupLighting();

      // Crear piezas de tangram
      this.createTangramPieces();

      // Iniciar animación
      this.animate();

      // Handle resize
      window.addEventListener('resize', () => this.onWindowResize());
      
      this.initialized = true;
      console.log('✅ 3D Tangram inicializado correctamente');
      
    } catch (error) {
      console.error('❌ Error inicializando 3D:', error);
    }
  }

  setupLighting() {
  // Iluminación para PBR: hemisférica + direccionales suaves
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.95);
  hemi.position.set(0, 1, 0);
  this.scene.add(hemi);

  const dir1 = new THREE.DirectionalLight(0xffffff, 1.3);
  dir1.position.set(5, 10, 7.5);
  this.scene.add(dir1);

  const dir2 = new THREE.DirectionalLight(0xffffff, 0.6);
  dir2.position.set(-5, -2, -5);
  this.scene.add(dir2);

  const ambient = new THREE.AmbientLight(0xffffff, 0.12);
  this.scene.add(ambient);
  }

  // Función para asegurar que los vértices estén en orden counter-clockwise
  ensureCounterClockwise(vertices) {
    // Calcular el área usando la fórmula shoelace
    let area = 0;
    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length;
      area += vertices[i][0] * vertices[j][1];
      area -= vertices[j][0] * vertices[i][1];
    }
    
    // Si el área es negativa, los vértices están en orden clockwise, necesitamos invertir
    if (area < 0) {
      return vertices.slice().reverse();
    }
    return vertices;
  }

  createTangramPieces() {
    Object.entries(TANGRAM_PIECES).forEach(([pieceId, pieceData]) => {
      const mesh = this.createTangramMesh(pieceId, pieceData);
      this.pieces.set(pieceId, mesh);
      this.scene.add(mesh);
    });
    
    console.log(`🧩 Creadas ${this.pieces.size} piezas de tangram`);
  }

  createTangramMesh(pieceId, pieceData) {
    // Asegurar orden correcto de vértices (counter-clockwise)
    const vertices = this.ensureCounterClockwise(pieceData.vertices);
    
    // Crear geometría del polígono con orientación correcta
    const shape = new THREE.Shape();
    
    // Crear el polígono correctamente
    shape.moveTo(vertices[0][0], vertices[0][1]);
    for (let i = 1; i < vertices.length; i++) {
      shape.lineTo(vertices[i][0], vertices[i][1]);
    }
    
    // Crear geometría extruida - COMPLETAMENTE SÓLIDA
    const extrudeSettings = {
      depth: 0.3,
      bevelEnabled: false,
      bevelSegments: 0,
      bevelSize: 0,
      bevelThickness: 0,
      steps: 1,
      curveSegments: 12
    };
    
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    
    // Asegurar normales correctas
    geometry.computeVertexNormals();
    geometry.normalizeNormals();
    
    // Material PBR para realismo (sin brillos ni outlines extra)
    const material = new THREE.MeshStandardMaterial({
      color: pieceData.color,
      roughness: 0.35,
      metalness: 0.15,
      flatShading: false,
      side: THREE.DoubleSide
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Configurar posición inicial (dispersa) - MÁS LEJOS PARA PIEZAS GRANDES
  const angle = (parseInt(pieceId.split('_')[1]) - 1) * (Math.PI * 2 / 7);
  const radius = SCATTER_RADIUS;
    mesh.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      Math.random() * 2 - 1
    );
    // SIN ROTACIÓN INICIAL - las piezas mantienen su orientación original
    
  // Escalar piezas (30% más chicas que antes)
  mesh.scale.set(TANGRAM_SCALE, TANGRAM_SCALE, TANGRAM_SCALE);
    
    mesh.userData.pieceId = pieceId;
    mesh.userData.pieceData = pieceData;
    mesh.userData.initialPosition = mesh.position.clone();
    mesh.userData.initialRotation = mesh.rotation.clone();
    mesh.visible = false;
    // mesh.scale se mantiene como está establecido arriba (3, 3, 3)
    
  // Sin bordes ni outlines adicionales: solo pieza sólida con su color
    
    return mesh;
  }

  revealPiece(pieceId) {
    console.log(`🎨 Revelando pieza de tangram: ${pieceId}`);
    
    this.obtainedPieces[pieceId] = true;
    
    if (!this.initialized || !this.pieces.has(pieceId)) {
      console.warn('3D no listo o pieza no encontrada:', pieceId);
      this.updatePiecesCount();
      return;
    }
    
    const mesh = this.pieces.get(pieceId);
    mesh.visible = true;
    
    // Animación de "vuelo" dramática hacia el grupo
    this.playFlyingAnimation(mesh, () => {
      // Después del vuelo, unirse al grupo progresivamente
      this.addPieceToGroup(pieceId);
      this.updatePiecesCount();
    });
  }

  playFlyingAnimation(mesh, callback) {
    const startTime = performance.now();
    const duration = 3000; // 3 segundos de vuelo dramático
    const startRot = mesh.rotation.clone();

    // Posición de inicio fuera de eje para evitar solapamientos (arriba y al frente)
    const idx = parseInt(mesh.userData.pieceId.split('_')[1]) - 1;
    const xLane = (idx - 3) * (BASE_GROUP_SCALE * 0.8);
    const yStart = BASE_GROUP_SCALE * 6; // bastante arriba
    const zStart = 18 + idx * 1.2; // al frente y escalonado
    const startPos = new THREE.Vector3(xLane, yStart, zStart);

    // Fijar inmediatamente posición y escala de inicio para evitar "saltos"
    mesh.position.copy(startPos);
    mesh.scale.setScalar(0.001);
    
    // Determinar posición de destino según las piezas ya obtenidas
    const obtainedCount = Object.keys(this.obtainedPieces).length;
    const targetPos = this.calculateGroupPosition(mesh.userData.pieceId, obtainedCount);
    
    // Posición intermedia de vuelo (más alta y dramática)
    const flyHeight = BASE_GROUP_SCALE * 1.2;
    const flyPosition = new THREE.Vector3(
      (startPos.x + targetPos.x) * 0.5,
      Math.max(startPos.y, targetPos.y) + flyHeight,
      (startPos.z + 2)
    );
    
    const animateFly = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing suavizado
      const easeInOutCubic = (t) => (t < 0.5)
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const t = easeInOutCubic(progress);

      // Aparición con escala (ease-out) hasta TANGRAM_SCALE
      const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
      const scaleT = easeOutCubic(Math.min(progress / 0.25, 1));
      mesh.scale.setScalar(THREE.MathUtils.lerp(0.001, TANGRAM_SCALE, scaleT));

      // Trayectoria Bezier cuadrática para movimiento suave
      const p01 = startPos.clone().lerp(flyPosition, t);
      const p12 = flyPosition.clone().lerp(targetPos, t);
      const pos = p01.lerp(p12, t);
      mesh.position.copy(pos);

      // Rotación suave que vuelve a 0 al final (sin salto)
      const spinTurns = 1.25 + idx * 0.05;
      mesh.rotation.z = Math.sin(t * Math.PI) * spinTurns * Math.PI * 2;
      
      if (progress < 1) {
        requestAnimationFrame(animateFly);
      } else {
  // Finalizar vuelo - ya está en posición de grupo
        mesh.userData.isFlying = false;
        mesh.userData.isInGroup = true;
        mesh.userData.isStatic = true; // Completamente estática
        mesh.userData.floatOffset = 0; // Sin flotación
        // Orientación final ya es 0 por la función de giro
        
        console.log(`✨ Pieza ${mesh.userData.pieceId} se unió al grupo y está estática!`);
        if (callback) callback();
      }
    };
    
    mesh.userData.isFlying = true;
    requestAnimationFrame(animateFly);
  }

  calculateGroupPosition(pieceId, totalPieces) {
    // Calcular posición en el grupo progresivo
  const pieceData = TANGRAM_PIECES[pieceId];
    const finalPos = pieceData.finalPosition;
    
    // Escalar el cuadrado según las piezas obtenidas - MUCHO MÁS GRANDE
  const baseScale = BASE_GROUP_SCALE;
    const completionScale = Math.min(totalPieces / 7, 1); // Factor de completitud
    const currentScale = baseScale * (0.3 + 0.7 * completionScale); // Entre 30% y 100%
    
    // Posición final escalada
    return new THREE.Vector3(
      finalPos.x * currentScale,
      finalPos.y * currentScale,
      0
    );
  }

  addPieceToGroup(pieceId) {
    console.log(`🧩 Agregando pieza ${pieceId} al grupo`);
    
    const mesh = this.pieces.get(pieceId);
    if (!mesh) return;
    
    // Animar rotación hacia la posición final
    const pieceData = mesh.userData.pieceData;
    // SIN ROTACIÓN - las piezas mantienen su orientación original
    
    const duration = 1500;
    const startTime = performance.now();
    
    const animatePosition = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 2);
      
  // SIN ROTACIONES ni efectos de brillo: piezas sólidas únicamente
      
      if (progress < 1) {
        requestAnimationFrame(animatePosition);
      } else {
        mesh.userData.isStatic = true; // Pieza completamente estática en el grupo
        
        // Verificar si el cuadrado está completo
        if (Object.keys(this.obtainedPieces).length === 7) {
          setTimeout(() => {
            this.playFinalAssembly();
          }, 1000);
        }
      }
    };
    
    requestAnimationFrame(animatePosition);
  }

  assembleSquare() {
    // Esta función ahora es llamada playFinalAssembly
    this.playFinalAssembly();
  }

  playFinalAssembly() {
    console.log('🎯 Ensamblaje final del cuadrado completo...');
    this.isAssembling = true;
    
    const assemblyDuration = 3000; // 3 segundos para el ensamblaje final
    const startTime = performance.now();
    
    const animateAssembly = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / assemblyDuration, 1);
      const easeInOut = 0.5 * (1 - Math.cos(progress * Math.PI));
      
      // Mover cada pieza a su posición exacta final
      this.pieces.forEach((mesh, pieceId) => {
        if (this.obtainedPieces[pieceId]) {
          const pieceData = mesh.userData.pieceData;
          const finalPos = pieceData.finalPosition;
          
          // Posición final exacta del cuadrado completo - MUY GRANDE
          const finalScale = FINAL_GROUP_SCALE; // 30% más chico que antes
          const targetPos = new THREE.Vector3(
            finalPos.x * finalScale,
            finalPos.y * finalScale,
            0
          );
          
          // Interpolar a posición exacta
          mesh.position.lerp(targetPos, easeInOut * 0.2);
          
          // SIN ROTACIONES ni efectos adicionales: piezas sólidas únicamente
        }
      });
      
      if (progress < 1) {
        requestAnimationFrame(animateAssembly);
      } else {
        // Ensamblaje completado
        this.isAssembling = false;
        this.pieces.forEach((mesh) => {
          mesh.userData.isFloating = false;
          mesh.userData.isInGroup = false;
          mesh.userData.isAssembled = true;
          mesh.userData.isStatic = true; // Completamente estática
        });
        
        console.log('✅ ¡Cuadrado de tangram perfectamente ensamblado!');
        
        // Celebración final
        this.playSquareCompletionCelebration();
      }
    };
    
    requestAnimationFrame(animateAssembly);
  }

  playSquareCompletionCelebration() {
    console.log('🎉 ¡Celebración del cuadrado completado!');
    
    const duration = 3000;
    const startTime = performance.now();
    
    const celebrate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Sin cambios de color ni brillos: mantener piezas sólidas con su color
      this.pieces.forEach((mesh, pieceId) => {
        if (this.obtainedPieces[pieceId]) {
          // Mantener escala estable
          mesh.scale.setScalar(TANGRAM_SCALE);
        }
      });
      
      if (progress < 1) {
        requestAnimationFrame(celebrate);
      } else {
        // Asegurar colores originales y escala estable
        this.pieces.forEach((mesh, pieceId) => {
          if (this.obtainedPieces[pieceId]) {
            const originalColor = mesh.userData.pieceData.color;
            mesh.material.color.setHex(originalColor);
            mesh.scale.setScalar(TANGRAM_SCALE);
            mesh.userData.isStatic = true; // Mantener estáticas después de celebración
          }
        });
        
        console.log('🏆 ¡Tangram completado con éxito!');
      }
    };
    
    requestAnimationFrame(celebrate);
  }

  animate() {
    if (!this.renderer || !this.scene || !this.camera) return;
    
    this.animationFrame = requestAnimationFrame(() => this.animate());
    
    const time = performance.now() * 0.001;
    
    // Animar piezas según su estado
    this.pieces.forEach((mesh, pieceId) => {
      if (this.obtainedPieces[pieceId] && mesh.visible) {
        
        // Solo las piezas que están volando se mueven
        if (mesh.userData.isFlying) {
          // Las animaciones de vuelo ya están manejadas en playFlyingAnimation
          return;
        }
        
        // Las piezas en grupo y ensambladas permanecen completamente estáticas
        if (mesh.userData.isInGroup || mesh.userData.isAssembled || mesh.userData.isStatic) {
          // Sin movimiento, sin flotación, sin rotación
          return;
        }
      }
    });
    
    // Oscilación suave de la cámara (±15°) solo si no estamos ensamblando
    if (!this.isAssembling) {
      const r = 15;
      const maxAngle = THREE.MathUtils.degToRad(15);
      const a = Math.sin(time * 0.3) * maxAngle;
      this.camera.position.x = Math.sin(a) * r;
      this.camera.position.z = Math.cos(a) * r;
      this.camera.lookAt(0, 0, 0);
    }
    
    this.renderer.render(this.scene, this.camera);
  }

  updatePiecesCount() {
    const count = Object.values(this.obtainedPieces).filter(Boolean).length;
    const counterEl = document.getElementById('pieces-count');
    if (counterEl) {
      counterEl.textContent = `${count}/7`;
    }
  }

  syncState(obtained) {
    console.log('🔄 Sincronizando estado 3D tangram:', obtained);
    this.obtainedPieces = { ...obtained };
    
    if (!this.initialized) {
      this.updatePiecesCount();
      return;
    }
    
    // Revelar piezas ya obtenidas y agruparlas progresivamente
    const obtainedKeys = Object.keys(obtained).filter(key => obtained[key]);
    
    obtainedKeys.forEach((pieceId, index) => {
      if (this.pieces.has(pieceId)) {
        const mesh = this.pieces.get(pieceId);
        if (!mesh.visible) {
          // Simular el proceso de obtención con delay
          setTimeout(() => {
            mesh.visible = true;
            mesh.scale.set(TANGRAM_SCALE, TANGRAM_SCALE, TANGRAM_SCALE);
            
            // Posicionar en el grupo directamente
            const groupPos = this.calculateGroupPosition(pieceId, index + 1);
            mesh.position.copy(groupPos);
            
            // Configurar estado de grupo estático
            mesh.userData.isInGroup = true;
            mesh.userData.isStatic = true; // Sin movimiento
            mesh.userData.floatOffset = 0; // Sin flotación
            
            // SIN ROTACIÓN - mantener orientación original
            // Las piezas se posicionan sin rotar
            
          }, index * 500); // Delay progresivo
        }
      }
    });
    
    this.updatePiecesCount();
    
    // Si todas las piezas ya están obtenidas, ensamblar después de un delay
    if (obtainedKeys.length === 7) {
      setTimeout(() => {
        if (!this.isAssembling) {
          this.playFinalAssembly();
        }
      }, obtainedKeys.length * 500 + 1000);
    }
  }

  playCompletionAnimation(callback) {
    console.log('🎉 Animación de completado del tangram!');
    
    if (!this.initialized) {
      if (callback) setTimeout(callback, 100);
      return;
    }
    
    // Si no está ensamblado, ensamblarlo primero
    if (!this.isAssembling && Object.keys(this.obtainedPieces).length === 7) {
      this.playFinalAssembly();
    }
    
    setTimeout(() => {
      this.playSquareCompletionCelebration();
      if (callback) {
        setTimeout(callback, 3000);
      }
    }, this.isAssembling ? 3000 : 0);
  }

  onWindowResize() {
    if (!this.container || !this.camera || !this.renderer) return;
    
    const width = this.container.clientWidth || 400;
    const height = this.container.clientHeight || 300;
    const aspect = width / height;
    const frustumSize = 13.5;
    
    // Actualizar cámara ortográfica
    this.camera.left = frustumSize * aspect / -2;
    this.camera.right = frustumSize * aspect / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = frustumSize / -2;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
  }

  highlightPiece(pieceId) {
    const mesh = this.pieces.get(pieceId);
    if (!mesh || !this.obtainedPieces[pieceId]) {
      return; // Only highlight obtained pieces
    }

    // Store original color and material properties
    const originalColor = mesh.material.color.getHex();
    const originalEmissive = mesh.material.emissive.getHex();
    
    // Create highlight animation
    const duration = 2000; // 2 seconds
    const startTime = performance.now();
    
    const animateHighlight = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = elapsed / duration;
      
      if (progress < 1) {
        // Create pulsing glow effect
        const pulseValue = (Math.sin(progress * Math.PI * 4) + 1) * 0.5; // 0 to 1
        const glowIntensity = pulseValue * 0.3; // Adjust intensity
        
        // Apply highlight color (brighter version of original)
        mesh.material.emissive.setHex(0x4CAF50);
        mesh.material.emissiveIntensity = glowIntensity;
        
        // Slightly scale the piece
        const scaleMultiplier = 1 + pulseValue * 0.1;
        mesh.scale.setScalar(TANGRAM_SCALE * scaleMultiplier);
        
        requestAnimationFrame(animateHighlight);
      } else {
        // Reset to original state
        mesh.material.emissive.setHex(originalEmissive);
        mesh.material.emissiveIntensity = 0;
        mesh.scale.setScalar(TANGRAM_SCALE);
      }
    };
    
    requestAnimationFrame(animateHighlight);
  }

  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    if (this.renderer) {
      this.renderer.dispose();
    }
    
    window.removeEventListener('resize', this.onWindowResize);
  }
}

// Exportar instancia singleton
export const puzzle3DInstance = new Puzzle3D();
