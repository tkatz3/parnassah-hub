// ─── ParnassaHub Supabase Client ───────────────────────────
const SUPABASE_URL = 'https://pfxsmjcogscvccjygpwj.supabase.co'
const SUPABASE_KEY = 'sb_publishable_R4eY_tjJV1oDTMjVbFiE7g_lSgEosiR'

const { createClient } = supabase
const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── Auth helpers ───────────────────────────────────────────

async function getCurrentUser() {
  const { data: { user } } = await sb.auth.getUser()
  return user
}

async function getCurrentProfile() {
  const user = await getCurrentUser()
  if (!user) return null
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).single()
  return data
}

async function requireAuth(redirectTo = 'signup.html') {
  const user = await getCurrentUser()
  if (!user) { window.location.href = redirectTo; return null }
  return user
}

async function requireRole(role, redirectTo = 'index.html') {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== role) { window.location.href = redirectTo; return null }
  return profile
}

async function signOut() {
  await sb.auth.signOut()
  window.location.href = 'index.html'
}

// ─── Display helpers ────────────────────────────────────────

function vacancyBadge(type) {
  const map = {
    'Full Time':  'bg-green-50 text-green-700',
    'Part-Time':  'bg-purple-50 text-purple-700',
    'Commission': 'bg-amber-50 text-amber-700',
    'Volunteer':  'bg-blue-50 text-blue-700',
  }
  const cls = map[type] || 'bg-gray-100 text-gray-600'
  return `<span class="text-xs font-semibold px-2.5 py-1 ${cls} rounded-full">${type}</span>`
}

function formatSalary(min, max, type) {
  if (type === 'Commission') return 'Commission-based'
  if (type === 'Volunteer')  return 'Volunteer'
  if (!min && !max)          return 'Salary not listed'
  const fmt = n => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min)        return `${fmt(min)}+`
  return `Up to ${fmt(max)}`
}

function initials(name) {
  if (!name) return '??'
  return name.trim().split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase()
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Job card HTML (used on index + find-jobs) ───────────────

function jobCardHTML(job, compact = false) {
  const company = job.companies?.name || 'Unknown Company'
  const abbr    = initials(company)
  const salary  = formatSalary(job.salary_min, job.salary_max, job.vacancy_type)
  const ago     = job.posted_at
    ? new Date(job.posted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : timeAgo(job.created_at)

  if (compact) {
    // 3-col card for index.html
    return `
    <article class="card-hover bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3">
      <div class="flex items-start justify-between gap-3">
        <div class="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 text-sm font-bold text-gray-500">${abbr}</div>
        ${vacancyBadge(job.vacancy_type)}
      </div>
      <div>
        <h3 class="font-semibold text-gray-900 mb-0.5">${job.title}</h3>
        <p class="text-sm text-gray-500">${company}</p>
      </div>
      <div class="flex flex-wrap gap-2 text-xs text-gray-500">
        <span class="flex items-center gap-1">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
          ${job.location}
        </span>
        <span class="flex items-center gap-1">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/></svg>
          ${salary}
        </span>
      </div>
      <a href="find-jobs.html?job=${job.id}" class="mt-auto inline-flex items-center justify-center gap-1.5 text-sm font-medium text-brand-500 hover:text-brand-600 border border-brand-200 hover:border-brand-400 rounded-xl py-2.5 transition">View Position</a>
    </article>`
  }

  // Full horizontal card for find-jobs.html
  return `
  <article class="card-hover bg-white border border-gray-200 rounded-2xl p-5 cursor-pointer" data-job-id="${job.id}" onclick="openJobModal('${job.id}')">
    <div class="flex items-start gap-4">
      <div class="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center shrink-0 text-sm font-bold text-brand-600">${abbr}</div>
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 class="font-semibold text-gray-900 mb-0.5">${job.title}</h3>
            <p class="text-sm text-gray-500">${company}</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            ${vacancyBadge(job.vacancy_type)}
            <button onclick="event.stopPropagation(); toggleSave('${job.id}', this)" class="save-btn w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-300 transition-all duration-150 hover:border-brand-400 hover:text-brand-400 hover:bg-brand-50 hover:scale-110" data-job-id="${job.id}" aria-label="Save job" title="Save job">
              <svg class="w-4 h-4 save-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
            </button>
          </div>
        </div>
        <div class="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
          <span class="flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
            ${job.location}
          </span>
          <span class="flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/></svg>
            ${salary}
          </span>
          <span class="flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2h2z"/></svg>
            ${job.category}
          </span>
          <span class="text-gray-400 ml-auto">${ago}</span>
        </div>
        ${job.description ? `<p class="text-sm text-gray-500 mt-3 line-clamp-2">${job.description}</p>` : ''}
        <p class="text-xs text-brand-500 font-medium mt-3 flex items-center gap-1">
          View details
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </p>
      </div>
    </div>
  </article>`
}

function emptyState(message = 'No jobs found matching your filters.') {
  return `
  <div class="col-span-full text-center py-16 text-gray-400">
    <svg class="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z"/></svg>
    <p class="text-sm font-medium">${message}</p>
    <p class="text-xs mt-1">Check back soon — new listings are added regularly.</p>
  </div>`
}

// ─── Toast notifications ─────────────────────────────────────

function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'toast-container'
    container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none'
    document.body.appendChild(container)
  }
  const colors = type === 'success'
    ? 'background:#16a34a;color:#fff'
    : type === 'error'
    ? 'background:#dc2626;color:#fff'
    : 'background:#d97706;color:#fff'
  const toast = document.createElement('div')
  toast.style.cssText = `pointer-events:auto;display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:12px;font-size:13px;font-weight:500;box-shadow:0 4px 20px rgba(0,0,0,.15);transition:all .3s ease;transform:translateY(8px);opacity:0;${colors}`
  toast.textContent = message
  container.appendChild(toast)
  requestAnimationFrame(() => { toast.style.transform = 'translateY(0)'; toast.style.opacity = '1' })
  setTimeout(() => {
    toast.style.transform = 'translateY(8px)'; toast.style.opacity = '0'
    setTimeout(() => toast.remove(), 300)
  }, 3500)
}

function loadingState(count = 3) {
  return Array(count).fill(`
  <div class="bg-white border border-gray-200 rounded-2xl p-5 animate-pulse">
    <div class="flex gap-4">
      <div class="w-12 h-12 rounded-xl bg-gray-100 shrink-0"></div>
      <div class="flex-1 space-y-2">
        <div class="h-4 bg-gray-100 rounded w-1/2"></div>
        <div class="h-3 bg-gray-100 rounded w-1/3"></div>
        <div class="h-3 bg-gray-100 rounded w-2/3 mt-3"></div>
      </div>
    </div>
  </div>`).join('')
}
