// svg-animation.js
// SVG zoom animation system for trivia completion
import { STORAGE_KEY } from 'data.js';

export class SVGAnimationSystem {
  constructor() {
    this.svgContainer = null;
    this.svgElement = null;
    this.isAnimating = false;
    this.shouldShowFinalForm = false;
    this.isNavigationMode = false; // New: tracks if we're in navigation mode
    this.currentZoomedRoom = null; // New: tracks which room is currently zoomed
  this.lastAnimatedPieceId = null; // New: remembers the last piece shown via animation (non-navigation)
  this._rectHitHandler = null; // New: svg-level click handler for rect hit testing
    
    // Mapping from piece IDs to SVG regions (coordinates extracted from actual locked layers)
    this.pieceRegions = {
      'piece_1': {
        // Op Recovery - Locked_Op_Recovery_BACK coordinates
        zoomTarget: { x: 58, y: 692, width: 415, height: 173 },
        lockedLayer: 'Locked_Op_Recovery_BACK',
        unlockedLayer: 'Unlocked_Op_Recovery_FRONT'
      },
      'piece_2': {
        // Pediatrics - Locked_Pediatrics_BACK coordinates  
        zoomTarget: { x: 685, y: 312, width: 206, height: 173 },
        lockedLayer: 'Locked_Pediatrics_BACK',
        unlockedLayer: 'Unlocked_Pediatrics_FRONT'
      },
      'piece_3': {
        // ICU - Locked_ICU_BACK coordinates
        zoomTarget: { x: 896, y: 312, width: 194, height: 173 },
        lockedLayer: 'Locked_ICU_BACK',
        unlockedLayer: 'Unlocked_ICU_FRONT'
      },
      'piece_4': {
        // Behavioral - Locked_Behavioral_BACK coordinates
        zoomTarget: { x: 1096, y: 312, width: 191, height: 173 },
        lockedLayer: 'Locked_Behavioral_BACK',
        unlockedLayer: 'Unlocked_Behavioral_FRONT'
      },
      'piece_5': {
        // Operating - Locked_Operating_BACK coordinates
        zoomTarget: { x: 684, y: 490, width: 309, height: 173 },
        lockedLayer: 'Locked_Operating_BACK',
        unlockedLayer: 'Unlocked_Operating_FRONT'
      },
      'piece_6': {
        // Med Surgical - Locked_MedSurgical_BACK coordinates
        zoomTarget: { x: 998, y: 490, width: 288, height: 173 },
        lockedLayer: 'Locked_MedSurgical_BACK',
        unlockedLayer: 'Unlocked_MedSurgical_FRONT'
      },
      'piece_7': {
        // Emergency - Locked_Emergency_BACK coordinates
        zoomTarget: { x: 684, y: 670, width: 437, height: 176 },
        lockedLayer: 'Locked_Emergency_BACK',
        unlockedLayer: 'Unlocked_Emergency_FRONT'
      }
    };

    // Room info copy shown in the info panel; fill incrementally as copy is provided
    this.roomInfo = {
      // Provided now
      'piece_1': {
        title: 'Outpatient Center',
        text: 'Our web-based platform can be utilized from any device type, making connecting with outpatient centers on the same platform a breeze'
      },
      // Stubs (can be updated with exact copy later)
  'piece_2': { title: 'Pediatrics', text: 'Did you know virtual care has been proven to help with eating disorder patients? A common pediatric use case.' },
      'piece_3': { title: 'ICU', text: 'Integration with eICU technology makes AvaSure a prime choice in the ICU setting' },
  'piece_4': { title: 'Behavioral Health', text: 'Ligature-free devices ensure patient safety during observation of behavioral health patients' },
  'piece_5': { title: 'Operating Room', text: 'Ambient AI helps keep ORs running smoothly' },
  'piece_6': { title: 'Med/Surg Patient Room', text: 'Connect the AvaSure platform with IPCs, EHRs and other in-room technology to enable a smart patient room' },
  'piece_7': { title: 'Emergency Room', text: 'Specialty consults in the ER can help prevent patient leakage by improving care access' }
    };
  }

  async init() {
    console.log('🎨 Initializing SVG Animation System');
    await this.createSVGContainer();
    await this.loadSVG();
  }

