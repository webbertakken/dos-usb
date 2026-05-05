// Allow side-effect CSS imports (e.g. `import './globals.css'` in
// app/layout.tsx). Next.js handles these at build time but tsgo / tsc
// need the declaration to typecheck the import.
declare module "*.css";
declare module "*.scss";
