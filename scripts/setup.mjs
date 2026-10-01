import {existsSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
const major=Number(process.versions.node.split('.')[0]);
if(major!==24){console.error('Use Node.js 24 LTS for this local version.');process.exit(1)}
if(existsSync('.env.local')){console.log('.env.local already exists; your settings were preserved.');process.exit(0)}
writeFileSync('.env.local',`APP_ORIGIN=http://localhost:3000\nADMIN_KEY=${randomBytes(24).toString('hex')}\nSESSION_SECRET=${randomBytes(32).toString('hex')}\nDATABASE_PATH=./data/yuwazac.sqlite\n`,{mode:0o600});
console.log('Local settings created. Open .env.local privately to copy ADMIN_KEY into the admin login. Do not send this key in chat.');
