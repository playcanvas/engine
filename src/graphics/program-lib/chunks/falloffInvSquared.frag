float getFalloffInvSquared(inout psInternalData data, float lightRadius) {
    float sqrDist = dot(data.lightDirW, data.lightDirW);
    float falloff = 1.0 / (sqrDist + 1.0);
    float invRadius = 1.0 / lightRadius;

    falloff *= 16.0;
    falloff *= square( saturate( 1.0 - square( sqrDist * square(invRadius) ) ) );

    return falloff;
}

