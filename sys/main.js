import { Player } from './player.js';
import { Environment } from './environment.js';

// --- 1. Global Viewport Setup ---
const scene = new THREE.Scene();
// Deep void fog that hides generating platforms in the distance
scene.fog = new THREE.FogExp2(0x000000, 0.018);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- 2. Instantiate System Modules ---
const player = new Player(scene);
const environment = new Environment(scene);

// Dynamic 3D Box used to calculate frame-by-frame player hitboxes
const playerBox = new THREE.Box3();

// --- 3. Collision Resolution Matrix ---
function handleSystemsPhysics() {
    // A. Track Floor Collisions (Are we on a platform?)
    let currentFloorY = -Infinity;
    const px = player.mesh.position.x;
    const pz = player.mesh.position.z;

    for (let p of environment.platforms) {
        // Check if the ball's current coordinates overlap a platform's physical boundaries
        if (pz <= p.maxZ && pz >= p.minZ) {
            if (px >= p.minX && px <= p.maxX) {
                currentFloorY = p.y;
                break; // Found the active platform surface, stop searching
            }
        }
    }

    // Pass the calculated landing surface elevation to the player physics loop
    if (currentFloorY !== -Infinity) {
        player.handleFloorCollision(currentFloorY);
    }

    // B. Obstacle Collisions (Did we hit a red hazard?)
    // Update the player's bounding box to match its current animated position
    playerBox.setFromObject(player.mesh);

    for (let obs of environment.obstacleManager.obstacles) {
        // Tunnels are environmental pathways, only calculate hits on blocks and moving gates
        if (obs.type === 'static' || obs.type === 'moving') {
            if (playerBox.intersectsBox(obs.boundingBox)) {
                triggerVoidDeath();
                break;
            }
        }
    }
}

/**
 * Triggers the end-game state when a player crashes or drops out of bounds.
 */
function triggerVoidDeath() {
    player.isDead = true;
    document.getElementById('game-over').style.display = 'block';
}

// --- 4. Dynamic Camera Behavior ---
function updateCamera() {
    // Linear interpolation tracking (gives the camera a smooth, floating follow effect)
    const targetX = player.mesh.position.x * 0.4;
    const targetY = player.mesh.position.y + 4.2;
    const targetZ = player.mesh.position.z + 8.5;

    camera.position.x += (targetX - camera.position.x) * 0.08;
    camera.position.y += (targetY - camera.position.y) * 0.08;
    camera.position.z = targetZ;

    // Direct the camera focus downstream ahead of the ball's trajectory
    camera.lookAt(player.mesh.position.x * 0.2, player.mesh.position.y - 1.5, player.mesh.position.z - 12);
}

// --- 5. Window Resize Adaptation ---
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// --- 6. Infinite Game Loop ---
function animate() {
    // Halt the rendering pipeline if the player has failed
    if (player.isDead) return;
    
    requestAnimationFrame(animate);

    // 1. Process individual module timelines
    player.update();
    environment.update(player.mesh.position.z, player.speedZ);

    // 2. Resolve cross-module intersections
    handleSystemsPhysics();

    // 3. Update Camera views
    updateCamera();

    // 4. Update UI Distance Meter (Converts negative Z coordinate into an absolute meter value)
    const currentDistance = Math.max(0, Math.floor(-player.mesh.position.z));
    document.getElementById('distance').innerText = currentDistance;

    // Check if player has dropped past the terminal map floor altitude threshold
    if (player.mesh.position.y < -35) {
        triggerVoidDeath();
    }

    renderer.render(scene, camera);
}

// Initiate the sequence
animate();
