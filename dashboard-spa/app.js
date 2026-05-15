const PT = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
const TZ = 'Europe/Lisbon'
const qs = (s, el=document) => el.querySelector(s)
const qsa = (s, el=document) => [...el.querySelectorAll(s)]

const DB_KEY = 'cf_data_v1'
const STAGES = [
  { id: 'novo', label: 'Novo' },
  { id: 'contactado', label: 'Contactado' },
  { id: 'qualificado', label: 'Qualificado' },
  { id: 'proposta', label: 'Proposta' },
  { id: 'fechado', label: 'Fechado' },
  { id: 'perdido', label: 'Perdido' }
]
const SELLERS = [
  { id: 'jusepp', label: 'Fluxo Jusepp' },
  { id: 'bruno', label: 'Fluxo Bruno' },
  { id: 'kenan', label: 'Fluxo Kenan' }
]

const VIEW_META = {
  dashboard: { title: 'Dashboard' },
  vendas: { title: 'Vendas' },
  investir: { title: 'Investir' },
  historico: { title: 'Histórico' },
  clientes: { title: 'Clientes' }
}

const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' -]{1,79}$/

function loadDB(){
  try{
    const parsed = JSON.parse(localStorage.getItem(DB_KEY))
    if(parsed) return parsed
  }catch{}
  const next = { customers: [], sales: [], investments: [] }
  localStorage.setItem(DB_KEY, JSON.stringify(next))
  return next
}
function saveDB(next){
  localStorage.setItem(DB_KEY, JSON.stringify(next))
}
function normalizePhone(phone){
  const p = String(phone||'').trim()
  const digits = p.replace(/\D/g, '')
  return digits
}
function normalizeDB(next){
  if(!next || typeof next !== 'object') return { customers: [], sales: [], investments: [] }
  next.customers = Array.isArray(next.customers) ? next.customers : []
  next.sales = Array.isArray(next.sales) ? next.sales : []
  next.investments = Array.isArray(next.investments) ? next.investments : []

  next.customers = next.customers.map(c=>{
    const id = c.id || crypto.randomUUID()
    const name = String(c.name||'').trim() || 'Sem nome'
    const phone = String(c.phone||'').trim()
    const createdAt = c.createdAt || new Date().toISOString()
    const stage = STAGES.some(s=>s.id===c.stage) ? c.stage : 'novo'
    return {
      id,
      name,
      phone,
      source: c.source || 'Facebook',
      profileUrl: c.profileUrl || '',
      notes: c.notes || '',
      stage,
      createdAt,
      movedAt: c.movedAt || null
    }
  })

  next.sales = next.sales.map(s=>({
    id: s.id || crypto.randomUUID(),
    customerId: s.customerId,
    occurredAt: s.occurredAt || new Date().toISOString(),
    amount: Number(s.amount||0),
    sellerId: SELLERS.some(x=>x.id===s.sellerId) ? s.sellerId : (SELLERS[0]?.id || 'jusepp'),
    paymentMethod: s.paymentMethod || '',
    notes: s.notes || '',
    createdAt: s.createdAt || new Date().toISOString()
  }))

  next.investments = next.investments.map(i=>({
    id: i.id || crypto.randomUUID(),
    platform: i.platform || 'FACEBOOK',
    campaign: i.campaign || '',
    occurredOn: i.occurredOn || new Date().toISOString().slice(0,10),
    amount: Number(i.amount||0),
    notes: i.notes || '',
    createdAt: i.createdAt || new Date().toISOString()
  }))

  return next
}

let db = normalizeDB(loadDB())
saveDB(db)

function setHidden(id, hidden){
  const el = qs(id)
  if(!el) return
  el.classList.toggle('hidden', hidden)
}
function setError(elId, message){
  const el = qs(elId)
  if(!el) return
  if(message){
    el.textContent = message
    el.classList.remove('hidden')
  }else{
    el.textContent = ''
    el.classList.add('hidden')
  }
}
function validateFullName(raw){
  const name = String(raw||'').trim().replace(/\s+/g, ' ')
  if(!name) return { ok: false, message: 'Nome completo é obrigatório.' }
  if(!NAME_RE.test(name)) return { ok: false, message: 'Nome inválido. Use apenas letras, espaços, hífen e apóstrofo.' }
  return { ok: true, value: name }
}

