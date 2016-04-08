
    outPosition = (outPosition - boundsCenter) / boundsSize + vec3(0.5); // TODO: mad
    outRotation = (outRotation + 1000.0) / 2000.0;

    outVelocity = (outVelocity / maxVel) + vec3(0.5); // TODO: mul

    life = (life + maxNegLife) / (maxNegLife + maxPosLife);


   //tex = vec4(outPosition, (outRotation + 1000.0) * visMode) * outMask0 +
   //       vec4(outVelocity, life) * outMask1;

   vec4 tex = vec4(encodeFloatRG(outPosition.x), encodeFloatRG(outPosition.y)) * outMask0 +
              vec4(encodeFloatRG(outPosition.z), encodeFloatRG(outRotation)) * outMask1 +
              vec4(outVelocity, visMode*0.5+0.5) * outMask2 +
              encodeFloatRGBA(life) * outMask3;

    gl_FragColor = tex;
}

//RG=X, BA=Y
//RG=Z, BA=A
//RGB=V, A=visMode
//RGBA=life

