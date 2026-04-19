import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const arxivRoot = path.join(repoRoot, "paper", "arxiv");
const outputRoot = path.join(arxivRoot, "submission");
const bundleName = "bs-bench-arxiv";
const bundleRoot = path.join(outputRoot, bundleName);
const bundleTar = path.join(outputRoot, `${bundleName}.tar.gz`);

const figureFiles = [
  "challenge_frequency_vs_win_rate.png",
  "compare_challenge_frequency.png",
  "compare_lie_frequency.png",
  "compare_optional_lie_rate.png",
  "exp1_win_rates.png",
  "exp3_violations.png",
  "lie_frequency_vs_win_rate.png",
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function cleanDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDirFiles(srcDir, destDir) {
  ensureDir(destDir);
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirFiles(src, dest);
    } else {
      copyFile(src, dest);
    }
  }
}

cleanDir(outputRoot);
ensureDir(bundleRoot);

copyFile(path.join(arxivRoot, "main.tex"), path.join(bundleRoot, "main.tex"));
copyFile(path.join(arxivRoot, "author_block.tex"), path.join(bundleRoot, "author_block.tex"));
copyFile(path.join(repoRoot, "references.bib"), path.join(bundleRoot, "references.bib"));
copyDirFiles(path.join(arxivRoot, "sections"), path.join(bundleRoot, "sections"));

const figuresDest = path.join(bundleRoot, "figures");
ensureDir(figuresDest);
for (const figure of figureFiles) {
  copyFile(path.join(arxivRoot, "figures", figure), path.join(figuresDest, figure));
}

const mainPath = path.join(bundleRoot, "main.tex");
const mainText = fs
  .readFileSync(mainPath, "utf8")
  .replace("\\bibliography{../../references}", "\\bibliography{references}");
fs.writeFileSync(mainPath, mainText);

fs.rmSync(bundleTar, { force: true });
execFileSync("tar", ["-czf", bundleTar, "-C", bundleRoot, "."], {
  cwd: repoRoot,
  stdio: "inherit",
});

console.log(`Prepared arXiv bundle at ${bundleRoot}`);
console.log(`Prepared arXiv archive at ${bundleTar}`);