  createSVGContainer() {
    // Create a full-screen overlay for the SVG animation with framed interface
    this.svgContainer = document.createElement('div');
    this.svgContainer.id = 'svg-animation-container';
    this.svgContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: #16252E;
      z-index: 1000;
      display: none;
      opacity: 0;
      transition: opacity 0.5s ease-in-out;
      overflow: auto;
      padding: 10px;
      box-sizing: border-box;
    `;
    
    // Create the success banner
    const successBanner = document.createElement('div');
    successBanner.className = 'svg-success-banner';
    successBanner.style.cssText = `
      background: linear-gradient(135deg, #FF8A50, #FF6B2C);
      border-radius: 30px;
      padding: 8px 16px;
      text-align: center;
      color: white;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 10px;
      max-width: 280px;
      width: auto;
      flex-shrink: 0;
      margin-left: auto;
      margin-right: auto;
    `;
    successBanner.textContent = 'You got another piece!';
    
    // Create the SVG frame container
    const svgFrame = document.createElement('div');
    svgFrame.className = 'svg-frame';
    svgFrame.style.cssText = `
      background: white;
      border-radius: 16px;
      padding: 6px;
      margin-bottom: 10px;
      max-width: 85vw;
      width: 100%;
      max-height: 50vh;
      height: 45vh;
      margin-left: auto;
      margin-right: auto;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      position: relative;
      overflow: visible;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    // Create info button (hidden; no longer used for toggling)
    const infoButton = document.createElement('div');
    infoButton.className = 'svg-info-button';
    infoButton.style.cssText = `
      background: #35D3D3;
      border-radius: 30px;
      padding: 8px 16px;
      text-align: center;
      color: white;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 8px;
      max-width: 250px;
      width: auto;
      cursor: pointer;
      flex-shrink: 0;
      margin-left: auto;
      margin-right: auto;
      display: none;
    `;
    infoButton.textContent = 'Info';
    // Store ref
    this.infoButton = infoButton;

    // Create info panel (hidden by default)
    const infoPanel = document.createElement('div');
    infoPanel.className = 'svg-info-panel';
    infoPanel.style.cssText = `
      display: block;
      background: #0F1B21;
      color: #E9F7F7;
      border: 1px solid rgba(53, 211, 211, 0.35);
      border-radius: 12px;
      padding: 12px 14px;
      max-width: 85vw;
      margin: 6px auto 10px;
      line-height: 1.35;
      box-shadow: 0 6px 18px rgba(0,0,0,0.25);
    `;
    // Body
    const panelBody = document.createElement('div');
    panelBody.className = 'svg-info-body';
    panelBody.style.cssText = `
      font-size: 13px;
      opacity: 0.95;
    `;
    // Initial generic message
    panelBody.textContent = 'Tap a room to zoom in and learn more.';
    infoPanel.appendChild(panelBody);
    
    // Create back button
    const backButton = document.createElement('button');
    backButton.className = 'svg-back-button';
    backButton.style.cssText = `
      background: transparent;
      border: 2px solid #FF8A50;
      border-radius: 30px;
      padding: 8px 16px;
      color: #FF8A50;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      max-width: 200px;
      width: auto;
      transition: all 0.3s ease;
      flex-shrink: 0;
      margin-left: auto;
      margin-right: auto;
      display: block;
    `;
    backButton.textContent = 'Back to Main Menu';
    
    // Add hover effect to back button
    backButton.addEventListener('mouseenter', () => {
      backButton.style.background = '#FF8A50';
      backButton.style.color = 'white';
    });
    backButton.addEventListener('mouseleave', () => {
      backButton.style.background = 'transparent';
      backButton.style.color = '#FF8A50';
    });
    
    // Add click handler to back button (zoom out then fade)
    backButton.addEventListener('click', () => {
      this.hideSVGAnimation();
    });
    
    this.svgContainer.appendChild(successBanner);
    this.svgContainer.appendChild(svgFrame);
  this.svgContainer.appendChild(infoButton);
  this.svgContainer.appendChild(infoPanel);
    this.svgContainer.appendChild(backButton);
    
    // Store references
    this.svgFrame = svgFrame;
  this.backButton = backButton;
  this.infoPanel = infoPanel;
  this.infoPanelBody = panelBody;
    
    document.body.appendChild(this.svgContainer);
  }

  async loadSVG() {
    try {
      const response = await fetch('assets/AvaSureDollhouseGraphics_Optimized 3.svg');
      const svgText = await response.text();

      // Create SVG wrapper
      const svgWrapper = document.createElement('div');
      svgWrapper.style.cssText = `
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
      `;

      svgWrapper.innerHTML = svgText;
      this.svgElement = svgWrapper.querySelector('svg');

      if (this.svgElement) {
        this.svgElement.style.cssText = `
          width: 100%;
          height: 100%;
          display: block;
          transform-origin: 0 0;
          transition: transform 1.5s ease-in-out;
          shape-rendering: geometricPrecision;
          text-rendering: geometricPrecision;
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
        `;
        // Ensure aspect ratio is preserved and content is centered
        this.svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        
        // Set viewBox if not present
        if (!this.svgElement.getAttribute('viewBox')) {
          const width = this.svgElement.getAttribute('width') || '1920';
          const height = this.svgElement.getAttribute('height') || '1280';
          this.svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
        }
        
        // Add better text rendering for all text elements
        const textElements = this.svgElement.querySelectorAll('text, tspan');
        textElements.forEach(textEl => {
          textEl.style.textRendering = 'geometricPrecision';
          textEl.style.shapeRendering = 'geometricPrecision';
        });
      }

      // Add SVG to the frame container instead of the main container
      this.svgFrame.appendChild(svgWrapper);
      console.log('🎨 SVG loaded successfully');

      // Apply unlocked state from storage
      this.applyUnlockedStateFromStorage();
    } catch (error) {
      console.error('❌ Failed to load SVG:', error);
    }
  }

  async showSVGAnimation(pieceId) {
    if (this.isAnimating || !this.svgContainer || !this.svgElement) {
      console.log('🎨 Animation already in progress or SVG not ready');
      return;
    }

    const region = this.pieceRegions[pieceId];
    if (!region) {
      console.log(`🎨 No region defined for piece ${pieceId}`);
      return;
    }

  // Remember the piece shown via animation for contextual info
  this.lastAnimatedPieceId = pieceId;

  this.isAnimating = true;
  console.log(`🎨 Starting SVG animation for ${pieceId}`);
  try {
      // Show the container with fade in and flex layout
      this.svgContainer.style.display = 'flex';
      this.svgContainer.style.flexDirection = 'column';
      this.svgContainer.style.justifyContent = 'center';
      this.svgContainer.style.alignItems = 'center';
      await this.wait(50);
      this.svgContainer.style.opacity = '1';
      
      // Wait for fade in to complete
      await this.wait(500);

  // Reset any previous transformations and prepare a subtle fade-in
  this.svgElement.style.transformOrigin = '0 0';
  this.svgElement.style.transition = 'opacity 300ms ease-out, filter 300ms ease-out, transform 2.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
  this.svgElement.style.opacity = '0';
  this.svgElement.style.filter = 'blur(0.6px)';
  // Add a tiny randomized intro offset so the zoom motion varies each time
  const introOffsetX = (Math.random() * 24 - 12); // -12..12 px
  const introOffsetY = (Math.random() * 24 - 12); // -12..12 px
  this.svgElement.style.transform = `scale(1) translate(${introOffsetX}px, ${introOffsetY}px)`;
  await this.wait(10);
  this.svgElement.style.opacity = '1';
  this.svgElement.style.filter = 'none';
  // allow the fade-in to complete before zoom
  await this.wait(320);
      await this.wait(300);

      // Calculate zoom transformation using the frame container
      const frameRect = this.svgFrame.getBoundingClientRect();
      const svgRect = this.svgElement.getBoundingClientRect();
      
      // Get SVG viewBox dimensions (original coordinates)
      const viewBox = this.svgElement.getAttribute('viewBox');
      let svgWidth = 1920, svgHeight = 1280; // Default dimensions
      if (viewBox) {
        const vb = viewBox.split(' ');
        svgWidth = parseFloat(vb[2]);
        svgHeight = parseFloat(vb[3]);
      }
      
      // Map viewBox -> viewport (pre-transform) using preserveAspectRatio='xMidYMid meet'
      // Baseline content scale (before our zoom): same for X/Y
      const baselineScale = Math.min(svgRect.width / svgWidth, svgRect.height / svgHeight);
      // Offsets due to centering inside the SVG viewport
      const offsetX0 = (svgRect.width - svgWidth * baselineScale) / 2;
      const offsetY0 = (svgRect.height - svgHeight * baselineScale) / 2;

      // Region size in pixels under baseline mapping
      const regionWidthPx = region.zoomTarget.width * baselineScale;
      const regionHeightPx = region.zoomTarget.height * baselineScale;

      // Our zoom factor so the region fits within the frame container
      const scaleX = frameRect.width / regionWidthPx;
      const scaleY = frameRect.height / regionHeightPx;
      // Slight random margin so it doesn't feel identical each time
      const marginJitter = 0.8 + (Math.random() * 0.06 - 0.03); // 0.77..0.83
      const scale = Math.min(scaleX, scaleY) * Math.max(0.75, Math.min(0.85, marginJitter));

      // Region center in pixels under baseline mapping (including centering offsets)
      const regionCenterPxX = offsetX0 + (region.zoomTarget.x + region.zoomTarget.width / 2) * baselineScale;
      const regionCenterPxY = offsetY0 + (region.zoomTarget.y + region.zoomTarget.height / 2) * baselineScale;

      // Translate so the scaled region center lands in the frame center
      const translateX = (frameRect.width / 2) - (regionCenterPxX * scale);
      const translateY = (frameRect.height / 2) - (regionCenterPxY * scale);

      // Apply zoom transformation
  this.svgElement.style.transformOrigin = '0 0';
  // Use scale first then translate to align with computed math
  this.svgElement.style.transform = `scale(${scale}) translate(${translateX/scale}px, ${translateY/scale}px)`;
      
      // Wait for zoom animation to complete
      await this.wait(2200);

      // Reveal the piece (fade out locked layer)
      await this.revealPiece(region);

      // Keep the SVG open - user must click "Back to Main Menu" to close
      console.log(`🎨 SVG animation completed for ${pieceId} - staying open for user interaction`);
      
      // Check if game is completed and show final form
      if (this.isGameCompleted()) {
        console.log('🎯 Game completed! Final form will show when user closes SVG view');
        // Store that we should show final form when SVG closes
        this.shouldShowFinalForm = true;
      }
  // Auto-show info for this piece
  this.showInfoForPiece(pieceId);
      
    } catch (error) {
      console.error('❌ SVG animation error:', error);
    } finally {
      this.isAnimating = false;
    }
  }

  async revealPiece(region) {
    // Hide the specific locked layer for this region
    if (region.lockedLayer) {
      // Try multiple selectors to find the locked layer
      const selectors = [
        `#${region.lockedLayer}`, // Direct ID match
        `[id="${region.lockedLayer}"]`, // Attribute selector
        `#7_Emergency #${region.lockedLayer}`, // Look inside 7_Emergency group
        `#7_Emergency [id="${region.lockedLayer}"]`, // Look inside 7_Emergency group with attribute
        `g[id*="Emergency"] #${region.lockedLayer}`, // Look inside any Emergency group
        `g[id*="Emergency"] [id="${region.lockedLayer}"]`, // Look inside any Emergency group with attribute
        `[id*="7_Emergency"] #${region.lockedLayer}`, // Look inside element containing 7_Emergency
        `[id*="7_Emergency"] [id="${region.lockedLayer}"]`, // Look inside element containing 7_Emergency with attribute
        `[id*="${region.lockedLayer}"]`, // ID containing the layer name
        `[class*="${region.lockedLayer}"]`, // Class containing the layer name
      ];
      
      let lockedElement = null;
      
      // Try each selector until we find the element
      for (const selector of selectors) {
        try {
          lockedElement = this.svgElement.querySelector(selector);
          if (lockedElement) {
            console.log(`🎨 Found locked layer with selector: ${selector}`);
            break;
          }
        } catch (e) {
          console.warn(`🎨 Invalid selector: ${selector}`);
        }
      }
      
      if (lockedElement) {
        console.log(`🎨 Hiding locked layer: ${region.lockedLayer}`);
        // Enhanced fade-out: slight scale-up + blur + fade
  lockedElement.style.willChange = 'transform, opacity, filter';
        lockedElement.style.transition = 'opacity 900ms ease, transform 900ms ease, filter 900ms ease';
        lockedElement.style.transformBox = 'fill-box';
        lockedElement.style.transformOrigin = '50% 50%';
        // Trigger effect on next frame
        requestAnimationFrame(() => {
          lockedElement.style.filter = 'blur(3px)';
          lockedElement.style.transform = 'scale(1.08) rotate(0.3deg)';
          lockedElement.style.opacity = '0';
        });
        // Hide after transition
        setTimeout(() => {
          if (lockedElement) {
            lockedElement.style.display = 'none';
            lockedElement.style.filter = '';
            lockedElement.style.transform = '';
          }
        }, 950);
      } else {
        console.log(`🎨 Locked layer not found: ${region.lockedLayer}. Trying fallback methods...`);
        
        // Fallback: try to find any element with "locked" and piece-specific identifiers
        const pieceNumber = region.lockedLayer.includes('Emergency') ? '7' : 
                           region.lockedLayer.includes('ICU') ? '2' :
                           region.lockedLayer.includes('MedSurg') ? '3' :
                           region.lockedLayer.includes('Behavioral') ? '4' :
                           region.lockedLayer.includes('Pediatrics') ? '5' :
                           region.lockedLayer.includes('Unit6') ? '6' :
                           region.lockedLayer.includes('Op_Recovery') ? '1' : '';
        
        const fallbackSelectors = [
          // Only look within the group that matches the numeric piece id
          `#${pieceNumber}_Emergency [id*="locked"], #${pieceNumber}_Emergency [id*="Locked"]`,
          `#${pieceNumber}_MedSurgical [id*="locked"], #${pieceNumber}_MedSurgical [id*="Locked"]`,
          `#${pieceNumber}_Operating [id*="locked"], #${pieceNumber}_Operating [id*="Locked"]`,
          `#${pieceNumber}_Behavioral [id*="locked"], #${pieceNumber}_Behavioral [id*="Locked"]`,
          `#${pieceNumber}_ICU [id*="locked"], #${pieceNumber}_ICU [id*="Locked"]`,
          `#${pieceNumber}_Pediatrics [id*="locked"], #${pieceNumber}_Pediatrics [id*="Locked"]`,
          `#${pieceNumber}_Op_Recovery [id*="locked"], #${pieceNumber}_Op_Recovery [id*="Locked"]`,
        ];
        
        let found = false;
        for (const selector of fallbackSelectors) {
          try {
            const elements = this.svgElement.querySelectorAll(selector);
            if (elements.length > 0) {
              console.log(`🎨 Found locked elements with fallback selector: ${selector} (${elements.length} elements)`);
              elements.forEach((el, index) => {
                console.log(`🎨 Hiding element ${index + 1}: ID="${el.id || 'no-id'}", Class="${el.className || 'no-class'}"`);
                el.style.willChange = 'transform, opacity, filter';
                el.style.transition = 'opacity 900ms ease, transform 900ms ease, filter 900ms ease';
                el.style.transformBox = 'fill-box';
                el.style.transformOrigin = '50% 50%';
                requestAnimationFrame(() => {
                  el.style.filter = 'blur(3px)';
                  el.style.transform = 'scale(1.08) rotate(0.3deg)';
                  el.style.opacity = '0';
                });
                setTimeout(() => {
                  if (el) {
                    el.style.display = 'none';
                    el.style.filter = '';
                    el.style.transform = '';
                  }
                }, 950);
              });
              found = true;
              break;
            }
          } catch (e) {
            console.warn(`🎨 Invalid fallback selector: ${selector}`);
          }
        }
        
        if (!found) {
          console.log(`🎨 No locked layer found for ${region.lockedLayer} - this might be expected if the SVG doesn't have locked layers`);
        }
      }
    }
    
    // Show the unlocked layer if it exists
    if (region.unlockedLayer) {
      const unlockedSelectors = [
        `#${region.unlockedLayer}`,
        `[id="${region.unlockedLayer}"]`,
        `#7_Emergency #${region.unlockedLayer}`,
        `#7_Emergency [id="${region.unlockedLayer}"]`,
        `g[id*="Emergency"] #${region.unlockedLayer}`,
        `g[id*="Emergency"] [id="${region.unlockedLayer}"]`,
        `[id*="7_Emergency"] #${region.unlockedLayer}`,
        `[id*="7_Emergency"] [id="${region.unlockedLayer}"]`
      ];
      
      let unlockedElement = null;
      
      for (const selector of unlockedSelectors) {
        try {
          unlockedElement = this.svgElement.querySelector(selector);
          if (unlockedElement) {
            console.log(`🎨 Found unlocked layer with selector: ${selector}`);
            break;
          }
        } catch (e) {
          console.warn(`🎨 Invalid unlocked selector: ${selector}`);
        }
      }
      
      if (unlockedElement) {
        console.log(`🎨 Showing unlocked layer: ${region.unlockedLayer}`);
        unlockedElement.style.opacity = '1';
        unlockedElement.style.display = 'block';
        unlockedElement.style.transition = 'opacity 1s ease-in';
      }
    }
    
    // No overlay banner; ripple + locked fade-out act as the feedback
  }  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStateFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : { obtained: {}, completed: false };
      // Normalize obtained values to booleans (handle legacy strings 'true'/'false')
      if (parsed && parsed.obtained && typeof parsed.obtained === 'object') {
        Object.keys(parsed.obtained).forEach(k => {
          const v = parsed.obtained[k];
          if (v === 'true') parsed.obtained[k] = true;
          else if (v === 'false') parsed.obtained[k] = false;
        });
      }
      if (parsed && typeof parsed.completed === 'string') {
        parsed.completed = parsed.completed === 'true';
      }
      return parsed || { obtained: {}, completed: false };
    } catch {
      return { obtained: {}, completed: false };
    }
  }

  applyUnlockedStateFromStorage() {
    if (!this.svgElement) return;
    const state = this.getStateFromStorage();
    const obtainedValues = state && state.obtained ? Object.values(state.obtained) : [];
    const hasAny = obtainedValues.some(v => v === true || v === 'true');
    if (!hasAny) {
      // Don't touch SVG visibility if nothing obtained yet
      return;
    }
    Object.keys(this.pieceRegions).forEach(pieceId => {
      if (state.obtained && state.obtained[pieceId] === true) {
        const region = this.pieceRegions[pieceId];
        // Hide locked layer if present
        if (region.lockedLayer) {
          const locked = this.svgElement.querySelector(`#${region.lockedLayer}, [id="${region.lockedLayer}"]`);
          if (locked) {
            locked.style.display = 'none';
            locked.style.opacity = '0';
          }
        }
        // Show unlocked layer if present
        if (region.unlockedLayer) {
          const unlocked = this.svgElement.querySelector(`#${region.unlockedLayer}, [id="${region.unlockedLayer}"]`);
          if (unlocked) {
            unlocked.style.display = 'block';
            unlocked.style.opacity = '1';
          }
        }
      }
    });
  }


  isGameCompleted() {
    const state = this.getStateFromStorage();
    return state && state.completed === true;
  }

  destroy() {
    if (this.svgContainer && this.svgContainer.parentNode) {
      this.svgContainer.parentNode.removeChild(this.svgContainer);
    }
    this.svgContainer = null;
    this.svgElement = null;
    this.isAnimating = false;
  }

  // Debug function for testing
  testAnimation(pieceId = 'piece_1') {
    console.log(`🎨 Testing SVG animation for ${pieceId}`);
    return this.showSVGAnimation(pieceId);
  }

  // Debug function to inspect SVG layers
  inspectSVGLayers() {
    if (!this.svgElement) {
      console.log('🎨 SVG not loaded yet');
      return;
    }

    console.log('🎨 SVG Layer Inspection:');
    
    // Get all elements with IDs
    const elementsWithIds = this.svgElement.querySelectorAll('[id]');
    console.log(`Elements with IDs (${elementsWithIds.length} total):`);
    elementsWithIds.forEach(el => {
      console.log(`  - ID: ${el.id}, Tag: ${el.tagName}, Classes: ${el.className || 'none'}`);
    });

    // Look for emergency-related elements
    console.log('\n🚨 Emergency-related elements:');
    const emergencyElements = this.svgElement.querySelectorAll(`[id*="emergency"], [id*="Emergency"], [class*="emergency"], [class*="Emergency"]`);
    emergencyElements.forEach(el => {
      console.log(`  - ${el.tagName}#${el.id || 'no-id'}.${el.className || 'no-class'}`);
    });

    // Look for 7_Emergency specifically
    console.log('\n🔍 Looking for 7_Emergency group:');
    const emergencyGroup = this.svgElement.querySelector('#7_Emergency, [id="7_Emergency"], [id*="7_Emergency"]');
    if (emergencyGroup) {
      console.log(`  ✅ Found 7_Emergency: ${emergencyGroup.tagName}#${emergencyGroup.id}`);
      
      // Look for children inside 7_Emergency
      const children = emergencyGroup.querySelectorAll('*');
      console.log(`  Children inside 7_Emergency (${children.length} total):`);
      children.forEach((child, index) => {
        if (child.id || child.className) {
          console.log(`    ${index + 1}. ${child.tagName}#${child.id || 'no-id'}.${child.className || 'no-class'}`);
        }
      });
    } else {
      console.log('  ❌ 7_Emergency group not found');
    }

    // Look for locked/unlocked patterns
    const lockedElements = this.svgElement.querySelectorAll(`[id*="locked"], [id*="Locked"], [class*="locked"], [class*="Locked"]`);
    const unlockedElements = this.svgElement.querySelectorAll(`[id*="unlocked"], [id*="Unlocked"], [class*="unlocked"], [class*="Unlocked"]`);
    
    console.log(`\n🔒 Found ${lockedElements.length} potential locked elements:`);
    lockedElements.forEach(el => {
      console.log(`  - ${el.tagName}#${el.id || 'no-id'}.${el.className || 'no-class'}`);
    });

    console.log(`\n🔓 Found ${unlockedElements.length} potential unlocked elements:`);
    unlockedElements.forEach(el => {
      console.log(`  - ${el.tagName}#${el.id || 'no-id'}.${el.className || 'no-class'}`);
    });

    // Check for the specific layer names we're looking for
    console.log('\n🎯 Checking for specific layer names:');
    Object.entries(this.pieceRegions).forEach(([pieceId, region]) => {
      const locked = this.svgElement.querySelector(`#${region.lockedLayer}, [id="${region.lockedLayer}"]`);
      const unlocked = this.svgElement.querySelector(`#${region.unlockedLayer}, [id="${region.unlockedLayer}"]`);
      console.log(`  ${pieceId}:`);
      console.log(`    Locked (${region.lockedLayer}): ${locked ? 'Found' : 'Not found'}`);
      console.log(`    Unlocked (${region.unlockedLayer}): ${unlocked ? 'Found' : 'Not found'}`);
    });

    // Look for any groups that might contain areas
    console.log('\n📁 SVG Groups:');
    const groups = this.svgElement.querySelectorAll('g');
    groups.forEach((group, index) => {
      if (group.id || group.className) {
        console.log(`  Group ${index + 1}: ${group.tagName}#${group.id || 'no-id'}.${group.className || 'no-class'}`);
      }
    });
  }

  hideSVGAnimation(immediate = false) {
    if (!this.svgContainer) return;

    // In navigation mode, ensure we zoom out to overview, then fade out to main
    if (this.isNavigationMode) {
      if (this.currentZoomedRoom) {
        // Zoom out, then exit with fade and resume
        this.zoomOutFromRoom(true);
        return;
      } else {
        // Already at overview; exit navigation mode with proper fade/resume
        this.isNavigationMode = false;
        this.currentZoomedRoom = null;
        this.performCloseAndFade();
        return;
      }
    }

    // Regular animation mode closure
    if (this.svgElement && !immediate) {
      this.svgElement.style.transformOrigin = '0 0';
      this.svgElement.style.transition = 'transform 2.0s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      this.svgElement.style.transform = 'scale(1) translate(0px, 0px)';
    }

  const startFade = () => this.performCloseAndFade();

    if (immediate) {
      startFade();
    } else {
      setTimeout(startFade, 2000);
    }
  }

  // Exit navigation mode (uses unified fade/close)
  exitNavigationMode() {
    console.log('🏥 Exiting Hospital Rooms navigation mode');
    // Clean up
    this.removeRoomClickHandlers();
    this.isNavigationMode = false;
    this.currentZoomedRoom = null;
    this.lastAnimatedPieceId = null;
    // Close overlay consistently
    this.performCloseAndFade();
  }

  // New method: Show navigation mode (hospital rooms overview)
  async showNavigationMode() {
    if (this.isAnimating || !this.svgContainer || !this.svgElement) {
      console.log('🎨 Animation in progress or SVG not ready');
      return;
    }

    this.isNavigationMode = true;
    this.currentZoomedRoom = null;
    
    console.log('🏥 Starting Hospital Rooms navigation mode');

    try {
      // Show the container with navigation interface
      this.svgContainer.style.display = 'flex';
      this.svgContainer.style.flexDirection = 'column';
      this.svgContainer.style.justifyContent = 'center';
      this.svgContainer.style.alignItems = 'center';
      await this.wait(50);
      this.svgContainer.style.opacity = '1';
      
      // Update UI for navigation mode
      this.updateNavigationUI();
      
      // Reset SVG to overview
      if (this.svgElement) {
        this.svgElement.style.transformOrigin = '0 0';
        this.svgElement.style.transition = 'transform 1.0s ease-out';
        this.svgElement.style.transform = 'scale(1) translate(0px, 0px)';
      }
      
      // Add click handlers for unlocked rooms
      this.addRoomClickHandlers();
      
    } catch (error) {
      console.error('❌ Navigation mode error:', error);
    }
  }

  // Update UI for navigation mode
  updateNavigationUI() {
    // Update banner text
    const banner = this.svgContainer.querySelector('.svg-success-banner');
    if (banner) {
      banner.textContent = 'Hospital Rooms - Click to explore';
    }
    
    // Keep info panel visible with generic message in overview
    if (!this.currentZoomedRoom && this.infoPanelBody) {
      this.infoPanelBody.textContent = 'Tap a room to zoom in and learn more.';
    }
    
    // Update back button
    const backBtn = this.svgContainer.querySelector('.svg-back-button');
    if (backBtn) {
      backBtn.textContent = 'Back to Main Menu';
    }
  }

  // Add click handlers for room navigation
  addRoomClickHandlers() {
    // Remove existing handlers first
    this.removeRoomClickHandlers();
    
    const state = this.loadState();
    let anyClickable = false;
    // Add click handlers for each piece region that's unlocked (DOM-based)
    Object.entries(this.pieceRegions).forEach(([pieceId, region]) => {
      if (state.obtained[pieceId]) {
        const clickable = this.findClickableRoomElement(pieceId, region);
        if (clickable) {
          const clickHandler = (e) => {
            e.stopPropagation();
            this.zoomToRoom(pieceId);
          };
          clickable.style.cursor = 'pointer';
          clickable.addEventListener('click', clickHandler);
          clickable._roomClickHandler = clickHandler;
          anyClickable = true;
          console.log(`\ud83c\udfe5 Added click handler for ${pieceId}`);
        }
      }
    });

    // Always enable rect-based hit testing as a reliable fallback
    this.addRectHitHandler();
    if (this.svgElement && (anyClickable || this.anyUnlocked())) {
      this.svgElement.style.cursor = 'pointer';
    }
  }

  // Remove room click handlers
  removeRoomClickHandlers() {
    Object.entries(this.pieceRegions).forEach(([pieceId, region]) => {
      const el = this.findClickableRoomElement(pieceId, region) || this.findUnlockedElement(region);
      if (el && el._roomClickHandler) {
        el.removeEventListener('click', el._roomClickHandler);
        el.style.cursor = 'default';
        delete el._roomClickHandler;
      }
    });
    this.removeRectHitHandler();
    if (this.svgElement) this.svgElement.style.cursor = 'default';
  }

  // Find unlocked element for a region
  findUnlockedElement(region) {
    if (!region.unlockedLayer || !this.svgElement) return null;
    
    const selectors = [
      `#${region.unlockedLayer}`,
      `[id="${region.unlockedLayer}"]`,
      `[id*="${region.unlockedLayer}"]`
    ];
    
    for (const selector of selectors) {
      try {
        const element = this.svgElement.querySelector(selector);
        if (element) return element;
      } catch (e) {
        console.warn(`🎨 Invalid selector: ${selector}`);
      }
    }
    
    return null;
  }

  // Determine if any piece is unlocked
  anyUnlocked() {
    const state = this.loadState();
    return Object.keys(this.pieceRegions).some(pid => !!state.obtained[pid]);
  }

  // Broader finder for a clickable element representing the room
  findClickableRoomElement(pieceId, region) {
    if (!this.svgElement) return null;
    // Prefer explicit unlocked layer
    const primary = this.findUnlockedElement(region);
    if (primary) return primary;
    // Fallback by room keywords
    const keywords = this.getRegionKeywords(pieceId);
    for (const key of keywords) {
      const selectors = [
        `g[id*="${key}"]`,
        `[id*="${key}"]`,
      ];
      for (const sel of selectors) {
        try {
          const el = this.svgElement.querySelector(sel);
          if (el) return el;
        } catch {}
      }
    }
    return null;
  }

  // Map pieceId to likely group keywords in the SVG
  getRegionKeywords(pieceId) {
    const map = {
      'piece_1': ['Op_Recovery', 'Recovery', 'Outpatient', 'OpRecovery'],
      'piece_2': ['Pediatrics', 'Pediatric'],
      'piece_3': ['ICU'],
      'piece_4': ['Behavioral', 'Behavior'],
      'piece_5': ['Operating', 'OR'],
      'piece_6': ['MedSurgical', 'MedSurg', 'Medical', 'Surgical'],
      'piece_7': ['Emergency', 'ER']
    };
    return map[pieceId] || [];
  }

  // Add SVG-level rect hit testing so any tap within a room's rect works
  addRectHitHandler() {
    if (!this.svgElement || this._rectHitHandler) return;
    this._rectHitHandler = (evt) => {
      if (!this.isNavigationMode || this.currentZoomedRoom) return;
      try {
        const pt = this.svgElement.createSVGPoint();
        pt.x = evt.clientX; pt.y = evt.clientY;
        const ctm = this.svgElement.getScreenCTM();
        if (!ctm) return;
        const inv = ctm.inverse();
        const svgPt = pt.matrixTransform(inv);
        const state = this.loadState();
        // Iterate unlocked regions and find the first rect containing the point
        for (const [pid, region] of Object.entries(this.pieceRegions)) {
          if (!state.obtained[pid]) continue;
          const r = region.zoomTarget;
          if (!r) continue;
          if (svgPt.x >= r.x && svgPt.x <= r.x + r.width && svgPt.y >= r.y && svgPt.y <= r.y + r.height) {
            evt.stopPropagation();
            this.zoomToRoom(pid);
            return;
          }
        }
      } catch {}
    };
    this.svgElement.addEventListener('click', this._rectHitHandler, true);
  }

  // Remove SVG-level rect hit testing
  removeRectHitHandler() {
    if (this.svgElement && this._rectHitHandler) {
      this.svgElement.removeEventListener('click', this._rectHitHandler, true);
    }
    this._rectHitHandler = null;
  }

  // Trigger visual click effect on room
  async triggerRoomClickEffect(pieceId, region) {
    // Find the unlocked element to animate
    const unlockedElement = this.findUnlockedElement(region);
    if (!unlockedElement) {
      console.warn(`🎨 Could not find unlocked element for ${pieceId}`);
      return;
    }

    console.log(`✨ Triggering click effect for room: ${pieceId}`);

    // Store original styles to restore later
    const originalTransform = unlockedElement.style.transform || '';
    const originalTransition = unlockedElement.style.transition || '';
    const originalFilter = unlockedElement.style.filter || '';

    // Apply click effect styles
    unlockedElement.style.transition = 'transform 200ms ease-out, filter 200ms ease-out';
    unlockedElement.style.transformOrigin = 'center center';
    unlockedElement.style.transformBox = 'fill-box';
    
    // Trigger the effect
    requestAnimationFrame(() => {
      // Pulse effect: slight scale up + glow
      unlockedElement.style.transform = `${originalTransform} scale(1.05)`;
      unlockedElement.style.filter = `${originalFilter} drop-shadow(0 0 10px rgba(53, 211, 211, 0.8)) brightness(1.2)`;
    });

    // Wait for effect to complete
    await this.wait(200);

    // Reset to original state
    unlockedElement.style.transform = originalTransform;
    unlockedElement.style.filter = originalFilter;
    
    // Wait a bit more for the reset to complete
    await this.wait(100);
    
    // Restore original transition
    unlockedElement.style.transition = originalTransition;
  }

  // Zoom to a specific room
  async zoomToRoom(pieceId) {
    if (!this.isNavigationMode) return;
    
    const region = this.pieceRegions[pieceId];
    if (!region) return;
    
    // Add click effect animation before zooming
    await this.triggerRoomClickEffect(pieceId, region);
    
    this.currentZoomedRoom = pieceId;
    console.log(`🔍 Zooming to room: ${pieceId}`);
    
    // Calculate zoom transformation (same as regular animation)
    const frameRect = this.svgFrame.getBoundingClientRect();
    const svgRect = this.svgElement.getBoundingClientRect();
    
    const viewBox = this.svgElement.getAttribute('viewBox');
    let svgWidth = 1920, svgHeight = 1280;
    if (viewBox) {
      const vb = viewBox.split(' ');
      svgWidth = parseFloat(vb[2]);
      svgHeight = parseFloat(vb[3]);
    }
    
    const baselineScale = Math.min(svgRect.width / svgWidth, svgRect.height / svgHeight);
    const offsetX0 = (svgRect.width - svgWidth * baselineScale) / 2;
    const offsetY0 = (svgRect.height - svgHeight * baselineScale) / 2;

    const regionWidthPx = region.zoomTarget.width * baselineScale;
    const regionHeightPx = region.zoomTarget.height * baselineScale;

    const scaleX = frameRect.width / regionWidthPx;
    const scaleY = frameRect.height / regionHeightPx;
    const scale = Math.min(scaleX, scaleY) * 0.8; // Slightly less zoom for navigation

    const regionCenterPxX = offsetX0 + (region.zoomTarget.x + region.zoomTarget.width / 2) * baselineScale;
    const regionCenterPxY = offsetY0 + (region.zoomTarget.y + region.zoomTarget.height / 2) * baselineScale;

    const translateX = (frameRect.width / 2) - (regionCenterPxX * scale);
    const translateY = (frameRect.height / 2) - (regionCenterPxY * scale);

    // Apply zoom transformation
    this.svgElement.style.transformOrigin = '0 0';
    this.svgElement.style.transition = 'transform 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    this.svgElement.style.transform = `scale(${scale}) translate(${translateX/scale}px, ${translateY/scale}px)`;
    
  // Keep back button label consistent as "Back to Main Menu"
  // Auto-show info for the selected room
  this.showInfoForPiece(pieceId);
    
    // Remove room click handlers while zoomed
    this.removeRoomClickHandlers();
  }

  // Zoom out from room to overview
  async zoomOutFromRoom(exitAfter = false) {
    if (!this.isNavigationMode || !this.currentZoomedRoom) return;
    console.log(`🔄 Zooming out from room: ${this.currentZoomedRoom}`);
    this.currentZoomedRoom = null;
    this.lastAnimatedPieceId = null;
    // Reset to overview
    this.svgElement.style.transformOrigin = '0 0';
    this.svgElement.style.transition = 'transform 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    this.svgElement.style.transform = 'scale(1) translate(0px, 0px)';
    // Update back button to "Back to Main Menu"
    const backBtn = this.svgContainer.querySelector('.svg-back-button');
    if (backBtn) backBtn.textContent = 'Back to Main Menu';
    // Generic info on overview
    if (this.infoPanelBody) {
      this.infoPanelBody.textContent = 'Tap a room to zoom in and learn more.';
    }
    // After zoom completes, either re-enable nav or close overlay
    setTimeout(() => {
      if (exitAfter) {
        // Exit with fade and resume
        this.isNavigationMode = false;
        this.performCloseAndFade();
      } else {
        this.addRoomClickHandlers();
      }
    }, 1200);
  }

  // Load state helper
  loadState() {
    try {
      const raw = localStorage.getItem('qr_puzzle_state_v1');
      if (!raw) return { obtained: {} };
      return JSON.parse(raw);
    } catch (e) {
      return { obtained: {} };
    }
  }

  // --- Info panel logic ---
  // No toggle/hide; panel is always visible while overlay is open

  showInfoForPiece(pieceId) {
    if (!this.infoPanel || !this.infoPanelBody) return;
    const info = this.roomInfo[pieceId] || { text: '' };
    this.infoPanelBody.textContent = info.text || 'More information coming soon.';
    this.infoPanel.style.display = 'block';
  }

  // No hide panel function needed

  // Info button pulse not used anymore
}

