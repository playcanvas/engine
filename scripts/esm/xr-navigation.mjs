import { Color, Script, Vec2, Vec3 } from 'playcanvas';

/** @import { XrInputSource } from 'playcanvas' */

/**
 * Handles VR navigation with support for teleportation, smooth locomotion, and snap vertical movement.
 * All methods can be enabled simultaneously, allowing users to choose their preferred
 * navigation method on the fly.
 *
 * Teleportation: Point and teleport using trigger/pinch gestures
 * Smooth Locomotion: Use left thumbstick for XZ movement
 * Snap Turn: Use right thumbstick X-axis for snap turning
 * Snap Vertical: Use right thumbstick Y-axis to snap up/down (right grip for larger jumps)
 *
 * This script should be attached to a parent entity of the camera entity used for the XR
 * session. The entity hierarchy should be: XrNavigationEntity > CameraEntity for proper
 * locomotion handling. Use it in conjunction with the `XrControllers` script.
 */
class XrNavigation extends Script {
    static scriptName = 'xrNavigation';

    /**
     * Enable teleportation navigation using trigger/pinch gestures.
     * @attribute
     */
    enableTeleport = true;

    /**
     * Enable smooth locomotion using thumbsticks.
     * @attribute
     */
    enableMove = true;

    /**
     * Speed of smooth locomotion movement in meters per second.
     * @attribute
     * @range [0.1, 10]
     * @enabledif {enableMove}
     */
    movementSpeed = 1.5;

    /**
     * Angle in degrees for each snap turn.
     * @attribute
     * @range [15, 180]
     * @enabledif {enableMove}
     */
    rotateSpeed = 45;

    /**
     * Thumbstick deadzone threshold for movement.
     * @attribute
     * @range [0, 0.5]
     * @precision 0.01
     * @enabledif {enableMove}
     */
    movementThreshold = 0.1;

    /**
     * Thumbstick threshold to trigger snap turning.
     * @attribute
     * @range [0.1, 1]
     * @precision 0.01
     * @enabledif {enableMove}
     */
    rotateThreshold = 0.5;

    /**
     * Thumbstick threshold to reset snap turn state.
     * @attribute
     * @range [0.05, 0.5]
     * @precision 0.01
     * @enabledif {enableMove}
     */
    rotateResetThreshold = 0.25;

    /**
     * Maximum distance for teleportation in meters.
     * @attribute
     * @range [1, 50]
     * @enabledif {enableTeleport}
     */
    maxTeleportDistance = 10;

    /**
     * Radius of the teleport target indicator circle.
     * @attribute
     * @range [0.1, 2]
     * @precision 0.1
     * @enabledif {enableTeleport}
     */
    teleportIndicatorRadius = 0.2;

    /**
     * Number of segments for the teleport indicator circle.
     * @attribute
     * @range [8, 64]
     * @enabledif {enableTeleport}
     */
    teleportIndicatorSegments = 16;

    /**
     * Color for valid teleportation areas.
     * @attribute
     * @enabledif {enableTeleport}
     */
    validTeleportColor = new Color(0, 1, 0);

    /**
     * Color for invalid teleportation areas.
     * @attribute
     * @enabledif {enableTeleport}
     */
    invalidTeleportColor = new Color(1, 0, 0);

    /**
     * Color for controller rays.
     * @attribute
     * @enabledif {enableMove}
     */
    controllerRayColor = new Color(1, 1, 1);

    /**
     * Enable snap vertical movement using right thumbstick Y (controllers only).
     * @attribute
     */
    enableSnapVertical = true;

    /**
     * Height in meters for each vertical snap when using one grip.
     * @attribute
     * @range [0.1, 2]
     * @precision 0.1
     * @enabledif {enableSnapVertical}
     */
    snapVerticalHeight = 0.5;

    /**
     * Height in meters for each vertical snap when holding right grip (boost).
     * @attribute
     * @range [0.5, 10]
     * @precision 0.5
     * @enabledif {enableSnapVertical}
     */
    snapVerticalBoostHeight = 2.0;

    /**
     * Thumbstick Y threshold to trigger vertical snap.
     * @attribute
     * @range [0.1, 1]
     * @precision 0.01
     * @enabledif {enableSnapVertical}
     */
    snapVerticalThreshold = 0.5;