const AUTH_KEY = 'cf_auth_v1'
function isAuthed(){
  try{ return sessionStorage.getItem(AUTH_KEY) === '1' }catch{ return false }
}
function setAuthed(value){
  try{
    if(value) sessionStorage.setItem(AUTH_KEY, '1')
    else sessionStorage.removeItem(AUTH_KEY)
  }catch{}
}
function setLocked(locked){
  document.body.classList.toggle('is-locked', locked)
  qsa('.view').forEach(v=>v.classList.remove('visible'))
  if(locked) qs('#view-login')?.classList.add('visible')
}
async function sha256Hex(text){
  const enc = new TextEncoder()
  const bytes = enc.encode(String(text||''))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')
}
function loadAuthConfigScript(){
  if(window.CF_AUTH && typeof window.CF_AUTH === 'object') return Promise.resolve(true)
  return new Promise(resolve=>{
    const existing = document.querySelector('script[data-auth-config]')
    if(existing) return resolve(window.CF_AUTH && typeof window.CF_AUTH === 'object')
    const s = document.createElement('script')
    s.src = './auth-config.js'
    s.defer = true
    s.dataset.authConfig = '1'
    s.onload = () => resolve(window.CF_AUTH && typeof window.CF_AUTH === 'object')
    s.onerror = () => resolve(false)
    document.head.appendChild(s)
  })
}
function getAuthConfig(){
  const cfg = window.CF_AUTH
  if(!cfg || typeof cfg !== 'object') return null
  const login = String(cfg.login||'').trim()
  const passwordSha256 = String(cfg.passwordSha256||'').trim()
  if(!login || !passwordSha256) return null
  return { login, passwordSha256 }
}

