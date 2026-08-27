// DOM 桩：SSR 冒烟只需骗过模块级副作用（boot.js 建 parking 元素、注入 CSS 等）。
function el() {
  const n = {
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, contains: () => false },
    setAttribute() {}, removeAttribute() {},
    appendChild(c) { return c }, insertBefore(c) { return c }, removeChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {},
    querySelectorAll: () => [], querySelector: () => null,
    contains: () => false,
    innerHTML: '', textContent: '', firstChild: null,
  }
  return n
}
globalThis.document = {
  createElement: el,
  createTextNode: el,
  head: el(),
  body: el(),
  documentElement: el(),
  getElementById: () => null,
  querySelector: () => null,
  addEventListener() {}, removeEventListener() {},
  hidden: false,
}
globalThis.window = globalThis
globalThis.addEventListener = () => {}
globalThis.removeEventListener = () => {}
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} }),
globalThis.requestAnimationFrame = (fn) => 0
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' })
const _mem = new Map()
globalThis.localStorage = {
  getItem: (k) => (_mem.has(k) ? _mem.get(k) : null),
  setItem: (k, v) => _mem.set(k, String(v)),
  removeItem: (k) => _mem.delete(k),
}