    /**
     * Thumbstick Y threshold to reset vertical snap state.
     * @attribute
     * @range [0.05, 0.5]
     * @precision 0.01
     * @enabledif {enableSnapVertical}
     */
    snapVerticalResetThreshold = 0.25;

    /** @type {Set<XrInputSource>} */
    inputSources = new Set();

    /** @type {Map<XrInputSource, boolean>} */
    activePointers = new Map();

    /** @type {Map<XrInputSource, { handleSelectStart: Function, handleSelectEnd: Function }>} */
    inputHandlers = new Map();

    // Rotation state for snap turning
    lastRotateValue = 0;

    // Vertical state for snap vertical movement
    lastVerticalValue = 0;

    // Pre-allocated objects for performance (object pooling)
    tmpVec2A = new Vec2();

    tmpVec2B = new Vec2();

    tmpVec3A = new Vec3();

    tmpVec3B = new Vec3();

    // Color objects
    validColor = new Color();

    invalidColor = new Color();

    rayColor = new Color();

    // Camera reference for movement calculations
    /** @type {import('playcanvas').Entity | null} */
    cameraEntity = null;

    initialize() {
        if (!this.app.xr) {
            console.error('XrNavigation script requires XR to be enabled on the application');
            return;
        }

        // Log enabled navigation methods
        const methods = [];
        if (this.enableTeleport) methods.push('teleportation');
        if (this.enableMove) methods.push('smooth movement');
        if (this.enableSnapVertical) methods.push('snap vertical');
        console.log(`XrNavigation: Enabled methods - ${methods.join(', ')}`);

        if (!this.enableTeleport && !this.enableMove && !this.enableSnapVertical) {
            console.warn('XrNavigation: All navigation methods are disabled. Navigation will not work.');
        }

        // Initialize color objects from Color attributes
        this.validColor.copy(this.validTeleportColor);
        this.invalidColor.copy(this.invalidTeleportColor);
        this.rayColor.copy(this.controllerRayColor);

        // Find camera entity - should be a child of this entity
        const cameraComponent = this.entity.findComponent('camera');
        this.cameraEntity = cameraComponent ? cameraComponent.entity : null;

        if (!this.cameraEntity) {
            console.warn('XrNavigation: Camera entity not found. Looking for camera in children...');

            // First try to find by name - cast to Entity since we know it should be one
            const foundByName = this.entity.findByName('camera');
            this.cameraEntity = /** @type {import('playcanvas').Entity | null} */ (foundByName);

            // If not found, search children for entity with camera component
            if (!this.cameraEntity) {
                for (const child of this.entity.children) {
                    const childEntity = /** @type {import('playcanvas').Entity} */ (child);
                    if (childEntity.camera) {
                        this.cameraEntity = childEntity;
                        break;
                    }
                }
            }

            if (!this.cameraEntity) {
                console.error('XrNavigation: No camera entity found. Movement calculations may not work correctly.');
            }
        }

        this.app.xr.input.on('add', (inputSource) => {
            const handleSelectStart = () => {
                this.activePointers.set(inputSource, true);
            };

            const handleSelectEnd = () => {
                this.activePointers.set(inputSource, false);
                this.tryTeleport(inputSource);
            };

            // Attach the handlers
            inputSource.on('selectstart', handleSelectStart);
            inputSource.on('selectend', handleSelectEnd);

            // Store the handlers in the map
            this.inputHandlers.set(inputSource, { handleSelectStart, handleSelectEnd });
            this.inputSources.add(inputSource);
        });

        this.app.xr.input.on('remove', (inputSource) => {
            const handlers = this.inputHandlers.get(inputSource);
            if (handlers) {
                inputSource.off('selectstart', handlers.handleSelectStart);
                inputSource.off('selectend', handlers.handleSelectEnd);
                this.inputHandlers.delete(inputSource);
            }
            this.activePointers.delete(inputSource);
            this.inputSources.delete(inputSource);
        });
    }

