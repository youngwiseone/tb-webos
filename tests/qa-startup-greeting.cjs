const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const box={module:{exports:{}},exports:{}};box.exports=box.module.exports;
vm.runInNewContext(esbuild.transformSync(fs.readFileSync('src/lib/startup.ts','utf8'),{loader:'ts',format:'cjs'}).code,box);
for(let h=0;h<24;h++)assert.equal(box.module.exports.startupGreeting(new Date(2026,0,1,h)),h>=5&&h<12?'GOOD MORNING':h>=12&&h<18?'GOOD AFTERNOON':'GOOD EVENING');
console.log('Time-of-day greeting boundaries passed for all24hours.');
