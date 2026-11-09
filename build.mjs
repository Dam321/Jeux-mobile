// Construit dist/index.html (application complète) et dist/artifact.html (page autonome publiable)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

mkdirSync('dist', { recursive: true });
await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020', 'safari15'],
  outfile: 'dist/game.js',
  legalComments: 'none',
  loader: { '.css': 'css' },
});
const js = readFileSync('dist/game.js', 'utf8').replace(/<\/script/gi, '<\\/script');
const css = readFileSync('dist/game.css', 'utf8');
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&family=Lilita+One&display=swap">';

const full = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#170d33">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<title>Miaou Empire</title>
${FONTS}
<style>${css}
body{padding-top:env(safe-area-inset-top,0px)}</style>
</head>
<body>
<div id="app"></div>
<script>${js}</script>
</body>
</html>`;
writeFileSync('dist/index.html', full);

const fragment = `<title>Miaou Empire</title>
${FONTS}
<style>${css}
:root{--safe-b:0px}</style>
<div id="app"></div>
<script>${js}</script>
`;
writeFileSync('dist/artifact.html', fragment);
console.log('JS', (js.length / 1024).toFixed(0) + 'KB', 'CSS', (css.length / 1024).toFixed(0) + 'KB');
