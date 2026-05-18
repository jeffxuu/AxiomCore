// Augments React's JSX types to recognise <altcha-widget> (self-hosted ALTCHA).
// The `export {}` makes this a module, which is required for `declare module` augmentation.
export {};

declare module "react/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      "altcha-widget": {
        // altcha v3.x: the attribute is `challenge` (URL or inline JSON), NOT `challengeurl`.
        challenge?: string;
        name?: string;
        hidefooter?: boolean | "";
        hidelogo?: boolean | "";
        auto?: "onload" | "onsubmit" | "off";
        delay?: number;
        strings?: string;
        theme?: "auto" | "light" | "dark";
        className?: string;
        id?: string;
        style?: import("react").CSSProperties;
      };
    }
  }
}
