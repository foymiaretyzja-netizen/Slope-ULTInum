/**
 * Slope Voidition - Obstacle System Module
 * Handles procedural hazard placement, structural tunnels, and asynchronous moving blocks.
 */
export class ObstacleManager {
    constructor(scene, unitsPerBlock) {
        this.scene = scene;
        this.unitsPerBlock = unitsPerBlock;
        
        // Storage lists
        this.obstacles = []; // Stores individual obstacle objects for tracking/collision
        this.movingGroups = []; // Stores references to moving elements that need updating

        // Core Design Aesthetics
        this.wireColor = 0xff0000;  // Neon Red Glow lines
        this.solidColor = 0x220000; // Deep Crimson Solid core
    }

    /**
     * Factory to build composite glowing red geometries.
     * @private
     */
    _createHazardMesh(w, h, d) {
        const group = new THREE.Group();
        const geometry = new THREE.BoxGeometry(w, h, d);

        const solidMat = new THREE.MeshBasicMaterial({ color: this.solidColor });
        const solidMesh = new THREE.Mesh(geometry, solidMat);
        group.add(solidMesh);

        const wireMat = new THREE.MeshBasicMaterial({ color: this.wireColor, wireframe: true });
        const wireMesh = new THREE.Mesh(geometry, wireMat);
        wireMesh.scale.set(1.01, 1.01, 1.01); // Prevent Z-fighting
        group.add(wireMesh);

        return group;
    }

    /**
     * Master generation router. Called by the environment script per platform.
     * @param {Object} plat - Platform metadata from environment.js
     * @param {number} platIndex - Current absolute index of the platform
     * @param {number} blocksWide - Grid width
     * @param {number} length - Physical length in 3D units
     */
    generateObstacles(plat, platIndex, blocksWide, length) {
        const blocksLong = Math.floor(length / this.unitsPerBlock);
        
        // Rule 1: Every 8 to 10 platforms, encapsulate it completely in a tunnel
        if (platIndex % 9 === 0 && platIndex > 0) {
            this._spawnTunnel(plat, blocksWide, length);
            return; // Tunnels generally don't contain other blocks to avoid impossible configurations
        }

        // Rule 2: Every 4th platform, spawn the asynchronous moving block gate
        if (platIndex % 4 === 0 && platIndex > 0) {
            this._spawnMovingBlocks(plat, blocksWide, length);
            return;
        }

        // Rule 3: Procedural static block generation governed by dimensions
        this._spawnStaticBlocks(plat, blocksWide, blocksLong);
    }

    /**
     * Spawns standard neon blocks scaled to the length and width thresholds.
     * @private
     */
    _spawnStaticBlocks(plat, blocksWide, blocksLong) {
        // Enforce safety zones: Obstacles cannot spawn in the first 3 or last 3 grid rows
        const startRow = 3;
        const endRow = blocksLong - 3;
        if (endRow <= startRow) return;

        // Determine obstacle count scaling laws
        let densityModifier = 1;
        if (blocksWide <= 2) densityModifier = 1; // Narrow: limit hazards
        else if (blocksWide >= 5) densityModifier = 3; // Wide: populate aggressively

        for (let row = startRow; row < endRow; row += 4) {
            if (Math.random() > 0.45 * (1 / densityModifier)) {
                // Randomly assign a grid column alignment
                const col = Math.floor(Math.random() * blocksWide);
                
                const blockWidth = this.unitsPerBlock * 0.9;
                const mesh = this._createHazardMesh(blockWidth, 2, 2);

                // Convert grid layout to absolute spatial positions
                const posX = plat.group.position.x + (col - (blocksWide - 1) / 2) * this.unitsPerBlock;
                const posZ = plat.maxZ - (row * this.unitsPerBlock);
                const posY = plat.y + 1; // Sit flush on the top surface

                mesh.position.set(posX, posY, posZ);
                this.scene.add(mesh);

                this.obstacles.push({
                    mesh: mesh,
                    type: 'static',
                    boundingBox: new THREE.Box3().setFromObject(mesh)
                });
            }
        }
    }

