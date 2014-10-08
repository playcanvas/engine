
// VERTEX SHADER BODY
void main(void)
{
    vec2 uv = particle_uvLifeTimeFrameStart.xy;
    float lifeTime = particle_uvLifeTimeFrameStart.z;
    float frameStart = particle_uvLifeTimeFrameStart.w;
    vec3 position = particle_positionStartTime.xyz;
    float startTime = particle_positionStartTime.w;

    vec3 velocity = (matrix_model * vec4(particle_velocityStartSize.xyz, 0.0)).xyz + particle_worldVelocity;
    float startSize = particle_velocityStartSize.w;

    vec3 acceleration = (matrix_model * vec4(particle_accelerationEndSize.xyz, 0.0)).xyz + particle_worldAcceleration;
    float endSize = particle_accelerationEndSize.w;

    float spinStart = particle_spinStartSpinSpeed.x;
    float spinSpeed = particle_spinStartSpinSpeed.y;

    float localTime = mod((particle_time - particle_timeOffset - startTime), particle_timeRange);
    float percentLife = localTime / lifeTime;

    float frame = mod(floor(localTime / particle_frameDuration + frameStart), particle_numFrames);
    float uOffset = frame / particle_numFrames;
    float u = uOffset + (uv.x + 0.5) * (1.0 / particle_numFrames);

    vUv0 = vec2(u, uv.y + 0.5);
    vColor = particle_colorMult;