    findPlaneIntersection(origin, direction) {
        // Find intersection with y=0 plane
        if (Math.abs(direction.y) < 0.00001) return null;  // Ray is parallel to plane

        const t = -origin.y / direction.y;
        if (t < 0) return null;  // Intersection is behind the ray

        return new Vec3(
            origin.x + direction.x * t,
            0,
            origin.z + direction.z * t
        );
    }

    tryTeleport(inputSource) {
        const origin = inputSource.getOrigin();
        const direction = inputSource.getDirection();

        const hitPoint = this.findPlaneIntersection(origin, direction);
        if (hitPoint) {
            // Adjust for camera's local XZ offset so the user's head ends up at the target
            if (this.cameraEntity) {
                const cameraLocalPos = this.cameraEntity.getLocalPosition();
                hitPoint.x -= cameraLocalPos.x;
                hitPoint.z -= cameraLocalPos.z;
            }

            const cameraY = this.entity.getPosition().y;
            hitPoint.y = cameraY;
            this.entity.setPosition(hitPoint);
        }
    }

    update(dt) {
        // Handle smooth locomotion and snap turning
        if (this.enableMove) {
            this.handleSmoothLocomotion(dt);
        }

        // Handle snap vertical movement (controllers only)
        if (this.enableSnapVertical) {
            this.handleSnapVertical();
        }

        // Handle teleportation
        if (this.enableTeleport) {
            this.handleTeleportation();
        }

        // Always show controller rays for debugging/visualization
        this.renderControllerRays();
    }

    handleSmoothLocomotion(dt) {
        if (!this.cameraEntity) return;

        for (const inputSource of this.inputSources) {
            // Only process controllers with gamepads
            if (!inputSource.gamepad) continue;

            // Left controller - movement
            if (inputSource.handedness === 'left') {
                // Get thumbstick input (axes[2] = X, axes[3] = Y)
                this.tmpVec2A.set(inputSource.gamepad.axes[2], inputSource.gamepad.axes[3]);

                // Check if input exceeds deadzone
                if (this.tmpVec2A.length() > this.movementThreshold) {
                    this.tmpVec2A.normalize();

                    // Calculate camera-relative movement direction
                    const forward = this.cameraEntity.forward;
                    this.tmpVec2B.x = forward.x;
                    this.tmpVec2B.y = forward.z;
                    this.tmpVec2B.normalize();

                    // Calculate rotation angle based on camera yaw
                    const rad = Math.atan2(this.tmpVec2B.x, this.tmpVec2B.y) - Math.PI / 2;

                    // Apply rotation to movement vector
                    const t = this.tmpVec2A.x * Math.sin(rad) - this.tmpVec2A.y * Math.cos(rad);
                    this.tmpVec2A.y = this.tmpVec2A.y * Math.sin(rad) + this.tmpVec2A.x * Math.cos(rad);
                    this.tmpVec2A.x = t;

                    // Scale by movement speed and delta time
                    this.tmpVec2A.mulScalar(this.movementSpeed * dt);

                    // Apply movement to camera parent (this entity)
                    this.entity.translate(this.tmpVec2A.x, 0, this.tmpVec2A.y);
                }
            } else if (inputSource.handedness === 'right') { // Right controller - snap turning
                this.handleSnapTurning(inputSource);
            }
        }
    }

    handleSnapTurning(inputSource) {
        // Get rotation input from right thumbstick X-axis
        const rotate = -inputSource.gamepad.axes[2];

        // Hysteresis system to prevent multiple rotations from single gesture
        if (this.lastRotateValue > 0 && rotate < this.rotateResetThreshold) {
            this.lastRotateValue = 0;
        } else if (this.lastRotateValue < 0 && rotate > -this.rotateResetThreshold) {
            this.lastRotateValue = 0;
        }

        // Only rotate when thumbstick crosses threshold from neutral position
        if (this.lastRotateValue === 0 && Math.abs(rotate) > this.rotateThreshold) {
            this.lastRotateValue = Math.sign(rotate);

            if (this.cameraEntity) {
                // Rotate around camera position, not entity origin
                this.tmpVec3A.copy(this.cameraEntity.getLocalPosition());
                this.entity.translateLocal(this.tmpVec3A);
                this.entity.rotateLocal(0, Math.sign(rotate) * this.rotateSpeed, 0);
                this.entity.translateLocal(this.tmpVec3A.mulScalar(-1));
            }
        }
    }

