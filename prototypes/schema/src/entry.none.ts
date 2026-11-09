// Baseline: the same page with no check at all.
const res = await fetch("/data/idols.json");
const data: { idols: unknown[] } = await res.json();
document.body.textContent = String(data.idols.length);
