const WS_URL = process.argv[2]
const EXPR = [
  "(async () => {",
  "  const db = await new Promise((res, rej) => { const r = indexedDB.open('hst-app', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })",
  "  const get = (name) => new Promise((res) => { const tx = db.transaction('files', 'readonly'); const r = tx.objectStore('files').get(name); r.onsuccess = () => res(r.result || null) })",
  "  const out = {}",
  "  const itemsRaw = await get('items.json'); const items = itemsRaw ? JSON.parse(itemsRaw) : { items: [] }",
  "  const st = {}",
  "  for (const it of items.items) st[it.srs.state] = (st[it.srs.state] || 0) + 1",
  "  out.itemCount = items.items.length; out.states = st",
  "  const prof = JSON.parse((await get('profile.json')) || 'null')",
  "  out.profile = prof ? { subjects: prof.subjects, newPerDay: prof.newPerDay, grade: prof.grade } : null",
  "  const rv = JSON.parse((await get('reviews.json')) || '{}')",
  "  out.reviewCount = (rv.log || []).length",
  "  out.reviewRecent = (rv.log || []).slice(-5).map((r) => ({ g: r.grade, first: r.first, d: new Date(r.ts).toISOString().slice(0, 10) }))",
  "  return JSON.stringify(out)",
  "})()",
].join('\n')
const ws = new WebSocket(WS_URL)
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: EXPR, awaitPromise: true, returnByValue: true } }))
const reply = await new Promise((r) => { const h = (ev) => { const m = JSON.parse(ev.data); if (m.id === 1) { ws.removeEventListener('message', h); r(m) } }; ws.addEventListener('message', h) })
console.log(JSON.stringify((reply.result && reply.result.result && reply.result.result.value) || reply, null, 1).slice(0, 1600))
ws.close()