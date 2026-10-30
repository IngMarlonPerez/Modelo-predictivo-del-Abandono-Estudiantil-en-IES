// ==========================================================================
//  Arranque del sistema completo en Docker con un solo comando:
//    npm run dev            (desde esta carpeta o desde la carpeta superior)
//  1. Verifica Docker; si no está instalado lo instala (winget) y lo inicia.
//  2. Prepara backend/.env (desde .env.example si falta).
//  3. Elige puertos libres: si 3000, 8090 o 14330 están ocupados, usa el siguiente.
//  4. SQL Server: reutiliza el contenedor «vicmar-sqlserver» si ya existe; si
//     no existe (o se borró), lo crea con su volumen de datos.
//     docker compose up --build: API (FastAPI) y web (React).
//  5. Primera vez (base vacía): crea las bases, carga los datos de prueba y
//     califica a los estudiantes con el modelo ganador de los 4 candidatos
//     (RF_PONDERADO, RF_SMOTE, LOGISTICA, LIGHTGBM). No reentrena.
//     Si falta OULAD en datos/externos/oulad, lo descarga del repositorio UCI.
//  6. Muestra las direcciones y abre el navegador.
//  Opciones: --sin-navegador   --local (arranque sin contenedores: iniciar.mjs)
//  Solo usa módulos nativos de Node: no necesita npm install.
//  Autores: Marlon David Pérez Almachi, Víctor Manuel Lluilema Pisco (UNEMI, 2026)
// ==========================================================================
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const BACKEND = join(RAIZ, 'backend')
const ENV = join(BACKEND, '.env')
const WINDOWS = process.platform === 'win32'
const ARGS = process.argv.slice(2)
const ALMACEN = 'ALMACEN_ACADEMICO'
const DIR_OULAD = join(RAIZ, 'datos', 'externos', 'oulad')
// OULAD (Kuzilek et al., 2017), repositorio UCI, DOI 10.24432/C5KK69, licencia CC BY 4.0.
const URL_OULAD = 'https://archive.ics.uci.edu/static/public/349/open+university+learning+analytics+dataset.zip'
const ARCHIVOS_OULAD = ['assessments.csv', 'courses.csv', 'studentAssessment.csv', 'studentInfo.csv',
  'studentRegistration.csv', 'studentVle.csv', 'vle.csv']

