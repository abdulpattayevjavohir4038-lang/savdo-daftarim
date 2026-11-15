# Ishlab chiqarish ilovasi uchun namunaviy server (video darslik): «Mazza nonvoyxonasi»
import random, time
DAY=864e5; TZ=5*3600e3
def now_ms(): return int(time.time()*1000)
def day_ts(d,h,m=0):
    t=now_ms()+TZ; d0=t-t%DAY; return int(d0-d*DAY+(h*60+m)*60e3-TZ)
CATS=[('gaz','🔥','Gaz va svet'),('ijara','🏠','Ijara'),('ishhaqi','👷','Ish haqi'),('qadoq','📦','Qadoq'),('transport','🚚','Transport'),('asbob','🛠','Asbob-uskuna'),('soliq','🧾','Soliq'),('boshqa','💸','Boshqa')]
class IcMock:
    def __init__(self, empty=False):
        self.id=100; self.items=[]; self.mats=[]; self.tx=[]
        if empty: return
        rnd=random.Random(3)
        for n,u,p in [('Tort «Napoleon»','kg',90000),('Pechenye','kg',45000),('Chak-chak','kg',60000),('Pahlava','kg',70000)]: self.items.append({'id':self.nid(),'name':n,'unit':u,'price':p,'archived':False})
        for n,u,p in [('Un','kg',6500),('Shakar','kg',13000),("Sariyog'",'kg',95000),('Tuxum','dona',1500),("Yong'oq",'kg',120000),('Qadoq','dona',300)]: self.mats.append({'id':self.nid(),'name':n,'unit':u,'price':p,'archived':False})
        I={x['name']:x for x in self.items}; M={x['name']:x for x in self.mats}
        for d in range(45,-1,-1):
            for nm,q in [('Pechenye',(11,20)),('Chak-chak',(4,9)),('Pahlava',(3,8))]:
                it=I[nm]; qq=rnd.randint(*q); self.add('sale',item=it['id'],qty=qq,price=it['price'],ts=day_ts(d,rnd.randint(8,18)))
            if rnd.random()<.5 or d in (9,3): it=I['Tort «Napoleon»']; qq=rnd.choice([1.5,2,2.5,3]); cr=d in (9,3); self.add('sale',item=it['id'],qty=qq,price=it['price'],ts=day_ts(d,15),customer='Baraka doʻkoni' if cr else '',paid=0 if cr else None)
            if d%3==0:
                for nm,q in [('Un',(40,70)),('Shakar',(10,20)),("Sariyog'",(3,6)),('Tuxum',(60,120)),("Yong'oq",(3,6))]:
                    m=M[nm]; self.add('buy',mat=m['id'],qty=rnd.randint(*q),price=m['price'],ts=day_ts(d,7))
            if d%10==4: self.add('buy',mat=M['Qadoq']['id'],qty=1000,price=300,ts=day_ts(d,9))
        for d,c,a in [(40,'ijara',2500000),(10,'ijara',2500000),(14,'gaz',900000),(44,'gaz',850000),(1,'ishhaqi',4000000),(31,'ishhaqi',4000000),(6,'transport',300000)]: self.add('exp',cat=c,amount=a,ts=day_ts(d,11))
    def nid(self): self.id+=1; return self.id
    def add(self,kind,item=None,mat=None,cat=None,qty=None,price=None,amount=None,ts=None,customer='',paid=None,note=''):
        amount=amount or round(qty*price)
        x={'id':self.nid(),'kind':kind,'item':item,'mat':mat,'cat':cat,'qty':qty,'price':price,'amount':amount,'paid':amount if paid is None else paid,'customer':customer,'note':note,'ts':ts or now_ms()}
        self.tx.append(x); return x
    def load(self):
        return {'ok':True,'now':now_ms(),'today':time.strftime('%Y-%m-%d',time.gmtime((now_ms()+TZ)/1000)),'bot':'minimarketkassabot','user':{'name':'Javohir','username':''},
            'cats':[{'id':a,'e':b,'n':c} for a,b,c in CATS],'items':self.items,'mats':self.mats,'tx':sorted(self.tx,key=lambda x:-x['ts']),'more':False}
    def named(self, lst, b):
        nm=b['name'].strip()
        for x in lst:
            if x['name'].lower()==nm.lower(): return x
        x={'id':self.nid(),'name':nm,'unit':b.get('unit','kg'),'price':b.get('price') or 0,'archived':False}; lst.append(x); return x
    def handle(self,b):
        a=b.get('action')
        if a=='load': return 200,self.load()
        if a in('tx_add','tx_edit'):
            k=b['kind']
            if k=='exp': v=dict(kind='exp',cat=b.get('cat'),amount=b['amount'])
            else:
                lst=self.items if k=='sale' else self.mats
                oid=b.get('item' if k=='sale' else 'mat') or self.named(lst,b)['id']
                qty=float(b['qty']); price=b.get('price') or round(b['amount']/qty); amount=b.get('amount') or round(qty*price)
                v=dict(kind=k,item=oid if k=='sale' else None,mat=oid if k=='buy' else None,qty=qty,price=price,amount=amount)
                if k=='sale' and b.get('credit'): v['customer']=b['customer']; v['paid']=min(amount,b.get('paid') or 0)
            if a=='tx_add': self.add(**v); return 200,{'ok':True,'id':self.id}
            x=next(t for t in self.tx if t['id']==b['id']); x.update(v); x.setdefault('paid',x['amount'])
            if 'paid' not in v: x['paid']=x['amount']; x['customer']=''
            return 200,{'ok':True}
        if a=='tx_del': self.tx=[t for t in self.tx if t['id']!=b['id']]; return 200,{'ok':True}
        if a=='pay':
            x=next(t for t in self.tx if t['id']==b['id']); x['paid']=min(x['amount'],x['paid']+(b.get('amount') or x['amount'])); return 200,{'ok':True,'left':x['amount']-x['paid']}
        if a=='pay_customer':
            n=0
            for t in self.tx:
                if t['kind']=='sale' and t['customer']==b['customer'] and t['paid']<t['amount']: t['paid']=t['amount']; n+=1
            return 200,{'ok':True,'n':n}
        if a in('item_save','mat_save'):
            lst=self.items if a=='item_save' else self.mats
            if b.get('id'):
                x=next(t for t in lst if t['id']==b['id']); x.update(name=b['name'],unit=b['unit'],price=b['price'],archived=b['archived'])
            else: x=self.named(lst,b)
            return 200,{'ok':True,'id':x['id']}
        return 400,{'error':'UNKNOWN'}
