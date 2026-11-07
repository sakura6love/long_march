import io
p='src/components/EarthGlobe.vue'
s=io.open(p,encoding='utf-8').read()
s=s.replace("float edge = 1.0 - smoothstep(0.004, 0.022, abs(e0 - 0.5));",
            "float edge = 1.0 - smoothstep(0.003, 0.012, abs(e0 - 0.5));")
s=s.replace("vec3(1.0, 0.82, 0.48) * rim * 0.45","vec3(1.0, 0.84, 0.5) * rim * 0.3")
io.open(p,'w',encoding='utf-8').write(s)
print('rim v4')
