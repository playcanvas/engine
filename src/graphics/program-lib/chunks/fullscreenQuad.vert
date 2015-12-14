attribute vec2 aPosition;

varying vec2 vUv0;

void main(void)
{
    gl_Position = vec4(aPosition, 0.5, 1.0);
    vUv0 = aPosition.xy*0.5+0.5;
}

