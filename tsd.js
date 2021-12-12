const fs = require('fs');

// Add 'export as namespace pc' to the end of the file
const path = './types/index.d.ts';
let ts = (fs.readFileSync(path, 'utf8')).toString();
ts = ts + '\n\nexport as namespace pc;\n';
fs.writeFileSync(path, ts);

// Create a regex that matches any string starting with Class< and ending with >
const regex = /Class<(.*?)>/g;
const paths = [
    './types/framework/components/script/component.d.ts',
    './types/script/script-attributes.d.ts',
    './types/script/script-registry.d.ts',
    './types/script/script.d.ts'
];

paths.forEach(path => {
    ts = (fs.readFileSync(path, 'utf8')).toString();
    ts = ts.replace(regex, 'typeof ScriptType');
    fs.writeFileSync(path, ts);
});