function fmtMoney(n){ return PT.format(Number(n||0)) }
function fmtDateTime(iso){
  const d = new Date(iso)
  return d.toLocaleString('pt-PT', { timeZone: TZ, day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
}
function fmtDateOnlyFromISO(iso){
  const d = new Date(iso)
  return d.toLocaleDateString('pt-PT', { timeZone: TZ, day:'2-digit', month:'2-digit', year:'numeric' })
}
function dateFromYMD(ymd){
  return new Date(`${ymd}T12:00:00`)
}
function fmtDateOnlyFromYMD(ymd){
  const d = dateFromYMD(ymd)
  return d.toLocaleDateString('pt-PT', { timeZone: TZ, day:'2-digit', month:'2-digit', year:'numeric' })
}
function dayKeyFromISO(iso){
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
}
function dayKeyFromYMD(ymd){
  return dateFromYMD(ymd).toLocaleDateString('en-CA', { timeZone: TZ })
}
function todayISO(){ return new Date().toISOString().slice(0,10) }
function nowISO(){ const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,16) }

let currentView = 'dashboard'
function setHeader(view){
  const meta = VIEW_META[view] || VIEW_META.dashboard
  const titleEl = qs('#page-title')
  const crumbEl = qs('#crumb-current')
  if(titleEl) titleEl.textContent = meta.title
  if(crumbEl) crumbEl.textContent = meta.title
  document.title = `${meta.title} — Vendas & Investimentos`
}

function navTo(view){
  currentView = view
  setHeader(view)
  qsa('.view').forEach(v=>v.classList.remove('visible'))
  qs(`#view-${view}`).classList.add('visible')
  qsa('.nav-btn').forEach(b=>{
    const active = b.dataset.view===view
    b.classList.toggle('active', active)
    if(active) b.setAttribute('aria-current', 'page')
    else b.removeAttribute('aria-current')
  })
  if(view==='historico') renderHistory()
  if(view==='vendas'){
    populateClientesDatalist()
    populateSociosSelect()
  }
}
qsa('.nav-btn').forEach(b=>b.addEventListener('click', ()=>navTo(b.dataset.view)))

function setClientesTab(tab){
  const btn = qs(`[data-clientes-tab="${tab}"]`)
  if(btn) btn.click()
}

function applyGlobalSearch(query){
  const q = String(query||'').trim()
  if(!q) return
  navTo('clientes')
  setClientesTab('lista')
  const a = qs('#cliente-search')
  if(a){
    a.value = q
    a.dispatchEvent(new Event('input', { bubbles: true }))
  }
  const b = qs('#pipeline-search')
  if(b){
    b.value = q
    b.dispatchEvent(new Event('input', { bubbles: true }))
  }
}

qs('#btn-refresh')?.addEventListener('click', ()=>{
  refreshAll()
})

qs('#shortcut-venda')?.addEventListener('click', ()=>{
  navTo('vendas')
  qs('#venda-cliente-nome')?.focus()
})

qs('#global-search')?.addEventListener('keydown', e=>{
  if(e.key !== 'Enter') return
  applyGlobalSearch(e.target.value)
})

function upsertCustomer({name, phone, source, profileUrl, notes, stage}){
  const nextName = String(name||'').trim() || 'Sem nome'
  const nextPhone = String(phone||'').trim()
  const phoneKey = normalizePhone(nextPhone)
  if(phoneKey){
    const exists = db.customers.find(c => normalizePhone(c.phone) === phoneKey)
    if(exists) return exists
  }
  const c = {
    id: crypto.randomUUID(),
    name: nextName,
    phone: nextPhone,
    source: source || 'Facebook',
    profileUrl: profileUrl || '',
    notes: notes || '',
    stage: STAGES.some(s=>s.id===stage) ? stage : 'novo',
    createdAt: new Date().toISOString(),
    movedAt: null
  }
  db.customers.push(c)
  saveDB(db)
  return c
}
function addSale({customerId, quickCustomer, occurredAt, amount, sellerId, paymentMethod, notes}){
  let cId = customerId
  if(!cId && quickCustomer){
    const c = upsertCustomer({
      name: quickCustomer.name || 'Sem nome',
      phone: quickCustomer.phone || '',
      stage: 'novo'
    })
    cId = c.id
  }
  const s = {
    id: crypto.randomUUID(),
    customerId: cId,
    occurredAt: occurredAt || new Date().toISOString(),
    amount: Number(amount||0),
    sellerId: SELLERS.some(x=>x.id===sellerId) ? sellerId : (SELLERS[0]?.id || 'jusepp'),
    paymentMethod: paymentMethod || '',
    notes: notes || '',
    createdAt: new Date().toISOString()
  }
  db.sales.push(s)
  saveDB(db)
  return s
}
function addInvestment({platform, campaign, occurredOn, amount, notes}){
  const inv = {
    id: crypto.randomUUID(),
    platform: platform || 'FACEBOOK',
    campaign: campaign || '',
    occurredOn: occurredOn || todayISO(),
    amount: Number(amount||0),
    notes: notes || '',
    createdAt: new Date().toISOString()
  }
  db.investments.push(inv)
  saveDB(db)
  return inv
}

function computeMetrics(range){
  const from = range.from ? new Date(range.from) : new Date(Date.now()-30*86400000)
  const to = range.to ? new Date(range.to) : new Date()
  const sales = db.sales.filter(s => new Date(s.occurredAt) >= from && new Date(s.occurredAt) <= to)
  const investments = db.investments.filter(i => new Date(i.occurredOn) >= from && new Date(i.occurredOn) <= to)
  const totalSold = sales.reduce((a,b)=>a+b.amount,0)
  const numSales = sales.length
  const ticket = numSales>0 ? totalSold/numSales : 0
  const totalInvested = investments.reduce((a,b)=>a+b.amount,0)
  const roi = totalInvested>0 ? ((totalSold-totalInvested)/totalInvested)*100 : null
  return { from, to, totalSold, numSales, ticket, totalInvested, roi, sales, investments }
}

function readPeriod(){
  const pSel = qs('#periodo-select').value
  let from = null
  let to = null
  if(pSel==='7') from = new Date(Date.now()-7*86400000)
  else if(pSel==='30') from = new Date(Date.now()-30*86400000)
  else if(pSel==='mes'){
    const d = new Date()
    from = new Date(d.getFullYear(), d.getMonth(), 1)
  }else{
    const f = qs('#from-date').value
    const t = qs('#to-date').value
    if(f) from = new Date(f)
    if(t) to = new Date(t)
    if(!to) to = new Date()
  }
  return { from, to }
}

function updateKPIs(){
  const { from, to } = readPeriod()
  const m = computeMetrics({from, to})
  qs('#kpi-total-vendido').textContent = fmtMoney(m.totalSold)
  qs('#kpi-num-vendas').textContent = String(m.numSales)
  qs('#kpi-ticket-medio').textContent = m.numSales? fmtMoney(m.ticket): '—'
  qs('#kpi-total-investido').textContent = fmtMoney(m.totalInvested)
  qs('#kpi-roi').textContent = m.roi===null ? '—' : `${m.roi.toFixed(1)}%`
  renderChart()
  renderRecent(m)
}

let chart
function renderChart(){
  const days = []
  for(let i=29;i>=0;i--){
    const d = new Date(Date.now()-i*86400000)
    days.push(d.toISOString().slice(0,10))
  }
  const series = days.map(day=>{
    return db.sales.filter(s=>s.occurredAt.slice(0,10)===day).reduce((a,b)=>a+b.amount,0)
  })
  const ctx = qs('#salesChart').getContext('2d')
  if(chart) chart.destroy()
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: days.map(d=>new Date(d).toLocaleDateString('pt-PT',{day:'2-digit',month:'2-digit'})),
      datasets: [{
        label: 'Vendas (€)',
        data: series,
        borderColor: '#7b5cf7',
        backgroundColor: 'rgba(123,92,247,0.25)',
        fill: true,
        tension: .35,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { mode:'index', intersect:false }},
      interaction: { mode:'index', intersect:false },
      scales: {
        x: {
          ticks: { color: 'rgba(167,176,191,0.85)' },
          grid: { color: 'rgba(255,255,255,0.06)' }
        },
        y: {
          ticks: {
            color: 'rgba(167,176,191,0.85)',
            callback: v => PT.format(v)
          },
          grid: { color: 'rgba(255,255,255,0.06)' }
        }
      }
    }
  })
}

