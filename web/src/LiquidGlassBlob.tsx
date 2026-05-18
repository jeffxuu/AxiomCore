/**
 * LiquidGlassBlob — liquid-glass-studio 着色器 WebGL2 多 Pass 液态玻璃 Blob 效果
 *
 * 渲染流水线：
 *   Pass 1: 背景 + 阴影     → bgFBO
 *   Pass 2: 水平高斯模糊    → hBlurFBO
 *   Pass 3: 垂直高斯模糊    → vBlurFBO (= blurredBg)
 *   Pass 4: 液态玻璃主渲染  → 屏幕
 *
 * Shape 1 (圆形):     固定在屏幕中心
 * Shape 2 (圆角矩形): 跟随鼠标弹簧物理运动
 * 两者靠近时用 smin 平滑融合 (Blob 液滴合并效果)
 *
 * 参数来源：用户导出的 liquid-glass-2026-05-15T07-50-40.json
 */
import { useEffect, useRef } from "react";

// ── 弹簧物理常数 ──────────────────────────────────────────────────
const SK = 0.10;  // 弹性系数（越大越跟手）
const SD = 0.78;  // 阻尼系数（越大越粘滞，阻止振荡）

// ── 用户导出参数（100倍 UI 值 → 已归一化为 0-1）─────────────────────
const P = {
  // 折射参数（绝对值）
  refThickness:        20,
  refFactor:          1.4,
  refDispersion:      7.0,
  refFresnelRange:     30,
  // 折射参数（归一化 0-1）
  refFresnelHardness: 0.20,
  refFresnelFactor:   0.20,
  // 高光眩光（绝对值）
  glareRange:          30,
  // 高光眩光（归一化 0-1）
  glareHardness:      0.20,
  glareFactor:        0.90,
  glareConvergence:   0.50,
  glareOppositeFactor:0.80,
  glareAngle:         -45,   // 度数，JS 侧转换为弧度再传入
  // 模糊
  blurRadius:          24,   // 高斯模糊半径（px），比 studio 默认大，效果更明显
  // 阴影
  shadowExpand:        25,
  shadowFactor:        15,
  shadowX:              0,
  shadowY:            -10,
  // 形状
  shapeWidth:         200,
  shapeHeight:        200,
  shapeRadius:         80,
  shapeRoundness:       5,
  mergeRate:          0.05,  // Blob 融合平滑度（归一化空间）
} as const;

// ── WebGL 工具函数 ────────────────────────────────────────────────

function gaussianWeights(radius: number): Float32Array {
  const sigma = radius / 2.5;
  const w = new Float32Array(radius + 1);
  let sum = 0;
  for (let i = 0; i <= radius; i++) {
    w[i] = Math.exp(-(i * i) / (2 * sigma * sigma));
    sum += i === 0 ? w[i] : w[i] * 2;
  }
  for (let i = 0; i <= radius; i++) w[i] /= sum;
  return w;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error("Shader: " + (gl.getShaderInfoLog(s) ?? "compile error"));
  }
  return s;
}

function link(gl: WebGL2RenderingContext, vert: string, frag: string): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER,   vert));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error("Program: " + (gl.getProgramInfoLog(p) ?? "link error"));
  }
  return p;
}

function makeVAO(gl: WebGL2RenderingContext, prog: WebGLProgram): { vao: WebGLVertexArrayObject; buf: WebGLBuffer } {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  // 全屏四边形（两个三角形）
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a_position");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return { vao, buf };
}

function makeFBO(gl: WebGL2RenderingContext, w: number, h: number) {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex };
}

// ── 着色器源码 ────────────────────────────────────────────────────

// 通用顶点着色器（所有 Pass 共用）
const VERT = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = (a_position + 1.0) * 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

// ── Pass 1: 动态背景 + 玻璃阴影 ──────────────────────────────────
const FRAG_BG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_dark;
uniform float u_dpr;
uniform vec2  u_mouseSpring;
uniform float u_shadowExpand;
uniform float u_shadowFactor;
uniform vec2  u_shadowPosition;
uniform float u_mergeRate;
uniform float u_shapeWidth;
uniform float u_shapeHeight;
uniform float u_shapeRadius;
uniform float u_shapeRoundness;
uniform int   u_showShape1;

