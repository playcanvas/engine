uniform matrix_viewProjection : mat4x4f; 

// particle storage buffer in read-only mode
var<storage, read> particles: array<Particle>;

// quad vertices - used to expand the particles into quads
var<private> pos : array<vec2f, 4> = array<vec2f, 4>(
    vec2(-1.0, 1.0), vec2(1.0, 1.0), vec2(-1.0, -1.0), vec2(1.0, -1.0)
);

const particleSize = 0.04;

varying color: vec4f;

@vertex
fn vertexMain(input : VertexInput) -> VertexOutput {

    // get particle position from the storage buffer
    var particleIndex = input.vertexIndex / 4;
    var particlePos = particles[particleIndex].position;

    // extract camera left and up vectors from the view-projection matrix
    var left = vec3f(uniform.matrix_viewProjection[0][0], uniform.matrix_viewProjection[1][0], uniform.matrix_viewProjection[2][0]);
    var up = vec3f(uniform.matrix_viewProjection[0][1], uniform.matrix_viewProjection[1][1], uniform.matrix_viewProjection[2][1]);

    // expand the particle into a quad
    var quadVertexIndex = input.vertexIndex % 4;
    var quadPos = vec3f(pos[quadVertexIndex] * particleSize, 0.0);
    var expandedPos = quadPos.x * left + quadPos.y * up;

    // projected position
    var output : VertexOutput;
    output.position = uniform.matrix_viewProjection * vec4(particlePos + expandedPos, 1.0);

    // lerp between red and yellow based on the time since the particle collision
    output.color = mix(vec4f(1.0, 1.0, 0.0, 1.0), vec4f(1.0, 0.0, 0.0, 1.0), particles[particleIndex].collisionTime / 7.0);
    return output;
}