function renderRecent(m){
  const items = [
    ...m.sales.map(s => ({ type:'sale', at: s.occurredAt, value: s.amount, id:s.id, customerId:s.customerId })),
    ...m.investments.map(i => ({ type:'investment', at: i.occurredOn+'T12:00:00', value: i.amount, id:i.id, campaign:i.campaign }))
  ].sort((a,b)=> new Date(b.at)-new Date(a.at)).slice(0,8)
  const el = qs('#recent-list')
  el.innerHTML = ''
  items.forEach(it=>{
    const div = document.createElement('div')
    div.className = 'item'
    if(it.type==='sale'){
      const c = db.customers.find(c=>c.id===it.customerId)
      const s = db.sales.find(x=>x.id===it.id)
      const seller = SELLERS.find(x=>x.id===s?.sellerId)?.label || '—'
      div.innerHTML = `
        <div>
          <div><strong>Venda</strong> <span class="chip">${fmtMoney(it.value)}</span></div>
          <div class="meta"><span>${c?c.name:'Cliente'}</span><span>${fmtDateTime(it.at)}</span><span class="chip">${seller}</span></div>
        </div>
        <div class="meta"><span class="chip">+ Receita</span></div>
      `
    }else{
      div.innerHTML = `
        <div>
          <div><strong>Investimento</strong> <span class="chip">${fmtMoney(it.value)}</span></div>
          <div class="meta"><span>${it.campaign||'Campanha'}</span><span>${fmtDateOnlyFromISO(it.at)}</span></div>
        </div>
        <div class="meta"><span class="chip">Ads</span></div>
      `
    }
    el.appendChild(div)
  })
}

