import io
p='src/App.vue'
s=io.open(p,encoding='utf-8').read()
block = """
// 调试入口：便于用脚本强制推进到终章
if (typeof window !== 'undefined') {
  window.__march = { screen, litIds, chainEnd }
}"""
s = s.replace(block, "", 1)
anchor = "const hint = computed(() => {"
s = s.replace(anchor, block.strip() + "\n\n" + anchor, 1)
io.open(p,'w',encoding='utf-8').write(s)
print('hook moved')
