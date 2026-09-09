import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('outputs', { recursive: true });
const socket = new WebSocket(process.argv[2]);
await new Promise(r => socket.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map(), errors = [];
socket.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
  if (pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.reject(m.error); else p.resolve(m.result); }
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const seq = ++id; pending.set(seq, { resolve, reject }); socket.send(JSON.stringify({ id: seq, method, params, sessionId })); });
const { targetInfos } = await send('Target.getTargets');
const target = targetInfos.find(t => t.type === 'page' && t.url.includes('127.0.0.1:5173'));
const { sessionId } = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
const cdp = (m, p) => send(m, p, sessionId);
const evaluate = async expression => { const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await wait(100); } throw new Error(`Timed out: ${expression}`); };
const state = () => evaluate(`({...document.querySelector('.game-shell').dataset, ...document.querySelector('.world').dataset})`);
const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const _shot = async name => { const { data } = await cdp('Page.captureScreenshot', { format: 'png' }); await writeFile(`outputs/${name}.png`, Buffer.from(data, 'base64')); };
const key = (type, code, key) => cdp('Input.dispatchKeyEvent', { type, code, key });
const tap = async (code, name) => { await key('keyDown', code, name); await key('keyUp', code, name); };
const reload = async () => { await cdp('Page.navigate', { url: 'http://127.0.0.1:5173/' }); await until(`!!document.querySelector('[data-hero="patrick"]:not(:disabled)') && !!document.querySelector('[data-hero="su"]:not(:disabled)')`); await wait(150); };
await cdp('Page.enable');
const hook = await cdp('Page.addScriptToEvaluateOnNewDocument', {source:`
window.audioCheck={decoded:0,samples:0,active:0,max:0,peak:0,noise:0};
const known=new WeakSet();
const decode=AudioContext.prototype.decodeAudioData;
AudioContext.prototype.decodeAudioData=function(...args){return decode.apply(this,args).then(b=>{known.add(b);audioCheck.decoded++;return b;});};
const make=AudioContext.prototype.createBufferSource;
AudioContext.prototype.createBufferSource=function(){const s=make.call(this),start=s.start; s.start=function(...args){if(known.has(s.buffer)){audioCheck.samples++;audioCheck.active++;audioCheck.max=Math.max(audioCheck.max,audioCheck.active);s.addEventListener('ended',()=>audioCheck.active--,{once:true});}else audioCheck.noise++;return start.apply(s,args);};return s;};
const compressor=AudioContext.prototype.createDynamicsCompressor;
AudioContext.prototype.createDynamicsCompressor=function(){const n=compressor.call(this),connect=n.connect.bind(n),analyser=this.createAnalyser(); analyser.fftSize=2048; connect(analyser); const data=new Float32Array(2048);setInterval(()=>{analyser.getFloatTimeDomainData(data);for(const x of data)audioCheck.peak=Math.max(audioCheck.peak,Math.abs(x));},20);return n;};
`});
const deploy = async()=>{
 const p=await evaluate(`(()=>{const r=document.querySelector('.deploy').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 if(process.argv.includes('--phone')) {
  await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});
  await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  return;
 }
 await cdp('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});
 await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});
};
try {
 await cdp('Runtime.enable'); await cdp('Network.enable');
 const phone=process.argv.includes('--phone');
 await cdp('Emulation.setTouchEmulationEnabled',{enabled:phone,maxTouchPoints:5});
 await cdp('Emulation.setDeviceMetricsOverride',{width:phone?393:1280,height:phone?852:720,deviceScaleFactor:1,mobile:phone});
 await reload(); await click('[data-hero="patrick"]'); await deploy();
 await until('audioCheck.decoded===21');
 const before=await evaluate('audioCheck.samples');
 for(let i=1;i<=8;i++){await tap('Digit'+i,String(i)); await key('keyDown','KeyJ','j');await wait(260);await key('keyUp','KeyJ','j');}
 await tap('KeyK','k'); await wait(180);
 assert((await evaluate('audioCheck.samples'))>before+8);
 await tap('Escape','Escape');await wait(120);assert.equal(await evaluate('audioCheck.active'),0,'Pause stops sample tails');
 await click('[data-hero="su"]');await click('.state-panel .deploy');await tap('Space',' ');await wait(120);await tap('Space',' ');await wait(120);
 await click('[aria-label="Mute sound"]');const muted=await evaluate('audioCheck.samples');await key('keyDown','KeyJ','j');await wait(250);await key('keyUp','KeyJ','j');assert.equal(await evaluate('audioCheck.samples'),muted);
 await click('[aria-label="Enable sound"]');await key('keyDown','KeyJ','j');await wait(250);await key('keyUp','KeyJ','j');
 const metrics=await evaluate('audioCheck');assert(metrics.peak>0.001&&metrics.peak<1);assert(metrics.max<=24);console.log('PASS Loaded audio, weapon/ability playback, mute, pause, bounded voices and unclipped output',metrics);
 await cdp('Network.setBlockedURLs',{urls:['*/media/audio/kenney/*']});await reload();await deploy();await key('keyDown','KeyJ','j');await wait(700);await key('keyUp','KeyJ','j');
 assert.equal(await evaluate('audioCheck.decoded'),0);assert((await evaluate('audioCheck.noise'))>0);assert.equal((await state()).mode,'playing');
 assert.equal(errors.length,0,JSON.stringify(errors));console.log('PASS Missing audio files retain playable procedural fallback, no browser exceptions');
} finally {await cdp('Network.setBlockedURLs',{urls:[]});await cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:hook.identifier});socket.close();}

