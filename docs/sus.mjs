// Usage: node docs/sus.mjs 4,2,4,1,4,2,5,1,4,2 5,1,5,1,5,1,5,1,5,1
const rows = process.argv.slice(2).map((r) => r.split(',').map(Number));
if (!rows.length) {
  console.error('Give one comma-separated row of 10 answers (1-5) per respondent.');
  process.exit(1);
}
const scores = rows.map((r, n) => {
  if (r.length !== 10 || r.some((x) => !(x >= 1 && x <= 5)))
    throw new Error(`Respondent ${n + 1}: need 10 answers between 1 and 5`);
  return r.reduce((s, a, i) => s + (i % 2 === 0 ? a - 1 : 5 - a), 0) * 2.5;
});
scores.forEach((s, i) => console.log(`Respondent ${i + 1}: ${s}`));
console.log(`Mean SUS: ${(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)} (n=${scores.length})`);
