const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),esbuild=require('esbuild');
function fixture({webos=true,direct,root,launch}={}){
 const calls=[],launches=[],box={module:{exports:{}},exports:{}};box.exports=box.module.exports;
 box.require=name=>name==='./luna'?{isWebOS:()=>webos,lunaCall:async(uri,params)=>{calls.push({uri,params});if(uri.endsWith('/exec')){if(root)return root(uri,params);throw Error('No root response')}if(direct)return direct(uri,params);throw Error('Direct access denied')}}:name==='../config/constants'?{LUNA:{homebrewExec:'luna://org.webosbrew.hbchannel.service/exec'}}:name==='./launch'?{launchApp:async(id,params={})=>{launches.push({id,params});if(launch)return launch(id,params)}}:(()=>{throw Error('Unexpected dependency '+name)})();
 vm.runInNewContext(esbuild.transformSync(fs.readFileSync('src/lib/network.ts','utf8'),{loader:'ts',format:'cjs'}).code,box);return {api:box.module.exports,calls,launches};
}
const wifi={returnValue:true,isInternetConnectionAvailable:true,wifi:{state:'connected',ssid:'Example Wi-Fi',ipAddress:'192.0.2.20',gateway:'192.0.2.1',netmask:'255.255.255.0',dns1:'192.0.2.1'}};
(async()=>{
 let f=fixture({direct:async()=>wifi}),s=await f.api.readNetwork();assert.equal(s.kind,'Wi-Fi');assert.equal(s.ip,'192.0.2.20');assert.equal(s.internet,'Connected');assert.equal(f.calls.length,1);
 s=f.api.networkSnapshot({...wifi,wired:{state:'connected',ipAddress:'192.0.2.30'}});assert.equal(s.kind,'Ethernet');assert.equal(s.ip,'192.0.2.30');
 s=f.api.networkSnapshot({...wifi,isInternetConnectionAvailable:false});assert.equal(s.ip,'192.0.2.20');assert.equal(s.internet,'No internet');
 s=f.api.networkSnapshot({...wifi,isInternetConnectionAvailable:undefined});assert.equal(s.internet,'Unknown');
 s=f.api.networkSnapshot({returnValue:true,wifi:{state:'disconnected'}});assert.equal(s.kind,'Disconnected');assert.equal(s.ip,'Not assigned');assert.equal(s.internet,'No internet');
 assert.throws(()=>f.api.networkSnapshot({returnValue:true}));assert.throws(()=>f.api.networkSnapshot({returnValue:false}));assert.throws(()=>f.api.networkSnapshot(null));
 f=fixture();await assert.rejects(()=>f.api.readNetwork(),/enable Homebrew/);assert.equal(f.calls.filter(c=>c.uri.endsWith('/exec')).length,0,'Root access must stay off by default');
 f=fixture({root:async()=>({returnValue:true,stdoutString:JSON.stringify(wifi)})});s=await f.api.readNetwork(true);assert.equal(s.ip,'192.0.2.20');assert.equal(f.calls[1].params.command,"luna-send -n 1 -w 5000 luna://com.webos.service.connectionmanager/getStatus '{}'",'Only fixed read-only status query reaches root');
 f=fixture({root:async()=>({returnValue:true,stdoutString:'not json'})});await assert.rejects(()=>f.api.readNetwork(true),/Connection details are unavailable/);
 f=fixture();await f.api.openNetworkSettings();assert.equal(f.launches[0].id,'com.palm.app.settings');assert.equal(f.launches[0].params.target,'general');assert.equal(f.launches[0].params.item,'network');
 f=fixture({launch:async(_id,params)=>{if(params.target)throw Error('Route unavailable')}});await f.api.openNetworkSettings();assert.equal(f.launches.length,2);assert.equal(Object.keys(f.launches[1].params).length,0);
 f=fixture({launch:async()=>{throw Error('Settings unavailable')}});await assert.rejects(()=>f.api.openNetworkSettings());
 f=fixture({webos:false});s=await f.api.readNetwork();assert.equal(s.ip,'192.0.2.20');await f.api.openNetworkSettings();assert.equal(f.calls.length,0);assert.equal(f.launches.length,0);
 console.log('Network: interface priority, IP/reachability, disconnected/invalid replies, root opt-in, fixed query, native-settings fallback and offline preview passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
