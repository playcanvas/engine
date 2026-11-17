// The voxels the particles of the SceneParticlesEffect collide with, see VoxelOccupancy#getTexture,
// and the random numbers of its compute shaders.

// The solid voxels, 1 bit per voxel. Each texel of the volume texture holds a block of 4x4x4
// voxels as a 64 bit mask. Without voxels, the texture is a placeholder and the grid is empty.
var voxels: texture_3d<u32>;

// the world position of the min corner of the voxel grid
uniform voxelGridMin: vec3f;

// the number of voxels of the grid along each axis, zero without voxels
uniform voxelGridSize: vec3f;

// the size of a voxel, in world units
uniform voxelSize: f32;

fn voxelsEnabled() -> bool {
    return uniform.voxelGridSize.x > 0.0;
}

fn voxelOf(position: vec3f) -> vec3i {
    return vec3i(floor((position - uniform.voxelGridMin) / uniform.voxelSize));
}

// the voxels outside of the grid are empty
fn voxelSolidAt(voxel: vec3i) -> bool {
    if (any(voxel < vec3i(0)) || any(voxel >= vec3i(uniform.voxelGridSize))) {
        return false;
    }

    let mask = textureLoad(voxels, voxel >> vec3u(2u), 0).xy;
    let local = vec3u(voxel & vec3i(3));
    let bit = local.x + local.y * 4u + local.z * 16u;
    let word = select(mask.y, mask.x, bit < 32u);
    return ((word >> (bit & 31u)) & 1u) != 0u;
}

fn voxelSolid(position: vec3f) -> bool {
    return voxelSolidAt(voxelOf(position));
}

// The surface normal at a voxel, pointing away from the solid voxels around it. Their offsets in
// the 3x3x3 neighborhood are summed, which smooths out the staircase of the voxels - a bounce off a
// slanted wall leaves along the wall's normal, not the normal of a voxel face.
fn voxelNormal(position: vec3f, fallback: vec3f) -> vec3f {
    let center = voxelOf(position);
    var gradient = vec3f(0.0);
    for (var z = -1; z <= 1; z++) {
        for (var y = -1; y <= 1; y++) {
            for (var x = -1; x <= 1; x++) {
                let offset = vec3i(x, y, z);
                if (voxelSolidAt(center + offset)) {
                    gradient -= vec3f(offset);
                }
            }
        }
    }
    let len = length(gradient);
    return select(fallback, gradient / len, len > 0.001);
}

// ------ Random numbers ------

fn hash(value: u32) -> u32 {
    let state = value * 747796405u + 2891336453u;
    let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
}

fn random(rng: ptr<function, u32>) -> f32 {
    *rng = hash(*rng);
    return f32(*rng >> 8u) / 16777216.0;
}

fn randomDirection(rng: ptr<function, u32>) -> vec3f {
    let z = random(rng) * 2.0 - 1.0;
    let angle = random(rng) * 6.2831853;
    let r = sqrt(max(0.0, 1.0 - z * z));
    return vec3f(r * cos(angle), r * sin(angle), z);
}
