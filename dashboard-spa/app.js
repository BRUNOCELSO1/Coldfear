import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm'

const PT = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
const TZ = 'Europe/Lisbon'
const qs = (s, el=document) => el.querySelector(s)
const qsa = (s, el=document) => [...el.querySelectorAll(s)]

const DB_KEY = 'cf_data_v1'
let storageMode = 'local'
let supabase = null
let supabaseCfg = null

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
  if(storageMode !== 'local') return { customers: [], sales: [], investments: [] }
  try{
    const parsed = JSON.parse(localStorage.getItem(DB_KEY))
    if(parsed) return parsed
  }catch{}
  const next = { customers: [], sales: [], investments: [] }
  localStorage.setItem(DB_KEY, JSON.stringify(next))
  return next
}
function saveDB(next){
  if(storageMode !== 'local') return
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
let db = normalizeDB({ customers: [], sales: [], investments: [] })

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

function escapeHtml(raw){
  return String(raw ?? '').replace(/[&<>"']/g, c=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[c]))
}

let modalBound = false
function openModal({ title, subtitle, bodyHtml }){
  const modal = qs('#cf-modal')
  if(!modal) return
  qs('#modal-title').textContent = title || 'Detalhes'
  qs('#modal-subtitle').textContent = subtitle || ''
  qs('#modal-body').innerHTML = bodyHtml || ''
  modal.classList.remove('hidden')
  if(!modalBound){
    modalBound = true
    qs('#modal-close')?.addEventListener('click', closeModal)
    modal.addEventListener('click', e=>{
      if(e.target === modal) closeModal()
    })
    document.addEventListener('keydown', e=>{
      if(e.key === 'Escape') closeModal()
    })
  }
}
function closeModal(){
  const modal = qs('#cf-modal')
  if(!modal) return
  modal.classList.add('hidden')
  qs('#modal-body').innerHTML = ''
}
function openCustomerModal(customerId){
  const c = db.customers.find(x=>x.id===customerId)
  if(!c) return
  const stageLabel = (STAGES.find(s=>s.id===c.stage) || STAGES[0]).label
  const sales = db.sales
    .filter(s=>s.customerId===c.id)
    .slice()
    .sort((a,b)=> new Date(b.occurredAt)-new Date(a.occurredAt))
  const total = sales.reduce((a,s)=>a+Number(s.amount||0),0)
  const subtitle = `${stageLabel} · ${c.phone || '—'}`
  const profile = c.profileUrl ? `<a href="${escapeHtml(c.profileUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(c.profileUrl)}</a>` : '—'
  const notes = c.notes ? escapeHtml(c.notes) : '—'
  const tx = sales.length
    ? sales.map(s=>{
        const seller = SELLERS.find(x=>x.id===s.sellerId)?.label || '—'
        const method = s.paymentMethod || '—'
        const when = fmtDateTime(s.occurredAt)
        const sNotes = s.notes ? `<div class="tx-notes">${escapeHtml(s.notes)}</div>` : ''
        return `
          <div class="tx">
            <div class="tx-main">
              <div class="tx-title">${escapeHtml(c.name)}</div>
              <div class="tx-sub">
                <span class="chip">${escapeHtml(seller)}</span>
                <span class="chip">${escapeHtml(method)}</span>
                <span>${escapeHtml(when)}</span>
              </div>
              ${sNotes}
            </div>
            <div class="tx-amount">${escapeHtml(fmtMoney(s.amount))}</div>
          </div>
        `
      }).join('')
    : `<div class="meta">Sem vendas registradas para este cliente.</div>`
  openModal({
    title: c.name,
    subtitle,
    bodyHtml: `
      <div class="detail-grid">
        <div class="detail-field">
          <div class="detail-label">Telemóvel</div>
          <div class="detail-value">${escapeHtml(c.phone || '—')}</div>
        </div>
        <div class="detail-field">
          <div class="detail-label">Origem</div>
          <div class="detail-value">${escapeHtml(c.source || '—')}</div>
        </div>
        <div class="detail-field">
          <div class="detail-label">Etapa</div>
          <div class="detail-value">${escapeHtml(stageLabel)}</div>
        </div>
        <div class="detail-field" style="grid-column: span 3;">
          <div class="detail-label">Perfil</div>
          <div class="detail-value">${profile}</div>
        </div>
        <div class="detail-field" style="grid-column: span 3;">
          <div class="detail-label">Notas</div>
          <div class="detail-value">${notes}</div>
        </div>
      </div>

      <div class="detail-block">
        <p class="detail-block-title">Resumo</p>
        <div class="meta">
          <span>Vendas: <strong>${sales.length}</strong></span>
          <span>Total: <strong>${escapeHtml(fmtMoney(total))}</strong></span>
        </div>
      </div>

      <div class="detail-block">
        <p class="detail-block-title">Histórico de vendas</p>
        ${tx}
      </div>
    `
  })
}

function openSaleModal(saleId){
  const s = db.sales.find(x=>x.id===saleId)
  if(!s) return
  const c = db.customers.find(x=>x.id===s.customerId)
  const seller = SELLERS.find(x=>x.id===s.sellerId)?.label || '—'
  const method = s.paymentMethod || '—'
  const when = fmtDateTime(s.occurredAt)
  const stageLabel = c ? (STAGES.find(x=>x.id===c.stage) || STAGES[0]).label : '—'
  const profile = c?.profileUrl ? `<a href="${escapeHtml(c.profileUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(c.profileUrl)}</a>` : '—'
  const cNotes = c?.notes ? escapeHtml(c.notes) : '—'
  const sNotes = s.notes ? escapeHtml(s.notes) : '—'

  openModal({
    title: 'Venda',
    subtitle: `${when} · ${seller}`,
    bodyHtml: `
      <div class="row">
        <button type="button" class="btn danger" id="modal-del-sale">Remover</button>
      </div>
      <div class="detail-grid">
        <div class="detail-field">
          <div class="detail-label">Cliente</div>
          <div class="detail-value">${c ? `<button type="button" class="link-btn" id="modal-open-customer">${escapeHtml(c.name)}</button>` : '—'}</div>
        </div>
        <div class="detail-field">
          <div class="detail-label">Telemóvel</div>
          <div class="detail-value">${escapeHtml(c?.phone || '—')}</div>
        </div>
        <div class="detail-field">
          <div class="detail-label">Etapa</div>
          <div class="detail-value">${escapeHtml(stageLabel)}</div>
        </div>

        <div class="detail-field">
          <div class="detail-label">Valor</div>
          <div class="detail-value">${escapeHtml(fmtMoney(s.amount))}</div>
        </div>
        <div class="detail-field">
          <div class="detail-label">Método</div>
          <div class="detail-value">${escapeHtml(method)}</div>
        </div>
        <div class="detail-field">
          <div class="detail-label">Sócio</div>
          <div class="detail-value">${escapeHtml(seller)}</div>
        </div>

        <div class="detail-field" style="grid-column: span 3;">
          <div class="detail-label">Perfil</div>
          <div class="detail-value">${profile}</div>
        </div>
        <div class="detail-field" style="grid-column: span 3;">
          <div class="detail-label">Notas da venda</div>
          <div class="detail-value">${sNotes}</div>
        </div>
        <div class="detail-field" style="grid-column: span 3;">
          <div class="detail-label">Notas do cliente</div>
          <div class="detail-value">${cNotes}</div>
        </div>
      </div>
    `
  })

  if(c){
    document.getElementById('modal-open-customer')?.addEventListener('click', ()=>{
      closeModal()
      openCustomerModal(c.id)
    })
  }
  document.getElementById('modal-del-sale')?.addEventListener('click', async ()=>{
    const ok = confirm('Remover esta venda?')
    if(!ok) return
    try{
      await deleteSale(saleId)
      closeModal()
      refreshAll()
    }catch(err){}
  })
}

const AUTH_KEY = 'cf_auth_v1'
const SELLER_PREF_KEY = 'cf_seller_pref_v1'
let sellerSelectedId = ''
function isAuthed(){
  try{ return sessionStorage.getItem(AUTH_KEY) === '1' }catch{ return false }
}
function setAuthed(value){
  try{
    if(value) sessionStorage.setItem(AUTH_KEY, '1')
    else sessionStorage.removeItem(AUTH_KEY)
  }catch{}
}
function getSellerPref(){
  try{ return localStorage.getItem(SELLER_PREF_KEY) || '' }catch{ return '' }
}
function setSellerPref(id){
  try{ localStorage.setItem(SELLER_PREF_KEY, String(id||'')) }catch{}
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

function loadSupabaseConfigScript(){
  if(window.CF_SUPABASE && typeof window.CF_SUPABASE === 'object') return Promise.resolve(true)
  return new Promise(resolve=>{
    const existing = document.querySelector('script[data-supabase-config]')
    if(existing) return resolve(window.CF_SUPABASE && typeof window.CF_SUPABASE === 'object')
    const s = document.createElement('script')
    s.src = './supabase-config.js'
    s.defer = true
    s.dataset.supabaseConfig = '1'
    s.onload = () => resolve(window.CF_SUPABASE && typeof window.CF_SUPABASE === 'object')
    s.onerror = () => resolve(false)
    document.head.appendChild(s)
  })
}
function getSupabaseConfig(){
  const cfg = window.CF_SUPABASE
  if(!cfg || typeof cfg !== 'object') return null
  const url = String(cfg.url||'').trim()
  const anonKey = String(cfg.anonKey||'').trim()
  const loginAlias = String(cfg.loginAlias||'').trim()
  const loginEmail = String(cfg.loginEmail||'').trim()
  if(!url || !anonKey) return null
  return { url, anonKey, loginAlias, loginEmail }
}
async function initStorage(){
  await loadSupabaseConfigScript()
  const cfg = getSupabaseConfig()
  if(cfg){
    storageMode = 'supabase'
    supabaseCfg = cfg
    supabase = createClient(cfg.url, cfg.anonKey)
  }else{
    const host = String(window.location?.hostname || '').toLowerCase()
    const isDevHost = host === 'localhost' || host === '127.0.0.1' || host === '::1'
    if(!isDevHost){
      storageMode = 'supabase_required'
      supabaseCfg = null
      supabase = null
      return
    }
    storageMode = 'local'
    supabaseCfg = null
    supabase = null
    db = normalizeDB(loadDB())
    saveDB(db)
  }
}
function resolveLoginEmail(rawLogin){
  const login = String(rawLogin||'').trim()
  if(!supabaseCfg) return login
  if(supabaseCfg.loginAlias && login === supabaseCfg.loginAlias && supabaseCfg.loginEmail) return supabaseCfg.loginEmail
  if(login.includes('@')) return login
  if(supabaseCfg.loginEmail) return supabaseCfg.loginEmail
  return login
}
async function getRemoteSession(){
  if(storageMode !== 'supabase' || !supabase) return null
  const { data } = await supabase.auth.getSession()
  return data?.session || null
}
async function remoteSignIn(login, password){
  const email = resolveLoginEmail(login)
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if(error) throw error
}
async function remoteSignOut(){
  if(storageMode !== 'supabase' || !supabase) return
  await supabase.auth.signOut()
}
let remoteSyncTimer = null
let remoteSyncBound = false
async function remoteSyncOnce(){
  try{
    if(storageMode !== 'supabase' || !supabase) return
    if(document.hidden) return
    const s = await getRemoteSession()
    if(!s) return
    await pullRemoteDB()
    refreshAll()
  }catch{}
}
function startRemoteSync(){
  if(storageMode !== 'supabase' || !supabase) return
  if(!remoteSyncBound){
    document.addEventListener('visibilitychange', remoteSyncOnce)
    remoteSyncBound = true
  }
  if(remoteSyncTimer) return
  remoteSyncTimer = setInterval(remoteSyncOnce, 5000)
}
function stopRemoteSync(){
  if(remoteSyncTimer){
    clearInterval(remoteSyncTimer)
    remoteSyncTimer = null
  }
}
function formatSupabaseAuthError(err){
  const msg = String(err?.message || 'Falha ao autenticar.')
  const status = err?.status ? ` (status ${err.status})` : ''
  const name = err?.name ? ` — ${err.name}` : ''
  return `${msg}${status}${name}`
}
function mapCustomerRow(r){
  return {
    id: r.id,
    name: String(r.name||'').trim() || 'Sem nome',
    phone: String(r.phone||'').trim(),
    source: r.source || 'Facebook',
    profileUrl: r.profile_url || '',
    notes: r.notes || '',
    stage: STAGES.some(s=>s.id===r.stage) ? r.stage : 'novo',
    createdAt: r.created_at || new Date().toISOString(),
    movedAt: r.moved_at ? new Date(r.moved_at).getTime() : null
  }
}
function mapSaleRow(r){
  return {
    id: r.id,
    customerId: r.customer_id,
    occurredAt: r.occurred_at || new Date().toISOString(),
    amount: Number(r.amount||0),
    sellerId: SELLERS.some(x=>x.id===r.seller_id) ? r.seller_id : (SELLERS[0]?.id || 'jusepp'),
    paymentMethod: r.payment_method || '',
    notes: r.notes || '',
    createdAt: r.created_at || new Date().toISOString()
  }
}
function mapInvestmentRow(r){
  return {
    id: r.id,
    platform: r.platform || 'FACEBOOK',
    campaign: r.campaign || '',
    occurredOn: r.occurred_on || todayISO(),
    amount: Number(r.amount||0),
    notes: r.notes || '',
    createdAt: r.created_at || new Date().toISOString()
  }
}
async function pullRemoteDB(){
  if(storageMode !== 'supabase' || !supabase) return
  const [{ data: customers, error: e1 }, { data: sales, error: e2 }, { data: investments, error: e3 }] = await Promise.all([
    supabase.from('customers').select('*').limit(5000),
    supabase.from('sales').select('*').limit(10000),
    supabase.from('investments').select('*').limit(10000)
  ])
  if(e1) throw e1
  if(e2) throw e2
  if(e3) throw e3
  db = normalizeDB({
    customers: (customers || []).map(mapCustomerRow),
    sales: (sales || []).map(mapSaleRow),
    investments: (investments || []).map(mapInvestmentRow)
  })
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

qs('#btn-refresh')?.addEventListener('click', async ()=>{
  try{
    if(storageMode === 'supabase'){
      const session = await getRemoteSession()
      if(session) await pullRemoteDB()
    }
  }catch{}
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

async function upsertCustomer({name, phone, source, profileUrl, notes, stage}){
  const nextName = String(name||'').trim() || 'Sem nome'
  const nextPhone = String(phone||'').trim()
  const phoneKey = normalizePhone(nextPhone)
  if(phoneKey){
    const exists = db.customers.find(c => normalizePhone(c.phone) === phoneKey)
    if(exists) return exists
  }
  if(storageMode === 'supabase' && supabase){
    const row = {
      name: nextName,
      phone: nextPhone || null,
      source: source || 'Facebook',
      profile_url: profileUrl || null,
      notes: notes || null,
      stage: STAGES.some(s=>s.id===stage) ? stage : 'novo'
    }
    const { data, error } = await supabase.from('customers').insert(row).select('*').single()
    if(error) throw error
    const c = mapCustomerRow(data)
    db.customers.push(c)
    return c
  }else{
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
}
async function addSale({customerId, quickCustomer, occurredAt, amount, sellerId, paymentMethod, notes}){
  let cId = customerId
  if(!cId && quickCustomer){
    const c = await upsertCustomer({
      name: quickCustomer.name || 'Sem nome',
      phone: quickCustomer.phone || '',
      stage: 'novo'
    })
    cId = c.id
  }
  if(storageMode === 'supabase' && supabase){
    const row = {
      customer_id: cId,
      occurred_at: occurredAt || new Date().toISOString(),
      amount: Number(amount||0),
      seller_id: SELLERS.some(x=>x.id===sellerId) ? sellerId : (SELLERS[0]?.id || 'jusepp'),
      payment_method: paymentMethod || null,
      notes: notes || null
    }
    const { data, error } = await supabase.from('sales').insert(row).select('*').single()
    if(error) throw error
    const s = mapSaleRow(data)
    db.sales.push(s)
    return s
  }else{
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
}
async function addInvestment({platform, campaign, occurredOn, amount, notes}){
  if(storageMode === 'supabase' && supabase){
    const row = {
      platform: platform || 'FACEBOOK',
      campaign: campaign || null,
      occurred_on: occurredOn || todayISO(),
      amount: Number(amount||0),
      notes: notes || null
    }
    const { data, error } = await supabase.from('investments').insert(row).select('*').single()
    if(error) throw error
    const inv = mapInvestmentRow(data)
    db.investments.push(inv)
    return inv
  }else{
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
}

async function updateCustomerName(customerId, nextName){
  const c = db.customers.find(c=>c.id===customerId)
  if(!c) return
  c.name = nextName
  if(storageMode === 'supabase' && supabase){
    const { error } = await supabase.from('customers').update({ name: nextName }).eq('id', customerId)
    if(error) throw error
  }else{
    saveDB(db)
  }
}
async function deleteSale(id){
  db.sales = db.sales.filter(x=>x.id!==id)
  if(storageMode === 'supabase' && supabase){
    const { error } = await supabase.from('sales').delete().eq('id', id)
    if(error) throw error
  }else{
    saveDB(db)
  }
}
async function deleteInvestment(id){
  db.investments = db.investments.filter(x=>x.id!==id)
  if(storageMode === 'supabase' && supabase){
    const { error } = await supabase.from('investments').delete().eq('id', id)
    if(error) throw error
  }else{
    saveDB(db)
  }
}
async function deleteCustomerAndSales(customerId){
  const saleIds = db.sales.filter(s=>s.customerId===customerId).map(s=>s.id)
  db.sales = db.sales.filter(s=>s.customerId!==customerId)
  db.customers = db.customers.filter(c=>c.id!==customerId)
  if(storageMode === 'supabase' && supabase){
    if(saleIds.length){
      const { error: e1 } = await supabase.from('sales').delete().in('id', saleIds)
      if(e1) throw e1
    }
    const { error: e2 } = await supabase.from('customers').delete().eq('id', customerId)
    if(e2) throw e2
  }else{
    saveDB(db)
  }
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
  if(pSel==='today'){
    const d = new Date()
    from = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    to = new Date(d.getFullYear(), d.getMonth(), d.getDate()+1)
  }else if(pSel==='yesterday'){
    const d = new Date()
    from = new Date(d.getFullYear(), d.getMonth(), d.getDate()-1)
    to = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }else if(pSel==='7'){
    from = new Date(Date.now()-7*86400000)
  }else if(pSel==='30'){
    from = new Date(Date.now()-30*86400000)
  }else if(pSel==='mes'){
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
  renderChart(m)
  renderRecent(m)
}

let chart
function renderChart(m){
  const maxDays = 120
  const end = m?.to ? new Date(m.to) : new Date()
  let start = m?.from ? new Date(m.from) : new Date(Date.now()-29*86400000)
  start.setHours(12,0,0,0)
  end.setHours(12,0,0,0)
  const rangeDays = Math.floor((end.getTime()-start.getTime())/86400000)+1
  if(rangeDays > maxDays){
    start = new Date(end.getTime() - (maxDays-1)*86400000)
    start.setHours(12,0,0,0)
  }

  const days = []
  for(let t=start.getTime(); t<=end.getTime() && days.length<maxDays; t+=86400000){
    days.push(new Date(t).toISOString().slice(0,10))
  }

  const dayTotals = new Map()
  ;(m?.sales || db.sales).forEach(s=>{
    const k = dayKeyFromISO(s.occurredAt)
    dayTotals.set(k, (dayTotals.get(k)||0) + Number(s.amount||0))
  })
  const series = days.map(d=> dayTotals.get(d) || 0)
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
  if(!sel.options.length){
    sel.innerHTML = SELLERS.map(s=>`<option value="${s.id}">${s.label}</option>`).join('')
  }
  if(!sellerSelectedId){
    const pref = getSellerPref()
    sellerSelectedId = (pref && SELLERS.some(s=>s.id===pref)) ? pref : (SELLERS[0]?.id || 'jusepp')
  }
  if(!sel.dataset.prefBound){
    sel.dataset.prefBound = '1'
    sel.addEventListener('change', ()=>{
      sellerSelectedId = sel.value
      setSellerPref(sellerSelectedId)
    })
  }
  if(SELLERS.some(s=>s.id===sellerSelectedId)) sel.value = sellerSelectedId
}

function renderClientes(list=db.customers){
  const el = qs('#clientes-list')
  el.innerHTML = ''
  list
    .slice()
    .sort((a,b)=> (a.name||'').localeCompare(b.name||''))
    .forEach(c=>{
      const div = document.createElement('div')
      div.className='item clickable'
      const stageLabel = (STAGES.find(s=>s.id===c.stage) || STAGES[0]).label
      const csales = db.sales.filter(s=>s.customerId===c.id)
      const csalesCount = csales.length
      const csalesTotal = csales.reduce((a,s)=>a+Number(s.amount||0),0)
      div.innerHTML = `
        <div>
          <div><strong>${c.name}</strong></div>
          <div class="meta">
            <span>${c.phone || '—'}</span>
            <span>${c.source || '—'}</span>
            <span class="chip">${stageLabel}</span>
            <span class="chip">${csalesCount} vendas</span>
            <span class="chip">${fmtMoney(csalesTotal)}</span>
          </div>
        </div>
        <div class="row">
          <button data-edit="${c.id}" class="btn">Editar</button>
          <button data-del="${c.id}" class="btn danger">Remover</button>
        </div>
      `
      div.addEventListener('click', e=>{
        if(e.target.closest('button')) return
        openCustomerModal(c.id)
      })
      div.querySelector('[data-del]').addEventListener('click', async ()=>{
        const ok = confirm('Remover cliente e as vendas associadas?')
        if(!ok) return
        setError('#cliente-error', '')
        try{
          await deleteCustomerAndSales(c.id)
          refreshAll()
        }catch(err){
          setError('#cliente-error', err?.message || 'Erro ao remover cliente.')
        }
      })
      div.querySelector('[data-edit]').addEventListener('click', async ()=>{
        const next = prompt('Editar nome completo:', c.name)
        if(next===null) return
        const v = validateFullName(next)
        if(!v.ok){
          setError('#cliente-error', v.message)
          return
        }
        setError('#cliente-error', '')
        try{
          await updateCustomerName(c.id, v.value)
          refreshAll()
        }catch(err){
          setError('#cliente-error', err?.message || 'Erro ao atualizar cliente.')
        }
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
    div.className='item clickable'
    div.innerHTML = `
      <div>
        <div><strong>${fmtMoney(s.amount)}</strong> <span class="chip">${seller}</span> <span class="chip">${s.paymentMethod || '—'}</span></div>
        <div class="meta"><span>${c?c.name:'Cliente'}</span><span>${fmtDateTime(s.occurredAt)}</span></div>
      </div>
      <div class="row">
        <button data-open="${s.id}" class="btn">Detalhes</button>
        <button data-del="${s.id}" class="btn danger">Remover</button>
      </div>
    `
    div.addEventListener('click', e=>{
      if(e.target.closest('button')) return
      openSaleModal(s.id)
    })
    div.querySelector('[data-open]')?.addEventListener('click', e=>{
      e.stopPropagation()
      openSaleModal(s.id)
    })
    div.querySelector('[data-del]').addEventListener('click', async ()=>{
      try{
        await deleteSale(s.id)
        renderVendas()
        updateKPIs()
      }catch(err){}
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
    div.querySelector('[data-del]').addEventListener('click', async ()=>{
      try{
        await deleteInvestment(i.id)
        renderInvestimentos()
        updateKPIs()
      }catch(err){}
    })
    el.appendChild(div)
  })
}

const pipelineState = {
  query: '',
  limitByStage: Object.fromEntries(STAGES.map(s=>[s.id, 40])),
  editingId: null
}

async function setCustomerStage(customerId, stageId){
  const c = db.customers.find(c=>c.id===customerId)
  if(!c) return
  if(!STAGES.some(s=>s.id===stageId)) return
  c.stage = stageId
  c.movedAt = Date.now()
  if(storageMode === 'supabase' && supabase){
    const { error } = await supabase
      .from('customers')
      .update({ stage: stageId, moved_at: new Date().toISOString() })
      .eq('id', customerId)
    if(error) throw error
  }else{
    saveDB(db)
  }
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
    body.addEventListener('drop', async e=>{
      e.preventDefault()
      body.classList.remove('over')
      const id = e.dataTransfer.getData('text/plain')
      if(!id) return
      setError('#pipeline-error', '')
      try{
        await setCustomerStage(id, stage.id)
        refreshAll({kanbanOnly:true})
      }catch(err){
        setError('#pipeline-error', err?.message || 'Erro ao mover cliente.')
      }
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

  card.addEventListener('click', e=>{
    if(card.classList.contains('dragging')) return
    if(e.target.closest('button, select, input, textarea, a')) return
    openCustomerModal(customer.id)
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

    saveBtn.addEventListener('click', async ()=>{
      const v = validateFullName(nameInput.value)
      if(!v.ok){
        setError('#pipeline-error', v.message)
        return
      }
      setError('#pipeline-error', '')
      try{
        await updateCustomerName(customer.id, v.value)
        pipelineState.editingId = null
        refreshAll({kanbanOnly:true})
      }catch(err){
        setError('#pipeline-error', err?.message || 'Erro ao atualizar cliente.')
      }
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
  const csales = db.sales.filter(s=>s.customerId===customer.id)
  const csalesCount = csales.length
  const csalesTotal = csales.reduce((a,s)=>a+Number(s.amount||0),0)
  const chipCount = document.createElement('span')
  chipCount.className = 'chip'
  chipCount.textContent = `${csalesCount} vendas`
  const chipTotal = document.createElement('span')
  chipTotal.className = 'chip'
  chipTotal.textContent = fmtMoney(csalesTotal)
  meta.appendChild(chipCount)
  meta.appendChild(chipTotal)

  const actions = document.createElement('div')
  actions.className = 'lead-actions'

  const mover = document.createElement('select')
  mover.className = 'select-sm'
  mover.setAttribute('aria-label', 'Mover cliente para etapa')
  mover.innerHTML = STAGES.map(s=>`<option value="${s.id}" ${s.id===customer.stage?'selected':''}>${s.label}</option>`).join('')
  mover.addEventListener('change', async ()=>{
    setError('#pipeline-error', '')
    try{
      await setCustomerStage(customer.id, mover.value)
      refreshAll({kanbanOnly:true})
    }catch(err){
      setError('#pipeline-error', err?.message || 'Erro ao mover cliente.')
    }
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
  delBtn.addEventListener('click', async ()=>{
    const ok = confirm('Remover este cliente?')
    if(!ok) return
    setError('#pipeline-error', '')
    try{
      await deleteCustomerAndSales(customer.id)
      refreshAll()
    }catch(err){
      setError('#pipeline-error', err?.message || 'Erro ao remover cliente.')
    }
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

qs('#form-cliente').addEventListener('submit', async e=>{
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

  try{
    await upsertCustomer({ name: v.value, phone, source, profileUrl, notes, stage: 'novo' })
    e.target.reset()
    refreshAll()
  }catch(err){
    setError('#cliente-error', err?.message || 'Erro ao guardar cliente.')
  }
})

qs('#cliente-limpar').addEventListener('click', ()=>{
  qs('#form-cliente').reset()
  setError('#cliente-error', '')
})

qs('#form-venda').addEventListener('submit', async e=>{
  e.preventDefault()
  setError('#venda-error', '')
  const customerNameRaw = qs('#venda-cliente-nome').value
  populateSociosSelect()
  const sellerId = qs('#venda-socio').value
  const quickPhone = qs('#venda-quick-telemovel').value.trim()
  const occurredOn = qs('#venda-data').value
  const occurredAt = occurredOn ? dateFromYMD(occurredOn).toISOString() : new Date().toISOString()
  const amountRaw = qs('#venda-valor').value
  const amount = amountRaw==='' ? 0 : Number(amountRaw)
  const paymentMethod = qs('#venda-metodo').value.trim()
  const notes = qs('#venda-notas').value.trim()

  if(Number.isNaN(amount) || amount < 0){
    setError('#venda-error', 'Valor da venda inválido.')
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
  try{
    const customerId = existing ? existing.id : (await upsertCustomer({ name: customerName, phone: quickPhone, stage: 'novo' })).id
    await addSale({ customerId, quickCustomer: null, occurredAt, amount, sellerId, paymentMethod, notes })
    e.target.reset()
    qs('#venda-cliente-nome').value = ''
    qs('#venda-data').value = todayISO()
    populateSociosSelect()
    refreshAll()
  }catch(err){
    setError('#venda-error', err?.message || 'Erro ao guardar venda.')
  }
})

qs('#venda-limpar').addEventListener('click', ()=>{
  qs('#form-venda').reset()
  qs('#venda-cliente-nome').value = ''
  qs('#venda-data').value = todayISO()
  populateSociosSelect()
  setError('#venda-error', '')
})

qs('#form-invest').addEventListener('submit', async e=>{
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

  try{
    await addInvestment({ platform, campaign, occurredOn, amount, notes })
    e.target.reset()
    qs('#invest-data').value = todayISO()
    refreshAll()
  }catch(err){
    setError('#invest-error', err?.message || 'Erro ao guardar investimento.')
  }
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

qs('#pipeline-add-btn').addEventListener('click', async ()=>{
  setError('#pipeline-error', '')
  const raw = qs('#pipeline-add-name').value
  const v = validateFullName(raw)
  if(!v.ok){
    setError('#pipeline-error', v.message)
    return
  }
  try{
    await upsertCustomer({ name: v.value, phone: '', stage: 'novo' })
    qs('#pipeline-add-name').value = ''
    refreshAll()
  }catch(err){
    setError('#pipeline-error', err?.message || 'Erro ao adicionar cliente.')
  }
})

qs('#pipeline-reset').addEventListener('click', async ()=>{
  setError('#pipeline-error', '')
  try{
    db.customers.forEach(c=>{ c.stage='novo'; c.movedAt=null })
    if(storageMode === 'supabase' && supabase){
      const { error } = await supabase
        .from('customers')
        .update({ stage: 'novo', moved_at: null })
        .neq('id', '00000000-0000-0000-0000-000000000000')
      if(error) throw error
    }else{
      saveDB(db)
    }
    STAGES.forEach(s=> pipelineState.limitByStage[s.id] = 40)
    refreshAll()
  }catch(err){
    setError('#pipeline-error', err?.message || 'Erro ao redefinir funil.')
  }
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
            <div class="meta">
              <span>${c ? `<button type="button" class="link-btn" data-open-customer="${c.id}">${escapeHtml(c.name)}</button>` : 'Cliente'}</span>
              <span>${fmtDateTime(x.sale.occurredAt)}</span>
            </div>
          </div>
          <div class="row">
            <span class="chip">${x.sale.paymentMethod || '—'}</span>
            <button type="button" class="btn" data-open-sale="${x.sale.id}">Detalhes</button>
          </div>
        `
        div.classList.add('clickable')
        div.addEventListener('click', e=>{
          if(e.target.closest('button')) return
          openSaleModal(x.sale.id)
        })
        div.querySelector('[data-open-sale]')?.addEventListener('click', e=>{
          e.stopPropagation()
          openSaleModal(x.sale.id)
        })
        div.querySelector('[data-open-customer]')?.addEventListener('click', e=>{
          e.stopPropagation()
          openCustomerModal(e.target.getAttribute('data-open-customer'))
        })
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
  for(const r of rows){
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
      const c = await upsertCustomer({ name: customer||'Sem nome', phone: phone||'' })
      const sellerId =
        SELLERS.find(s=>s.id===String(sellerRaw||'').toLowerCase())?.id ||
        SELLERS.find(s=>s.label.toLowerCase()===String(sellerRaw||'').toLowerCase())?.id ||
        (SELLERS[0]?.id || 'jusepp')
      await addSale({ customerId: c.id, occurredAt: date, amount: Number(amount||0), sellerId, paymentMethod: '', notes })
    }else if(type==='investment'){
      await addInvestment({ platform:'FACEBOOK', campaign, occurredOn: date, amount: Number(amount||0), notes })
    }
  }
  refreshAll()
  e.target.value = ''
})

qs('#hist-filtrar').addEventListener('click', renderHistory)
qs('#hist-tipo').addEventListener('change', renderHistory)
qs('#hist-from').addEventListener('change', renderHistory)
qs('#hist-to').addEventListener('change', renderHistory)

function boot(){
  ;(async ()=>{
    await initStorage()

    if(storageMode === 'supabase_required'){
      setLocked(true)
      setError('#login-error', 'Supabase não está configurado neste link. No Railway, adicione CF_SUPABASE_URL, CF_SUPABASE_ANON_KEY, CF_LOGIN_EMAIL (e CF_LOGIN_ALIAS) e faça Redeploy. Depois confirme se /supabase-config.js abre no navegador.')
      const btn = qs('#login-submit')
      if(btn) btn.disabled = true
      return
    }

    if(storageMode === 'supabase'){
      const loginInput = qs('#login-user')
      if(loginInput && supabaseCfg?.loginAlias && !loginInput.value) loginInput.value = supabaseCfg.loginAlias

      const session = await getRemoteSession()
      const locked = !session
      setLocked(locked)

      const btn = qs('#login-submit')
      if(btn) btn.disabled = false

      qs('#login-form')?.addEventListener('submit', async e=>{
        e.preventDefault()
        setError('#login-error', '')
        const user = qs('#login-user')?.value || ''
        const pass = qs('#login-pass')?.value || ''
        try{
          await remoteSignIn(user, pass)
          await pullRemoteDB()
          setLocked(false)
          navTo('dashboard')
          qs('#venda-data').value = todayISO()
          qs('#invest-data').value = todayISO()
          refreshAll()
          qs('#login-pass').value = ''
          startRemoteSync()
        }catch(err){
          setError('#login-error', formatSupabaseAuthError(err))
        }
      })

      if(locked){
        qs('#login-user')?.focus()
        return
      }

      await pullRemoteDB()
      navTo('dashboard')
      qs('#venda-data').value = todayISO()
      qs('#invest-data').value = todayISO()
      refreshAll()
      renderKanban()
      startRemoteSync()
      return
    }

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
      qs('#venda-data').value = todayISO()
      qs('#invest-data').value = todayISO()
      refreshAll()
      qs('#login-pass').value = ''
    })

    if(locked){
      qs('#login-user')?.focus()
      return
    }

    navTo('dashboard')
    qs('#venda-data').value = todayISO()
    qs('#invest-data').value = todayISO()
    refreshAll()
    renderKanban()
  })()
}
boot()
