export default /* glsl */`
float getFalloffWindow(float lightRadius, vec3 lightDir) {
    float sqrDist = dot(lightDir, lightDir);
    float invRadius = 1.0 / lightRadius;
    return square( saturate( 1.0 - square( sqrDist * square(invRadius) ) ) );
}

float getFalloffInvSquared(float lightRadius, vec3 lightDir) {
    float sqrDist = dot(lightDir, lightDir);
    float falloff = 1.0 / (sqrDist + 1.0);
    float invRadius = 1.0 / lightRadius;

    falloff *= 16.0;
    falloff *= square( saturate( 1.0 - square( sqrDist * square(invRadius) ) ) );

    return falloff;
}
`;
