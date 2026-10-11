#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SRC = resolve(ROOT, 'data/0808IbnKhaldun.Tarikh.mARkdown');
const OUT_JSON = resolve(ROOT, 'data/book.json');
const OUT_JS = resolve(ROOT, 'book-data.js');

const TASHKEEL = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

export function norm(s) {
  return s
    .replace(TASHKEEL, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    .replace(/\u0649/g, '\u064A')
    .replace(/\u0626/g, '\u064A')
    .replace(/\u0624/g, '\u0648')
    .replace(/\u0629/g, '\u0647')
    .replace(/[^\u0621-\u064A0-9a-zA-Z\u0660-\u0669 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clean(s) {
  return s
    .replace(/PageV\d+P\d+/g, ' ')
    .replace(/\bms\d+\b/g, ' ')
    .replace(/@[A-Za-z0-9_]+@/g, ' ')
    .replace(/\[ *\d+ *\]/g, ' ')
    .replace(/\u0640/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function parseMeta(lines) {
  const meta = {};
  for (const line of lines) {
    const m = line.match(/^#META#\s+([0-9A-Za-z.]+)\s*::\s*(.*)$/);
    if (m && m[2] && m[2] !== 'NODATA' && m[2] !== 'NOTGIVEN') meta[m[1]] = m[2].trim();
  }
  return meta;
}

function parse() {
  const raw = readFileSync(SRC, 'utf8');
  const lines = raw.split(/\r?\n/);

  const meta = parseMeta(lines);

  const root = { level: 0, title: '', children: [], paragraphs: [] };
  const stack = [root];
  let skipped = 0;

  for (const line of lines) {
    if (line.startsWith('#META#') || line.startsWith('######')) continue;
    if (line.startsWith('###')) {
      const pipes = line.match(/^###+(\s*\|+)/);
      const level = pipes ? pipes[1].replace(/\s/g, '').length : 1;
      const title = clean(line.replace(/^###+\s*\|+\s*/, ''));
      const node = { level, title, children: [], paragraphs: [] };
      const parent = stack[level - 1] || root;
      parent.children.push(node);
      stack.length = level;
      stack[level] = node;
      continue;
    }
    let content;
    if (line.startsWith('~~')) content = line.slice(2);
    else if (line.startsWith('#')) content = line.slice(1);
    else if (line.trim() === '') continue;
    else content = line;
    content = clean(content);
    if (!content) { skipped++; continue; }
    const current = stack[stack.length - 1] || root;
    current.paragraphs.push(content);
  }

  let id = 0;
  const stats = { parts: 0, chapters: 0, sections: 0, subsections: 0, paras: 0, chars: 0 };

  function walk(node, path) {
    node.id = node.level === 0 ? 0 : ++id;
    if (node.level === 1) stats.parts++;
    else if (node.level === 2) stats.chapters++;
    else if (node.level === 3) stats.sections++;
    else if (node.level === 4) stats.subsections++;
    stats.paras += node.paragraphs.length;
    for (const p of node.paragraphs) stats.chars += p.length;
    node.path = node.title ? path.concat(node.title) : path;
    for (const c of node.children) walk(c, node.path);
  }
  for (const c of root.children) walk(c, []);

  const out = {
    meta: {
      title: meta['020.BookTITLE'] || 'تاريخ ابن خلدون',
      titleAlt: meta['029.BookTITLEalt'] || '',
      author: meta['010.AuthorNAME'] || 'ابن خلدون',
      died: meta['011.AuthorDIED'] || '808',
      editor: meta['040.EdEDITOR'] || '',
      edition: meta['041.EdNUMBER'] || '',
      publisher: meta['043.EdPUBLISHER'] || '',
      source: meta['030.LibURI'] || 'Shamela_0012320',
      sourceURL: meta['031.LibREADONLINE'] || '',
      subject: meta['021.BookSUBJ'] || '',
    },
    source: 'OpenITI 0825AH / 0808IbnKhaldun.Tarikh.Shamela0012320-ara1',
    generated: new Date().toISOString().slice(0, 10),
    stats,
    parts: root.children,
  };

  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(OUT_JSON, JSON.stringify(out));
  mkdirSync(dirname(OUT_JS), { recursive: true });
  writeFileSync(OUT_JS, 'window.__IK__ = ' + JSON.stringify(out) + ';\n');

  console.log(JSON.stringify(stats, null, 2));
  console.log('skipped empty:', skipped);
  console.log('meta:', JSON.stringify(meta['020.BookTITLE']));
}

parse();
