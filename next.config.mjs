/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export to out/; the packaged app serves it on app://dos-usb/
  // (electron/protocol/staticExport.mjs). Build artefacts stay in .next/.
  output: "export",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
