import config from '@examples/config';
const files = {
    'example.mjs': '',
    'controls.mjs': ''
};
Object.assign(files, config.FILES ?? {});
export default files;
