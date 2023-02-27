export default /* glsl */`
gl_FragColor.rgb *= frontend.alpha;
gl_FragColor.a = frontend.alpha;
`;
