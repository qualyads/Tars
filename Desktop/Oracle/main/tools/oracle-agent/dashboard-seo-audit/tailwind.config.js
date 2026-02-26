import relumeTailwindPreset from "@relume_io/relume-tailwind";
import { vxbTheme } from "../dashboard-shared/tailwind.brand.js";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../dashboard-shared/**/*.{js,jsx}",
    "./node_modules/@relume_io/relume-ui/dist/**/*.{js,ts,jsx,tsx}",
  ],
  presets: [relumeTailwindPreset],
  theme: {
    extend: vxbTheme,
  },
};
