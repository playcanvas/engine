// Work-buffer-backed geometry for color-only (spherical harmonics) work buffer updates.
// Instead of re-reading geometry from the source format textures, getCenter/getRotation/getScale
// read back the world-space data previously written to the work buffer at the destination pixel,
// and convert it to the splat's local space so user modifier code keeps working. The stored data
// already includes the model transform and modifySplatCenter / modifySplatRotationScale, so
// neither is re-applied by this path.
export default /* wgsl */`
#ifdef GSPLAT_WORKBUFFER_GEOMETRY

    // world-space transform data previously written to the work buffer (see gsplatWriteVS)
    var uWorkBufferTransformA: texture_2d<u32>;
    var uWorkBufferTransformB: texture_2d<u32>;

    // inverse of matrix_model, to convert stored world-space data back to local space
    uniform matrix_model_inverse: mat4x4f;

    // world-space camera position
    uniform uCameraPosition: vec3f;

    var<private> wbCoord: vec2i;
    var<private> wbTransformA: vec4u;

    // cache transformA at the destination pixel; must be called before any getters
    fn initWorkBufferGeometry(coord: vec2i) {
        wbCoord = coord;
        wbTransformA = textureLoad(uWorkBufferTransformA, coord, 0);
    }

    fn workBufferWorldCenter() -> vec3f {
        return vec3f(bitcast<f32>(wbTransformA.x), bitcast<f32>(wbTransformA.y), bitcast<f32>(wbTransformA.z));
    }

    // world-space rotation (x,y,z,w), decoded to match the work buffer write encoding
    fn workBufferWorldRotation() -> vec4f {
        #ifdef GSPLAT_WORKBUFFER_COMPACT
            // half-angle projected quaternion, 11+11+10 bits (see containerCompactWrite)
            let data = textureLoad(uWorkBufferTransformB, wbCoord, 0).x;
            let p = vec3f(
                f32(data & 0x7FFu) / 2047.0 * 2.0 - 1.0,
                f32((data >> 11u) & 0x7FFu) / 2047.0 * 2.0 - 1.0,
                f32((data >> 22u) & 0x3FFu) / 1023.0 * 2.0 - 1.0
            );
            let d = dot(p, p);
            return vec4f(sqrt(max(0.0, 2.0 - d)) * p, 1.0 - d);
        #else
            // rotation.xy in transformA.w, rotation.z in transformB.x (see containerPackedWrite)
            let rotXY = unpack2x16float(wbTransformA.w);
            let r = vec3f(rotXY, unpack2x16float(textureLoad(uWorkBufferTransformB, wbCoord, 0).x).x);
            return vec4f(r, sqrt(max(0.0, 1.0 - dot(r, r))));
        #endif
    }

    fn workBufferWorldScale() -> vec3f {
        #ifdef GSPLAT_WORKBUFFER_COMPACT
            // log-encoded scale, 3x8 bits: 0 = true zero, 1-255 maps to e^-12..e^9 (see containerCompactWrite)
            let data = wbTransformA.w;
            let sx = f32(data & 0xFFu);
            let sy = f32((data >> 8u) & 0xFFu);
            let sz = f32((data >> 16u) & 0xFFu);
            let logRange = 21.0 / 255.0;
            let logMin = -12.0;
            return vec3f(
                select(exp(sx * logRange + logMin), 0.0, sx == 0.0),
                select(exp(sy * logRange + logMin), 0.0, sy == 0.0),
                select(exp(sz * logRange + logMin), 0.0, sz == 0.0)
            );
        #else
            let b = textureLoad(uWorkBufferTransformB, wbCoord, 0).xy;
            return vec3f(unpack2x16float(b.x).y, unpack2x16float(b.y));
        #endif
    }

    // rotate vector by the inverse of unit quaternion q (x,y,z,w)
    fn quatRotateInv(q: vec4f, v: vec3f) -> vec3f {
        let t = -q.xyz;
        return v + 2.0 * cross(t, cross(t, v) + q.w * v);
    }

    // Source-format-compatible getters for user modifier code: local-space values reconstructed
    // from the stored world-space data (quantized by the work buffer format, so rotation and
    // scale are approximate).
    fn getCenter() -> vec3f {
        return (uniform.matrix_model_inverse * vec4f(workBufferWorldCenter(), 1.0)).xyz;
    }

    // returns (w,x,y,z) to match the source format getRotation convention
    fn getRotation() -> vec4f {
        let worldRotation = workBufferWorldRotation();
        let localRotation = vec4f(quatMul(half4(vec4f(-uniform.model_rotation.xyz, uniform.model_rotation.w)), half4(worldRotation)));
        return localRotation.wxyz;
    }

    fn getScale() -> vec3f {
        return workBufferWorldScale() / uniform.model_scale;
    }

#endif
`;
