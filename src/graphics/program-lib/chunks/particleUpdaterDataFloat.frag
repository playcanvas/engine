void readInput() {
    vec4 tex = texture2D(particleTexIN, vec2(vUv0.x, 0.25));
    vec4 tex2 = texture2D(particleTexIN, vec2(vUv0.x, 0.75));

    inPos = tex.xyz;
    inAngle = (tex.w < 0.0? -tex.w : tex.w) - 1000.0;
    inShow = tex.w > 0.0;
    inLife = tex2.w;
}

void writeOutput() {
    float outMask0 = gl_FragCoord.y < 1.0? 1.0 : 0.0;
    float outMask1 = (gl_FragCoord.y < 2.0 && gl_FragCoord.y >= 1.0)? 1.0 : 0.0;

    gl_FragColor = vec4(outPos, (outAngle + 1000.0) * visMode) * outMask0 +
                   vec4(outVel, life) * outMask1;
}