float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
}
float superCorner(vec2 p,float r,float n){ p=abs(p); return pow(pow(p.x,n)+pow(p.y,n),1.0/n)-r; }
float rrSDF(vec2 p,float w,float h,float cr,float n){
  cr*=u_dpr;
  vec2 d=abs(p)-vec2(w,h)*u_dpr*0.5;
  if(d.x>-cr&&d.y>-cr){ vec2 cc=sign(p)*(vec2(w,h)*u_dpr*0.5-vec2(cr)); return superCorner(p-cc,cr,n); }
  return min(max(d.x,d.y),0.0)+length(max(d,0.0));
}
float sdCircle(vec2 p,float r){ return length(p)-r; }
float smin(float a,float b,float k){ float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0); return mix(b,a,h)-k*h*(1.0-h); }
float mainSDF(vec2 p1,vec2 p2,vec2 p){
  vec2 p1n=p1+p/u_resolution.y, p2n=p2+p/u_resolution.y;
  float d1=u_showShape1==1?sdCircle(p1n,100.0*u_dpr/u_resolution.y):1.0;
  float d2=rrSDF(p2n,u_shapeWidth/u_resolution.y,u_shapeHeight/u_resolution.y,
                  u_shapeRadius/u_resolution.y,u_shapeRoundness);
  return smin(d1,d2,u_mergeRate);
}

void main(){
  vec2 res1x=u_resolution/u_dpr;
  vec2 uv=gl_FragCoord.xy/u_resolution.xy;
  vec2 p=uv*2.0-1.0; p.x*=u_resolution.x/u_resolution.y;
  float t=u_time*0.055;
  float sheet=noise(p*1.35+vec2(t,-t*0.55));
  float caustic=sin((p.x+sheet*0.32)*5.4+t*4.0)*0.5+0.5;
  caustic*=sin((p.y-sheet*0.22)*4.2-t*3.2)*0.5+0.5;
  caustic=pow(caustic,2.0)*0.12;

  // 浅色/深色背景渐变
  vec3 baseL=mix(vec3(0.88,0.95,1.00),vec3(0.76,0.88,0.98),uv.y);
  vec3 baseD=mix(vec3(0.022,0.042,0.095),vec3(0.030,0.058,0.125),uv.y);
  vec3 base=mix(baseL,baseD,u_dark);

  // 彩色色块（让折射效果更丰富多彩）
  vec3 blue =vec3(0.35,0.62,1.00)*smoothstep(0.8,0.0,length(p-vec2(-0.5, 0.2)))*(u_dark>0.5?0.28:0.22);
  vec3 grn  =vec3(0.25,0.82,0.65)*smoothstep(0.7,0.0,length(p-vec2( 0.5,-0.2)))*(u_dark>0.5?0.22:0.18);
  vec3 orng =vec3(1.00,0.55,0.25)*smoothstep(0.6,0.0,length(p-vec2( 0.6, 0.6)))*(u_dark>0.5?0.18:0.14);
  vec3 teal =vec3(0.28,0.88,0.78)*smoothstep(0.5,0.0,length(p-vec2(-0.6,-0.3)))*0.18;
  vec3 purp =vec3(0.72,0.38,1.00)*smoothstep(0.55,0.0,length(p-vec2( 0.2, 0.5)))*(u_dark>0.5?0.20:0.14);

  vec3 col=base+blue+grn+orng+teal+purp;
  col+=vec3(caustic*1.4,caustic*1.1,caustic*0.7)*(u_dark>0.5?1.5:1.0);

  // 阴影（在背景上绘制玻璃形状的投影）
  vec2 sp=u_shadowPosition*u_dpr;
  vec2 s1=(vec2(0.0)-u_resolution.xy*0.5+sp)/u_resolution.y;
  vec2 s2=(vec2(0.0)-u_mouseSpring+sp)/u_resolution.y;
  float sdShadow=mainSDF(s1,s2,gl_FragCoord.xy);
  float shadow=exp(-1.0/u_shadowExpand*abs(sdShadow)*res1x.y)*0.6*(u_shadowFactor*0.01);
  col-=vec3(shadow);

  fragColor=vec4(clamp(col,0.0,1.0),1.0);
}`;

// ── Pass 2+3: 可分离高斯模糊 ─────────────────────────────────────
const FRAG_BLUR = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_tex;
uniform vec2  u_resolution;
uniform vec2  u_blurDir;
uniform int   u_blurRadius;
uniform float u_blurWeights[33];

void main(){
  vec2 ts=1.0/u_resolution;
  vec4 color=texture(u_tex,v_uv)*u_blurWeights[0];
  int r=min(u_blurRadius,32);
  for(int i=1;i<=32;i++){
    if(i>r) break;
    float w=u_blurWeights[i];
    color+=texture(u_tex,v_uv+float(i)*ts*u_blurDir)*w;
    color+=texture(u_tex,v_uv-float(i)*ts*u_blurDir)*w;
  }
  fragColor=color;
}`;

