export const planeVertex = `
varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
`;

const common = `
uniform float uAge;
uniform float uType;
uniform float uStrength;
uniform float uAngle;
uniform float uSpin;
uniform float uSignature;
uniform vec2 uSource;
const float PI=3.14159265;
mat2 rotate2(float a){return mat2(cos(a),sin(a),-sin(a),cos(a));}
float windowed(float t,float a,float b,float c,float d){return smoothstep(a,b,t)*(1.0-smoothstep(c,d,t));}
vec2 direction(){return vec2(cos(uAngle-0.55),sin(uAngle-0.55));}
vec2 perpendicular(vec2 d){return vec2(-d.y,d.x);}
float trailOffset(float i){return (i-2.5)*0.7+(uSignature-0.5)*0.4;}
float trailStart(float i){return 0.6+i*0.62;}
`;

export const particleVertex = `
attribute float aSeed;
attribute vec3 aHome;
uniform float uTime;
uniform float uAge;
uniform float uPixelRatio;
uniform vec2 uPointer;
uniform float uGentle;
varying float vLight;
varying float vSeed;
void main(){
  vec3 base=mix(position,aHome,uGentle);
  float r=aSeed, phase=r*62.83;
  if(uAge<0.0){
    base+=vec3(sin(phase+uTime*0.3),cos(phase+uTime*0.21),sin(phase))*0.023;
    vec2 away=base.xy-uPointer;
    base.xy+=normalize(away+0.001)*exp(-dot(away,away)*2.0)*0.1*(1.0-uGentle);
  }
  gl_Position=projectionMatrix*modelViewMatrix*vec4(base,1.0);
  gl_PointSize=(1.15+r*1.5)*uPixelRatio;
  vLight=0.42+0.58*pow(abs(sin(base.y*7.0+phase*0.15+uTime*0.4)),2.0);
  vSeed=r;
}
`;

export const particleFragment = `
uniform vec3 uColor;
varying float vLight;
varying float vSeed;
void main(){
  float d=length(gl_PointCoord-0.5);
  if(d>0.5)discard;
  float alpha=smoothstep(0.5,0.06,d)*(0.48+vLight*0.5);
  gl_FragColor=vec4(mix(uColor,vec3(1.0,0.98,0.9),vSeed*0.7),alpha);
}
`;

