import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class World{
  constructor(container){
    // renderer
    const renderer = new THREE.WebGLRenderer({ antialias:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.setSize(1,1,false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = renderer;
    container.append(renderer.domElement);

    // camera FIRST (for resizer)
    const camera = new THREE.PerspectiveCamera(60, 2, 0.1, 100);
    this.camera = camera;

    // resizer
    const resizer = ()=>{
      const w=container.clientWidth, h=container.clientHeight;
      camera.aspect = (w/h)||1; camera.updateProjectionMatrix();
      renderer.setSize(w,h,false);
    };
    resizer(); window.addEventListener('resize', resizer);

    // scene + bg
    const scene = new THREE.Scene();
    const bg = new THREE.TextureLoader().load('src/World/assets/textures/backgrounds/starfield.jpg', ()=>{}, undefined, ()=>{ scene.background = new THREE.Color(0x0b0e16); });
    bg.colorSpace = THREE.SRGBColorSpace;
    scene.background = bg;
    this.scene = scene;

    // controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.enablePan=false; controls.maxPolarAngle=Math.PI/2.05;
    this.controls = controls;

    // lights
    const amb = new THREE.AmbientLight(0xffffff, 0.6); scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9); dir.position.set(3,5,5); scene.add(dir);
    this.amb=amb; this.dir=dir;

    // table
    const TABLE_W=2.6, TABLE_H=1.3, BALL_R=0.055;
    const feltGeom=new THREE.BoxGeometry(TABLE_W,0.06,TABLE_H);
    const felt=new THREE.Mesh(feltGeom,new THREE.MeshStandardMaterial({color:0x146b36,roughness:0.95})); scene.add(felt);
    const frame=new THREE.Mesh(new THREE.BoxGeometry(TABLE_W+0.18,0.18,TABLE_H+0.18),new THREE.MeshStandardMaterial({color:0x5a3b1e,roughness:0.85})); frame.position.y=-0.12; scene.add(frame);
    scene.add(new THREE.LineSegments(new THREE.EdgesGeometry(feltGeom), new THREE.LineBasicMaterial({color:0x1a7f48})));

    const halfW=TABLE_W/2-0.10, halfH=TABLE_H/2-0.10, planeY=0.03;
    this.TABLE={halfW,halfH,y:planeY}; this.BALL_R=BALL_R;

    // camera start
    camera.position.set(-1.0,2.8,3.6);
    controls.target.set(0,planeY,0); controls.update();

    // balls
    const ballGeo=new THREE.SphereGeometry(BALL_R,32,32);
    const colors=[0xffffff,0xffc300,0x4da6ff,0xff3b5c,0xad3bff,0xff7f00,0x2db984,0x111111];
    const mat=(c)=>new THREE.MeshStandardMaterial({color:c,roughness:0.35,metalness:0.1});
    this.ballsMeshes=[]; this.ballsBodies=[];
    const add=(x,z,c,isCue=false)=>{ const m=new THREE.Mesh(ballGeo,mat(c)); m.position.set(x,planeY+BALL_R,z); scene.add(m); this.ballsMeshes.push(m); this.ballsBodies.push({x,z,vx:0,vz:0,isCue}); return m; };

    // rack à direita
    const spacing=BALL_R*2+0.005; let apexX=halfW-0.35; const rows=[1,2,3,4,5]; let ci=1; let x=apexX;
    for(let r=0;r<rows.length;r++){ const count=rows[r]; const z0=-(count-1)*spacing*0.5; for(let i=0;i<count;i++){ add(x,z0+i*spacing,colors[(ci++)%colors.length]); } x-=spacing; }
    add(-(halfW-0.35),0,0xffffff,true); // cue ball

    // cue + aim
    const cueGroup=new THREE.Group();
    const cue=new THREE.Mesh(new THREE.CylinderGeometry(0.011,0.017,1.6,24), new THREE.MeshStandardMaterial({color:0xb28d5b,roughness:0.7}));
    cue.rotation.z=Math.PI/2; cueGroup.add(cue); scene.add(cueGroup); this.cueGroup=cueGroup;
    const aimGeom=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);
    const aim=new THREE.Line(aimGeom, new THREE.LineBasicMaterial({color:0xffffff})); scene.add(aim); this.aimLine=aim;

    // physics
    this.restitution=0.98; this.friction=0.992;

    // HUD buttons
    const pfill=document.getElementById('pfill');
    document.getElementById('resetBtn').onclick=()=>this._reset();
    document.getElementById('v34Btn').onclick=()=>{ this.camera.position.set(-1.0,2.8,3.6); this.controls.update(); };
    document.getElementById('topBtn').onclick=()=>{ this.camera.position.set(0,3.4,0.0001); this.controls.update(); };

    // Panel bindings
    const ambRange=document.getElementById('amb');
    const dirRange=document.getElementById('dir');
    const dirColor=document.getElementById('dirColor');
    const camX=document.getElementById('camX');
    const camY=document.getElementById('camY');
    const camZ=document.getElementById('camZ');
    const resetCam=document.getElementById('resetCam');
    ambRange.oninput=()=> amb.intensity=parseFloat(ambRange.value);
    dirRange.oninput=()=> dir.intensity=parseFloat(dirRange.value);
    dirColor.oninput=()=> dir.color.set(dirColor.value);
    const updateCam=()=>{ camera.position.set(parseFloat(camX.value), parseFloat(camY.value), parseFloat(camZ.value)); controls.update(); };
    camX.oninput=camY.oninput=camZ.oninput=updateCam;
    resetCam.onclick=()=>{ camX.value=-1; camY.value=2.8; camZ.value=3.6; updateCam(); };

    // input handling
    this._installInput(pfill);
  }

  _installInput(pfill){
    const raycaster=new THREE.Raycaster();
    const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    const screenToXZ=(ev)=>{ const r=this.renderer.domElement.getBoundingClientRect(); const ndc=new THREE.Vector2(((ev.clientX-r.left)/r.width)*2-1, -((ev.clientY-r.top)/r.height)*2+1); raycaster.setFromCamera(ndc,this.camera); const p=new THREE.Vector3(); raycaster.ray.intersectPlane(plane,p); return new THREE.Vector3(p.x,0,p.z); };
    const el=this.renderer.domElement;
    this.player={aim:false, start:new THREE.Vector2(), power:0};

    el.addEventListener('pointerdown',(ev)=>{ const p=screenToXZ(ev); const w=this.ballsBodies.find(b=>b.isCue); if(Math.hypot(p.x-w.x,p.z-w.z)<0.2){ this.player.aim=true; this.player.start.set(p.x,p.z); this._updateAim(p.x,p.z); } });
    el.addEventListener('pointermove',(ev)=>{ if(!this.player.aim) return; const p=screenToXZ(ev); const d=Math.hypot(p.x-this.player.start.x,p.z-this.player.start.z); this.player.power=Math.min(1,d/0.7); if(pfill) pfill.style.width=(this.player.power*100)+'%'; this._updateAim(p.x,p.z); });
    el.addEventListener('pointerup',(ev)=>{ if(!this.player.aim) return; this.player.aim=false; const p=screenToXZ(ev); this._shoot(p.x,p.z,this.player.power); if(pfill) pfill.style.width='0%'; this.aimLine.visible=false; });
  }

  _updateAim(px,pz){
const w = this.ballsBodies.find(b => b.isCue);
  const R = this.BALL_R;

  // vetor da bola → ponteiro (arraste)
  const dx = px - w.x;
  const dz = pz - w.z;
  const len = Math.hypot(dx, dz) || 1;
  const nx = dx / len;
  const nz = dz / len;

  // posiciona o taco atrás da bola (oposto ao disparo)
  const off = 0.40;
  this.cueGroup.position.set(
    w.x - nx * off,
    this.TABLE.y + R + 0.02,
    w.z - nz * off
  );

  // orienta o taco apontando para a bola
  this.cueGroup.rotation.set(0, Math.atan2(nz, nx), 0);

  // linha de mira na direção do chute (bola → alvo)
  const p1 = new THREE.Vector3(w.x, this.TABLE.y + R + 0.01, w.z);
  const shootX = -nx, shootZ = -nz;
  const p2 = new THREE.Vector3(
    w.x + shootX * 0.7,
    this.TABLE.y + R + 0.01,
    w.z + shootZ * 0.7
  );
  this.aimLine.geometry.setFromPoints([p1, p2]);
  this.aimLine.visible = true;
}
export { World };
