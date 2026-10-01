/**
 * Slope Voidition - Player System Module
 * Handles physics, movement, inputs, and rolling animations for the ball.
 */
export class Player {
    constructor(scene) {
        this.scene = scene;
        
        // --- 1. Visual Configuration ---
        const geometry = new THREE.SphereGeometry(1, 16, 16);
        this.material = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00, 
            wireframe: true 
        });
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.position.set(0, 1, 0);
        this.scene.add(this.mesh);

        // --- 2. Physics & Kinematics Settings ---
        // Forward Movement (Z-Axis)
        this.speedZ = 0.6;            // Initial forward speed
        this.maxSpeedZ = 2.5;         // Hard speed limit cap
        this.accelerationZ = 0.00005; // Gradual physics scaling over distance

        // Lateral Movement / Steering (X-Axis)
        this.velocityX = 0;           // Current horizontal velocity
        this.strafeSpeed = 0.025;     // Gradual lateral acceleration
        this.maxSpeedX = 0.5;         // Maximum steering speed
        this.frictionX = 0.84;         // Smoothly slows the ball when steering is released

        // Vertical Movement / Gravity (Y-Axis)
        this.velocityY = 0;           // Current vertical velocity
        this.gravity = 0.04;          // Downward acceleration force
        this.terminalVelocityY = -1.8; // Prevent clipping issues on high drops

        // States
        this.isDead = false;
        this.radius = 1;

        // --- 3. Input Tracking ---
        this.keys = { left: false, right: false };
        this._setupInputs();
    }

    /**
     * Bind window event listeners to monitor user input.
     * @private
     */
    _setupInputs() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = true;
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = true;
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = false;
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = false;
        });
    }

    /**
     * Main physics and state processor. 
     * Executed once per animation frame by the main loop.
     */
    update() {
        if (this.isDead) return;

        // --- Forward Momentum ---
        this.mesh.position.z -= this.speedZ;
        if (this.speedZ < this.maxSpeedZ) {
            this.speedZ += this.accelerationZ;
        }

        // --- Lateral Momentum (Steering with Inertia) ---
        if (this.keys.left) {
            this.velocityX -= this.strafeSpeed;
        } else if (this.keys.right) {
            this.velocityX += this.strafeSpeed;
        } else {
            // Apply slick friction when drifting or coasting
            this.velocityX *= this.frictionX;
        }

        // Clamp side speed and apply updates to position
        this.velocityX = Math.max(-this.maxSpeedX, Math.min(this.maxSpeedX, this.velocityX));
        this.mesh.position.x += this.velocityX;

        // --- Vertical Momentum (Gravity) ---
        this.velocityY -= this.gravity;
        if (this.velocityY < this.terminalVelocityY) {
            this.velocityY = this.terminalVelocityY;
        }
        this.mesh.position.y += this.velocityY;

        // --- Procedural Animations ---
        // Continuous rolling rotation matching forward velocity
        this.mesh.rotation.x -= this.speedZ * 0.4;
        
        // Dynamically tilt/bank the wireframe structure into side-turns
        this.mesh.rotation.z = -this.velocityX * 2.5;

        // --- Bounds Checking ---
        // If the ball falls past a specific altitude threshold into the void
        if (this.mesh.position.y < -40) {
            this.isDead = true;
        }
    }

    /**
     * Interface Method for Future Platform Module.
     * Resolves upward floor boundaries when landing on segments.
     * @param {number} floorY - The target platform surface elevation.
     */
    handleFloorCollision(floorY) {
        if (this.mesh.position.y - this.radius <= floorY && this.velocityY <= 0) {
            this.mesh.position.y = floorY + this.radius;
            this.velocityY = 0; // Kill falling velocity on contact
        }
    }
}