export const eventFragment =
  common +
  `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uGentle;
uniform float uEnvelope;
uniform float uFront1;
uniform float uFront2;
uniform float uIgnition;
uniform float uOrbit;
uniform float uFlowAngle;
uniform vec2 uLensCentre;
uniform float uMeteorHeads[6];
uniform float uMeteorOpacity[6];
float glow(vec2 p,float radius){return exp(-dot(p,p)/(radius*radius));}
float ring(vec2 p,float radius,float width){float d=(length(p)-radius)/width;return abs(d)<=3.0?exp(-d*d):0.0;}
float star(vec2 p,float radius){
  float core=glow(p,radius);
  float rays=exp(-abs(p.x)*95.0)*exp(-abs(p.y)*3.3)+exp(-abs(p.y)*95.0)*exp(-abs(p.x)*3.3);
  return core+rays*0.45;
}
void main(){
  vec2 p=(vUv-0.5)*vec2(14.0,10.0);
  float t=uAge;
  if(t<0.0 || uGentle>0.5)discard;
  float brightness=0.0;
  float fade=uEnvelope;
  if(uType<0.5){
    vec2 v=p-uSource;
    float ignition=uIgnition;
    brightness+=star(v,0.06+ignition*0.13)*ignition*1.7;
    brightness+=glow(v,0.55)*ignition*0.22;
    float radius=uFront1;
    float released=smoothstep(1.4,1.6,t);
    brightness+=ring(v,radius,0.045+radius*0.012)*released*0.8;
    brightness+=ring(v,uFront2,0.16)*released*0.15;
    brightness+=glow(v,max(0.04,radius*0.65))*released*0.1;
  }else if(uType<1.5){
    vec2 d=direction(),n=perpendicular(d);
    for(int i=0;i<6;i++){
      float fi=float(i),life=t-trailStart(fi);
      float head=uMeteorHeads[i];
      float along=dot(p,d),across=dot(p,n)-trailOffset(fi);
      float tail=exp(-across*across*250.0)*exp(-max(0.0,head-along)*1.3)*step(along,head);
      brightness+=tail*uMeteorOpacity[i]*0.85;
    }
  }else if(uType<2.5){
    vec2 v=rotate2(uAngle*0.4)*(p-uSource);
    vec2 ellipse=v*vec2(1.0,2.8);
    float open=1.0;
    float a=atan(ellipse.y,ellipse.x),r=length(ellipse);
    brightness+=ring(ellipse,0.85,0.12)*(0.6+0.4*sin(a*3.0-t*3.5))*open;
    brightness+=ring(v,0.49,0.035)*open*0.9;
    brightness+=ring(v,0.53,0.14)*open*0.2;
    brightness+=glow(ellipse,1.5)*open*0.06;
  }else if(uType<3.5){
    float radius=uOrbit;
    float angle=uFlowAngle;
    vec2 source=vec2(cos(angle),sin(angle))*radius;
    float pair=1.0-smoothstep(2.9,3.3,t);
    brightness+=(star(p-source,0.1)+star(p+source,0.1))*pair;
    brightness+=(glow(p-source,0.4)+glow(p+source,0.4))*pair*0.16;
    float shock=uFront1;
    brightness+=ring(p,shock,0.055)*smoothstep(3.1,3.3,t)*0.8;
    brightness+=ring(p,uFront2,0.13)*smoothstep(3.1,3.3,t)*0.3;
    brightness+=glow(p,0.6)*uIgnition*0.6;
  }else if(uType<4.5){
    vec2 v=p-uSource;
    vec2 beam=rotate2(-uFlowAngle)*v;
    float on=1.0;
    brightness+=exp(-pow(beam.y/(0.03+abs(beam.x)*0.11),2.0))*exp(-abs(beam.x)*0.28)*on*0.5;
    brightness+=star(v,0.12)*on;
    brightness+=ring(v,0.35,0.022)*on*0.4;
  }else if(uType<5.5){
    vec2 d=direction(),n=perpendicular(d),v=p+d*4.8;
    float along=dot(v,d),across=dot(v,n);
    float reached=smoothstep(1.3+along/3.5,1.6+along/3.5,t)*step(0.0,along);
    brightness+=exp(-pow(across/(0.025+max(0.0,along)*0.022),2.0))*reached*0.8;
    brightness+=exp(-pow(across/0.27,2.0))*reached*0.14;
    brightness+=star(v,0.1);
    brightness+=sin(along*12.0-t*20.0)*sin(along*12.0-t*20.0)*exp(-across*across*200.0)*reached*0.2;
  }else if(uType<6.5){
    vec2 v=p-uLensCentre;
    float lens=1.0;
    float a=atan(v.y,v.x),r=length(v);
    brightness+=ring(v,2.0,0.045)*pow(0.5+0.5*sin(a*2.0+t*0.2),2.0)*lens;
    brightness+=ring(v,2.15,0.11)*lens*0.13;
    brightness+=(star(v-vec2(2.0,0.0),0.08)+star(v+vec2(2.0,0.0),0.08))*lens*0.8;
  }else if(uType<7.5){
    float r=length(p),a=atan(p.y,p.x);
    float grow=1.0;
    float shell=sin(r*9.0-a*2.0-t*2.4*uSpin);
    float pattern=pow(max(0.0,shell),14.0);
    brightness+=pattern*exp(-r*0.33)*smoothstep(0.1,0.5,r)*grow*0.65;
    vec2 binary=vec2(cos(t*2.0),sin(t*2.0))*0.24;
    brightness+=(star(p-binary,0.07)+star(p+binary,0.07))*grow*0.8;
  }else{
    vec2 v=rotate2(uAngle)*p;
    float bloom=uEnvelope;
    float wing=abs(v.x)/(0.35+bloom*2.9);
    float boundary=pow(abs(v.y)/(0.15+sin(clamp(wing,0.0,1.0)*PI)*1.7),2.0);
    float inside=exp(-boundary*2.0)*(1.0-smoothstep(0.85,1.1,wing))*smoothstep(0.0,0.2,wing);
    brightness+=inside*(0.14+0.1*sin(length(v)*17.0-t))*bloom;
    brightness+=exp(-pow(boundary-1.0,2.0)*40.0)*(1.0-smoothstep(0.75,1.0,wing))*bloom*0.35;
    brightness+=star(v,0.09)*bloom;
  }
  float alpha=clamp(brightness*fade,0.0,0.92);
  gl_FragColor=vec4(mix(uColor,vec3(1.0,0.96,0.88),clamp(brightness*0.55,0.0,0.85)),alpha);
}
`;

export const spaceFragment = `
varying vec2 vUv;
uniform float uTime;
uniform float uAspect;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
float cloud(vec2 p){return noise(p)*0.57+noise(p*2.03)*0.28+noise(p*4.01)*0.15;}
void main(){
  vec2 p=(vUv-0.5)*vec2(uAspect,1.0);
  vec2 flow=p*3.1+vec2(uTime*0.002,0.0);
  float n=cloud(flow+cloud(flow*0.7)*2.0);
  float band=exp(-pow((p.y+p.x*0.34-0.08)*2.1,2.0));
  float dust=pow(max(0.0,n-0.22),2.2)*band;
  vec3 color=vec3(0.015,0.022,0.035);
  color+=mix(vec3(0.13,0.13,0.22),vec3(0.24,0.14,0.095),smoothstep(-0.4,0.6,p.x))*dust*2.5;
  color+=vec3(0.025,0.055,0.065)*cloud(flow*1.6)*band*0.2;
  color*=0.65+0.35*(1.0-length(vUv-0.5));
  gl_FragColor=vec4(color,1.0);
}
`;

export const starsVertex = `
attribute float aSize;
attribute float aSeed;
attribute vec3 aColor;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vSeed;
void main(){
  vec3 p=position;
  p.xy+=vec2(sin(uTime*0.02+aSeed*6.28),cos(uTime*0.015+aSeed*6.28))*0.003;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
  gl_PointSize=aSize*uPixelRatio;
  vColor=aColor*(0.75+0.25*sin(uTime*0.45+aSeed*33.0));vSeed=aSeed;
}`;
export const starsFragment = `
varying vec3 vColor;
varying float vSeed;
void main(){vec2 p=gl_PointCoord-0.5;float r=length(p);float a=exp(-r*r*30.0);if(vSeed>0.96)a+=exp(-abs(p.x)*65.0-abs(p.y)*7.0)*0.5+exp(-abs(p.y)*65.0-abs(p.x)*7.0)*0.5;gl_FragColor=vec4(vColor,a);}
`;
