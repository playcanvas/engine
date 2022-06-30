import fs from 'fs';

const readDirectoryNames = (dir) => {
    return fs.readdirSync(dir, { withFileTypes: true })
        .filter(result => result.isDirectory())
        .map(result => result.name);
};

export default readDirectoryNames;