// ── Pass 4: 完整物理液态玻璃（来自 liquid-glass-studio）──────────
const FRAG_GLASS = `#version 300 es
precision highp float;
#define PI (3.14159265359)

// 色散常数（R偏移略大，B偏移略小 → 彩虹边缘）
const float N_R=1.0-0.02, N_G=1.0, N_B=1.0+0.02;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_bg;        // 原始背景纹理
uniform sampler2D u_blurredBg; // 高斯模糊后的背景
uniform vec2  u_resolution;
uniform float u_dpr;
uniform vec2  u_mouseSpring;
uniform float u_mergeRate;
uniform float u_shapeWidth;
uniform float u_shapeHeight;
uniform float u_shapeRadius;
uniform float u_shapeRoundness;
uniform float u_refThickness;
uniform float u_refFactor;
uniform float u_refDispersion;
uniform float u_refFresnelRange;
uniform float u_refFresnelFactor;
uniform float u_refFresnelHardness;
uniform float u_glareRange;
uniform float u_glareConvergence;
uniform float u_glareOppositeFactor;
uniform float u_glareFactor;
uniform float u_glareHardness;
uniform float u_glareAngle;    // 弧度
uniform int   u_blurEdge;
uniform int   u_showShape1;

// ── SDF 函数 ──────────────────────────────────────────────────────
float superCorner(vec2 p,float r,float n){ p=abs(p); return pow(pow(p.x,n)+pow(p.y,n),1.0/n)-r; }
float rrSDF(vec2 p,float w,float h,float cr,float n){
  cr*=u_dpr;
  vec2 d=abs(p)-vec2(w,h)*u_dpr*0.5;
  if(d.x>-cr&&d.y>-cr){ vec2 cc=sign(p)*(vec2(w,h)*u_dpr*0.5-vec2(cr)); return superCorner(p-cc,cr,n); }
  return min(max(d.x,d.y),0.0)+length(max(d,0.0));
}
float sdCircle(vec2 p,float r){ return length(p)-r; }
float smin(float a,float b,float k){ float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0); return mix(b,a,h)-k*h*(1.0-h); }
float mainSDF(vec2 p1,vec2 p2,vec2 p){
  vec2 p1n=p1+p/u_resolution.y, p2n=p2+p/u_resolution.y;
  float d1=u_showShape1==1?sdCircle(p1n,100.0*u_dpr/u_resolution.y):1.0;
  float d2=rrSDF(p2n,u_shapeWidth/u_resolution.y,u_shapeHeight/u_resolution.y,
                  u_shapeRadius/u_resolution.y,u_shapeRoundness);
  return smin(d1,d2,u_mergeRate);
}

// 数值梯度 → 表面法向量（用于折射方向计算）
vec2 getNormal(vec2 p1,vec2 p2,vec2 p){
  vec2 h=vec2(max(abs(dFdx(p.x)),0.0001),max(abs(dFdy(p.y)),0.0001));
  vec2 grad=vec2(
    mainSDF(p1,p2,p+vec2(h.x,0.0))-mainSDF(p1,p2,p-vec2(h.x,0.0)),
    mainSDF(p1,p2,p+vec2(0.0,h.y))-mainSDF(p1,p2,p-vec2(0.0,h.y))
  )/(2.0*h);
  return grad*1.41421356*1000.0;
}

// 色散采样：RGB 三通道用略微不同的偏移量 → 彩虹边
vec4 getTexDisp(sampler2D tex1,sampler2D tex2,float mixRate,vec2 off,float factor){
  float bgR=texture(tex1,v_uv+off*(1.0-(N_R-1.0)*factor)).r;
  float bgG=texture(tex1,v_uv+off*(1.0-(N_G-1.0)*factor)).g;
  float bgB=texture(tex1,v_uv+off*(1.0-(N_B-1.0)*factor)).b;
  float blR=texture(tex2,v_uv+off*(1.0-(N_R-1.0)*factor)).r;
  float blG=texture(tex2,v_uv+off*(1.0-(N_G-1.0)*factor)).g;
  float blB=texture(tex2,v_uv+off*(1.0-(N_B-1.0)*factor)).b;
  return vec4(mix(bgR,blR,mixRate),mix(bgG,blG,mixRate),mix(bgB,blB,mixRate),1.0);
}

float vec2ToAngle(vec2 v){ float a=atan(v.y,v.x); if(a<0.0)a+=2.0*PI; return a; }

// ── LCH 颜色空间（来自 liquid-glass-studio，用于物理正确的高光颜色）─
const mat3 RGB2XYZ=mat3(0.4124,0.3576,0.1805, 0.2126,0.7152,0.0722, 0.0193,0.1192,0.9505);
const mat3 XYZ2RGB=mat3(3.2406,-1.5372,-0.4986, -0.9689,1.8758,0.0415, 0.0557,-0.2040,1.0570);
const vec3 WHITE=vec3(0.95046,1.0,1.08906);
float uc(float a){ return a>0.04045?pow((a+0.055)/1.055,2.4):a/12.92; }
float cc(float a){ return a<=0.0031308?12.92*a:1.055*pow(a,0.41667)-0.055; }
vec3 s2l(vec3 c){ return vec3(uc(c.r),uc(c.g),uc(c.b)); }
vec3 l2s(vec3 c){ return vec3(cc(c.r),cc(c.g),cc(c.b)); }
float lf(float x){ return x>0.00886?pow(x,0.33333):7.787*x+0.13793; }
vec3 srgb2lch(vec3 c){
  vec3 xyz=s2l(c)*RGB2XYZ, w=xyz/WHITE;
  vec3 lab=vec3(116.0*lf(w.y)-16.0, 500.0*(lf(w.x)-lf(w.y)), 200.0*(lf(w.y)-lf(w.z)));
  return vec3(lab.x,sqrt(dot(lab.yz,lab.yz)),atan(lab.z,lab.y)*57.29578);
}
float lfi(float x){ return x>0.20690?x*x*x:0.12842*(x-0.13793); }
vec3 lch2srgb(vec3 lch){
  vec3 lab=vec3(lch.x,lch.y*cos(lch.z*0.01745),lch.y*sin(lch.z*0.01745));
  float w=(lab.x+16.0)/116.0;
  vec3 xyz=WHITE*vec3(lfi(w+lab.y/500.0),lfi(w),lfi(w-lab.z/200.0));
  return l2s(clamp(xyz*XYZ2RGB,0.0,1.0));
}

void main(){
  vec2 res1x=u_resolution/u_dpr;

  // 形状位置（Screen Space, Y from bottom）
  vec2 p1=(vec2(0.0)-u_resolution.xy*0.5)/u_resolution.y;   // 圆：屏幕中心
  vec2 p2=(vec2(0.0)-u_mouseSpring)/u_resolution.y;          // 矩形：跟随鼠标

  float merged=mainSDF(p1,p2,gl_FragCoord.xy);
  vec4 outColor;

  if(merged<0.005){
    float nmerged=-merged*res1x.y;

    // 折射边缘因子（Snell 折射定律）
    float xR=1.0-nmerged/u_refThickness;
    float thetaI=asin(clamp(pow(xR,2.0),-1.0,1.0));
    float sinT=clamp(1.0/u_refFactor*sin(thetaI),-1.0,1.0);
    float thetaT=asin(sinT);
    float edgeFactor=-tan(thetaT-thetaI);
    if(nmerged>=u_refThickness) edgeFactor=0.0;

    if(edgeFactor<=0.0){
      // 玻璃内部：显示模糊背景
      outColor=texture(u_blurredBg,v_uv);
    } else {
      // 折射边缘：偏移采样 + 色散
      float edgeH=nmerged/u_refThickness;
      vec2 normal=getNormal(p1,p2,gl_FragCoord.xy);
      vec2 off=-normal*edgeFactor*0.05*u_dpr
               *vec2(u_resolution.y/(res1x.x*u_dpr),1.0);
      float mixRate=u_blurEdge>0?1.0:edgeH;
      vec4 px=getTexDisp(u_bg,u_blurredBg,mixRate,off,u_refDispersion);
      outColor=px;

      // ── 菲涅尔反射 ──────────────────────────────────────────
      float fresnelFactor=clamp(
        pow(1.0+merged*res1x.y/1500.0*pow(500.0/u_refFresnelRange,2.0)+u_refFresnelHardness,5.0),
        0.0,1.0);
      vec3 frLCH=srgb2lch(vec3(1.0));
      frLCH.x+=20.0*fresnelFactor*u_refFresnelFactor;
      frLCH.x=clamp(frLCH.x,0.0,100.0);
      outColor=mix(outColor,vec4(lch2srgb(frLCH),1.0),
                   fresnelFactor*u_refFresnelFactor*0.7*length(normal));

      // ── 高光眩光 ─────────────────────────────────────────────
      float glareGeo=clamp(
        pow(1.0+merged*res1x.y/1500.0*pow(500.0/u_glareRange,2.0)+u_glareHardness,5.0),
        0.0,1.0);
      float ga=(vec2ToAngle(normalize(normal))-PI/4.0+u_glareAngle)*2.0;
      int farside=0;
      if((ga>PI*(2.0-0.5)&&ga<PI*(4.0-0.5))||ga<PI*(0.0-0.5)) farside=1;
      float gaf=(0.5+sin(ga)*0.5)*(farside==1?1.2*u_glareOppositeFactor:1.2)*u_glareFactor;
      gaf=clamp(pow(gaf,0.1+u_glareConvergence*2.0),0.0,1.0);
      vec3 glareLCH=srgb2lch(mix(px.rgb,vec3(1.0),0.0));
      glareLCH.x+=150.0*gaf*glareGeo;
      glareLCH.y+=30.0*gaf*glareGeo;
      glareLCH.x=clamp(glareLCH.x,0.0,120.0);
      outColor=mix(outColor,vec4(lch2srgb(glareLCH),1.0),gaf*glareGeo*length(normal));
    }
  } else {
    outColor=texture(u_bg,v_uv);
  }

  // 玻璃边缘平滑过渡（消除锯齿）
  outColor=mix(outColor,texture(u_bg,v_uv),smoothstep(-0.001,0.001,merged));
  fragColor=outColor;
}`;

