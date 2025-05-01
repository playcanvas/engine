import { Color, Script, Vec3 } from 'playcanvas';

/** @import { XrInputSource } from 'playcanvas' */

/**
 * Handles VR teleportation navigation by allowing users to point and teleport using either
 * hands or tracked controllers. Shows a visual ray and target indicator when the user holds
 * the select button (trigger) or makes a pinch gesture with hand tracking, and teleports to
 * the target location when released.
 *
 * This script should be attached to a parent entity of the camera entity used for the XR
 * session. Use it in conjunction with the `XrControllers` script to handle the rendering of
 * the controllers.
 */
class XrNavigation extends Script {
    static scriptName = 'xrNavigation';

    /** @type {Set<XrInputSource>} */
    inputSources = new Set();

    /** @type {Map<XrInputSource, boolean>} */
    activePointers = new Map();

    validColor = new Color(0, 1, 0);    // Green for valid teleport

    invalidColor = new Color(1, 0, 0);   // Red for invalid teleport

    /** @type {Map<XrInputSource, { handleSelectStart: Function, handleSelectEnd: Function }>} */
    inputHandlers = new Map();

    initialize() {
        if (!this.app.xr) {
            console.error('XrNavigation script requires XR to be enabled on the application');
            return;
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
            const cameraY = this.entity.getPosition().y;
            hitPoint.y = cameraY;
            this.entity.setPosition(hitPoint);
        }
    }

    update() {
        for (const inputSource of this.inputSources) {
            // Only show ray when trigger is pressed
            if (!this.activePointers.get(inputSource)) continue;

            const start = inputSource.getOrigin();
            const direction = inputSource.getDirection();

            const hitPoint = this.findPlaneIntersection(start, direction);

            if (hitPoint) {
                // Draw line to intersection point
                this.app.drawLine(start, hitPoint, this.validColor);
                this.drawTeleportIndicator(hitPoint);
            } else {
                // Draw full length ray if no intersection
                const end = start.clone().add(
                    direction.clone().mulScalar(100)
                );
                this.app.drawLine(start, end, this.invalidColor);
            }
        }
    }

    drawTeleportIndicator(point) {
        // Draw a circle at the teleport point
        const segments = 32;
        const radius = 0.2;

        for (let i = 0; i < segments; i++) {
            const angle1 = (i / segments) * Math.PI * 2;
            const angle2 = ((i + 1) / segments) * Math.PI * 2;

            const x1 = point.x + Math.cos(angle1) * radius;
            const z1 = point.z + Math.sin(angle1) * radius;
            const x2 = point.x + Math.cos(angle2) * radius;
            const z2 = point.z + Math.sin(angle2) * radius;

            this.app.drawLine(
                new Vec3(x1, 0.01, z1),  // Slightly above ground to avoid z-fighting
                new Vec3(x2, 0.01, z2),
                this.validColor
            );
        }
    }
}

export { XrNavigation };