function populateClientesDatalist(){
  const dl = qs('#clientes-datalist')
  if(!dl) return
  const seen = new Set()
  const options = db.customers
    .slice()
    .sort((a,b)=> (a.name||'').localeCompare(b.name||''))
    .map(c=>String(c.name||'').trim())
    .filter(name=>{
      if(!name) return false
      const key = name.toLowerCase()
      if(seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map(name=>`<option value="${name}"></option>`)
    .join('')
  dl.innerHTML = options
}

function populateSociosSelect(){
  const sel = qs('#venda-socio')
  if(!sel) return
  sel.innerHTML = SELLERS.map(s=>`<option value="${s.id}">${s.label}</option>`).join('')
}

function renderClientes(list=db.customers){
  const el = qs('#clientes-list')
  el.innerHTML = ''
  list
    .slice()
    .sort((a,b)=> (a.name||'').localeCompare(b.name||''))
    .forEach(c=>{
      const div = document.createElement('div')
      div.className='item'
      const stageLabel = (STAGES.find(s=>s.id===c.stage) || STAGES[0]).label
      div.innerHTML = `
        <div>
          <div><strong>${c.name}</strong></div>
          <div class="meta">
            <span>${c.phone || '—'}</span>
            <span>${c.source || '—'}</span>
            <span class="chip">${stageLabel}</span>
          </div>
        </div>
        <div class="row">
          <button data-edit="${c.id}" class="btn">Editar</button>
          <button data-del="${c.id}" class="btn danger">Remover</button>
        </div>
      `
      div.querySelector('[data-del]').addEventListener('click', ()=>{
        const ok = confirm('Remover cliente e as vendas associadas?')
        if(!ok) return
        db.sales = db.sales.filter(s=>s.customerId!==c.id)
        db.customers = db.customers.filter(x=>x.id!==c.id)
        saveDB(db)
        refreshAll()
      })
      div.querySelector('[data-edit]').addEventListener('click', ()=>{
        const next = prompt('Editar nome completo:', c.name)
        if(next===null) return
        const v = validateFullName(next)
        if(!v.ok){
          setError('#cliente-error', v.message)
          return
        }
        c.name = v.value
        saveDB(db)
        setError('#cliente-error', '')
        refreshAll()
      })
      el.appendChild(div)
    })
}

function renderVendas(){
  const el = qs('#vendas-list')
  el.innerHTML = ''
  const items = [...db.sales].sort((a,b)=> new Date(b.occurredAt)-new Date(a.occurredAt)).slice(0,20)
  items.forEach(s=>{
    const c = db.customers.find(c=>c.id===s.customerId)
    const seller = SELLERS.find(x=>x.id===s.sellerId)?.label || '—'
    const div = document.createElement('div')
    div.className='item'
    div.innerHTML = `
      <div>
        <div><strong>${fmtMoney(s.amount)}</strong> <span class="chip">${seller}</span> <span class="chip">${s.paymentMethod || '—'}</span></div>
        <div class="meta"><span>${c?c.name:'Cliente'}</span><span>${fmtDateTime(s.occurredAt)}</span></div>
      </div>
      <div class="row"><button data-del="${s.id}" class="btn danger">Remover</button></div>
    `
    div.querySelector('[data-del]').addEventListener('click', ()=>{
      db.sales = db.sales.filter(x=>x.id!==s.id)
      saveDB(db)
      renderVendas()
      updateKPIs()
    })
    el.appendChild(div)
  })
}

function renderInvestimentos(){
  const el = qs('#invest-list')
  el.innerHTML = ''
  const items = [...db.investments].sort((a,b)=> new Date(b.occurredOn)-new Date(a.occurredOn)).slice(0,20)
  items.forEach(i=>{
    const div = document.createElement('div')
    div.className='item'
    div.innerHTML = `
      <div>
        <div><strong>${fmtMoney(i.amount)}</strong> <span class="chip">${i.platform}</span></div>
        <div class="meta"><span>${i.campaign||'—'}</span><span>${fmtDateOnlyFromYMD(i.occurredOn)}</span></div>
      </div>
      <div class="row"><button data-del="${i.id}" class="btn danger">Remover</button></div>
    `
    div.querySelector('[data-del]').addEventListener('click', ()=>{
      db.investments = db.investments.filter(x=>x.id!==i.id)
      saveDB(db)
      renderInvestimentos()
      updateKPIs()
    })
    el.appendChild(div)
  })
}

const pipelineState = {
  query: '',
  limitByStage: Object.fromEntries(STAGES.map(s=>[s.id, 40])),
  editingId: null
}

function setCustomerStage(customerId, stageId){
  const c = db.customers.find(c=>c.id===customerId)
  if(!c) return
  if(!STAGES.some(s=>s.id===stageId)) return
  c.stage = stageId
  c.movedAt = Date.now()
  saveDB(db)
}

function renderKanban(){
  const host = qs('#kanban')
  if(!host) return
  host.innerHTML = ''

  const query = (pipelineState.query || '').toLowerCase().trim()
  const filtered = query
    ? db.customers.filter(c => (c.name||'').toLowerCase().includes(query))
    : db.customers

  STAGES.forEach(stage=>{
    const col = document.createElement('section')
    col.className = 'col'
    col.setAttribute('aria-label', stage.label)

    const listAll = filtered.filter(c=>c.stage===stage.id).sort((a,b)=> (b.movedAt||0)-(a.movedAt||0) || (b.createdAt||'').localeCompare(a.createdAt||''))
    const limit = pipelineState.limitByStage[stage.id] ?? 40
    const list = listAll.slice(0, limit)

    const head = document.createElement('div')
    head.className = 'col-head'
    head.innerHTML = `<h4 class="col-title">${stage.label}</h4><div class="col-count">${listAll.length}</div>`

    const body = document.createElement('div')
    body.className = 'col-body dropzone'
    body.dataset.stage = stage.id

    body.addEventListener('dragover', e=>{
      e.preventDefault()
      body.classList.add('over')
    })
    body.addEventListener('dragleave', ()=>{
      body.classList.remove('over')
    })
    body.addEventListener('drop', e=>{
      e.preventDefault()
      body.classList.remove('over')
      const id = e.dataTransfer.getData('text/plain')
      if(!id) return
      setCustomerStage(id, stage.id)
      refreshAll({kanbanOnly:true})
    })

    list.forEach(c=>{
      const card = renderLeadCard(c)
      body.appendChild(card)
    })

    if(listAll.length > list.length){
      const more = document.createElement('button')
      more.className = 'btn'
      more.type = 'button'
      more.textContent = `Carregar mais (${Math.min(40, listAll.length - list.length)})`
      more.addEventListener('click', ()=>{
        pipelineState.limitByStage[stage.id] = (pipelineState.limitByStage[stage.id] ?? 40) + 40
        renderKanban()
      })
      body.appendChild(more)
    }

    col.appendChild(head)
    col.appendChild(body)
    host.appendChild(col)
  })
}

function renderLeadCard(customer){
  const card = document.createElement('article')
  card.className = 'lead'
  card.draggable = true
  card.dataset.id = customer.id

  const movedRecently = customer.movedAt && (Date.now() - customer.movedAt < 900)
  if(movedRecently) card.classList.add('moved')

  card.addEventListener('dragstart', e=>{
    e.dataTransfer.setData('text/plain', customer.id)
    card.classList.add('dragging')
  })
  card.addEventListener('dragend', ()=>{
    card.classList.remove('dragging')
  })

  if(pipelineState.editingId === customer.id){
    const nameInput = document.createElement('input')
    nameInput.className = 'input'
    nameInput.value = customer.name
    nameInput.setAttribute('aria-label', 'Editar nome do cliente')

    const actions = document.createElement('div')
    actions.className = 'lead-actions'
    const saveBtn = document.createElement('button')
    saveBtn.className = 'btn primary'
    saveBtn.type = 'button'
    saveBtn.textContent = 'Guardar'
    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'btn'
    cancelBtn.type = 'button'
    cancelBtn.textContent = 'Cancelar'

    saveBtn.addEventListener('click', ()=>{
      const v = validateFullName(nameInput.value)
      if(!v.ok){
        setError('#pipeline-error', v.message)
        return
      }
      customer.name = v.value
      pipelineState.editingId = null
      saveDB(db)
      setError('#pipeline-error', '')
      refreshAll({kanbanOnly:true})
    })
    cancelBtn.addEventListener('click', ()=>{
      pipelineState.editingId = null
      setError('#pipeline-error', '')
      refreshAll({kanbanOnly:true})
    })

    actions.appendChild(saveBtn)
    actions.appendChild(cancelBtn)
    card.appendChild(nameInput)
    card.appendChild(actions)
    return card
  }

  const name = document.createElement('div')
  name.className = 'lead-name'
  name.textContent = customer.name

  const meta = document.createElement('div')
  meta.className = 'meta'
  const phone = document.createElement('span')
  phone.textContent = customer.phone || '—'
  meta.appendChild(phone)

  const actions = document.createElement('div')
  actions.className = 'lead-actions'

  const mover = document.createElement('select')
  mover.className = 'select-sm'
  mover.setAttribute('aria-label', 'Mover cliente para etapa')
  mover.innerHTML = STAGES.map(s=>`<option value="${s.id}" ${s.id===customer.stage?'selected':''}>${s.label}</option>`).join('')
  mover.addEventListener('change', ()=>{
    setCustomerStage(customer.id, mover.value)
    refreshAll({kanbanOnly:true})
  })

  const editBtn = document.createElement('button')
  editBtn.className = 'btn'
  editBtn.type = 'button'
  editBtn.textContent = 'Editar'
  editBtn.addEventListener('click', ()=>{
    pipelineState.editingId = customer.id
    setError('#pipeline-error', '')
    refreshAll({kanbanOnly:true})
  })

  const delBtn = document.createElement('button')
  delBtn.className = 'btn danger'
  delBtn.type = 'button'
  delBtn.textContent = 'Remover'
  delBtn.addEventListener('click', ()=>{
    const ok = confirm('Remover este cliente?')
    if(!ok) return
    db.sales = db.sales.filter(s=>s.customerId!==customer.id)
    db.customers = db.customers.filter(c=>c.id!==customer.id)
    saveDB(db)
    refreshAll()
  })

  actions.appendChild(mover)
  actions.appendChild(editBtn)
  actions.appendChild(delBtn)

  card.appendChild(name)
  card.appendChild(meta)
  card.appendChild(actions)
  return card
}

function refreshAll(opts={}){
  if(!opts.kanbanOnly){
    populateClientesDatalist()
    populateSociosSelect()
    renderClientes()
    renderVendas()
    renderInvestimentos()
    updateKPIs()
    renderHistory()
  }
  renderKanban()
}

qsa('[data-clientes-tab]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    qsa('[data-clientes-tab]').forEach(b=>{
      const isActive = b === btn
      b.classList.toggle('active', isActive)
      b.setAttribute('aria-selected', isActive ? 'true' : 'false')
    })
    const tab = btn.dataset.clientesTab
    setHidden('#clientes-tab-lista', tab!=='lista')
    setHidden('#clientes-tab-etapas', tab!=='etapas')
    setError('#cliente-error', '')
    setError('#pipeline-error', '')
    renderKanban()
  })
})