// ── React 组件 ────────────────────────────────────────────────────

export function LiquidGlassBlob({ isDark }: { isDark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDarkRef = useRef(isDark);
  const darkRef   = useRef(isDark ? 1.0 : 0.0);
  useEffect(() => { isDarkRef.current = isDark; }, [isDark]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false }) as WebGL2RenderingContext | null;
    if (!gl) return;

    // ── 初始化着色器 ──
    let progBG: WebGLProgram, progBlur: WebGLProgram, progGlass: WebGLProgram;
    let quadBG: ReturnType<typeof makeVAO>,
        quadBlur: ReturnType<typeof makeVAO>,
        quadGlass: ReturnType<typeof makeVAO>;
    try {
      progBG    = link(gl, VERT, FRAG_BG);
      progBlur  = link(gl, VERT, FRAG_BLUR);
      progGlass = link(gl, VERT, FRAG_GLASS);
      quadBG    = makeVAO(gl, progBG);
      quadBlur  = makeVAO(gl, progBlur);
      quadGlass = makeVAO(gl, progGlass);
    } catch (e) {
      console.error("LiquidGlassBlob 着色器初始化失败:", e);
      return;
    }

    // 预计算高斯权重（固定半径，只计算一次）
    const gw = gaussianWeights(P.blurRadius);
    const weightsArr = new Float32Array(33); // 着色器声明 33 个
    for (let i = 0; i <= Math.min(P.blurRadius, 32); i++) weightsArr[i] = gw[i];

    // ── FBO 管理 ──
    let bgFBO:   ReturnType<typeof makeFBO> | null = null;
    let hFBO:    ReturnType<typeof makeFBO> | null = null;
    let vFBO:    ReturnType<typeof makeFBO> | null = null;
    let fbW = 0, fbH = 0;

    const ensureFBOs = (w: number, h: number) => {
      if (w === fbW && h === fbH) return;
      fbW = w; fbH = h;
      const del = (f: ReturnType<typeof makeFBO> | null) => {
        if (!f) return;
        gl.deleteTexture(f.tex);
        gl.deleteFramebuffer(f.fbo);
      };
      del(bgFBO); del(hFBO); del(vFBO);
      bgFBO = makeFBO(gl, w, h);
      hFBO  = makeFBO(gl, w, h);
      vFBO  = makeFBO(gl, w, h);
    };

    // ── 工具：绑定纹理到采样器 uniform ──
    const bindTex = (prog: WebGLProgram, name: string, tex: WebGLTexture, unit: number) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(gl.getUniformLocation(prog, name), unit);
    };

    // ── 弹簧状态（物理像素，Y 轴已翻转为 WebGL 坐标系）──
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let springX = 0, springY = 0, velX = 0, velY = 0;
    let targetX = 0, targetY = 0;
    let springInited = false;

    const onMouse = (e: PointerEvent) => {
      targetX = e.clientX * dpr;
      targetY = (window.innerHeight - e.clientY) * dpr; // WebGL Y 轴向上翻转
      if (!springInited) { springX = targetX; springY = targetY; springInited = true; }
    };

    // ── Uniform 便捷设置函数 ──
    const ul = (prog: WebGLProgram, n: string) => gl.getUniformLocation(prog, n);
    const uf = (prog: WebGLProgram, n: string, v: number) => gl.uniform1f(ul(prog, n), v);
    const ui = (prog: WebGLProgram, n: string, v: number) => gl.uniform1i(ul(prog, n), v);
    const u2 = (prog: WebGLProgram, n: string, x: number, y: number) => gl.uniform2f(ul(prog, n), x, y);

    // 所有 Pass 共用的形状 uniform
    const setShapeUniforms = (prog: WebGLProgram, w: number, h: number, sx: number, sy: number) => {
      u2(prog, "u_resolution",     w, h);
      u2(prog, "u_mouseSpring",    sx, sy);
      uf(prog, "u_dpr",            dpr);
      uf(prog, "u_mergeRate",      P.mergeRate);
      uf(prog, "u_shapeWidth",     P.shapeWidth);
      uf(prog, "u_shapeHeight",    P.shapeHeight);
      uf(prog, "u_shapeRadius",    P.shapeRadius);
      uf(prog, "u_shapeRoundness", P.shapeRoundness);
      ui(prog, "u_showShape1",     1);
    };

    // ── 渲染循环 ──
    let raf = 0;
    const render = (time: number) => {
      const w = Math.floor(window.innerWidth  * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      ensureFBOs(w, h);

      // 初始化弹簧在屏幕中心
      if (!springInited) { springX = w * 0.5; springY = h * 0.5; springInited = true; }

      // 弹簧物理更新
      const dx = targetX - springX, dy = targetY - springY;
      velX = velX * SD + dx * SK;
      velY = velY * SD + dy * SK;
      springX += velX;
      springY += velY;

      // 深色模式平滑插值
      darkRef.current += ((isDarkRef.current ? 1.0 : 0.0) - darkRef.current) * 0.055;

      const t = time * 0.001;
      const sx = springX, sy = springY;

      // ── Pass 1: 背景 + 阴影 → bgFBO ──
      gl.bindFramebuffer(gl.FRAMEBUFFER, bgFBO!.fbo);
      gl.viewport(0, 0, w, h);
      gl.useProgram(progBG);
      gl.bindVertexArray(quadBG.vao);
      setShapeUniforms(progBG, w, h, sx, sy);
      uf(progBG, "u_time",           t);
      uf(progBG, "u_dark",           darkRef.current);
      uf(progBG, "u_shadowExpand",   P.shadowExpand);
      uf(progBG, "u_shadowFactor",   P.shadowFactor);
      u2(progBG, "u_shadowPosition", P.shadowX, P.shadowY);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // ── Pass 2: 水平高斯模糊 → hFBO ──
      gl.bindFramebuffer(gl.FRAMEBUFFER, hFBO!.fbo);
      gl.useProgram(progBlur);
      gl.bindVertexArray(quadBlur.vao);
      bindTex(progBlur, "u_tex", bgFBO!.tex, 0);
      u2(progBlur, "u_resolution", w, h);
      u2(progBlur, "u_blurDir",    1, 0);  // 水平方向
      ui(progBlur, "u_blurRadius", P.blurRadius);
      gl.uniform1fv(ul(progBlur, "u_blurWeights"), weightsArr);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // ── Pass 3: 垂直高斯模糊 → vFBO ──
      gl.bindFramebuffer(gl.FRAMEBUFFER, vFBO!.fbo);
      gl.useProgram(progBlur);
      gl.bindVertexArray(quadBlur.vao);
      bindTex(progBlur, "u_tex", hFBO!.tex, 0);
      u2(progBlur, "u_resolution", w, h);
      u2(progBlur, "u_blurDir",    0, 1);  // 垂直方向
      ui(progBlur, "u_blurRadius", P.blurRadius);
      gl.uniform1fv(ul(progBlur, "u_blurWeights"), weightsArr);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // ── Pass 4: 液态玻璃主渲染 → 屏幕 ──
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.useProgram(progGlass);
      gl.bindVertexArray(quadGlass.vao);
      bindTex(progGlass, "u_bg",        bgFBO!.tex, 0);
      bindTex(progGlass, "u_blurredBg", vFBO!.tex,  1);
      setShapeUniforms(progGlass, w, h, sx, sy);
      uf(progGlass, "u_refThickness",        P.refThickness);
      uf(progGlass, "u_refFactor",           P.refFactor);
      uf(progGlass, "u_refDispersion",       P.refDispersion);
      uf(progGlass, "u_refFresnelRange",     P.refFresnelRange);
      uf(progGlass, "u_refFresnelFactor",    P.refFresnelFactor);
      uf(progGlass, "u_refFresnelHardness",  P.refFresnelHardness);
      uf(progGlass, "u_glareRange",          P.glareRange);
      uf(progGlass, "u_glareHardness",       P.glareHardness);
      uf(progGlass, "u_glareFactor",         P.glareFactor);
      uf(progGlass, "u_glareConvergence",    P.glareConvergence);
      uf(progGlass, "u_glareOppositeFactor", P.glareOppositeFactor);
      uf(progGlass, "u_glareAngle",          P.glareAngle * Math.PI / 180.0);
      ui(progGlass, "u_blurEdge",            1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      raf = requestAnimationFrame(render);
    };

    window.addEventListener("pointermove", onMouse, { passive: true });
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMouse);
      if (bgFBO) { gl.deleteTexture(bgFBO.tex); gl.deleteFramebuffer(bgFBO.fbo); }
      if (hFBO)  { gl.deleteTexture(hFBO.tex);  gl.deleteFramebuffer(hFBO.fbo); }
      if (vFBO)  { gl.deleteTexture(vFBO.tex);  gl.deleteFramebuffer(vFBO.fbo); }
      gl.deleteProgram(progBG);
      gl.deleteProgram(progBlur);
      gl.deleteProgram(progGlass);
      gl.deleteBuffer(quadBG.buf);
      gl.deleteBuffer(quadBlur.buf);
      gl.deleteBuffer(quadGlass.buf);
    };
  }, []);

  return <canvas ref={canvasRef} className="liquid-canvas" aria-hidden="true" />;
}
