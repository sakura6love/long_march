import io
p='src/components/EarthGlobe.vue'
s=io.open(p,encoding='utf-8').read()
anchor = "  gl_FragColor.rgb *= mix(1.0, 0.86, full * (1.0 - inCn));"
add = anchor + """

  // 国境描边：掩码差分取边缘，随 uBurn 收尾亮起
  if (uBurn > 0.9) {
    vec2 px = vec2(1.0 / 1024.0, 1.0 / 512.0);
    float e0 = texture2D(uChina, vUv).r;
    float ex = abs(texture2D(uChina, vUv + vec2(px.x, 0.0)).r - e0);
    float ey = abs(texture2D(uChina, vUv + vec2(0.0, px.y)).r - e0);
    float edge = clamp((ex + ey) * 2.2, 0.0, 1.0);
    float rim = edge * smoothstep(0.9, 0.99, uBurn);
    gl_FragColor.rgb += vec3(1.0, 0.84, 0.52) * rim * 0.55;
  }"""
s = s.replace(anchor, add, 1)
io.open(p,'w',encoding='utf-8').write(s)
print('rim added')
