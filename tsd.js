const fs = require('fs');

const path = './types/index.d.ts';

// replace declare with export and add 'export as namespace pc' in the end
let ts = (fs.readFileSync(path, 'utf8')).toString();
ts = ts + '\n\nexport as namespace pc;\n';
fs.writeFileSync(path, ts);
