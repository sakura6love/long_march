import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { ref, computed } from 'vue'
import { parse, compileScript } from 'vue/compiler-sfc'
import nodes from '../src/data.js'
const storyText = fs.readFileSync(new URL('../src/lib/story.js', import.meta.url), 'utf8').replaceAll('import.meta.env.BASE_URL', "''")
const { STORY_EVENTS } = await import(`data:text/javascript,${encodeURIComponent(storyText)}`)
const text = fs.readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const { descriptor, errors } = parse(text, { filename: 'src/App.vue' })
assert.deepEqual(errors, [], 'App.vue must be a valid Vue component')
const compiled = compileScript(descriptor, { id: 'app-state-regression' })
let setup = descriptor.scriptSetup.content
// Strip only parsed static imports; multiline imports and dynamic imports remain safe.
for (const node of compiled.scriptSetupAst.filter(node => node.type === 'ImportDeclaration').reverse()) {
  setup = setup.slice(0, node.start) + setup.slice(node.end)
}
// State transitions only: browser event dispatch and Vue DOM watchers belong to visual QA.
function harness() {
  let saved = []
  const state = { pending: null, igniteCalls: 0, resumeCalls: 0, focusCalls: 0 }
  const focus = { isConnected: true, focus() { state.focusCalls++ } }
  const noop = () => {}
  const context = vm.createContext({
    ref, computed, nextTick: callback => callback?.(), watch: noop, onMounted: noop, onBeforeUnmount: noop,
    defineAsyncComponent: () => ({}), nodes, STORY_EVENTS,
    readLitIds: () => saved, saveLitIds: ids => (saved = ids), clearProgress: () => { saved = [] },
    isMuted: () => true, isBgmOn: () => false, setMuted: noop, setBgmOn: noop, startAudio: noop, startBgm: noop, sfxPage: noop, duckBgm: noop,
    document: { activeElement: focus, documentElement: { classList: { toggle: noop } } },
    window: { scrollTo: noop, clearTimeout: noop, setTimeout: () => 1 }, navigator: {}, localStorage: { setItem: noop },
  })
  vm.runInContext(`${setup}\nglobalThis.h = {screen, globeRef, mapReady, mapRequested, mapFailed, mapEnabled, activeIndex, activeNode, showingEvent, eventIndex, litIds, chainEnd, pausedEvent, burning, hasFinished, handleStart, selectNode, closeNode, openEventById, closeEvent, navigateEvent, toggleLit, skipBurn, onMapError, goTo, restart};`, context)
  const h = context.h
  h.globeRef.value = {
    stationS: nodes.map((_, i) => i / (nodes.length - 1)),
    ignite(from, to, handlers) { state.igniteCalls++; state.pending = handlers },
    skipFire() { const pending = state.pending; state.pending = null; pending?.onDone?.() },
    resumeFire() { state.resumeCalls++ }, enterOverview: noop, focusNode: noop, clearFire: noop,
  }
  return { h, state }
}
let passed = 0, failed = 0
function test(name, run) { try { run(); passed++; console.log(`PASS ${name}`) } catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`) } }
test('start requests map; first station never enters a stuck animation', () => {
  const { h, state } = harness(); h.handleStart(); h.mapReady.value = true; h.selectNode(nodes[0]); h.toggleLit(nodes[0].id)
  assert.equal(h.screen.value, 'overview'); assert.equal(h.mapRequested.value, true); assert.equal(h.chainEnd.value, 1); assert.equal(h.burning.value, false); assert.equal(state.igniteCalls, 0)
})
test('guided event closes and resumes exactly once', () => {
  const { h, state } = harness(); h.handleStart(); h.mapReady.value = true
  h.toggleLit(nodes[0].id); h.selectNode(nodes[1]); h.toggleLit(nodes[1].id)
  assert.equal(h.burning.value, true)
  state.pending.onEvent(STORY_EVENTS[0]); assert.equal(h.activeNode.value, null); assert.equal(h.pausedEvent.value, true)
  h.closeEvent(); assert.equal(state.resumeCalls, 1); assert.equal(h.showingEvent.value, null); assert.equal(h.pausedEvent.value, false)
  const pending = state.pending; state.pending = null; pending.onDone(); assert.equal(h.burning.value, false)
})
test('direct event navigation and close preserve current room', () => {
  const { h } = harness(); h.goTo('chapters'); h.openEventById(STORY_EVENTS[0].id); h.navigateEvent(1)
  assert.equal(h.eventIndex.value, 1); assert.equal(h.pausedEvent.value, false)
  h.closeEvent(); assert.equal(h.showingEvent.value, null); assert.equal(h.screen.value, 'chapters')
})
test('map failure releases animation state and preserves reading content', () => {
  const { h, state } = harness(); h.handleStart(); h.mapReady.value = true; h.toggleLit(nodes[0].id); h.toggleLit(nodes[1].id)
  state.pending.onEvent(STORY_EVENTS[0]); h.onMapError()
  assert.equal(h.burning.value, false); assert.equal(h.pausedEvent.value, false); assert.equal(h.mapFailed.value, true); assert.equal(h.mapReady.value, false); assert.equal(h.eventIndex.value, 0)
  h.closeEvent(); assert.equal(h.showingEvent.value, null)
})
test('static tour completion waits until station reader closes', () => {
  const { h } = harness(); h.handleStart(); h.mapEnabled.value = false
  nodes.forEach(node => { h.selectNode(node); h.toggleLit(node.id) })
  assert.equal(h.chainEnd.value, nodes.length); assert.equal(h.screen.value, 'overview'); h.closeNode(); assert.equal(h.screen.value, 'finale')
  h.restart(); assert.equal(h.screen.value, 'start'); assert.equal(h.chainEnd.value, 0); assert.equal(h.hasFinished.value, false)
})
test('jump-ahead light records remain intact until their predecessor is removed', () => {
  const { h } = harness(); h.handleStart(); h.mapEnabled.value = false
  h.toggleLit(nodes[5].id); h.toggleLit(nodes[0].id); assert.equal(h.chainEnd.value, 1); assert.equal(h.litIds.value.length, 2)
  h.toggleLit(nodes[0].id); assert.equal(h.litIds.value.length, 0)
})
console.log(`\n${passed} passed, ${failed} failed`)
process.exitCode = failed ? 1 : 0
