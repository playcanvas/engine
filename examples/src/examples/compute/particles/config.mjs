/**
 * @type {import('../../../../types.mjs').ExampleConfig}
 */
export default {
    WEBGPU_REQUIRED: true,
    FILES: {

        // part of the shader containing the Particle struct that is shared between the simulation
        // and rendering shaders
        'shader-shared.wgsl': /* wgsl */`
            struct Particle {
                position: vec3<f32>,
                collisionTime: f32,
                positionOld: vec3<f32>,
                originalVelocity: vec3<f32>
            }
        `,

        // simulation compute shader
        'shader-simulation.wgsl': /* wgsl */ `

            // uniform buffer for the compute shader
            struct ub_compute {
                count: u32,              // number of particles
                dt: f32,                 // delta time
                sphereCount: u32         // number of spheres
            }

            // sphere struct used for the colliders
            struct Sphere {
                center: vec3<f32>,
                radius: f32
            }

            @group(0) @binding(0) var<uniform> ubCompute : ub_compute;
            @group(0) @binding(1) var<storage, read_write> particles: array<Particle>;
            @group(0) @binding(2) var<storage, read> spheres: array<Sphere>;
            
            @compute @workgroup_size(64)
            fn main(@builtin(global_invocation_id) global_invocation_id: vec3u) {

                // particle index - ignore if out of bounds (as they get batched into groups of 64)
                let index = global_invocation_id.x * 1024 + global_invocation_id.y;
                if (index >= ubCompute.count) { return; }

                // update times
                var particle = particles[index];
                particle.collisionTime += ubCompute.dt;

                // if particle gets too far, reset it to its original position / velocity
                var distance = length(particle.position);
                if (distance > 300.0) {
                    var temp = particle.position;
                    var wrapDistance = distance - 300.0;
                    particle.collisionTime = 100.0;
                    particle.positionOld = vec3f(0.0, 0.0, 0.0) + wrapDistance * particle.originalVelocity;
                    particle.position = particle.originalVelocity;
                }

                // Verlet integration for a simple physics simulation
                var delta = (particle.position - particle.positionOld);
                var next = particle.position + delta;

                // handle collisions with spheres
                for (var i = 0u; i < ubCompute.sphereCount; i++) {
                    var center = spheres[i].center;
                    var radius = spheres[i].radius;

                    // if the particle is inside the sphere, move it to the surface
                    if (length(next - center) < radius) {
                        next = center + normalize(next - center) * radius;
                        particle.collisionTime = 0.0;
                    }
                }

                // write out the changes
                particle.positionOld = particle.position;
                particle.position = next;
                particles[index] = particle;
            }
        `,

        // rendering shader
        'shader-rendering.wgsl': /* wgsl */`

            // uniform buffer for the mesh
            struct ub_mesh {
                matrix_model : mat4x4f
            }

            // uniform buffer per view - this is provided by the engine and the layout just needs to match
            struct ub_view {
                matrix_viewProjection : mat4x4f
            }

            @group(0) @binding(0) var<uniform> uvMesh : ub_mesh;
            @group(0) @binding(1) var<storage, read> particles: array<Particle>;
            @group(1) @binding(0) var<uniform> ubView : ub_view;

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
        `
    }
};
