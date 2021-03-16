float getFalloffWindow(float lightRadius) {
    MEDP float sqrDist = dot(dLightDirW, dLightDirW);
    MEDP float invRadius = 1.0 / lightRadius;
    return square( saturate( 1.0 - square( sqrDist * square(invRadius) ) ) );
}

float getFalloffInvSquared(float lightRadius) {
    MEDP float sqrDist = dot(dLightDirW, dLightDirW);
    MEDP float falloff = 1.0 / (sqrDist + 1.0);
    MEDP float invRadius = 1.0 / lightRadius;

    falloff *= 16.0;
    falloff *= square( saturate( 1.0 - square( sqrDist * square(invRadius) ) ) );

    return falloff;
}


