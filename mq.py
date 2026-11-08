import io
p='src/components/EventRail.vue'
s=io.open(p,encoding='utf-8').read()
s=s.rstrip()+"""

@media (max-width: 768px) {
  .route-strip {
    width: 86vw;
    bottom: 18px;
    height: 26px;
  }
  .rs-title,
  .rs-end-l,
  .rs-end-r {
    display: none;
  }
  .rs-num {
    font-size: 8px;
  }
}
"""
io.open(p,'w',encoding='utf-8').write(s)
print('mobile strip')
