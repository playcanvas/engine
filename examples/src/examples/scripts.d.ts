import type { Entity, ScriptType, Vec3 } from 'playcanvas';

// TODO: remove once examples use CameraControls (#9816)
/**
 * The classic `orbitCamera` script from `scripts/camera/orbit-camera.js`, which examples reach
 * through the script component by name.
 */
interface OrbitCamera extends ScriptType {
    distanceMax: number;
    distanceMin: number;
    pitchAngleMax: number;
    pitchAngleMin: number;
    inertiaFactor: number;
    focusEntity: Entity;
    frameOnStart: boolean;
    distance: number;
    orthoHeight: number;
    pitch: number;
    yaw: number;
    pivotPoint: Vec3;
    focus(focusEntity: Entity): void;
    resetAndLookAtPoint(resetPoint: Vec3, lookAtPoint: Vec3): void;
    reset(yaw: number, pitch: number, distance: number): void;
}

declare module 'playcanvas' {
    interface ScriptComponent {
        orbitCamera?: OrbitCamera;
    }
}
