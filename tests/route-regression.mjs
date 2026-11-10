import assert from 'node:assert/strict'
import { Scene } from 'three'
import { createRouteLine } from '../src/lib/routeLine.js'
import nodes from '../src/data.js'

let time = 0
let nextId = 0
const pending = new Map()
Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => time } })
globalThis.requestAnimationFrame = (callback) => { const id = ++nextId; pending.set(id, callback); return id }
globalThis.cancelAnimationFrame = (id) => pending.delete(id)
function frame(ms = 50) {
  time += ms
  const callbacks = [...pending.values()]
  pending.clear()
  callbacks.forEach(callback => callback(time))
}
function drain(limit = 150) {
  let count = 0
  while (pending.size && count++ < limit) frame()
  assert.ok(count <= limit, 'RAF did not settle within the expected route duration')
}
function setup() {
  assert.equal(pending.size, 0, 'previous case leaked RAF')
  const scene = new Scene()
  const globe = {
    getGlobeRadius: () => 100,
    getCoords(lat, lng) {
      const p = lat * Math.PI / 180, t = lng * Math.PI / 180
      return { x: 100 * Math.cos(p) * Math.sin(t), y: 100 * Math.sin(p), z: 100 * Math.cos(p) * Math.cos(t) }
    },
    toGeoCoords({ x, y, z }) { return { lat: Math.atan2(y, Math.hypot(x, z)) * 180 / Math.PI, lng: Math.atan2(x, z) * 180 / Math.PI } },
    scene: () => scene, width: () => 1440, height: () => 900,
  }
  return { route: createRouteLine(globe, nodes), scene }
}
let passed = 0, failed = 0
function test(name, run) {
  try { run(); passed++; console.log(`PASS ${name}`) }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); pending.clear() }
}

test('first station calls onDone synchronously with no RAF', () => {
  const { route } = setup(); let done = 0
  route.ignite(0, 0, { onDone: () => done++ })
  assert.equal(done, 1); assert.equal(pending.size, 0); assert.equal(route.headS, route.stationS[0])
  route.resume(); route.skip(); assert.equal(done, 1)
  route.dispose()
})
test('normal path advances monotonically and completes once', () => {
  const { route } = setup(); let done = 0
  route.ignite(0, 5, { onDone: () => done++ })
  let previous = route.headS
  for (let i = 0; i < 60; i++) { frame(); assert.ok(route.headS >= previous); previous = route.headS }
  assert.equal(done, 1); assert.equal(route.headS, route.stationS[5]); assert.equal(pending.size, 0)
  route.dispose()
})
test('intermediate and final events pause until explicit resume', () => {
  const { route } = setup(); let done = 0; const seen = []
  route.ignite(0, 5, { events: [{ s: route.stationS[2], event: 'middle' }, { s: route.stationS[5], event: 'final' }], onEvent: e => seen.push(e), onDone: () => done++ })
  drain(); assert.deepEqual(seen, ['middle']); assert.equal(done, 0); assert.equal(route.headS, route.stationS[2])
  frame(30000); assert.equal(route.headS, route.stationS[2]); assert.equal(pending.size, 0)
  route.resume(); drain(); assert.deepEqual(seen, ['middle', 'final']); assert.equal(done, 0)
  route.resume(); drain(); assert.equal(done, 1); assert.equal(pending.size, 0)
  route.dispose()
})
test('hidden animation pauses without time jump and resumes', () => {
  const { route } = setup(); let done = 0
  route.ignite(0, 5, { onDone: () => done++ }); frame()
  route.pauseAnimation(); const stopped = route.headS; assert.equal(pending.size, 0)
  frame(100000); assert.equal(route.headS, stopped)
  route.resumeAnimation(); frame(0); assert.equal(route.headS, stopped)
  drain(); assert.equal(done, 1); route.dispose()
})
test('event pause survives hide/show until user resumes', () => {
  const { route } = setup(); let done = 0
  route.ignite(0, 5, { events: [{ s: route.stationS[2], event: 'pause' }], onDone: () => done++ })
  drain(); route.pauseAnimation(); route.resumeAnimation()
  assert.equal(pending.size, 0); assert.equal(done, 0)
  route.resume(); drain(); assert.equal(done, 1); route.dispose()
})
test('skip at a paused event completes once without future event callbacks', () => {
  const { route } = setup(); let done = 0; const seen = []
  route.ignite(0, 5, { events: [{ s: route.stationS[2], event: 'first' }, { s: route.stationS[4], event: 'second' }], onEvent: e => seen.push(e), onDone: () => done++ })
  drain(); route.skip(); route.skip(); route.resume(); drain()
  assert.deepEqual(seen, ['first']); assert.equal(done, 1); assert.equal(route.headS, route.stationS[5]); route.dispose()
})
test('clear cancels RAF and callbacks; setLit uses contiguous prefix', () => {
  const { route } = setup(); let done = 0
  route.ignite(0, 5, { onDone: () => done++ }); frame(); route.clear(); drain()
  assert.equal(done, 0); assert.equal(route.headS, 0)
  route.setLit([0, 1, 3, 5]); assert.equal(route.headS, route.stationS[1]); route.dispose()
})
test('dispose removes scene objects, cancels RAF, and releases GPU resources', () => {
  const { route, scene } = setup(); let done = 0; let releases = 0
  for (const line of route.group.children) { line.geometry.addEventListener('dispose', () => releases++); line.material.addEventListener('dispose', () => releases++) }
  route.ignite(0, 5, { onDone: () => done++ }); route.dispose(); frame(); route.resumeAnimation(); frame()
  assert.equal(done, 0); assert.equal(pending.size, 0); assert.equal(scene.children.length, 0); assert.equal(releases, 4)
})
test('zero-length replacement clears an already running route', () => {
  const { route } = setup(); let oldDone = 0; let newDone = 0
  route.ignite(0, 5, { onDone: () => oldDone++ }); frame()
  route.ignite(1, 1, { onDone: () => newDone++ })
  route.resume(); drain()
  assert.equal(newDone, 1); assert.equal(oldDone, 0); assert.equal(route.headS, route.stationS[1]); route.dispose()
})
console.log(`\n${passed} passed, ${failed} failed`)
process.exitCode = failed ? 1 : 0
