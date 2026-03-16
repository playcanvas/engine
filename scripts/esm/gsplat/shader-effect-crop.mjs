import { Vec3 } from 'playcanvas';
import { GsplatShaderEffect } from './gsplat-shader-effect.mjs';

const shaderGLSL = /* glsl */`
uniform vec3 uAabbMin;
uniform vec3 uAabbMax;
uniform float uEdgeScaleFactor;

void modifySplatCenter(inout vec3 center) {
    // No modifications needed
}

void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
    // Check if splat is inside AABB
    bool insideAABB = all(greaterThanEqual(modifiedCenter, uAabbMin)) && all(lessThanEqual(modifiedCenter, uAabbMax));
    
    // If outside AABB, make invisible by scaling to 0
    if (!insideAABB) {
        scale = vec3(0.0);
        return;
    }
    
    #ifdef GSPLAT_PRECISE_CROP
    // Conservative bound: use length(scale) * 3.0 (3 sigma)
    // This gives the maximum possible extent
    float maxRadius = length(scale) * 3.0;
    
    // Find minimum distance to any AABB face
    vec3 distToMin = modifiedCenter - uAabbMin;
    vec3 distToMax = uAabbMax - modifiedCenter;
    float minDist = min(
        min(min(distToMin.x, distToMin.y), distToMin.z),
        min(min(distToMax.x, distToMax.y), distToMax.z)
    );
    
    // Scale if splat would exceed boundary
    if (maxRadius > minDist) {
        float s = (minDist / maxRadius) * uEdgeScaleFactor;
        scale *= s;
    }
    #endif
}

void modifySplatColor(vec3 center, inout vec4 color) {
    // No color modification needed
}
`;

const shaderWGSL = /* wgsl */`
uniform uAabbMin: vec3f;
uniform uAabbMax: vec3f;
uniform uEdgeScaleFactor: f32;

fn modifySplatCenter(center: ptr<function, vec3f>) {
    // No modifications needed
}

fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
    // Check if splat is inside AABB
    let insideAABB = all(modifiedCenter >= uniform.uAabbMin) && all(modifiedCenter <= uniform.uAabbMax);
    
    // If outside AABB, make invisible by scaling to 0
    if (!insideAABB) {
        *scale = vec3f(0.0);
        return;
    }
    
    #if GSPLAT_PRECISE_CROP
    // Conservative bound: use length(scale) * 3.0 (3 sigma)
    // This gives the maximum possible extent
    let maxRadius = length(*scale) * 3.0;
    
    // Find minimum distance to any AABB face
    let distToMin = modifiedCenter - uniform.uAabbMin;
    let distToMax = uniform.uAabbMax - modifiedCenter;
    let minDist = min(
        min(min(distToMin.x, distToMin.y), distToMin.z),
        min(min(distToMax.x, distToMax.y), distToMax.z)
    );
    
    // Scale if splat would exceed boundary
    if (maxRadius > minDist) {
        let s = (minDist / maxRadius) * uniform.uEdgeScaleFactor;
        *scale = (*scale) * s;
    }
    #endif
}

fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
    // No color modification needed
}
`;

/**
 * Crop shader effect for gaussian splats.
 * Drops all splats outside the specified AABB by scaling them to 0.
 *
 * When GSPLAT_PRECISE_CROP is defined on the material, also scales down splats near the edges
 * based on their scale so they don't extend beyond the boundary.
 * Uses a conservative estimate based on the length of the scale vector (3 standard deviations).
 *
 * The edgeScaleFactor attribute controls how aggressively edge splats are scaled down:
 * - 1.0 = minimal scaling (just enough to touch the edge)
 * - 0.5 = more aggressive scaling (default, reduces size by additional 50%)
 * - Lower values = more aggressive scaling
 *
 * @example
 * // Add the script to a gsplat entity
 * entity.addComponent('script');
 * const cropScript = entity.script.create(GsplatCropShaderEffect);
 * cropScript.aabbMin.set(-1, -1, -1);
 * cropScript.aabbMax.set(1, 1, 1);
 * cropScript.edgeScaleFactor = 0.5; // Default value
 *
 * // Enable precise cropping
 * material.setDefine('GSPLAT_PRECISE_CROP', '');
 * material.update();
 */
class GsplatCropShaderEffect extends GsplatShaderEffect {
    static scriptName = 'gsplatCropShaderEffect';

    // Reusable arrays for uniform updates
    _aabbMinArray = [0, 0, 0];

    _aabbMaxArray = [0, 0, 0];

    /**
     * Minimum corner of AABB in world space
     * @attribute
     */
    aabbMin = new Vec3(-0.5, -0.5, -0.5);

    /**
     * Maximum corner of AABB in world space
     * @attribute
     */
    aabbMax = new Vec3(0.5, 0.5, 0.5);

    /**
     * Scale factor for edge splats (lower = more aggressive scaling)
     * @attribute
     */
    edgeScaleFactor = 0.5;

    getShaderGLSL() {
        return shaderGLSL;
    }

    getShaderWGSL() {
        return shaderWGSL;
    }

    updateEffect(effectTime, dt) {
        // Set AABB uniforms
        this._aabbMinArray[0] = this.aabbMin.x;
        this._aabbMinArray[1] = this.aabbMin.y;
        this._aabbMinArray[2] = this.aabbMin.z;
        this.setUniform('uAabbMin', this._aabbMinArray);

        this._aabbMaxArray[0] = this.aabbMax.x;
        this._aabbMaxArray[1] = this.aabbMax.y;
        this._aabbMaxArray[2] = this.aabbMax.z;
        this.setUniform('uAabbMax', this._aabbMaxArray);

        // Set edge scale factor
        this.setUniform('uEdgeScaleFactor', this.edgeScaleFactor);
    }
}

export { GsplatCropShaderEffect };
