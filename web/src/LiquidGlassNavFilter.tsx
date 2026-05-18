/**
 * LiquidGlassNavFilter — archisvaze 规范的物理折射液态玻璃
 *
 * 实现流程（完全遵循 github.com/archisvaze/liquid-glass SVG 版本）：
 *   1. calcRefractionProfile  — Snell 折射定律计算边缘折射曲线
 *   2. buildDispMap           — Canvas 生成位移贴图（R=X偏移, G=Y偏移）
 *   3. buildSpecMap           — Canvas 生成 Fresnel 镜面高光贴图
 *   4. SVG filter pipeline    — feGaussianBlur → feDisplacementMap
 *                               → feColorMatrix(saturate) → specular composite
 *   5. CSS                    — backdrop-filter: url(#lg-nav-filter) on ::before
 *
 * Chrome/Edge 完整支持；Safari 通过 -webkit- 前缀支持。
 */
import { useEffect, useState } from "react";

// ── 物理常量 ──────────────────────────────────────────────────
const SAMPLES = 128; // 折射曲线采样点数

/** 凸圆矩形 (convex squircle) 表面高度函数
 *  x=0 对应边缘 (h=0), x=1 对应中心 (h=1) */
function surfaceHeight(x: number): number {
  return Math.pow(1.0 - Math.pow(1.0 - x, 4.0), 0.25);
}

/** Snell 折射定律 — 计算每个边缘距离处的折射位移量
 *  @param bezel      贝泽尔宽度 (px)：折射效果影响范围
 *  @param thickness  玻璃厚度 (px)：光线穿透的虚拟深度
 *  @param ior        折射率 (Index of Refraction)：玻璃≈1.45
 *  @returns profile  每个归一化位置的位移值数组 + 最大绝对值 */
function calcRefractionProfile(
  bezel: number,
  thickness: number,
  ior: number
): { profile: Float64Array; maxAbs: number } {
  const eta = 1.0 / ior; // 相对折射率倒数
  const profile = new Float64Array(SAMPLES);
  let maxAbs = 0;

  for (let i = 0; i < SAMPLES; i++) {
    const t = i / (SAMPLES - 1); // 归一化位置 [0=边缘, 1=中心]
    const y = surfaceHeight(t);

    // 有限差分求导数（表面切线斜率）
    const dt = 1e-4;
    const slope = (surfaceHeight(Math.min(t + dt, 1.0)) - y) / dt;

    // 表面法向量（入射方向 (0,1) 对应的内向法线）
    const mag = Math.sqrt(slope * slope + 1.0);
    const nx = -slope / mag;
    const ny = -1.0 / mag;

    // Snell 定律：入射光线方向 = (0, 1)（垂直向下）
    const cosI = -ny; // 与内向法线的点积
    const sinT2 = eta * eta * (1.0 - cosI * cosI);
    if (sinT2 >= 1.0) continue; // 全内反射，跳过

    const cosT = Math.sqrt(1.0 - sinT2);
    // 折射光线方向（Snell 向量形式）
    const rx = eta * 0 - (eta * cosI - cosT) * nx; // 入射 x = 0
    const ry = eta * 1 - (eta * cosI - cosT) * ny; // 入射 y = 1

    if (Math.abs(ry) > 1e-4) {
      // 光线在玻璃内的水平位移 = 折射角 × 光路长度
      const disp = (rx / ry) * (y * bezel + thickness);
      profile[i] = disp;
      if (Math.abs(disp) > maxAbs) maxAbs = Math.abs(disp);
    }
  }

  return { profile, maxAbs: maxAbs || 1.0 };
}

// ── SDF 工具函数 ──────────────────────────────────────────────

/** 圆角矩形有符号距离场 (SDF)
 *  返回值：负数 = 内部，正数 = 外部，0 = 边界 */
function sdfRRect(
  px: number, py: number,
  w: number, h: number,
  r: number
): number {
  const qx = Math.abs(px - w * 0.5) - w * 0.5 + r;
  const qy = Math.abs(py - h * 0.5) - h * 0.5 + r;
  return (
    Math.sqrt(Math.max(qx, 0.0) ** 2 + Math.max(qy, 0.0) ** 2) +
    Math.min(Math.max(qx, qy), 0.0) -
    r
  );
}

