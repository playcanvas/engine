import * as pc from '../../../build/playcanvas.js';
window.pc = pc;
// make pc available outside of the iframe
window.top.pc = window.pc;
