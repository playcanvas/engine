uniform vec4 uScreenSize;

mat4 getModelMatrix() {
    return matrix_model;
}

vec4 getPosition() {
    dModelMatrix = getModelMatrix();
    vec4 posW = dModelMatrix * vec4(vertex_position, 1.0);
    dPositionW = posW.xyz;

    vec4 o = matrix_viewProjection * posW;

    // snap vertex to a pixel boundary
    o.xy = (o.xy * 0.5) + 0.5;
    o.xy *= uScreenSize.xy;
    o.xy = floor(o.xy);
    o.xy *= uScreenSize.zw;
    o.xy = (o.xy * 2.0) - 1.0;

    return o;
}

vec3 getWorldPosition() {
    return dPositionW;
}

