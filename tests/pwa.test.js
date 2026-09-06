import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { STORAGE_KEY } from '../js/store.js';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (path) => readFileSync(join(ROOT, path), 'utf8');

/** Fichiers (chemins relatifs, séparateur « / ») d'un dossier, récursivement. */
function filesUnder(dir) {
  const out = [];
  for (const entry of readdirSync(join(ROOT, dir))) {
    const path = join(dir, entry);
    if (statSync(join(ROOT, path)).isDirectory()) out.push(...filesUnder(path));
    else out.push(relative(ROOT, join(ROOT, path)).split('\\').join('/'));
  }
  return out;
}

describe('PWA : manifest', () => {
  const manifest = JSON.parse(read('manifest.json'));
  it('décrit l’application, en français, installable en plein écran', () => {
    assert.equal(manifest.short_name, '365Food');
    assert.ok(manifest.name.length > 0);
    assert.equal(manifest.lang, 'fr');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.start_url, './');
    assert.equal(manifest.scope, './');
    assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/);
    assert.match(manifest.background_color, /^#[0-9a-f]{6}$/);
  });
  it('a des icônes 192 et 512 (dont une maskable) présentes dans le dépôt', () => {
    const sizes = manifest.icons.map((icon) => icon.sizes);
    assert.ok(sizes.includes('192x192') && sizes.includes('512x512'), sizes.join(', '));
    assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));
    for (const icon of manifest.icons) {
      assert.ok(existsSync(join(ROOT, icon.src)), `icône manquante : ${icon.src}`);
      if (icon.type === 'image/png') {
        const png = readFileSync(join(ROOT, icon.src));
        assert.equal(png.toString('ascii', 1, 4), 'PNG', `${icon.src} n'est pas un PNG`);
        const side = Number(icon.sizes.split('x')[0]);
        assert.equal(png.readUInt32BE(16), side, `${icon.src} : largeur`);
        assert.equal(png.readUInt32BE(20), side, `${icon.src} : hauteur`);
      }
    }
  });
  it('est lié depuis index.html, avec l’icône Apple et le script d’apparence', () => {
    const html = read('index.html');
    assert.match(html, /<link rel="manifest" href="manifest\.json">/);
    assert.match(html, /<link rel="apple-touch-icon" href="img\/apple-touch-icon\.png">/);
    assert.ok(existsSync(join(ROOT, 'img/apple-touch-icon.png')));
    assert.ok(html.includes(`localStorage.getItem('${STORAGE_KEY}')`), 'le script inline lit la même clé que store.js');
    assert.match(html, /<section id="view-recipe-form"/);
  });
});

describe('PWA : service worker', () => {
  const sw = read('sw.js');
  const shell = [...sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

  it('met en cache tout le shell : chaque fichier listé existe', () => {
    assert.ok(shell.length > 20);
    for (const path of shell) assert.ok(existsSync(join(ROOT, path)), `fichier absent : ${path}`);
  });
  it('n’oublie aucun fichier de l’application', () => {
    const expected = ['index.html', 'manifest.json', ...filesUnder('css'), ...filesUnder('js'), ...filesUnder('data'), ...filesUnder('img')].sort();
    assert.deepEqual([...shell].sort(), expected);
  });
  it('est enregistré par l’application, avec une proposition de rechargement', () => {
    const app = read('js/app.js');
    assert.match(app, /navigator\.serviceWorker\.register\('sw\.js'\)/);
    assert.match(app, /type !== 'updated'/);
    assert.match(sw, /postMessage\(\{ type: 'updated'/);
    assert.match(sw, /skipWaiting\(\)/);
    assert.match(sw, /clients\.claim\(\)/);
  });
});
