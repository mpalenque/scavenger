# Cacería de Códigos QR - Rompecabezas 3D

Aplicación web (HTML + CSS + JS Vanilla) que permite a usuarios escanear códigos QR para desbloquear 7 piezas de un rompecabezas 3D, contestando trivias para obtener cada pieza. Al completar todas, se muestra una animación de ensamblado y un formulario final.

## Características Clave
- Escaneo de QR con `html5-qrcode` (cámara trasera preferida).
- Visualización y animaciones 3D con Three.js (ES Modules importados desde CDN en `puzzle3d.js`).
- Estado persistente en `localStorage` (sin login).
- Trivia interactiva por pieza.
- Animación de completado del rompecabezas.
- Formulario final (simulación de envío) tras completarlo.
- Eventos de Google Analytics 4 listos para instrumentar.
- Diseño responsive móvil / escritorio.

## Estructura de Archivos
```
index.html          Marcado principal y contenedores de UI
styles.css          Estilos y layout responsive
js/data.js          Datos (piezas, pistas, trivias) + estado inicial
js/puzzle3d.js      Configuración Three.js y animaciones de piezas
js/camera.js        Encapsula la inicialización y manejo del escáner QR
js/main.js          Orquestación: estado, UI, trivia, GA y flujo final
README.md           Este documento
```

## Flujo Básico
1. El usuario abre la página (idealmente bajo HTTPS o `http://localhost`).
2. Se pide acceso a la cámara y comienza el escaneo.
3. Al detectar un texto que coincide con un ID de pieza (p.ej. `pieza_3`), se dispara la trivia.
4. Si responde correctamente:
   - Se marca la pieza como obtenida en `localStorage`.
   - Se muestra animación de revelado.
   - Se registra evento GA `trivia_acierto`.
5. Al obtener las 7 piezas:
   - Evento GA `rompecabezas_completado`.
   - Animación final (ensamblado) y formulario final.
6. Envío del formulario → Evento GA `formulario_enviado`.

## IDs de Piezas Esperados en los QR
```
pieza_1
pieza_2
pieza_3
pieza_4
pieza_5
pieza_6
pieza_7
```
Cada código QR físico debe contener exactamente el texto del ID correspondiente.

## Parámetro de URL
Si el usuario abre directamente la página con `?pieza=pieza_4`, la app tratará ese valor como si hubiera escaneado ese QR (útil para redirecciones desde cámaras nativas).

Ejemplo: `https://tu-dominio.com/?pieza=pieza_2`

## Google Analytics 4
Reemplazar en `index.html`:
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  gtag('config', 'G-XXXXXXXXXX');
</script>
```
Por el ID real de tu propiedad GA4 (formato `G-XXXXXXX`).

Eventos implementados:
- `qr_escaneado` (params: `raw`)
- `trivia_acierto` (params: `piece`)
- `trivia_fallo` (params: `piece`)
- `rompecabezas_completado`
- `formulario_enviado` (params: campos del formulario)

## Desarrollo Local
Necesitas servir los archivos con un servidor estático (no abrir directamente el HTML con file://). Ejemplos:

### Python 3
```bash
python3 -m http.server 5173
```
Visita: `http://localhost:5173`

### Node (npx serve)
```bash
npx serve .
```

### Simple HTTP server (Mac/Linux)
```bash
python -m http.server
```

La API de cámara sólo funcionará en:
- Origenes seguros (HTTPS)
- `http://localhost`

## Personalización Rápida
- Cambiar preguntas/pistas: editar `js/data.js`.
- Ajustar colores / UI: `styles.css`.
- Reemplazar piezas placeholder con modelos reales: ampliar `puzzle3d.js` para cargar GLTF/GLB usando `GLTFLoader` de Three.js.

Ejemplo (esbozo) dentro de `puzzle3d.js` (manteniendo enfoque ES Modules):
```js
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
const loader = new GLTFLoader();
loader.load('models/pieza_1.glb', (gltf) => {
   // asignar a this.pieceMeshes['pieza_1']
});
```

## Limpieza de Estado
Para reiniciar el progreso:
```js
localStorage.removeItem('qr_puzzle_state_v1');
```
O usar herramientas de DevTools (Application > Local Storage).

## Accesibilidad
- Anuncios de estado vía `aria-live` en pistas y feedback.
- Botones navegables y roles de diálogo en modales.

## Futuras Mejores (Ideas)
- Integrar backend para persistencia multi-dispositivo.
- Temporizador y ranking (gamificación).
- Soporte multilingüe.
- Animaciones de partículas al desbloquear piezas.
- Validación real de formulario / envío a endpoint.

## Integración Figma Dev Mode MCP (Opcional)
Se añadió `.vscode/mcp.json` con la configuración para conectar al servidor MCP de Figma Dev Mode.

Pasos rápidos:
1. En la app de escritorio de Figma: Menú > Preferences > Enable Dev Mode MCP Server.
2. Verifica que el servidor local corre en `http://127.0.0.1:3845/mcp`.
3. En VS Code: abre la paleta (⌘⇧P) y confirma que tu cliente MCP reconoce la entrada (alternativamente edita `.vscode/mcp.json`).
4. Abre la barra de chat (⌥⌘B) y usa `#get_code` o `#get_variable_defs` tras seleccionar un frame en Figma.
5. Las reglas para guiar la generación están en `mcp-rules/figma-dev-mode-rules.yaml`.

Herramientas disponibles esperadas:
- get_code
- get_variable_defs
- get_code_connect_map
- get_image (si lo habilitas en preferencias)
- create_design_system_rules

Si no ves las tools:
- Reinicia Figma y VS Code.
- Asegura que usas la app de escritorio (no navegador).
- Verifica firewall no bloquea el puerto 3845.


## Licencia
Ajusta según tus necesidades (MIT sugerido). Actualmente sin licencia explícita.

---
¡Disfruta construyendo tu experiencia de cacería QR 3D!
