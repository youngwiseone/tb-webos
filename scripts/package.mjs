import {mkdirSync,copyFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
mkdirSync('build',{recursive:true});mkdirSync('dist/licenses',{recursive:true});
copyFileSync('LICENSE','dist/licenses/LICENSE.txt');
const cli=require.resolve('@webos-tools/cli/bin/ares-package.js');
const result=spawnSync(process.execPath,[cli,'dist','--no-minify','-o','build'],{stdio:'inherit'});
process.exit(result.status??1);
