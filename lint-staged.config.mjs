// Filter out test fixtures (raw third-party HTML we must not reformat).
const notFixture = (files) => files.filter((file) => !file.includes("__fixtures__"));

export default {
  "*.@(ts|tsx|mts|js|jsx|mjs|cjs)": ["oxlint --fix --quiet", "oxfmt --write"],
  "*.@(json|jsonc|json5|md|mdx|yaml|yml|css|scss|sass|html|toml)": (files) => {
    const targets = notFixture(files);
    return targets.length > 0 ? [`oxfmt --write ${targets.join(" ")}`] : [];
  },
  ".github/workflows/*.@(yml|yaml)": "actionlint",
};
