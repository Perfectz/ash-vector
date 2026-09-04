import * as T from 'three';
import { makeWorld, operative, siegeMech } from '../../app/game/models.ts';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const canvas=document.getElementById('cinema');
const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});renderer.setSize(1920,1080,false);renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
const scene=new T.Scene();scene.background=new T.Color(0x586a70);scene.fog=new T.FogExp2(0x586a70,.012);
const pmrem=new T.PMREMGenerator(renderer);const room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.03).texture;scene.environmentIntensity=.6;room.dispose();pmrem.dispose();
scene.add(new T.HemisphereLight(0xb2dbe4,0x302526,2.5));
const sun=new T.DirectionalLight(0xffa573,4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:1,far:140});sun.shadow.normalBias=.07;scene.add(sun,sun.target);
const rim=new T.DirectionalLight(0x86bacd,2.3);rim.position.set(-10,8,20);scene.add(rim);
makeWorld(scene);const hero=operative();hero.root.position.set(13,0,2);hero.root.rotation.y=-.4;scene.add(hero.root);
const boss=siegeMech();boss.position.set(177,0,0);scene.add(boss);
const camera=new T.PerspectiveCamera(48,1920/1080,.1,400);
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new T.Vector2(1920,1080),.35,.5,1.3));composer.addPass(new OutputPass());
let seed=91;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const base=new Float32Array(500*3),positions=new Float32Array(500*6);for(let i=0;i<base.length;i+=3){base[i]=(random()-.5)*80;base[i+1]=random()*30;base[i+2]=(random()-.5)*60;}
const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(positions,3));const rain=new T.LineSegments(geo,new T.LineBasicMaterial({color:0xc8dde7,transparent:true,opacity:.22}));rain.frustumCulled=false;scene.add(rain);
function renderAt(t){
 t=Math.max(0,Math.min(t,20));
 hero.torso.position.y=1.1+Math.sin(t*2)*.017;hero.root.visible=t<12;boss.visible=t>=12;
 let focus;
 if(t<6){const u=t/6;camera.position.set(-2+u*15,7.5-u*2,5.5);camera.lookAt(25+u*6,2.2,-2);focus=14;}
 else if(t<12){const u=(t-6)/6,a=.15+u*.7;camera.position.set(13+Math.cos(a)*5.2,2.35+u*.5,2+Math.sin(a)*5.2+3.5);camera.lookAt(13.2,1.45,2);hero.root.rotation.y=-.3+u*.16;focus=13;}
 else {const u=(t-12)/8;camera.position.set(169.5+u*1.5,2.4+u*.9,6-u);camera.lookAt(177,3.4,0);boss.position.y=Math.sin(t*1.5)*.04;boss.rotation.z=Math.sin(t*2)*.015;focus=176;}
 sun.position.set(focus+25,40,-45);sun.target.position.set(focus,0,0);sun.target.updateMatrixWorld();rain.position.x=focus;
 for(let i=0;i<500;i++){const j=i*3,k=i*6,y=((base[j+1]-t*17)%30+30)%30;positions[k]=base[j];positions[k+1]=y;positions[k+2]=base[j+2];positions[k+3]=base[j]-.13;positions[k+4]=y+.7;positions[k+5]=base[j+2];}geo.attributes.position.needsUpdate=true;
 composer.render();
}
window.addEventListener('hf-seek',e=>renderAt(e.detail.time));window.__renderIntroAt=renderAt;renderAt(0);

