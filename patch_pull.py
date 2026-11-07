import io
p='src/components/EarthGlobe.vue'
s=io.open(p,encoding='utf-8').read()
anchor="  /** 回序章：镜头退回远景 */"
add = """  /** 终章：镜头拉远，让整个中国进入画面 */
  pullBack() {
    hintVisible.value = false
    cameraRig?.flyTo({
      lat: DEFAULT_VIEW.lat,
      lng: DEFAULT_VIEW.lng,
      altitude: 0.62,
      aim: 10,
      duration: 2200,
    })
  },
"""
s=s.replace(anchor, add+anchor, 1)
io.open(p,'w',encoding='utf-8').write(s)
print('pullBack added')