    /**
     * Handles snap vertical movement using right thumbstick Y.
     * Uses hysteresis to prevent multiple snaps from a single gesture.
     * Hold right grip for larger snap height (boost).
     *
     * @private
     */
    handleSnapVertical() {
        // Find right controller
        let rightController = null;

        for (const inputSource of this.inputSources) {
            if (!inputSource.gamepad) continue;
            if (inputSource.handedness === 'right') {
                rightController = inputSource;
                break;
            }
        }

        if (!rightController || !rightController.gamepad) return;

        // Get vertical input from right thumbstick Y axis (negative = up on stick)
        const vertical = -rightController.gamepad.axes[3];

        // Hysteresis system to prevent multiple snaps from single gesture
        if (this.lastVerticalValue > 0 && vertical < this.snapVerticalResetThreshold) {
            this.lastVerticalValue = 0;
        } else if (this.lastVerticalValue < 0 && vertical > -this.snapVerticalResetThreshold) {
            this.lastVerticalValue = 0;
        }

        // Only snap when thumbstick crosses threshold from neutral position
        if (this.lastVerticalValue === 0 && Math.abs(vertical) > this.snapVerticalThreshold) {
            this.lastVerticalValue = Math.sign(vertical);

            // Check if right grip is held for boost
            const rightGripPressed = rightController.gamepad.buttons[1]?.pressed;
            const snapHeight = rightGripPressed
                ? this.snapVerticalBoostHeight
                : this.snapVerticalHeight;

            // Apply vertical snap (positive = up, negative = down)
            this.entity.translate(0, Math.sign(vertical) * snapHeight, 0);
        }
    }

    handleTeleportation() {
        for (const inputSource of this.inputSources) {
            // Only show teleportation ray when trigger/select is pressed
            if (!this.activePointers.get(inputSource)) continue;

            const start = inputSource.getOrigin();
            const direction = inputSource.getDirection();

            const hitPoint = this.findPlaneIntersection(start, direction);

            if (hitPoint && this.isValidTeleportDistance(hitPoint)) {
                // Draw line to intersection point
                this.app.drawLine(start, hitPoint, this.validColor);
                this.drawTeleportIndicator(hitPoint);
            } else {
                // Draw full length ray if no intersection or invalid distance
                this.tmpVec3B.copy(direction).mulScalar(this.maxTeleportDistance).add(start);
                this.app.drawLine(start, this.tmpVec3B, this.invalidColor);
            }
        }
    }

    renderControllerRays() {
        // Only render controller rays when smooth movement is enabled
        // (teleport rays are handled separately in handleTeleportation)
        if (!this.enableMove) return;

        for (const inputSource of this.inputSources) {
            // Skip if currently teleporting (handled by handleTeleportation)
            if (this.activePointers.get(inputSource)) continue;

            const start = inputSource.getOrigin();
            this.tmpVec3B.copy(inputSource.getDirection()).mulScalar(2).add(start);
            this.app.drawLine(start, this.tmpVec3B, this.rayColor);
        }
    }

    isValidTeleportDistance(hitPoint) {
        const distance = hitPoint.distance(this.entity.getPosition());
        return distance <= this.maxTeleportDistance;
    }

    drawTeleportIndicator(point) {
        // Draw a circle at the teleport point using configurable attributes
        const segments = this.teleportIndicatorSegments;
        const radius = this.teleportIndicatorRadius;

        for (let i = 0; i < segments; i++) {
            const angle1 = (i / segments) * Math.PI * 2;
            const angle2 = ((i + 1) / segments) * Math.PI * 2;

            const x1 = point.x + Math.cos(angle1) * radius;
            const z1 = point.z + Math.sin(angle1) * radius;
            const x2 = point.x + Math.cos(angle2) * radius;
            const z2 = point.z + Math.sin(angle2) * radius;

            // Use pre-allocated vectors to avoid garbage collection
            this.tmpVec3A.set(x1, 0.01, z1);  // Slightly above ground to avoid z-fighting
            this.tmpVec3B.set(x2, 0.01, z2);

            this.app.drawLine(this.tmpVec3A, this.tmpVec3B, this.validColor);
        }
    }
}

export { XrNavigation };
