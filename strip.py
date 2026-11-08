import io, re
p='src/lib/routeLine.js'
s=io.open(p,encoding='utf-8').read()
start = s.index("  // 鈥斺€?鏈儳娈?") if "鏈儳娈" in s else s.index("const dotTexture = makeDotTexture()")
end = s.index("group.remove(headGroup)") + len("group.remove(headGroup)")
s = s[:start] + "  const dotTexture = makeDotTexture()" + s[end:]
# 去掉残留引用行
drop = [
 "embers.visible = false", "embers.visible = visible",
 "sparkCloud.visible = false", "sparkPool.setVisible(true)",
 "headGroup.visible = false", "headGroup.visible = true",
 "headGroup.position.copy(pointAt(s0))",
]
lines = []
for ln in s.split("\n"):
    t = ln.strip()
    if any(t == d or t == d+";" for d in drop):
        continue
    lines.append(ln)
s = "\n".join(lines)
io.open(p,'w',encoding='utf-8').write(s)
print("stripped")