/** SDF 梯度 = 归一化外向法向量（通过数值微分） */
function sdfGrad(
  px: number, py: number,
  w: number, h: number,
  r: number
): [number, number] {
  const e = 0.4;
  const d = sdfRRect(px, py, w, h, r);
  const gx = sdfRRect(px + e, py, w, h, r) - d;
  const gy = sdfRRect(px, py + e, w, h, r) - d;
  const m = Math.sqrt(gx * gx + gy * gy);
  return m > 1e-4 ? [gx / m, gy / m] : [0.0, -1.0];
}

// ── Canvas 贴图生成 ───────────────────────────────────────────

/** 生成位移贴图
 *  R 通道 = 水平位移（128 = 零位移）
 *  G 通道 = 垂直位移（128 = 零位移）
 *  只在 bezel 宽度内的边缘区域有效，中心区域保持中性灰 */
function buildDispMap(
  w: number, h: number,
  r: number, bezel: number,
  profile: Float64Array,
  maxAbs: number
): string {
  const cvs = document.createElement("canvas");
  cvs.width = w;
  cvs.height = h;
  const ctx = cvs.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(w, h);
  const data = img.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const sd = sdfRRect(x + 0.5, y + 0.5, w, h, r);

      // 默认：中性灰（无位移）
      data[idx] = 128; data[idx + 1] = 128;
      data[idx + 2] = 128; data[idx + 3] = 255;

      if (sd > 0.0) { data[idx + 3] = 0; continue; } // 外部：透明

      const inside = -sd; // 内部深度（正值）
      if (inside >= bezel) continue; // 中心区域：保持中性灰，无折射

      // 边缘渐入不透明度（前 2px 平滑过渡）
      const fade = Math.min(inside / 2.0, 1.0);

      // 查找物理折射曲线值
      const t = inside / bezel; // 归一化：0=边缘, 1=中心
      const pi = Math.min(Math.floor(t * SAMPLES), SAMPLES - 1);
      const disp = profile[pi] ?? 0.0;

      // 外向法向量（位移方向）
      const [gx, gy] = sdfGrad(x + 0.5, y + 0.5, w, h, r);

      // 归一化位移到 [-1, 1]，再编码到 [0, 255]
      const dx = gx * disp / maxAbs;
      const dy = gy * disp / maxAbs;

      data[idx]     = Math.max(0, Math.min(255, Math.round(128 + dx * 127 * fade)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(128 + dy * 127 * fade)));
    }
  }

  ctx.putImageData(img, 0, 0);
  return cvs.toDataURL();
}

/** 生成 Fresnel 镜面高光贴图
 *  基于光源方向与表面法向量的点积计算反射强度
 *  @param angleDeg 光源方向角度（0=右，90=上） */
function buildSpecMap(
  w: number, h: number,
  r: number, bezel: number,
  angleDeg: number
): string {
  const cvs = document.createElement("canvas");
  cvs.width = w;
  cvs.height = h;
  const ctx = cvs.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(w, h);
  const data = img.data;

  const angle = (angleDeg * Math.PI) / 180.0;
  const lx = Math.cos(angle);
  const ly = -Math.sin(angle); // Y 轴翻转（屏幕坐标系）

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const sd = sdfRRect(x + 0.5, y + 0.5, w, h, r);

      if (sd > 0.0) { data[idx + 3] = 0; continue; }

      const inside = -sd;
      if (inside >= bezel) { data[idx + 3] = 0; continue; }

      const fade = Math.min(inside / 2.0, 1.0);
      const [gx, gy] = sdfGrad(x + 0.5, y + 0.5, w, h, r);

      // Fresnel：外向法向量与光源方向的点积（取绝对值模拟双面反射）
      const dot = Math.abs(gx * lx + gy * ly);

      // 边缘衰减：在 bezel 边界处强度为零，在实际边缘处最强
      const falloff = Math.sqrt(Math.max(0.0, 1.0 - (inside / bezel) ** 2));
      const coeff = dot * falloff;

      const val = (Math.round(255 * coeff)) | 0;
      // Alpha：二次方增强对比度
      const alpha = Math.min(255, (Math.round(val * coeff * fade * 2.4))) | 0;

      data[idx] = data[idx + 1] = data[idx + 2] = val;
      data[idx + 3] = alpha;
    }
  }

  ctx.putImageData(img, 0, 0);
  return cvs.toDataURL();
}

// ── React 组件 ────────────────────────────────────────────────

type NavMaps = {
  disp: string;
  spec: string;
  w: number;
  h: number;
  scale: number; // feDisplacementMap scale = maxAbs * factor
};

