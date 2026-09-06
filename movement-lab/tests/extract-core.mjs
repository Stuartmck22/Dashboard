/**
 * The app ships as one self-contained HTML file, so the tests read the analysis
 * half of its module out of that file rather than duplicating it. Everything up
 * to the Overlay section is pure maths with no DOM in it.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const MARKER = ' * Overlay — the skeleton, trails and ghosts drawn over the video';
const EXPORTS = `
export { lowpass, derivative, jointAngle, unwrapDeg, fillGaps, longGapMask, fitQuadratic,
         percentile, longestRun, reconstruct, analyse, PRESETS, LM, N_LM, argMax, argMin,
         median, ticks };
`;

export async function buildCore() {
  const html = await readFile(join(here, '..', 'index.html'), 'utf8');
  const open = html.indexOf('<script type="module">');
  const body = html.slice(open + '<script type="module">'.length, html.lastIndexOf('</script>'));

  const lines = body.split('\n');
  const at = lines.findIndex((l) => l === MARKER);
  if (at < 0) throw new Error('Could not find the Overlay section marker in index.html');

  // step back over the comment banner that opens the Overlay section
  let end = at;
  while (end > 0 && !lines[end - 1].startsWith('/* ====')) end--;
  const out = join(here, '.core.generated.mjs');
  await writeFile(out, lines.slice(0, end - 1).join('\n') + EXPORTS);
  return out;
}
