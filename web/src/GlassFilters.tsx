/**
 * GlassFilters — Apple Liquid Glass SVG filter bank
 *
 * #lg-main-refract : 核心折射 + RGB 色差（Chromium only，Safari 降级）
 * #lg-specular-halo: 有机形变高光（::after 层）
 * #lg-frost        : 微纹理表面（极低不透明度）
 * #lg-edge-distort : 边缘有机扭曲
 */
export function GlassFilters() {
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
         * lg-main-refract
         * ───────────────────────────────────────────────────────────────
         * 真实透镜折射效果。当 ::before 同时有 backdrop-filter:blur(0px)
         * 和 filter:url(#lg-main-refract) 时，feDisplacementMap 对已混合
         * 了背景的像素做坐标偏移，产生光线弯折（透镜折射）的视觉效果。
         *
         * RGB 三通道使用不同 scale（28/26/24）产生色散（色差），
         * 是 Apple Liquid Glass 彩虹边缘的来源。
         *
         * Chrome/Edge 完整支持；Safari 的 filter: url() 不支持，
         * 由 @supports not (filter: url(#x)) 降级处理。
         */}
        <filter
          id="lg-main-refract"
          x="-12%"
          y="-12%"
          width="124%"
          height="124%"
          colorInterpolationFilters="sRGB"
        >
          {/* 低频噪声 → 玻璃表面法线贴图 */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.008 0.012"
            numOctaves="3"
            seed="42"
            stitchTiles="noStitch"
            result="warpField"
          />
          {/* 增强对比度，让折射边缘更锐利 */}
          <feColorMatrix
            in="warpField"
            type="saturate"
            values="3"
            result="warpBoosted"
          />

          {/* R 通道：最大位移（红光折射角最大）*/}
          <feDisplacementMap
            in="SourceGraphic"
            in2="warpBoosted"
            scale="28"
            xChannelSelector="R"
            yChannelSelector="G"
            result="rFull"
          />
          <feColorMatrix
            in="rFull"
            type="matrix"
            values="1 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="rCh"
          />

          {/* G 通道：中等位移 */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="warpBoosted"
            scale="26"
            xChannelSelector="R"
            yChannelSelector="G"
            result="gFull"
          />
          <feColorMatrix
            in="gFull"
            type="matrix"
            values="0 0 0 0 0
                    0 1 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="gCh"
          />

          {/* B 通道：最小位移（蓝光折射角最小）*/}
          <feDisplacementMap
            in="SourceGraphic"
            in2="warpBoosted"
            scale="24"
            xChannelSelector="R"
            yChannelSelector="G"
            result="bFull"
          />
          <feColorMatrix
            in="bFull"
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 1 0 0
                    0 0 0 1 0"
            result="bCh"
          />

          {/* Screen blend 合并三通道 → RGB 色差彩虹边缘 */}
          <feBlend in="rCh" in2="gCh" mode="screen" result="rg" />
          <feBlend in="rg"  in2="bCh" mode="screen" result="rgb" />

          {/* feSpecularLighting：顶部点光源物理镜面高光 */}
          <feSpecularLighting
            in="warpBoosted"
            surfaceScale="4"
            specularConstant="0.6"
            specularExponent="18"
            lightingColor="white"
            result="spec"
          >
            <fePointLight x="50%" y="-80" z="120" />
          </feSpecularLighting>
          <feComposite in="spec" in2="rgb" operator="in"     result="specMasked" />
          <feBlend     in="rgb"  in2="specMasked" mode="screen" />
        </filter>

        {/*
         * lg-specular-halo
         * ───────────────────────────────────────────────────────────────
         * 有机形变高光，用于 ::after 镜面层。
         * 让圆形高光 blob 呈现不规则有机形状，更像真实玻璃反射。
         */}
        <filter
          id="lg-specular-halo"
          x="-30%"
          y="-30%"
          width="160%"
          height="160%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.22 0.34"
            numOctaves="2"
            seed="7"
            result="orgNoise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="orgNoise"
            scale="9"
            xChannelSelector="R"
            yChannelSelector="G"
            result="warped"
          />
          <feGaussianBlur in="warped" stdDeviation="3.5" />
        </filter>

        {/*
         * lg-frost
         * ───────────────────────────────────────────────────────────────
         * 微纹理表面。feBlend screen 模式只增亮，不遮盖文字。
         * opacity 0.038 极为微妙，提供真实磨砂玻璃的微观颗粒感。
         */}
        <filter
          id="lg-frost"
          x="0"
          y="0"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.68 0.72"
            numOctaves="4"
            seed="9"
            stitchTiles="stitch"
            result="noise"
          />
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 1
                    0 0 0 0 1
                    0 0 0 0 1
                    0 0 0 0.038 0"
            result="wn"
          />
          <feBlend in="SourceGraphic" in2="wn" mode="screen" />
        </filter>

        {/*
         * lg-edge-distort
         * ───────────────────────────────────────────────────────────────
         * 边缘有机扭曲，用于边框的有机形变。scale 升至 4.5。
         */}
        <filter
          id="lg-edge-distort"
          x="-8%"
          y="-8%"
          width="116%"
          height="116%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.018 0.035"
            numOctaves="2"
            seed="5"
            result="edgeNoise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="edgeNoise"
            scale="4.5"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
