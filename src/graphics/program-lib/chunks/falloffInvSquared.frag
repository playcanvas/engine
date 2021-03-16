float getFalloffWindow(float lightRadius) {
    LMEDP float sqrDist = dot(dLightDirW, dLightDirW);
    LMEDP float invRadius = 1.0 / lightRadius;
    return square( saturate( 1.0 - square( sqrDist * square(invRadius) ) ) );
}

float getFalloffInvSquared(float lightRadius) {
    LMEDP float sqrDist = dot(dLightDirW, dLightDirW);
    LMEDP float falloff = 1.0 / (sqrDist + 1.0);
    LMEDP float invRadius = 1.0 / lightRadius;

    falloff *= 16.0;
    falloff *= square( saturate( 1.0 - square( sqrDist * square(invRadius) ) ) );

    return falloff;
}


