
   tex = vec4(outPosition, outRotation) * outMask0 +
          vec4(outVelocity, life) * outMask1 +
          texR * outMask2;

    gl_FragColor = tex;
}

