import io
p = 'src/App.vue'
s = io.open(p, encoding='utf-8').read()
s = s.replace(
    ':burn="chainEnd >= 12 ? 1 : Math.min(0.92, chainEnd / 11 * 0.92)"',
    ':burn="Math.min(1, chainEnd / longMarchNodes.length)"',
)
old = "      if (chainEnd.value === longMarchNodes.length) screen.value = 'finale'"
new = """      if (chainEnd.value === longMarchNodes.length) {
        screen.value = 'finale'
        finaleReady.value = false
        globeRef.value?.pullBack?.()
        window.setTimeout(() => {
          finaleReady.value = true
        }, 2400)
      }"""
s = s.replace(old, new)
s = s.replace(
    "const screen = ref('start') // start | overview | finale",
    "const screen = ref('start') // start | overview | finale\nconst finaleReady = ref(false)",
)
s = s.replace('v-if="screen === \'finale\'"', 'v-if="screen === \'finale\' && finaleReady"')
io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
