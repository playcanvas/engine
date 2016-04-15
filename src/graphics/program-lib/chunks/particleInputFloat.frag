void readInput(float uv) {
    vec4 tex = texture2D(particleTexIN, vec2(uv, 0.25));
    vec4 tex2 = texture2D(particleTexIN, vec2(uv, 0.75));

    inPos = tex.xyz;
    inVel = tex2.xyz;
    inAngle = (tex.w < 0.0? -tex.w : tex.w) - 1000.0;
    inShow = tex.w >= 0.0;
    inLife = tex2.w;
}

