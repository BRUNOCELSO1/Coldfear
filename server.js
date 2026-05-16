const http = require('http')
const fs = require('fs')
const path = require('path')
const { URL } = require('url')

const ROOT_DIR = path.resolve(process.env.ROOT_DIR || 'dashboard-spa')
const PORT = Number(process.env.PORT || 8080)

function contentType(filePath){
  const ext = path.extname(filePath).toLowerCase()
  if(ext === '.html') return 'text/html; charset=utf-8'
  if(ext === '.css') return 'text/css; charset=utf-8'
  if(ext === '.js') return 'application/javascript; charset=utf-8'
  if(ext === '.json') return 'application/json; charset=utf-8'
  if(ext === '.svg') return 'image/svg+xml'
  if(ext === '.png') return 'image/png'
  if(ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if(ext === '.webp') return 'image/webp'
  if(ext === '.gif') return 'image/gif'
  return 'application/octet-stream'
}

function setNoCache(res){
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
}

function send(res, status, body, headers = {}){
  res.writeHead(status, headers)
  res.end(body)
}

function buildSupabaseConfig(){
  const url = String(process.env.CF_SUPABASE_URL || '').trim()
  const anonKey = String(process.env.CF_SUPABASE_ANON_KEY || '').trim()
  const loginEmail = String(process.env.CF_LOGIN_EMAIL || '').trim()
  const loginAlias = String(process.env.CF_LOGIN_ALIAS || 'BKJ').trim() || 'BKJ'

  if(!url || !anonKey || !loginEmail) return null
  return [
    'window.CF_SUPABASE = {',
    `  url: "${url}",`,
    `  anonKey: "${anonKey}",`,
    `  loginAlias: "${loginAlias}",`,
    `  loginEmail: "${loginEmail}"`,
    '}',
    ''
  ].join('\n')
}

const server = http.createServer((req, res)=>{
  try{
    const u = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const pathname = decodeURIComponent(u.pathname || '/')

    if(pathname === '/health'){
      return send(res, 200, 'ok', { 'Content-Type': 'text/plain; charset=utf-8' })
    }

    if(pathname === '/supabase-config.js'){
      const js = buildSupabaseConfig()
      setNoCache(res)
      return send(
        res,
        js ? 200 : 404,
        js ? js : '/* missing CF_SUPABASE env vars */\n',
        { 'Content-Type': 'application/javascript; charset=utf-8' }
      )
    }

    const rel = pathname === '/' ? '/index.html' : pathname
    const abs = path.resolve(ROOT_DIR, '.' + rel)
    if(!abs.startsWith(ROOT_DIR + path.sep) && abs !== path.join(ROOT_DIR, 'index.html')){
      return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' })
    }

    fs.readFile(abs, (err, buf)=>{
      if(err){
        return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' })
      }
      setNoCache(res)
      send(res, 200, buf, { 'Content-Type': contentType(abs) })
    })
  }catch(_){
    send(res, 500, 'Server error', { 'Content-Type': 'text/plain; charset=utf-8' })
  }
})

server.listen(PORT, '0.0.0.0')
