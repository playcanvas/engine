const fs = require('fs');

const path = './build/playcanvas.d.ts';

// replace declare with export and add 'export as namespace pc' in the end
let ts = (fs.readFileSync(path, 'utf8')).toString();
ts = ts.replace(/^declare /gm, 'export ') + 'export as namespace pc;';
fs.writeFileSync(path, ts);
