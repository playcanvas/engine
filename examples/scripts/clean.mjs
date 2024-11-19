/**
 * This script is used to clean build files
 */
import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const MAIN_DIR = `${dirname(__filename)}/../`;

const main = () => {
    fs.rmSync(`${MAIN_DIR}/dist`, { recursive: true, force: true });
    fs.rmSync(`${MAIN_DIR}/cache`, { recursive: true, force: true });
};
main();
