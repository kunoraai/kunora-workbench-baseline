import { diffLines } from 'diff';

// Replacement blocks share row positions so the two panes remain aligned.
export function alignedDiff(before, after) {
  const changes = diffLines(before, after);
  const rows = [];
  let oldNumber = 1;
  let newNumber = 1;
  const lines = value => value.replace(/\n$/, '').split('\n');
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    if (!change.added && !change.removed) {
      for (const text of lines(change.value)) rows.push({ left: { number: oldNumber++, text }, right: { number: newNumber++, text } });
      continue;
    }
    const removed = change.removed ? lines(change.value) : [];
    let added = change.added ? lines(change.value) : [];
    if (change.removed && changes[i + 1]?.added) added = lines(changes[++i].value);
    for (let j = 0; j < Math.max(removed.length, added.length); j++) {
      rows.push({ left: j < removed.length ? { number: oldNumber++, text: removed[j], type: 'removed' } : null, right: j < added.length ? { number: newNumber++, text: added[j], type: 'added' } : null });
    }
  }
  return rows;
}
