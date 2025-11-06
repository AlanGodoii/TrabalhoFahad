import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class World{
  constructor(container){
    const renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(window.devicePixelRatio,2)); renderer.setSize(1,1,false); renderer.outputColorSpace=THREE.SRGBColorSpace; this.renderer=renderer; container.append(renderer.domElement);
    const camera=new THREE.PerspectiveCamera(60,2,0.1,100); this.camera=camera;
    const onResize=()=>{ const w=container.clientWidth,h=container.clientHeight; camera.aspect=(w/h)||1; camera.updateProjectionMatrix(); renderer.setSize(w,h,false); }; onResize(); window.addEventListener('resize',onResize);

    const scene=new THREE.Scene();
    const texLoader=new THREE.TextureLoader();
    const bg=texLoader.load('src/World/assets/textures/backgrounds/starfield.jpg', undefined, undefined, ()=>{ scene.background=new THREE.Color(0x0b0e16); });
    bg.colorSpace=THREE.SRGBColorSpace; scene.background=bg;
    this.scene=scene;

    const controls=new OrbitControls(camera, renderer.domElement); controls.enableDamping=true; controls.enablePan=false; controls.maxPolarAngle=Math.PI/2.05; this.controls=controls;

    const amb=new THREE.AmbientLight(0xffffff,0.6); scene.add(amb);
    const dir=new THREE.DirectionalLight(0xffffff,0.9); dir.position.set(3,5,5); scene.add(dir);
    this.amb=amb; this.dir=dir;

    const TABLE_W=2.6,TABLE_H=1.3,BALL_R=0.055;
    const feltGeom=new THREE.BoxGeometry(TABLE_W,0.06,TABLE_H);
    const felt=new THREE.Mesh(feltGeom,new THREE.MeshStandardMaterial({color:0x146b36,roughness:0.95})); scene.add(felt);
    const frame=new THREE.Mesh(new THREE.BoxGeometry(TABLE_W+0.18,0.18,TABLE_H+0.18),new THREE.MeshStandardMaterial({color:0x5a3b1e,roughness:0.85})); frame.position.y=-0.12; scene.add(frame);
    scene.add(new THREE.LineSegments(new THREE.EdgesGeometry(feltGeom), new THREE.LineBasicMaterial({color:0x1a7f48})));

    const halfW=TABLE_W/2-0.10, halfH=TABLE_H/2-0.10, planeY=0.03; this.TABLE={halfW,halfH,y:planeY}; this.BALL_R=BALL_R;
    camera.position.set(-1.0,2.8,3.6); controls.target.set(0,planeY,0); controls.update();

    // bolas
    const ballGeo=new THREE.SphereGeometry(BALL_R,32,32);
    const colors=[0xffffff,0xffc300,0x4da6ff,0xff3b5c,0xad3bff,0xff7f00,0x2db984,0x111111];
    const mat=(c)=>new THREE.MeshStandardMaterial({color:c,roughness:0.35,metalness:0.1});
    this.ballsMeshes=[]; this.ballsBodies=[];
    const add=(x,z,c,isCue=false)=>{ const m=new THREE.Mesh(ballGeo,mat(c)); m.position.set(x,planeY+BALL_R,z); scene.add(m); this.ballsMeshes.push(m); this.ballsBodies.push({x,z,vx:0,vz:0,isCue}); return m; };
    const spacing=BALL_R*2+0.005; let apexX=halfW-0.35; const rows=[1,2,3,4,5]; let ci=1; let x=apexX;
    for(let r=0;r<rows.length;r++){ const count=rows[r]; const z0=-(count-1)*spacing*0.5; for(let i=0;i<count;i++){ add(x,z0+i*spacing,colors[(ci++)%colors.length]); } x-=spacing; }
    add(-(halfW-0.35),0,0xffffff,true);

    // taco + mira
    const cueGroup=new THREE.Group();
    const cue=new THREE.Mesh(new THREE.CylinderGeometry(0.011,0.017,1.6,24), new THREE.MeshStandardMaterial({color:0xb28d5b,roughness:0.7}));
    cue.rotation.z=Math.PI/2; cueGroup.add(cue); scene.add(cueGroup); this.cueGroup=cueGroup;
    const aimGeom=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);
    const aim=new THREE.Line(aimGeom,new THREE.LineBasicMaterial({color:0xffffff})); scene.add(aim); this.aimLine=aim;

    // física
    this.restitution=0.98; this.friction=0.992;

    // HUD
    const pfill=document.getElementById('pfill');
    document.getElementById('resetBtn').onclick=()=>location.reload();
    document.getElementById('v34Btn').onclick=()=>{ camera.position.set(-1.0,2.8,3.6); controls.update(); };
    document.getElementById('topBtn').onclick=()=>{ camera.position.set(0,3.4,0.0001); controls.update(); };

    // Painel
    const ambR=document.getElementById('amb'), dirR=document.getElementById('dir'), dirC=document.getElementById('dirColor');
    const camX=document.getElementById('camX'), camY=document.getElementById('camY'), camZ=document.getElementById('camZ'), resetCam=document.getElementById('resetCam');
    ambR.oninput=()=>amb.intensity=parseFloat(ambR.value); dirR.oninput=()=>dir.intensity=parseFloat(dirR.value); dirC.oninput=()=>dir.color.set(dirC.value);
    const upd=()=>{ camera.position.set(parseFloat(camX.value),parseFloat(camY.value),parseFloat(camZ.value)); controls.update(); };
    camX.oninput=camY.oninput=camZ.oninput=upd; resetCam.onclick=()=>{ camX.value=-1; camY.value=2.8; camZ.value=3.6; upd(); };

    this._installInput(pfill);
    // dispara automaticamente uma vez
    setTimeout(()=>this.autoBreak(), 400);
  }

  _installInput(pfill){
    const raycaster=new THREE.Raycaster(); const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    const screenToXZ=(ev)=>{ const r=this.renderer.domElement.getBoundingClientRect(); const ndc=new THREE.Vector2(((ev.clientX-r.left)/r.width)*2-1, -((ev.clientY-r.top)/r.height)*2+1); raycaster.setFromCamera(ndc,this.camera); const p=new THREE.Vector3(); raycaster.ray.intersectPlane(plane,p); return new THREE.Vector3(p.x,0,p.z); };
    this.player={aim:false,start:new THREE.Vector2(),power:0}; const el=this.renderer.domElement;
    el.addEventListener('pointerdown',(ev)=>{ const p=screenToXZ(ev); const w=this.ballsBodies.find(b=>b.isCue); if(Math.hypot(p.x-w.x,p.z-w.z)<0.2){ this.player.aim=true; this.player.start.set(p.x,p.z); this._updateAim(p.x,p.z); }});
    el.addEventListener('pointermove',(ev)=>{ if(!this.player.aim) return; const p=screenToXZ(ev); const d=Math.hypot(p.x-this.player.start.x,p.z-this.player.start.z); this.player.power=Math.min(1,d/0.7); if(pfill) pfill.style.width=(this.player.power*100)+'%'; this._updateAim(p.x,p.z); });
    el.addEventListener('pointerup',(ev)=>{ if(!this.player.aim) return; this.player.aim=false; const p=screenToXZ(ev); this._shoot(p.x,p.z,this.player.power); if(pfill) pfill.style.width='0%'; this.aimLine.visible=false; });
  }

  _updateAim(px,pz){
    const w=this.ballsBodies.find(b=>b.isCue); const R=this.BALL_R;
    const dx=px-w.x, dz=pz-w.z; const len=Math.hypot(dx,dz)||1; const nx=dx/len, nz=dz/len;
    const off=0.55; const cueH=this.TABLE.y+R+0.03;
    this.cueGroup.position.set(w.x-nx*off, cueH, w.z-nz*off);
    this.cueGroup.rotation.set(0, Math.atan2(nz,nx), 0);
    const p1=new THREE.Vector3(w.x, cueH-0.02, w.z);
    const p2=new THREE.Vector3(w.x-nx*0.7, cueH-0.02, w.z-nz*0.7);
    this.aimLine.geometry.setFromPoints([p1,p2]); this.aimLine.visible=true;
  }

  _shoot(px,pz,power){
    const w=this.ballsBodies.find(b=>b.isCue); const R=this.BALL_R;
    const dx=px-w.x, dz=pz-w.z; const len=Math.hypot(dx,dz)||1; const nx=dx/len, nz=dz/len;
    const start=this.cueGroup.position.clone(); const cueH=this.TABLE.y+R+0.03;
    const impact=0.50; const travel=impact+0.10; const velo=3.0+power*6.0; let t=0, hit=false, returning=false;
    const step=(time)=>{ if(!this._t) this._t=time; const dt=Math.min(0.033,(time-this._t)/1000); this._t=time;
      if(!returning){ t+=dt*velo; const adv=Math.min(travel,t); this.cueGroup.position.set(start.x+nx*adv, cueH, start.z+nz*adv);
        if(!hit && adv>=impact){ const sx=-nx, sz=-nz; const speed=4.2*Math.max(0.2,power); w.vx+=sx*speed; w.vz+=sz*speed; hit=true; }
        if(t>=travel) returning=true;
      }else{ t-=dt*velo*1.2; const adv=Math.max(0,t); this.cueGroup.position.set(start.x+nx*adv, cueH, start.z+nz*adv); if(t<=0){ this.cueGroup.position.copy(start); this._t=0; return; } }
      requestAnimationFrame(step);
    }; requestAnimationFrame(step);
  }

  _physics(dt){
    const R=this.BALL_R,W=this.TABLE.halfW,H=this.TABLE.halfH,e=0.98,fr=0.992,B=this.ballsBodies;
    for(const b of B){ b.vx*=fr; b.vz*=fr; b.x+=b.vx*dt; b.z+=b.vz*dt; if(b.x<-W+R){b.x=-W+R; b.vx=-b.vx*e;} if(b.x>W-R){b.x=W-R; b.vx=-b.vx*e;} if(b.z<-H+R){b.z=-H+R; b.vz=-b.vz*e;} if(b.z>H-R){b.z=H-R; b.vz=-b.vz*e;} }
    for(let i=0;i<B.length;i++){ for(let j=i+1;j<B.length;j++){ const a=B[i],b=B[j]; const dx=b.x-a.x,dz=b.z-a.z; const r=2*R; const d2=dx*dx+dz*dz;
      if(d2>0 && d2<r*r){ const d=Math.sqrt(d2),nx=dx/d,nz=dz/d,over=(r-d)*0.5; a.x-=nx*over; a.z-=nz*over; b.x+=nx*over; b.z+=nz*over;
        const dvx=b.vx-a.vx,dvz=b.vz-a.vz,rel=dvx*nx+dvz*nz; if(rel<0){ const jimp=-(1+e)*rel/2; const jx=jimp*nx,jz=jimp*nz; a.vx-=jx; a.vz-=jz; b.vx+=jx; b.vz+=jz; } } } }
    for(let i=0;i<this.ballsMeshes.length;i++){ const m=this.ballsMeshes[i], b=B[i]; m.position.set(b.x,this.TABLE.y+R,b.z); }
  }


  // Tacada automática: alinha a branca ao centro do triângulo e chuta
  autoBreak(){
    const cue = this.ballsBodies.find(b=>b.isCue);
    if(!cue) return;
    // média das bolas não-brancas
    let sx=0, sz=0, n=0;
    for(const b of this.ballsBodies){ if(!b.isCue){ sx+=b.x; sz+=b.z; n++; } }
    if(n===0) return;
    const tx = sx/n, tz = sz/n;
    // Atualiza mira e dispara com potência alta
    this._updateAim(tx, tz);
    setTimeout(()=> this._shoot(tx, tz, 0.9), 500);
  }

  render(){ const loop=(now)=>{ this._last=this._last||now; const dt=Math.min(0.033,(now-this._last)/1000); this._last=now; this._physics(dt); this.controls.update(); this.renderer.render(this.scene,this.camera); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
}
