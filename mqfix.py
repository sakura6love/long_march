import io
p='src/components/EventRail.vue'
s=io.open(p,encoding='utf-8').read()
i=s.rfind("@media (max-width: 768px)")
block=s[i:]
s=s[:i]
j=s.rfind("</style>")
s=s[:j]+block+"\n"+s[j:]
io.open(p,'w',encoding='utf-8').write(s)
print('mq inside style')
