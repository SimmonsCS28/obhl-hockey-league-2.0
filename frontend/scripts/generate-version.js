import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const version = {
    timestamp: new Date().getTime(),
    buildDate: new Date().toISOString()
};

const publicDir = path.join(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(
    path.join(publicDir, 'version.json'),
    JSON.stringify(version, null, 2)
);

console.log('Version info generated:', version.buildDate);
