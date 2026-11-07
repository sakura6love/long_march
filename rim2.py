import io
p='src/components/EarthGlobe.vue'
s=io.open(p,encoding='utf-8').read()
old = """    float e0 = texture2D(uChina, vUv).r;
    float ex = abs(texture2D(uChina, vUv + vec2(px.x, 0.0)).r - e0);
    float ey = abs(texture2D(uChina, vUv + vec2(0.0, px.y)).r - e0);
    float edge = clamp((ex + ey) * 2.2, 0.0, 1.0);
    float rim = edge * smoothstep(0.9, 0.99, uBurn);"""
new = """    float e0 = texture2D(uChina, vUv).r;
    // 羽化后的掩码：0.5 附近就是国境线
    float edge = 1.0 - smoothstep(0.015, 0.075, abs(e0 - 0.5));
    float rim = edge * smoothstep(0.9, 0.99, uBurn);"""
s = s.replace(old, new, 1)
s = s.replace("gl_FragColor.rgb += vec3(1.0, 0.84, 0.52) * rim * 0.55;",
              "gl_FragColor.rgb += vec3(1.0, 0.84, 0.52) * rim * 0.9;")
io.open(p,'w',encoding='utf-8').write(s)
print('rim v2')