const paso = (t) => console.log(`\n\x1b[36m▸ ${t}\x1b[0m`)
const aviso = (t) => console.log(`\x1b[33m! ${t}\x1b[0m`)
const fallar = (t) => {
  console.error(`\n\x1b[31m✖ ${t}\x1b[0m`)
  process.exit(1)
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

if (ARGS.includes('--local')) {
  spawnSync(process.execPath, [join(RAIZ, 'scripts', 'iniciar.mjs')], { stdio: 'inherit' })
  process.exit(0)
}

// docker.exe se invoca sin shell, con los argumentos separados: nada que escapar.
function docker(linea, { mostrar = false, env = process.env } = {}) {
  const args = Array.isArray(linea) ? linea : linea.split(' ')
  const r = spawnSync('docker', args, { cwd: RAIZ, env, encoding: 'utf8', stdio: mostrar ? 'inherit' : 'pipe' })
  return { ok: r.status === 0, salida: (r.stdout ?? '').trim() }
}

// ── 1. Docker ───────────────────────────────────────────────────────────────
async function asegurarDocker() {
  paso('Verificando Docker ...')
  if (!docker('--version').ok) {
    if (!WINDOWS) fallar('Docker no está instalado. Instálelo desde https://docs.docker.com/get-docker/')
    aviso('Docker no está instalado: se instalará Docker Desktop con winget (pedirá permiso de administrador).')
    const r = spawnSync('winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements',
      { shell: true, stdio: 'inherit' })
    if (r.status !== 0) fallar('No se pudo instalar Docker Desktop. Instálelo desde https://www.docker.com/products/docker-desktop/')
    aviso('Docker Desktop quedó instalado. Si Windows pide reiniciar, reinicie y vuelva a ejecutar: npm run dev')
    process.env.PATH += ';C:\\Program Files\\Docker\\Docker\\resources\\bin'
  }
  if (docker('info').ok) return
  const exe = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe'
  if (WINDOWS && existsSync(exe)) {
    console.log('  Iniciando Docker Desktop (puede tardar hasta 3 minutos) ...')
    spawnSync(`start "" "${exe}"`, { shell: true })
  }
  for (let i = 0; i < 60; i++) {
    await esperar(3000)
    if (docker('info').ok) return
  }
  fallar('Docker no respondió. Abra Docker Desktop, espere a que diga «Engine running» y repita: npm run dev')
}

// ── 2. backend/.env ─────────────────────────────────────────────────────────
function leerEnv() {
  const v = {}
  for (const l of readFileSync(ENV, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=(.*)$/)
    if (m && !(m[1] in v)) v[m[1]] = m[2].trim()
  }
  return v
}
function asegurarEnv() {
  if (!existsSync(ENV)) {
    copyFileSync(join(BACKEND, '.env.example'), ENV)
    aviso('Se creó backend/.env desde .env.example.')
  }
  let texto = readFileSync(ENV, 'utf8')
  if (!leerEnv().DB_PASSWORD) {
    // Contraseña de SQL Server con mayúscula, minúscula, dígito y símbolo (no se muestra).
    const clave = 'Vm' + randomBytes(12).toString('hex') + '#9'
    texto = /^DB_PASSWORD=.*$/m.test(texto) ? texto.replace(/^DB_PASSWORD=.*$/m, `DB_PASSWORD=${clave}`) : texto + `\nDB_PASSWORD=${clave}\n`
    writeFileSync(ENV, texto)
    aviso('Se generó DB_PASSWORD en backend/.env (no se muestra).')
  }
  return leerEnv()
}

// ── 3. Puertos libres ───────────────────────────────────────────────────────
function libre(puerto) {
  return new Promise((ok) => {
    const s = createServer()
    s.once('error', () => ok(false))
    s.once('listening', () => s.close(() => ok(true)))
    s.listen(puerto, '0.0.0.0')
  })
}
async function siguienteLibre(desde) {
  for (let p = desde; p < desde + 100; p++) if (await libre(p)) return p
  fallar(`No hay puertos libres desde ${desde}.`)
}
// Si la pila ya está corriendo, se conservan sus puertos.
function puertoActual(servicio, interno) {
  const r = docker(`compose port ${servicio} ${interno}`)
  const m = r.ok && r.salida.match(/:(\d+)\s*$/)
  return m ? Number(m[1]) : null
}
async function elegir(nombre, servicio, interno, preferido) {
  const actual = puertoActual(servicio, interno)
  if (actual) return actual
  const p = await siguienteLibre(preferido)
  if (p !== preferido) aviso(`El puerto ${preferido} (${nombre}) está ocupado: se usará ${p}.`)
  return p
}

// ── 4–6. Arranque ───────────────────────────────────────────────────────────
async function esperarSalud(servicio, segundos) {
  for (let i = 0; i < segundos / 3; i++) {
    const id = docker(`compose ps -q ${servicio}`).salida
    if (id) {
      const estado = docker(['inspect', '-f', '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}', id]).salida
      if (estado === 'healthy') return true
    }
    await esperar(3000)
  }
  return false
}

const SQL = 'vicmar-sqlserver'

// Consulta escalar en el contenedor de SQL Server (la clave va como argumento, no se imprime).
function sqlEscalar(env, consulta) {
  const r = docker(['exec', SQL, '/opt/mssql-tools18/bin/sqlcmd', '-C', '-S', 'localhost', '-U', env.DB_USER || 'sa',
    '-P', env.DB_PASSWORD, '-h', '-1', '-W', '-Q', `SET NOCOUNT ON; ${consulta}`])
  return r.ok ? r.salida.split(/\r?\n/).pop().trim() : null
}
async function esperarSql(env, segundos) {
  for (let i = 0; i < segundos / 3; i++) {
    if (sqlEscalar(env, 'SELECT 1') === '1') return true
    await esperar(3000)
  }
  return false
}

// Descarga OULAD (unos 47 MB comprimidos, 443 MB descomprimidos) si no está en datos/externos/oulad.
async function asegurarOulad() {
  if (ARCHIVOS_OULAD.every((f) => existsSync(join(DIR_OULAD, f)))) return true
  paso('Descargando el conjunto de datos OULAD desde el repositorio UCI (una sola vez) ...')
  const zip = join(RAIZ, 'datos', 'externos', 'oulad.zip')
  try {
    mkdirSync(DIR_OULAD, { recursive: true })
    const r = await fetch(URL_OULAD)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    writeFileSync(zip, Buffer.from(await r.arrayBuffer()))
    // En Windows se usa el tar de System32 (descomprime .zip); el de Git Bash no.
    const tar = WINDOWS ? join(process.env.SystemRoot ?? 'C:/Windows', 'System32', 'tar.exe') : 'tar'
    const descomprimir = WINDOWS ? [tar, ['-xf', zip, '-C', DIR_OULAD]] : ['unzip', ['-oq', zip, '-d', DIR_OULAD]]
    if (spawnSync(...descomprimir, { stdio: 'inherit' }).status !== 0) throw new Error('no se pudo descomprimir')
    rmSync(zip, { force: true })
    if (!ARCHIVOS_OULAD.every((f) => existsSync(join(DIR_OULAD, f)))) throw new Error('faltan archivos tras descomprimir')
    console.log('  OULAD descargado en datos/externos/oulad.')
    return true
  } catch (e) {
    aviso(`No se pudo descargar OULAD (${e.message}). Se continúa solo con UNEMI_PRUEBAS.`)
    return false
  }
}

await asegurarDocker()
const env = asegurarEnv()

// SQL Server: si el contenedor «vicmar-sqlserver» ya existe se reutiliza; si no, se crea.
const proyectoSql = docker(['inspect', '-f', '{{index .Config.Labels "com.docker.compose.project"}}', SQL])
const reutilizar = proyectoSql.ok && proyectoSql.salida !== 'vicmar'

paso('Eligiendo puertos libres ...')
const puertos = {
  VICMAR_PUERTO_WEB: await elegir('web', 'web', 3000, 3000),
  VICMAR_PUERTO_API: await elegir('API', 'api', 8090, 8090),
}
if (reutilizar) {
  console.log(`  Se reutiliza el contenedor existente «${SQL}».`)
  docker(['start', SQL])
  const m = docker(['port', SQL, '1433']).salida.match(/:(\d+)/)
  if (!m) fallar(`El contenedor «${SQL}» no publica el puerto 1433.`)
  puertos.VICMAR_PUERTO_SQL = Number(m[1])
} else {
  puertos.VICMAR_PUERTO_SQL = await elegir('SQL Server', 'sqlserver', 1433, 14330)
}
console.log(`  web ${puertos.VICMAR_PUERTO_WEB} · API ${puertos.VICMAR_PUERTO_API} · SQL Server ${puertos.VICMAR_PUERTO_SQL}`)
const entornoCompose = {
  ...process.env,
  ...Object.fromEntries(Object.entries(puertos).map(([k, v]) => [k, String(v)])),
  DB_PASSWORD: env.DB_PASSWORD,
  ...(reutilizar ? { VICMAR_DB_HOST: `host.docker.internal,${puertos.VICMAR_PUERTO_SQL}` } : { COMPOSE_PROFILES: 'sql' }),
}

if (reutilizar) {
  paso('Esperando a SQL Server ...')
  if (!(await esperarSql(env, 45)))
    fallar(`El contenedor «${SQL}» no acepta la contraseña DB_PASSWORD de backend/.env.
` +
      `  Escriba en DB_PASSWORD la clave de ese contenedor y repita: npm run dev`)
}

paso('Construyendo y levantando los contenedores (la primera vez tarda varios minutos) ...')
if (!docker('compose up -d --build', { mostrar: true, env: entornoCompose }).ok) fallar('docker compose up falló (revise el mensaje anterior).')

paso('Esperando a SQL Server y a la API ...')
if (!(await esperarSql(env, 240))) fallar('SQL Server no quedó listo. Revise: npm run logs')

if (sqlEscalar(env, `SELECT ISNULL(CAST(DB_ID('${ALMACEN}') AS varchar), 'NO')`) === 'NO') {
  paso('Base vacía: creando las bases, cargando los datos de prueba y calificando con el modelo (unos minutos) ...')
  const conOulad = await asegurarOulad()
  const pasos = ['entorno', 'conexion', 'unemi', ...(conOulad ? ['oulad'] : []), 'esquema', 'etl', 'referentes',
    'calificar', 'segmentar', 'usuarios'].join(',')
  // Los reportes aprobados (ml/modelos/*/*.json) se protegen: la carga no debe cambiar cifras del documento.
  const modelos = join(BACKEND, 'ml', 'modelos')
  const copia = join(BACKEND, 'datos_locales', 'reportes_aprobados')
  rmSync(copia, { recursive: true, force: true })
  cpSync(modelos, copia, { recursive: true, filter: (f) => !f.endsWith('.joblib') && !f.endsWith('.csv') })
  const r = docker(`compose exec -T api python -m scripts.pipeline --solo ${pasos}${conOulad ? '' : ' --sin-oulad'}`,
    { mostrar: true, env: entornoCompose })
  cpSync(copia, modelos, { recursive: true })
  if (!r.ok) fallar('La carga inicial falló. Revise backend/datos_locales/pipeline_*.log')
  docker('compose restart api', { env: entornoCompose })
} else {
  console.log('  La base ya tiene datos: no se modifica.')
}
if (!(await esperarSalud('api', 180))) fallar('La API no respondió. Revise: npm run logs')
await esperarSalud('web', 120)

const web = `http://localhost:${puertos.VICMAR_PUERTO_WEB}`
console.log(`
\x1b[32m✔ Sistema VicMar en marcha\x1b[0m
  Aplicación web ........ ${web}
  API (documentación) ... http://localhost:${puertos.VICMAR_PUERTO_API}/docs
  SQL Server ............ localhost,${puertos.VICMAR_PUERTO_SQL}  (usuario sa, clave en backend/.env)
  Usuarios de prueba .... backend/datos_locales/usuarios_demo.local.json
  Ver registros: npm run logs   ·   Detener: npm run stop
`)
if (!ARGS.includes('--sin-navegador')) spawnSync(WINDOWS ? `start "" "${web}"` : `xdg-open ${web}`, { shell: true })
