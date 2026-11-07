import io
p='src/components/FinaleScreen.vue'
s=io.open(p,encoding='utf-8').read()
s=s.replace("background: radial-gradient(ellipse at 50% 44%, rgba(4, 7, 12, 0.42), rgba(4, 7, 12, 0.9) 74%);",
            "background: radial-gradient(ellipse at 50% 46%, rgba(4, 7, 12, 0.18), rgba(4, 7, 12, 0.62) 78%);")
io.open(p,'w',encoding='utf-8').write(s)
print('veil lighter')