export function LiquidGlassNavFilter() {
  const [maps, setMaps] = useState<NavMaps | null>(null);

  useEffect(() => {
    // ── 物理参数 ──
    const BEZEL     = 22;  // px，折射影响宽度
    const THICKNESS = 38;  // px，虚拟玻璃厚度
    const IOR       = 1.45; // 折射率（高硼硅玻璃）
    const RADIUS    = 18;  // px，圆角半径（与 CSS border-radius 一致）
    const LIGHT_DEG = 52;  // °，光源方向（右上方向）

    let debounceId = 0;

    const build = () => {
      window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        const nav = document.querySelector<HTMLElement>(".top-nav");
        if (!nav) return;
        const rect = nav.getBoundingClientRect();
        const w = Math.round(rect.width);
        const h = Math.round(rect.height);
        if (w < 20 || h < 20) return;

        const { profile, maxAbs } = calcRefractionProfile(BEZEL, THICKNESS, IOR);

        setMaps({
          disp:  buildDispMap(w, h, RADIUS, BEZEL, profile, maxAbs),
          spec:  buildSpecMap(w, h, RADIUS, BEZEL, LIGHT_DEG),
          w, h,
          // feDisplacementMap scale: maxAbs × 2 ≈ 实际像素位移量
          scale: maxAbs * 2.2,
        });
      }, 80);
    };

    build();

    const ro = new ResizeObserver(build);
    const nav = document.querySelector(".top-nav");
    if (nav) ro.observe(nav);

    return () => {
      window.clearTimeout(debounceId);
      ro.disconnect();
    };
  }, []);

  if (!maps) return null;

  const { disp, spec, w, h, scale } = maps;

  // ── 视觉参数 ──
  const BLUR         = 2.8;  // backdrop blur（父级已有大模糊，这里只需轻微）
  const SPEC_SAT     = 4.5;  // 折射后饱和度提升（颜色更鲜艳）
  const SPEC_OPACITY = 0.56; // 高光不透明度
  const PAD          = 32;   // filter 溢出空间（处理边缘 blur 扩散）

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{
        position: "fixed",
        width: 0,
        height: 0,
        overflow: "hidden",
        pointerEvents: "none",
        left: "-9999px",
        top: 0,
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/*
         * lg-nav-filter — archisvaze 物理液态玻璃滤镜管线
         *
         * filterUnits="userSpaceOnUse" + primitiveUnits="userSpaceOnUse"
         * 确保在导航栏的像素坐标系中操作，与 Canvas 贴图尺寸对应
         */}
        <filter
          id="lg-nav-filter"
          filterUnits="userSpaceOnUse"
          primitiveUnits="userSpaceOnUse"
          x={String(-PAD)}
          y={String(-PAD)}
          width={String(w + PAD * 2)}
          height={String(h + PAD * 2)}
          colorInterpolationFilters="sRGB"
        >
          {/* Step 1：轻微模糊 backdrop（主模糊来自父级 backdrop-filter）*/}
          <feGaussianBlur
            in="SourceGraphic"
            stdDeviation={String(BLUR)}
            result="blurred"
          />

          {/* Step 2a：加载物理位移贴图 */}
          <feImage
            href={disp}
            x="0" y="0"
            width={String(w)}
            height={String(h)}
            preserveAspectRatio="none"
            result="dispMap"
          />

          {/* Step 2b：应用 Snell 折射位移 */}
          <feDisplacementMap
            in="blurred"
            in2="dispMap"
            scale={String(scale)}
            xChannelSelector="R"
            yChannelSelector="G"
            result="displaced"
          />

          {/* Step 3：饱和度提升（折射使颜色更丰富，类似棱镜效果）*/}
          <feColorMatrix
            in="displaced"
            type="saturate"
            values={String(SPEC_SAT)}
            result="boosted"
          />

          {/* Step 4a：加载 Fresnel 高光贴图 */}
          <feImage
            href={spec}
            x="0" y="0"
            width={String(w)}
            height={String(h)}
            preserveAspectRatio="none"
            result="specLayer"
          />

          {/* Step 4b：将高光遮罩到折射区域 */}
          <feComposite
            in="boosted"
            in2="specLayer"
            operator="in"
            result="specMasked"
          />

          {/* Step 4c：降低高光不透明度 */}
          <feComponentTransfer in="specLayer" result="specFaded">
            <feFuncA type="linear" slope={String(SPEC_OPACITY)} />
          </feComponentTransfer>

          {/* Step 5：最终合成 — 高光叠加在折射背景上 */}
          <feBlend in="specMasked" in2="displaced"  mode="normal" result="withSpec" />
          <feBlend in="specFaded"  in2="withSpec"   mode="normal" />
        </filter>
      </defs>
    </svg>
  );
}