qs('#form-cliente').addEventListener('submit', e=>{
  e.preventDefault()
  setError('#cliente-error', '')
  const nameRaw = qs('#cliente-nome').value
  const phone = qs('#cliente-telemovel').value.trim()
  const source = qs('#cliente-origem').value.trim()
  const profileUrl = qs('#cliente-perfil').value.trim()
  const notes = qs('#cliente-notas').value.trim()

  const v = validateFullName(nameRaw)
  if(!v.ok){
    setError('#cliente-error', v.message)
    return
  }

  const phoneKey = normalizePhone(phone)
  if(phoneKey && db.customers.some(c=>normalizePhone(c.phone)===phoneKey)){
    setError('#cliente-error', 'Já existe um cliente com este nº.')
    return
  }

  upsertCustomer({ name: v.value, phone, source, profileUrl, notes, stage: 'novo' })
  e.target.reset()
  refreshAll()
})

qs('#cliente-limpar').addEventListener('click', ()=>{
  qs('#form-cliente').reset()
  setError('#cliente-error', '')
})

qs('#form-venda').addEventListener('submit', e=>{
  e.preventDefault()
  setError('#venda-error', '')
  const customerNameRaw = qs('#venda-cliente-nome').value
  const sellerId = qs('#venda-socio').value
  const quickPhone = qs('#venda-quick-telemovel').value.trim()
  const occurredAt = qs('#venda-data').value || new Date().toISOString()
  const amount = Number(qs('#venda-valor').value||0)
  const paymentMethod = qs('#venda-metodo').value.trim()
  const notes = qs('#venda-notas').value.trim()

  if(amount<=0){
    setError('#venda-error', 'Valor da venda deve ser maior que 0.')
    return
  }
  if(!SELLERS.some(s=>s.id===sellerId)){
    setError('#venda-error', 'Selecione o sócio responsável pela venda.')
    return
  }

  const v = validateFullName(customerNameRaw)
  if(!v.ok){
    setError('#venda-error', v.message)
    return
  }

  const customerName = v.value
  const existing = db.customers.find(c => String(c.name||'').trim().toLowerCase() === customerName.toLowerCase())
  const customerId = existing ? existing.id : upsertCustomer({ name: customerName, phone: quickPhone, stage: 'novo' }).id

  addSale({ customerId, quickCustomer: null, occurredAt, amount, sellerId, paymentMethod, notes })
  e.target.reset()
  qs('#venda-cliente-nome').value = ''
  qs('#venda-data').value = nowISO()
  populateSociosSelect()
  refreshAll()
})

