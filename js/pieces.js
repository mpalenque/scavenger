// Sistema de gestión de piezas del puzzle
class PieceManager {
    constructor() {
        this.pieces = {
            1: {
                id: 1,
                name: "Op Recovery",
                department: "Recovery Room",
                unlocked: false,
                component: null // Se asignará cuando tengamos el componente completo
            },
            2: {
                id: 2,
                name: "Pediatrics",
                department: "Pediatric Unit",
                unlocked: false,
                component: "Pediatrics" // Cambiado para coincidir con el componente
            },
            3: {
                id: 3,
                name: "ICU",
                department: "Intensive Care Unit", 
                unlocked: false,
                component: "Component3ICU"
            },
            4: {
                id: 4,
                name: "Behavioral",
                department: "Behavioral Health",
                unlocked: false,
                component: "Component4Behavioral"
            },
            5: {
                id: 5,
                name: "Operating",
                department: "Operating Room",
                unlocked: false,
                component: "Component5Operating"
            },
            6: {
                id: 6,
                name: "MedSurgical", 
                department: "Medical-Surgical",
                unlocked: false,
                component: "Component6MedSurgical"
            },
            7: {
                id: 7,
                name: "Emergency",
                department: "Emergency Department",
                unlocked: false,
                component: "Component7Emergency"
            }
        };
        
        this.loadProgress();
    }

    // Cargar progreso desde localStorage
    loadProgress() {
        const saved = localStorage.getItem('puzzlePieces');
        if (saved) {
            const savedPieces = JSON.parse(saved);
            for (let id in savedPieces) {
                if (this.pieces[id]) {
                    this.pieces[id].unlocked = savedPieces[id].unlocked;
                }
            }
        }
    }

    // Guardar progreso en localStorage
    saveProgress() {
        const toSave = {};
        for (let id in this.pieces) {
            toSave[id] = { unlocked: this.pieces[id].unlocked };
        }
        localStorage.setItem('puzzlePieces', JSON.stringify(toSave));
    }

    // Desbloquear una pieza
    unlockPiece(pieceId) {
        if (this.pieces[pieceId]) {
            this.pieces[pieceId].unlocked = true;
            this.saveProgress();
            return this.pieces[pieceId];
        }
        return null;
    }

    // Obtener información de una pieza
    getPiece(pieceId) {
        return this.pieces[pieceId] || null;
    }

    // Obtener todas las piezas desbloqueadas
    getUnlockedPieces() {
        return Object.values(this.pieces).filter(piece => piece.unlocked);
    }

    // Obtener número de piezas desbloqueadas
    getUnlockedCount() {
        return Object.values(this.pieces).filter(piece => piece.unlocked).length;
    }

    // Verificar si todas las piezas están desbloqueadas
    isComplete() {
        return this.getUnlockedCount() === Object.keys(this.pieces).length;
    }

    // Reiniciar progreso
    reset() {
        for (let id in this.pieces) {
            this.pieces[id].unlocked = false;
        }
        this.saveProgress();
    }
}

// Clase para mostrar la pantalla de colección de piezas
class PieceCollectionScreen {
    constructor(pieceManager) {
        this.pieceManager = pieceManager;
        this.isShowing = false;
        this.currentPiece = null;
        this.animationState = 'hidden'; // hidden, zooming, revealing, showing, returning
    }

    // Mostrar la pantalla de colección con animación
    async showPieceCollection(pieceId) {
        if (this.isShowing) return;
        
        this.isShowing = true;
        this.currentPiece = this.pieceManager.getPiece(pieceId);
        
        if (!this.currentPiece) {
            console.error(`Pieza ${pieceId} no encontrada`);
            this.isShowing = false;
            return;
        }

        // Crear el overlay de la pantalla de colección
        this.createCollectionOverlay();
        
        // Iniciar secuencia de animación
        await this.animateSequence();
    }

