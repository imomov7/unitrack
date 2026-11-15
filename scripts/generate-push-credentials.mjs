// Run only when ready to configure your own Supabase server secrets. Nothing is
// printed or written by default; generated private credentials never enter Git.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {generateKeyPairSync,randomBytes} from 'node:crypto';
if(!process.argv.includes('--write')){console.log('Use --write to generate a new private 0600 server-env file outside this project. Existing files are never overwritten.');process.exit(0);}
const target=path.join(os.homedir(),'.config','acadely','push.env');
fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});
if(fs.existsSync(target))throw new Error('A push credential file already exists. Keep the existing keys; do not rotate them accidentally.');
const pair=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),pub=pair.publicKey.export({format:'jwk'}),priv=pair.privateKey.export({format:'jwk'});
const publicKey=Buffer.concat([Buffer.from([4]),Buffer.from(pub.x,'base64url'),Buffer.from(pub.y,'base64url')]).toString('base64url');
const content=`VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${priv.d}\nVAPID_SUBJECT=https://myacadely.vercel.app/\nACADELY_CRON_SECRET=${randomBytes(32).toString('base64url')}\n`;
fs.writeFileSync(target,content,{flag:'wx',mode:0o600});console.log('Private server credentials saved to '+target+'. Do not upload this file or print its contents.');