qs('#venda-limpar').addEventListener('click', ()=>{
  qs('#form-venda').reset()
  qs('#venda-cliente-nome').value = ''
  qs('#venda-data').value = nowISO()
  populateSociosSelect()
  setError('#venda-error', '')
})

qs('#form-invest').addEventListener('submit', e=>{
  e.preventDefault()
  setError('#invest-error', '')
  const platform = qs('#invest-plataforma').value
  const campaign = qs('#invest-campanha').value.trim()
  const occurredOn = qs('#invest-data').value || todayISO()
  const amount = Number(qs('#invest-valor').value||0)
  const notes = qs('#invest-notas').value.trim()

  if(amount<=0){
    setError('#invest-error', 'Montante do investimento deve ser maior que 0.')
    return
  }

  addInvestment({ platform, campaign, occurredOn, amount, notes })
  e.target.reset()
  qs('#invest-data').value = todayISO()
  refreshAll()
})

qs('#invest-limpar').addEventListener('click', ()=>{
  qs('#form-invest').reset()
  qs('#invest-data').value = todayISO()
  setError('#invest-error', '')
})

qs('#cliente-search').addEventListener('input', e=>{
  const q = e.target.value.toLowerCase()
  const filtered = db.customers.filter(c => (c.name||'').toLowerCase().includes(q) || (c.phone||'').includes(q))
  renderClientes(filtered)
})

qs('#pipeline-search').addEventListener('input', e=>{
  pipelineState.query = e.target.value
  STAGES.forEach(s=> pipelineState.limitByStage[s.id] = 40)
  renderKanban()
})

qs('#pipeline-add-btn').addEventListener('click', ()=>{
  setError('#pipeline-error', '')
  const raw = qs('#pipeline-add-name').value
  const v = validateFullName(raw)
  if(!v.ok){
    setError('#pipeline-error', v.message)
    return
  }
  upsertCustomer({ name: v.value, phone: '', stage: 'novo' })
  qs('#pipeline-add-name').value = ''
  refreshAll()
})

qs('#pipeline-reset').addEventListener('click', ()=>{
  db.customers.forEach(c=>{ c.stage='novo'; c.movedAt=null })
  saveDB(db)
  STAGES.forEach(s=> pipelineState.limitByStage[s.id] = 40)
  refreshAll()
})

qs('#periodo-select').addEventListener('change', e=>{
  const showCustom = e.target.value==='custom'
  qs('#from-date').classList.toggle('hidden', !showCustom)
  qs('#to-date').classList.toggle('hidden', !showCustom)
})
qs('#aplicar-periodo').addEventListener('click', updateKPIs)

qs('#nova-venda-fast').addEventListener('click', ()=>navTo('vendas'))
qs('#novo-invest-fast').addEventListener('click', ()=>navTo('investir'))

const historyState = {
  type: 'all',
  fromKey: '',
  toKey: ''
}

function readHistoryStateFromUI(){
  const type = qs('#hist-tipo')?.value || 'all'
  const from = qs('#hist-from')?.value || ''
  const to = qs('#hist-to')?.value || ''
  historyState.type = type
  historyState.fromKey = from ? dayKeyFromYMD(from) : ''
  historyState.toKey = to ? dayKeyFromYMD(to) : ''
}

function renderHistory(){
  const el = qs('#hist-list')
  if(!el) return
  readHistoryStateFromUI()

  const items = []
  if(historyState.type==='all' || historyState.type==='sale'){
    db.sales.forEach(s=>{
      items.push({
        type: 'sale',
        key: dayKeyFromISO(s.occurredAt),
        at: new Date(s.occurredAt),
        sale: s
      })
    })
  }
  if(historyState.type==='all' || historyState.type==='investment'){
    db.investments.forEach(i=>{
      items.push({
        type: 'investment',
        key: dayKeyFromYMD(i.occurredOn),
        at: dateFromYMD(i.occurredOn),
        inv: i
      })
    })
  }

  const filtered = items.filter(x=>{
    if(historyState.fromKey && x.key < historyState.fromKey) return false
    if(historyState.toKey && x.key > historyState.toKey) return false
    return true
  }).sort((a,b)=> b.at - a.at)

  const groups = new Map()
  filtered.forEach(x=>{
    const list = groups.get(x.key) || []
    list.push(x)
    groups.set(x.key, list)
  })

  el.innerHTML = ''
  ;[...groups.keys()].sort((a,b)=> b.localeCompare(a)).forEach(key=>{
    const group = groups.get(key) || []
    const wrap = document.createElement('div')
    wrap.className = 'day-group'

    const head = document.createElement('div')
    head.className = 'day-head'
    head.innerHTML = `<p class="day-title">${fmtDateOnlyFromYMD(key)}</p><div class="day-count">${group.length}</div>`

    const body = document.createElement('div')
    body.className = 'day-body'

    group.forEach(x=>{
      const div = document.createElement('div')
      div.className = 'item'
      if(x.type==='sale'){
        const c = db.customers.find(c=>c.id===x.sale.customerId)
        const seller = SELLERS.find(s=>s.id===x.sale.sellerId)?.label || '—'
        div.innerHTML = `
          <div>
            <div><strong>Venda</strong> <span class="chip">${fmtMoney(x.sale.amount)}</span> <span class="chip">${seller}</span></div>
            <div class="meta"><span>${c?c.name:'Cliente'}</span><span>${fmtDateTime(x.sale.occurredAt)}</span></div>
          </div>
          <div class="meta"><span class="chip">${x.sale.paymentMethod || '—'}</span></div>
        `
      }else{
        div.innerHTML = `
          <div>
            <div><strong>Investimento</strong> <span class="chip">${fmtMoney(x.inv.amount)}</span> <span class="chip">Ads</span></div>
            <div class="meta"><span>${x.inv.campaign||'—'}</span><span>${fmtDateOnlyFromYMD(x.inv.occurredOn)}</span></div>
          </div>
          <div class="meta"><span class="chip">${x.inv.platform}</span></div>
        `
      }
      body.appendChild(div)
    })

    wrap.appendChild(head)
    wrap.appendChild(body)
    el.appendChild(wrap)
  })
}

