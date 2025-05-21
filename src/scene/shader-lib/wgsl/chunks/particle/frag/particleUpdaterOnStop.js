export default /* wgsl */`
    visMode = select(visMode, -1.0, outLife < 0.0);
`;
