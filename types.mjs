import fs from 'fs';

// Create a regex that matches any string starting with Class< and ending with >
const regex = /Class<(.*?)>/g;
const paths = [
    './types/framework/components/script/component.d.ts',
    './types/script/script-attributes.d.ts',
    './types/script/script-registry.d.ts',
    './types/script/script.d.ts'
];

paths.forEach(path => {
    let dts = (fs.readFileSync(path, 'utf8')).toString();
    dts = dts.replace(regex, 'typeof ScriptType');
    fs.writeFileSync(path, dts);
});

// Fix up description parameter for VertexFormat constructor because tsc
// doesn't recognize it as an array
const path = './types/graphics/vertex-format.d.ts';
let dts = (fs.readFileSync(path, 'utf8')).toString();
dts = dts.replace('}, vertexCount?: number);', '}[], vertexCount?: number);');
fs.writeFileSync(path, dts);
