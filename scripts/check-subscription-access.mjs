import { readFileSync } from "node:fs";

const files = [
  "cloud.html",
  "download.html",
  "login.html",
  "privacy.html",
  "terms.html",
  "assets/accountPlan.js",
  "assets/cloud-auth.js",
  "assets/site-config.js",
  "assets/site-config.example.js",
  "assets/supabase-config.example.js",
  "docs/CLOUD.md",
  "README.md",
];

const disallowed = [
  /\bstart (?:a )?trial\b/iu,
  /\btrial\s*\/\s*subscription\b/iu,
  /\btrial or subscription\b/iu,
  /\btrials\/subscriptions\b/iu,
  /\b(?:trial|invite|beta) grant\b/iu,
];

const errors = [];
for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const pattern of disallowed) {
    if (pattern.test(source)) errors.push(`${file}: deprecated public access copy (${pattern.source})`);
  }
}

const accountPlan = readFileSync("assets/accountPlan.js", "utf8");
if (!accountPlan.includes("status === 'active'")) errors.push("assets/accountPlan.js: active subscription check missing");
if (accountPlan.includes("status === 'trialing'")) errors.push("assets/accountPlan.js: trialing still grants a plan");

for (const file of ["download.html", "login.html", "terms.html"]) {
  if (!readFileSync(file, "utf8").toLowerCase().includes("active subscription")) {
    errors.push(`${file}: active subscription requirement missing`);
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`subscription access check failed: ${error}`);
  process.exitCode = 1;
} else {
  console.log(`subscription access check passed: ${files.length} public files; trial execution remains disabled.`);
}