    /**
     * Spawns a sleek wireframe enclosure wrapping around the entire platform.
     * @private
     */
    _spawnTunnel(plat, blocksWide, length) {
        const width = blocksWide * this.unitsPerBlock;
        const tunnelHeight = 6;
        
        // Assemble 3-sided hollow arch group (Left Wall, Right Wall, Ceiling)
        const tunnelGroup = new THREE.Group();
        const wallThickness = 0.2;

        const wallGeo = new THREE.BoxGeometry(wallThickness, tunnelHeight, length);
        const roofGeo = new THREE.BoxGeometry(width, wallThickness, length);

        const solidMat = new THREE.MeshBasicMaterial({ color: 0x110000, transparent: true, opacity: 0.6 });
        const wireMat = new THREE.MeshBasicMaterial({ color: this.wireColor, wireframe: true });

        // Build Left Wall
        const leftWall = new THREE.Mesh(wallGeo, solidMat);
        const leftWire = new THREE.Mesh(wallGeo, wireMat); leftWire.scale.set(1.01, 1.01, 1.01);
        leftWall.add(leftWire);
        leftWall.position.set(-width / 2, tunnelHeight / 2, 0);
        tunnelGroup.add(leftWall);

        // Build Right Wall
        const rightWall = new THREE.Mesh(wallGeo, solidMat);
        const rightWire = new THREE.Mesh(wallGeo, wireMat); rightWire.scale.set(1.01, 1.01, 1.01);
        rightWall.add(rightWire);
        rightWall.position.set(width / 2, tunnelHeight / 2, 0);
        tunnelGroup.add(rightWall);

        // Build Roof
        const roof = new THREE.Mesh(roofGeo, solidMat);
        const roofWire = new THREE.Mesh(roofGeo, wireMat); roofWire.scale.set(1.01, 1.01, 1.01);
        roof.add(roofWire);
        roof.position.set(0, tunnelHeight, 0);
        tunnelGroup.add(roof);

        // Align tunnel directly to the parent platform position
        tunnelGroup.position.set(plat.group.position.x, plat.y, plat.group.position.z);
        this.scene.add(tunnelGroup);

        // Add to active track index for standard tracking cleanup
        this.obstacles.push({ mesh: tunnelGroup, type: 'tunnel' });
    }

    /**
     * Spawns three blocks distributed across the width that oscillate out of sync.
     * @private
     */
    _spawnMovingBlocks(plat, blocksWide, length) {
        const midZ = plat.group.position.z;
        const totalWidth = blocksWide * this.unitsPerBlock;
        const numBlocks = 3;

        for (let i = 0; i < numBlocks; i++) {
            const bWidth = totalWidth / numBlocks;
            const mesh = this._createHazardMesh(bWidth * 0.9, 2, 2);

            // Stagger horizontal distribution lanes
            const posX = plat.group.position.x - (totalWidth / 2) + (bWidth * i) + (bWidth / 2);
            const posY = plat.y + 1;
            mesh.position.set(posX, posY, midZ);
            
            this.scene.add(mesh);

            const movingObj = {
                mesh: mesh,
                type: 'moving',
                baseY: posY,
                timeOffset: i * 1.5, // The operational asynchronous delay factor
                boundingBox: new THREE.Box3().setFromObject(mesh)
            };

            this.obstacles.push(movingObj);
            this.movingGroups.push(movingObj);
        }
    }

    /**
     * Orchestrates moving blocks animations and memory cleanup.
     */
    update(playerZ) {
        const time = performance.now() * 0.004;

        // Animate moving asynchronous blocks up and down
        for (let obj of this.movingGroups) {
            // Apply unique wave rhythm calculations based on structural offsets
            const wave = Math.sin(time + obj.timeOffset);
            // Translate up and down neatly out of the platform bed surface
            obj.mesh.position.y = obj.baseY + (wave * 2.2); 
            // Refresh physical collision tracking definitions
            obj.boundingBox.setFromObject(obj.mesh);
        }

        // Garbage collection: clear objects left behind the camera view field
        const clearBoundZ = playerZ + 40;
        this.obstacles = this.obstacles.filter(obs => {
            if (obs.mesh.position.z > clearBoundZ || (obs.type === 'static' && obs.mesh.position.z > clearBoundZ)) {
                this.scene.remove(obs.mesh);
                return false;
            }
            return true;
        });

        // Keep moving group collection clean
        this.movingGroups = this.movingGroups.filter(obj => this.scene.children.includes(obj.mesh));
    }
}
