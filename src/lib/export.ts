import type { SQLiteDatabase } from 'expo-sqlite';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getInterpretation, listDreams } from './db';
import { formatLong } from './dates';
import { MOODS } from './theme';

async function collect(db: SQLiteDatabase) {
  const dreams = await listDreams(db);
  return Promise.all(dreams.map(async (d) => ({ d, i: await getInterpretation(db, d.id) })));
}

export async function exportText(db: SQLiteDatabase): Promise<void> {
  const items = await collect(db);
  const lines: string[] = ['DreamPattern journal export', `Exported ${new Date().toLocaleString()}`, ''];
  for (const { d, i } of items) {
    lines.push('='.repeat(40));
    lines.push(`${formatLong(d.dreamDate)}  ${d.title || 'Untitled dream'}`);
    if (d.mood !== null) lines.push(`Mood on waking: ${MOODS[d.mood]}`);
    if (d.lucid) lines.push('Lucid: yes');
    if (d.tags.length) lines.push(`Tags: ${d.tags.join(', ')}`);
    lines.push('', d.body, '');
    if (i) {
      lines.push('Interpretation:', i.summary, '');
      i.symbols.forEach((s) => lines.push(`- ${s.name}: ${s.meaning}`));
      lines.push('', `Tone: ${i.tone}`);
      if (i.patternCallback) lines.push(`Pattern: ${i.patternCallback}`);
      lines.push('');
    }
  }
  const file = new File(Paths.cache, `dreampattern-export-${Date.now()}.txt`);
  file.create({ overwrite: true });
  file.write(lines.join('\n'));
  await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', dialogTitle: 'Export dreams' });
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');

export async function exportPdf(db: SQLiteDatabase): Promise<void> {
  const items = await collect(db);
  const body = items
    .map(
      ({ d, i }) => `
      <section>
        <h2>${esc(d.title || 'Untitled dream')}</h2>
        <p class="meta">${formatLong(d.dreamDate)}${d.mood !== null ? ' · ' + MOODS[d.mood] : ''}${d.lucid ? ' · lucid' : ''}</p>
        <p>${esc(d.body)}</p>
        ${
          i
            ? `<h3>Interpretation</h3><p>${esc(i.summary)}</p>
               <ul>${i.symbols.map((s) => `<li><b>${esc(s.name)}</b>: ${esc(s.meaning)}</li>`).join('')}</ul>
               <p class="meta">Tone: ${esc(i.tone)}</p>
               ${i.patternCallback ? `<p class="meta">Pattern: ${esc(i.patternCallback)}</p>` : ''}`
            : ''
        }
      </section>`,
    )
    .join('');
  const html = `<html><head><meta charset="utf-8"/><style>
    body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1a1533;padding:24px}
    h1{color:#5b4bd6} h2{margin-bottom:2px} .meta{color:#777;font-size:12px}
    section{page-break-inside:avoid;border-bottom:1px solid #ddd;padding:12px 0}
  </style></head><body><h1>DreamPattern journal</h1>${body}</body></html>`;
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export dreams (PDF)' });
}
