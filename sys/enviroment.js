/**
 * Slope Voidition - Environment & Track System Module
 * Handles procedural grid platform generation, speed-scaled gap spacing, 
 * and solid-wireframe composite aesthetics.
 */
import { ObstacleManager } from './obstacles.js';

export class Environment {
    constructor(scene) {
        this.scene = scene;
        
        // --- 1. Track & Grid Configurations ---
        this.unitsPerBlock = 3.5; // Every 1 grid block = 3.5 units of actual 3D width
        this.platforms = [];       // Array to store active platform metadata
        
        // Procedural cursor tracking
        this.nextPlatformZ = 15;  // Spawning cursor along the Z axis (starts behind player)
        this.currentY = 0;        // Track elevation changes down the slope
        this.obstacleManager = new ObstacleManager(scene, this.unitsPerBlock);

        // --- 2. Aesthetic Design (Solid Fill + Wireframe Edges) ---
        this.themeColor = 0x00ff00; // Neon Green wireframe lines
        this.solidColor = 0x0a1a0a; // Deep forest green interior fill

        // Instantiate the starting safety platform immediately
        this._spawnInitialPlatform();
    }

    /**
     * Spawns a perfectly centered, gap-free runway directly beneath the player at launch.
     * @private
     */
    _spawnInitialPlatform() {
        const blocksWide = 5; // Generously wide starting grid
        const length = 90;    // Long runway to get oriented
        const width = blocksWide * this.unitsPerBlock;
        
        const platformGroup = this._createCompositeMesh(width, length);
        
        // Position platform so its top surface sits exactly at Y = 0
        const zPos = this.nextPlatformZ - (length / 2);
        const yPos = this.currentY;
        platformGroup.position.set(0, yPos - 1, zPos); // -1 assumes platform thickness is 2
        
        this.scene.add(platformGroup);

        this.platforms.push({
            group: platformGroup,
            y: yPos,
            slopeDrop: 0,
            minX: -width / 2,
            maxX: width / 2,
            minZ: this.nextPlatformZ - length,
            maxZ: this.nextPlatformZ
        });

        // Advance generation cursor to the edge of this runway
        this.nextPlatformZ -= length;
    }

    /**
     * Builds a composite 3D object containing a solid visual core nested inside a wireframe wrapper.
     * @private
     * @param {number} width - Real 3D space width.
     * @param {number} length - Real 3D space length.
     * @returns {THREE.Group} Composite platform mesh container.
     */
    _createCompositeMesh(width, length) {
        const platformGroup = new THREE.Group();
        const thickness = 2;
        const geometry = new THREE.BoxGeometry(width, thickness, length);

        // 1. Solid Interior Base
        const solidMaterial = new THREE.MeshBasicMaterial({ color: this.solidColor });
        const solidMesh = new THREE.Mesh(geometry, solidMaterial);
        platformGroup.add(solidMesh);

        // 2. Neon Wireframe Shell
        const wireframeMaterial = new THREE.MeshBasicMaterial({ 
            color: this.themeColor, 
            wireframe: true 
        });
        const wireframeMesh = new THREE.Mesh(geometry, wireframeMaterial);
        
        // Inflate the wireframe microscopicly to shield against Z-fighting glitching
        wireframeMesh.scale.set(1.002, 1.002, 1.002);
        platformGroup.add(wireframeMesh);

        return platformGroup;
    }

    /**
     * Procedural platform generation algorithm. Drops elevation levels and expands 
     * separation thresholds as player momentum climbs.
     * @private
     * @param {number} playerSpeed - Current speedZ value of the player module.
     */
    _spawnPlatform(playerSpeed) {
        // Determine grid width (Randomly selecting between narrow 2-block and wide 5-block layouts)
        const blocksWide = Math.floor(Math.random() * 3) + 4; // Results in 4, 5, or 6
        const width = blocksWide * this.unitsPerBlock;
        const length = Math.random() * 30 + 25; // Continuous run length between 25 and 55 units

        // Build a continuous downhill track. Slope stays playable while the elevation
        // changes gradually instead of creating random impossible holes.
        const gap = 0;
        const drop = Math.random() * 1.2 + 0.35;

        // Apply spatial transformations to layout cursors
        this.currentY -= drop;
        this.nextPlatformZ -= gap;

        const platformGroup = this._createCompositeMesh(width, length);
        
        // Randomly stagger horizontal alignments relative to the central void axis
        const maxStaggerBlocks = 1;
        const gridStaggerX = (Math.floor(Math.random() * (maxStaggerBlocks * 2 + 1)) - maxStaggerBlocks) * (this.unitsPerBlock * 0.5);

        const zPos = this.nextPlatformZ - (length / 2);
        const yPos = this.currentY;
        const slopeAngle = Math.atan2(drop, length);
        platformGroup.rotation.x = -slopeAngle;
        platformGroup.position.set(gridStaggerX, yPos - 1 - (drop / 2), zPos);

        this.scene.add(platformGroup);

        // Map abstract platform boundaries to simple collision registry object
        this.platforms.push({
            group: platformGroup,
            y: yPos,
            slopeDrop: drop,
            minX: gridStaggerX - width / 2,
            maxX: gridStaggerX + width / 2,
            minZ: this.nextPlatformZ - length,
            maxZ: this.nextPlatformZ
        });

        // Terminate generation tracker sequence at the end of this platform
        this.nextPlatformZ -= length;

        // Populate the newly generated platform with hazards.
        this.obstacleManager.generateObstacles(this.platforms[this.platforms.length - 1], this.platforms.length - 1, blocksWide, length);
    }

    /**
     * Core update loop for the environment manager. Orchestrates streaming additions 
     * and garbage collection memory sweeps.
     * @param {number} playerZ - Current position.z coordinate of the player ball.
     * @param {number} playerSpeed - Current forward velocity vector of the player ball.
     */
    update(playerZ, playerSpeed) {
        this.obstacleManager.update(playerZ);

        // Keep generating runway geometries up to 250 units downstream ahead of the camera view
        while (this.nextPlatformZ > playerZ - 250) {
            this._spawnPlatform(playerSpeed);
        }

        // Garbage Collection: Safely strip spent runway meshes left 40 units behind the player field of view
        const clearBoundZ = playerZ + 40;
        this.platforms = this.platforms.filter(platform => {
            if (platform.minZ > clearBoundZ) {
                this.scene.remove(platform.group);
                return false;
            }
            return true;
        });
    }
}
