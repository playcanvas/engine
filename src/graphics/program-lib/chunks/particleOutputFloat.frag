void writeOutput() {
    float outMask0 = gl_FragCoord.y < 1.0? 1.0 : 0.0;
    float outMask1 = (gl_FragCoord.y < 2.0 && gl_FragCoord.y >= 1.0)? 1.0 : 0.0;

    gl_FragColor = vec4(outPos, (outAngle + 1000.0) * visMode) * outMask0 +
                   vec4(outVel, outLife) * outMask1;
}

