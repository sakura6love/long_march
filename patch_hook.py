import io
p='src/App.vue'
s=io.open(p,encoding='utf-8').read()
anchor="const finaleReady = ref(false)"
add = anchor + """
// 调试入口：便于用脚本强制推进到终章
if (typeof window !== 'undefined') {
  window.__march = { screen, litIds, chainEnd }
}"""
s=s.replace(anchor, add, 1)
io.open(p,'w',encoding='utf-8').write(s)
print('hook added')
