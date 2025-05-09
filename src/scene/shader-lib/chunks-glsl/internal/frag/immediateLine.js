export default /* glsl */`
        #include "gammaPS"
        varying vec4 color;
        void main(void) {
            gl_FragColor = vec4(gammaCorrectOutput(decodeGamma(color.rgb)), color.a);
        }
`;