// Unified close helper: fade overlay, then resume camera or open final form
SVGAnimationSystem.prototype.performCloseAndFade = function() {
  if (!this.svgContainer) return;
  this.svgContainer.style.transition = 'opacity 0.6s ease-out';
  this.svgContainer.style.opacity = '0';
  setTimeout(() => {
    this.svgContainer.style.display = 'none';
    this.isAnimating = false;
    const showFinal = this.shouldShowFinalForm === true;
    this.shouldShowFinalForm = false;
    if (showFinal) {
      if (window.openFinalForm) {
        setTimeout(() => window.openFinalForm(), 300);
      } else {
        const ff = document.getElementById('final-form');
        if (ff) ff.classList.remove('hidden');
      }
    } else if (window.qrCamera && window.qrCamera.resume) {
      setTimeout(() => {
        window.qrCamera.resume().catch(() => {
          setTimeout(() => window.qrCamera.start().catch(() => {}), 500);
        });
      }, 100);
    }
  }, 600);
};

// Export singleton instance
export const svgAnimationSystem = new SVGAnimationSystem();

// Debug functions for browser console
window.__debugSVG = {
  inspect: () => svgAnimationSystem.inspectSVGLayers(),
  test: (pieceId) => svgAnimationSystem.testAnimation(pieceId),
  system: svgAnimationSystem
};
