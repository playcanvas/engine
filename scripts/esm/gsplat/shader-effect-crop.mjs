import { Vec3 } from 'playcanvas';
import { GsplatShaderEffect } from './gsplat-shader-effect.mjs';

const shaderGLSL = /* glsl */`
uniform vec3 uAabbMin;
uniform vec3 uAabbMax;
uniform float uEdgeScaleFactor;

void modifyCenter(inout vec3 center) {
    // No modifications needed
}

void modifyCovariance(vec3 originalCenter, vec3 modifiedCenter, inout vec3 covA, inout vec3 covB) {
    // Check if splat is inside AABB
    bool insideAABB = all(greaterThanEqual(modifiedCenter, uAabbMin)) && all(lessThanEqual(modifiedCenter, uAabbMax));
    
    // If outside AABB, make invisible by scaling to 0
    if (!insideAABB) {
        gsplatMakeRound(covA, covB, 0.0);
        return;
    }
    
    #ifdef GSPLAT_PRECISE_CROP
    // covA and covB represent a 3x3 covariance matrix:
    // [covA.x  covA.y  covA.z]
    // [covA.y  covB.x  covB.y]
    // [covA.z  covB.y  covB.z]
    
    // Conservative bound: use sqrt(trace) * 3.0 (3 sigma)
    // trace = sum of diagonal = covA.x + covB.x + covB.z
    // This gives the maximum possible extent (max_eigenvalue <= trace)
    float trace = covA.x + covB.x + covB.z;
    float maxRadius = sqrt(max(trace, 0.001)) * 3.0;
    
    // Find minimum distance to any AABB face
    vec3 distToMin = modifiedCenter - uAabbMin;
    vec3 distToMax = uAabbMax - modifiedCenter;
    float minDist = min(
        min(min(distToMin.x, distToMin.y), distToMin.z),
        min(min(distToMax.x, distToMax.y), distToMax.z)
    );
    
    // Scale if splat would exceed boundary
    if (maxRadius > minDist) {
        float scale = (minDist / maxRadius) * uEdgeScaleFactor;
        covA *= scale;
        covB *= scale;
    }
    #endif
}

void modifyColor(vec3 center, inout vec4 color) {
    // No color modification needed
}
`;

const shaderWGSL = /* wgsl */`
uniform uAabbMin: vec3f;
uniform uAabbMax: vec3f;
uniform uEdgeScaleFactor: f32;

fn modifyCenter(center: ptr<function, vec3f>) {
    // No modifications needed
}

fn modifyCovariance(originalCenter: vec3f, modifiedCenter: vec3f, covA: ptr<function, vec3f>, covB: ptr<function, vec3f>) {
    // Check if splat is inside AABB
    let insideAABB = all(modifiedCenter >= uniform.uAabbMin) && all(modifiedCenter <= uniform.uAabbMax);
    
    // If outside AABB, make invisible by scaling to 0
    if (!insideAABB) {
        gsplatMakeRound(covA, covB, 0.0);
        return;
    }
    
    #if GSPLAT_PRECISE_CROP
    // covA and covB represent a 3x3 covariance matrix:
    // [covA.x  covA.y  covA.z]
    // [covA.y  covB.x  covB.y]
    // [covA.z  covB.y  covB.z]
    
    // Conservative bound: use sqrt(trace) * 3.0 (3 sigma)
    // trace = sum of diagonal = covA.x + covB.x + covB.z
    // This gives the maximum possible extent (max_eigenvalue <= trace)
    let trace = (*covA).x + (*covB).x + (*covB).z;
    let maxRadius = sqrt(max(trace, 0.001)) * 3.0;
    
    // Find minimum distance to any AABB face
    let distToMin = modifiedCenter - uniform.uAabbMin;
    let distToMax = uniform.uAabbMax - modifiedCenter;
    let minDist = min(
        min(min(distToMin.x, distToMin.y), distToMin.z),
        min(min(distToMax.x, distToMax.y), distToMax.z)
    );
    
    // Scale if splat would exceed boundary
    if (maxRadius > minDist) {
        let scale = (minDist / maxRadius) * uniform.uEdgeScaleFactor;
        (*covA) = (*covA) * scale;
        (*covB) = (*covB) * scale;
    }
    #endif
}

fn modifyColor(center: vec3f, color: ptr<function, vec4f>) {
    // No color modification needed
}
`;

/**
 * Crop shader effect for gaussian splats.
 * Drops all splats outside the specified AABB by scaling them to 0.
 * 
 * When GSPLAT_PRECISE_CROP is defined on the material, also scales down splats near the edges
 * based on their covariance matrix so they don't extend beyond the boundary.
 * Uses a conservative estimate based on the trace of the covariance matrix (3 standard deviations).
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