function exportCSV(){
  const lines = ['type,date,customer,phone,campaign,amount,seller,notes']
  db.sales.forEach(s=>{
    const c = db.customers.find(c=>c.id===s.customerId) || {}
    const seller = SELLERS.find(x=>x.id===s.sellerId)?.label || ''
    lines.push(['sale', s.occurredAt, c.name||'', c.phone||'', '', s.amount, seller.replaceAll(',',';'), (s.notes||'').replaceAll(',',';')].join(','))
  })
  db.investments.forEach(i=>{
    lines.push(['investment', i.occurredOn, '', '', (i.campaign||'').replaceAll(',',';'), i.amount, '', (i.notes||'').replaceAll(',',';')].join(','))
  })
  const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8;'})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'historico.csv'
  a.click()
  URL.revokeObjectURL(url)
}
qs('#exportar').addEventListener('click', exportCSV)

qs('#importar').addEventListener('change', async e=>{
  const file = e.target.files[0]
  if(!file) return
  const text = await file.text()
  const [, ...rows] = text.split(/\r?\n/).filter(Boolean)
  rows.forEach(r=>{
    const cols = r.split(',')
    const type = cols[0]
    const date = cols[1]
    const customer = cols[2]
    const phone = cols[3]
    const campaign = cols[4]
    const amount = cols[5]
    const sellerRaw = cols.length >= 8 ? cols[6] : ''
    const notes = cols.length >= 8 ? cols[7] : cols[6]
    if(type==='sale'){
      const c = upsertCustomer({ name: customer||'Sem nome', phone: phone||'' })
      const sellerId =
        SELLERS.find(s=>s.id===String(sellerRaw||'').toLowerCase())?.id ||
        SELLERS.find(s=>s.label.toLowerCase()===String(sellerRaw||'').toLowerCase())?.id ||
        (SELLERS[0]?.id || 'jusepp')
      addSale({ customerId: c.id, occurredAt: date, amount: Number(amount||0), sellerId, paymentMethod: '', notes })
    }else if(type==='investment'){
      addInvestment({ platform:'FACEBOOK', campaign, occurredOn: date, amount: Number(amount||0), notes })
    }
  })
  refreshAll()
  e.target.value = ''
})

qs('#hist-filtrar').addEventListener('click', renderHistory)
qs('#hist-tipo').addEventListener('change', renderHistory)
qs('#hist-from').addEventListener('change', renderHistory)
qs('#hist-to').addEventListener('change', renderHistory)

function boot(){
  ;(async ()=>{
    await loadAuthConfigScript()
    const cfg = getAuthConfig()
    const locked = !cfg || !isAuthed()
    setLocked(locked)

    if(!cfg){
      setError('#login-error', 'Configuração de login em falta. Clique em “Gerar auth-config” e crie auth-config.js.')
      const btn = qs('#login-submit')
      if(btn) btn.disabled = true
    }else{
      const btn = qs('#login-submit')
      if(btn) btn.disabled = false
    }

    qs('#login-form')?.addEventListener('submit', async e=>{
      e.preventDefault()
      setError('#login-error', '')
      const cfg = getAuthConfig()
      if(!cfg){
        setError('#login-error', 'Configuração de login em falta. Clique em “Gerar auth-config” e crie auth-config.js.')
        return
      }
      const user = qs('#login-user')?.value || ''
      const pass = qs('#login-pass')?.value || ''
      const userOk = String(user).trim() === cfg.login
      const passHash = await sha256Hex(pass)
      const passOk = passHash === cfg.passwordSha256
      if(!userOk || !passOk){
        setError('#login-error', 'Login ou senha inválidos.')
        return
      }
      setAuthed(true)
      setLocked(false)
      navTo('dashboard')
      refreshAll()
      qs('#login-pass').value = ''
    })

    if(locked){
      qs('#login-user')?.focus()
      return
    }

    navTo('dashboard')
    qs('#venda-data').value = nowISO()
    qs('#invest-data').value = todayISO()
    refreshAll()
    renderKanban()
  })()
}
boot()