    // Crear el overlay de la pantalla de colección
    createCollectionOverlay() {
        // Remover overlay existente si existe
        const existing = document.getElementById('piece-collection-overlay');
        if (existing) {
            existing.remove();
        }

        const overlay = document.createElement('div');
        overlay.id = 'piece-collection-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #0a1e23 0%, #143940 100%);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            background: #f97316;
            color: white;
            padding: 20px 40px;
            border-radius: 15px;
            font-family: 'Poppins', sans-serif;
            font-weight: bold;
            font-size: 24px;
            margin-bottom: 40px;
            text-align: center;
        `;
        header.textContent = 'You got another piece!';

        // Contenedor de la pieza
        const pieceContainer = document.createElement('div');
        pieceContainer.id = 'piece-container';
        pieceContainer.style.cssText = `
            width: 300px;
            height: 300px;
            border: 3px solid #35d3d3;
            border-radius: 20px;
            background: #35d3d3;
            display: flex;
            justify-content: center;
            align-items: center;
            margin-bottom: 40px;
            position: relative;
            overflow: hidden;
            transform: scale(0);
            transition: transform 0.5s ease;
        `;

        // Información de la pieza
        const infoSection = document.createElement('div');
        infoSection.style.cssText = `
            background: #35d3d3;
            color: #004249;
            padding: 15px 30px;
            border-radius: 15px;
            font-family: 'Poppins', sans-serif;
            font-weight: 600;
            text-align: center;
            margin-bottom: 30px;
        `;
        infoSection.textContent = `${this.currentPiece.department} - Piece ${this.currentPiece.id}/7`;

        // Botón de regresar
        const backButton = document.createElement('button');
        backButton.style.cssText = `
            background: #35d3d3;
            color: #004249;
            border: none;
            padding: 15px 30px;
            border-radius: 25px;
            font-family: 'Poppins', sans-serif;
            font-weight: bold;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.3s ease;
        `;
        backButton.textContent = 'Back to Scanner';
        backButton.addEventListener('click', () => this.closeCollection());
        
        backButton.addEventListener('mouseenter', () => {
            backButton.style.background = '#004249';
            backButton.style.color = '#35d3d3';
        });
        
        backButton.addEventListener('mouseleave', () => {
            backButton.style.background = '#35d3d3';
            backButton.style.color = '#004249';
        });

        overlay.appendChild(header);
        overlay.appendChild(pieceContainer);
        overlay.appendChild(infoSection);
        overlay.appendChild(backButton);
        document.body.appendChild(overlay);

        // Mostrar overlay con fade in
        setTimeout(() => {
            overlay.style.opacity = '1';
        }, 100);
    }

    // Secuencia de animación completa
    async animateSequence() {
        const pieceContainer = document.getElementById('piece-container');
        
        // 1. Zoom in desde el scanner (efecto visual)
        this.animationState = 'zooming';
        await this.sleep(500);

        // 2. Mostrar pieza bloqueada primero
        this.showLockedPiece(pieceContainer);
        pieceContainer.style.transform = 'scale(1)';
        await this.sleep(800);

        // 3. Animación de desbloqueo
        this.animationState = 'revealing';
        await this.animateUnlock(pieceContainer);
        await this.sleep(500);

        // 4. Mostrar pieza desbloqueada
        this.showUnlockedPiece(pieceContainer);
        this.animationState = 'showing';
        await this.sleep(1000);

        // La animación se queda aquí hasta que el usuario presione "Back to Scanner"
    }

        // Mostrar pieza en estado bloqueado
    showLockedPiece(container) {
        // Si hay un componente personalizado, úsalo
        if (this.currentPiece.component && window[this.currentPiece.component + 'Component']) {
            const componentFunc = window[this.currentPiece.component + 'Component'];
            if (componentFunc && componentFunc.locked) {
                container.innerHTML = componentFunc.locked();
                return;
            }
        }
        
        // Fallback al candado genérico
        container.innerHTML = `
            <div style="
                width: 100%;
                height: 100%;
                background: #35d3d3;
                display: flex;
                justify-content: center;
                align-items: center;
                border: 3px solid #143940;
                border-radius: 15px;
                position: relative;
            ">
                <div style="
                    width: 60px;
                    height: 60px;
                    background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23143940"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"/></svg>') center/cover;
                ">
                </div>
            </div>
        `;
    }

    // Mostrar pieza desbloqueada
    showUnlockedPiece(container) {
        // Si hay un componente personalizado, úsalo
        if (this.currentPiece.component && window[this.currentPiece.component + 'Component']) {
            const componentFunc = window[this.currentPiece.component + 'Component'];
            if (componentFunc && componentFunc.unlocked) {
                container.innerHTML = componentFunc.unlocked();
                return;
            }
        }
        
        // Fallback a la representación genérica
        container.innerHTML = `
            <div style="
                width: 100%;
                height: 100%;
                background: linear-gradient(45deg, #35d3d3, #4dd4d4);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                border-radius: 15px;
                color: #004249;
                font-family: 'Poppins', sans-serif;
                text-align: center;
                padding: 20px;
                box-sizing: border-box;
            ">
                <div style="
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 10px;
                ">
                    ${this.currentPiece.name}
                </div>
                <div style="
                    font-size: 14px;
                    opacity: 0.8;
                ">
                    ${this.currentPiece.department}
                </div>
                <div style="
                    margin-top: 15px;
                    width: 60px;
                    height: 60px;
                    background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23004249"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>') center/cover;
                ">
                </div>
            </div>
        `;
    }

    // Animación de desbloqueo
    async animateUnlock(container) {
        // Efecto de brillo/flash
        container.style.boxShadow = '0 0 30px #35d3d3, 0 0 60px #35d3d3';
        
        // Efecto de rotación del candado
        const lock = container.querySelector('div > div');
        if (lock) {
            lock.style.transition = 'transform 0.5s ease, opacity 0.5s ease';
            lock.style.transform = 'rotate(360deg) scale(0)';
            lock.style.opacity = '0';
        }
        
        await this.sleep(500);
        container.style.boxShadow = 'none';
    }

    // Mostrar pieza desbloqueada
    showUnlockedPiece(container) {
        // Aquí normalmente cargaríamos el componente SVG de la pieza
        // Por ahora mostramos una representación simplificada
        container.innerHTML = `
            <div style="
                width: 100%;
                height: 100%;
                background: linear-gradient(45deg, #35d3d3, #4dd4d4);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                border-radius: 15px;
                color: #004249;
                font-family: 'Poppins', sans-serif;
                text-align: center;
                padding: 20px;
                box-sizing: border-box;
            ">
                <div style="
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 10px;
                ">
                    ${this.currentPiece.name}
                </div>
                <div style="
                    font-size: 14px;
                    opacity: 0.8;
                ">
                    ${this.currentPiece.department}
                </div>
                <div style="
                    margin-top: 15px;
                    width: 60px;
                    height: 60px;
                    background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23004249"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>') center/cover;
                ">
                </div>
            </div>
        `;
    }

    // Cerrar la pantalla de colección
    async closeCollection() {
        this.animationState = 'returning';
        
        const overlay = document.getElementById('piece-collection-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            await this.sleep(300);
            overlay.remove();
        }

        this.isShowing = false;
        this.currentPiece = null;
        this.animationState = 'hidden';

        // Mostrar nuevamente el scanner
        if (window.showCameraView) {
            window.showCameraView();
        }
    }

    // Función auxiliar para pausa
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Instancia global del gestor de piezas
window.pieceManager = new PieceManager();
window.pieceCollectionScreen = new PieceCollectionScreen(window.pieceManager);
