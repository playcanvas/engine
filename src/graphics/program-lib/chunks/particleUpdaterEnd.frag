
   tex = vec4(outPosition, (outRotation + 1000.0) * visMode) * outMask0 +
          vec4(outVelocity, life) * outMask1;

    gl_FragColor = tex;
}

