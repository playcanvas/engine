// uniform buffer for the mesh
struct ub_mesh {
    matrix_model : mat4x4f
}

// uniform buffer per view - this is provided by the engine and the layout just needs to match
struct ub_view {
    matrix_viewProjection : mat4x4f
}

@group(2) @binding(0) var<uniform> ubMesh : ub_mesh;
@group(1) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(0) var<uniform> ubView : ub_view;

// quad vertices - used to expand the particles into quads
var<private> pos : array<vec2f, 4> = array<vec2f, 4>(
    vec2(-1.0, 1.0), vec2(1.0, 1.0), vec2(-1.0, -1.0), vec2(1.0, -1.0)
);

const particleSize = 0.04;

struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) color: vec4f
}

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {

    // get particle position from the storage buffer
    var particleIndex = vertexIndex / 4;
    var particlePos = particles[particleIndex].position;

    // extract camera left and up vectors from the view-projection matrix
    var left = vec3f(ubView.matrix_viewProjection[0][0], ubView.matrix_viewProjection[1][0], ubView.matrix_viewProjection[2][0]);
    var up = vec3f(ubView.matrix_viewProjection[0][1], ubView.matrix_viewProjection[1][1], ubView.matrix_viewProjection[2][1]);

    // expand the particle into a quad
    var quadVertexIndex = vertexIndex % 4;
    var quadPos = vec3f(pos[quadVertexIndex] * particleSize, 0.0);
    var expandedPos = quadPos.x * left + quadPos.y * up;

    // projected position
    var output : VertexOutput;
    output.position = ubView.matrix_viewProjection * vec4(particlePos + expandedPos, 1.0);

    // lerp between red and yellow based on the time since the particle collision
    output.color = mix(vec4f(1.0, 1.0, 0.0, 1.0), vec4f(1.0, 0.0, 0.0, 1.0), particles[particleIndex].collisionTime / 7.0);

    return output;
}

@fragment
fn fragmentMain(input : VertexOutput) -> @location(0) vec4f {
    return input.color;
}
