// Skip test fixtures (raw third-party HTML) and large generated data files.
const skip = (file) =>
  file.includes("__fixtures__") ||
  file.endsWith("public/catalogue.json") ||
  file.endsWith("public/library.json") ||
  file.includes("/scripts/data/cache/") ||
  file.includes("/public/screens/");
const notFixture = (files) => files.filter((file) => !skip(file));

export default {
  "*.@(ts|tsx|mts|js|jsx|mjs|cjs)": ["oxlint --fix --quiet", "oxfmt --write"],
  "*.@(json|jsonc|json5|md|mdx|yaml|yml|css|scss|sass|html|toml)": (files) => {
    const targets = notFixture(files);
    return targets.length > 0 ? [`oxfmt --write ${targets.join(" ")}`] : [];
  },
  ".github/workflows/*.@(yml|yaml)": "actionlint",
};
