/* ============================================================
   Nookly notifications: socket.io client, bell dropdown,
   unread badge, mark read / mark all read.
   Expects a bell button inside `[data-notif-root]`:
     <div class="relative" data-notif-root>
       <button data-notif-bell>…bell svg…</button>
       (panel + badge are injected here by this script)
     </div>
   Loads the socket.io client dynamically from the backend
   (the socket.io server serves its client at /socket.io/socket.io.js),
   so pages only need to include config.js + api.js + this file.
   ============================================================ */

let notifSocket = null
let notifIoPromise = null

function loadSocketIoClient() {
  if (window.io) return Promise.resolve(window.io)
  if (notifIoPromise) return notifIoPromise
  notifIoPromise = new Promise(function (resolve, reject) {
    const s = document.createElement('script')
    s.src = API_BASE_URL + '/socket.io/socket.io.js'
    s.onload = function () { resolve(window.io) }
    s.onerror = function () { reject(new Error('Could not load socket.io client')) }
    document.head.appendChild(s)
  })
  return notifIoPromise
}

function timeAgo(iso) {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  if (isNaN(diff)) return ''
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Just now'
  if (min < 60) return min + 'm ago'
  const hr = Math.floor(min / 60)
  if (hr < 24) return hr + 'h ago'
  const day = Math.floor(hr / 24)
  if (day < 7) return day + 'd ago'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function notifIcon(type) {
  const icons = {
    BUSINESS_APPROVED: '#i-circle-check',
    BUSINESS_REJECTED: '#i-x-circle',
    BUSINESS_SUSPENDED: '#i-alert-triangle',
    KYC_VERIFIED: '#i-shield-check',
    KYC_REJECTED: '#i-shield-x',
    NEW_MESSAGE: '#i-message-circle',
  }
  return '<svg class="size-4" aria-hidden="true"><use href="' + (icons[type] || '#i-bell') + '"/></svg>'
}

// Route a notification to the right page based on its type + payload.
function notifHref(n) {
  const data = n.data || {}
  if (n.type === 'KYC_VERIFIED' || n.type === 'KYC_REJECTED') return '/owner/kyc.html'
  if (n.type === 'BUSINESS_APPROVED' || n.type === 'BUSINESS_REJECTED' || n.type === 'BUSINESS_SUSPENDED') {
    return data.businessId ? '/owner/business-form.html?id=' + data.businessId : '/owner/dashboard.html'
  }
  if (n.type === 'NEW_MESSAGE') {
    return data.businessId ? '/owner/messages.html?businessId=' + data.businessId : '/owner/messages.html'
  }
  return '/notifications.html'
}

function renderItem(n) {
  const item = document.createElement('a')
  item.href = notifHref(n)
  item.className = 'flex gap-3 px-4 py-3 text-sm transition hover:bg-muted'
  item.dataset.notifId = n.id
  const unreadDot = n.read ? '' : '<span class="mt-1.5 size-2 shrink-0 rounded-full bg-primary"></span>'
  item.innerHTML =
    '<span class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">' +
    notifIcon(n.type) + '</span>' +
    '<span class="min-w-0 flex-1">' +
    '<span class="block font-semibold">' + escapeHtml(n.title) + '</span>' +
    '<span class="mt-0.5 block text-xs leading-snug text-muted-foreground">' + escapeHtml(n.body) + '</span>' +
    '<span class="mt-1 block text-[11px] text-muted-foreground/70">' + timeAgo(n.createdAt) + '</span>' +
    '</span>' + unreadDot
  if (!n.read) {
    item.addEventListener('click', function () {
      apiPatch('/notifications/' + n.id + '/read').catch(function () {})
      setUnreadCount(getUnreadCount() - 1)
    })
  }
  return item
}

function badgeEl(root) { return root.querySelector('[data-notif-badge]') }
function panelEl(root) { return root.querySelector('[data-notif-panel]') }
function listEl(root) { return root.querySelector('[data-notif-list]') }
function emptyEl(root) { return root.querySelector('[data-notif-empty]') }

let unreadCount = 0
function setUnreadCount(n) {
  unreadCount = Math.max(0, n)
  document.querySelectorAll('[data-notif-badge]').forEach(function (b) {
    b.textContent = unreadCount > 99 ? '99+' : String(unreadCount)
    b.classList.toggle('hidden', unreadCount === 0)
  })
}
function getUnreadCount() { return unreadCount }

async function refreshBadge() {
  try {
    const { data } = await apiGet('/notifications/unread-count')
    setUnreadCount(data.unreadCount || 0)
  } catch (err) { /* backend down or logged out — keep current badge */ }
}

async function openPanel(root) {
  const panel = panelEl(root)
  const list = listEl(root)
  const empty = emptyEl(root)
  if (panel.classList.contains('hidden')) {
    panel.classList.remove('hidden')
    try {
      const { data } = await apiGet('/notifications')
      list.innerHTML = ''
      const recent = (data.notifications || []).slice(0, 5)
      if (!recent.length) {
        empty.classList.remove('hidden')
      } else {
        empty.classList.add('hidden')
        recent.forEach(function (n) { list.appendChild(renderItem(n)) })
      }
      setUnreadCount(data.unreadCount || 0)
    } catch (err) {
      list.innerHTML = '<div class="px-4 py-6 text-center text-xs text-muted-foreground">Could not load notifications.</div>'
    }
  } else {
    panel.classList.add('hidden')
  }
}

function initNotificationsRoot(root) {
  const bell = root.querySelector('[data-notif-bell]')
  if (!bell) return

  // Inject the unread badge onto the bell.
  const badge = document.createElement('span')
  badge.dataset.notifBadge = ''
  badge.className = 'pointer-events-none absolute -right-0.5 -top-0.5 hidden min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-bold leading-4 text-white'
  bell.classList.add('relative')
  bell.appendChild(badge)

  // Build the dropdown panel.
  const panel = document.createElement('div')
  panel.dataset.notifPanel = ''
  panel.className = 'hidden absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-lg'
  panel.innerHTML =
    '<div class="flex items-center justify-between border-b border-border px-4 py-3">' +
    '<p class="font-mono text-sm font-bold">Notifications</p>' +
    '<button type="button" data-notif-mark-all class="text-xs font-semibold text-primary hover:underline">Mark all read</button>' +
    '</div>' +
    '<div data-notif-list class="max-h-80 overflow-y-auto divide-y divide-border"></div>' +
    '<div data-notif-empty class="hidden px-4 py-6 text-center text-xs text-muted-foreground">You\u2019re all caught up.</div>' +
    '<a href="/notifications.html" class="flex items-center justify-center gap-1 border-t border-border px-4 py-3 text-sm font-semibold text-primary hover:bg-muted">' +
    'View all notifications<svg class="size-4" aria-hidden="true"><use href="#i-chevron-right"/></svg></a>'
  root.appendChild(panel)

  bell.addEventListener('click', function (e) {
    e.stopPropagation()
    openPanel(root)
  })
  panel.addEventListener('click', function (e) {
    e.stopPropagation()
    if (e.target.closest('[data-notif-mark-all]')) {
      apiPatch('/notifications/read-all').then(function () {
        setUnreadCount(0)
        listEl(root).querySelectorAll('[data-notif-id]').forEach(function (el) { el.classList.add('opacity-60') })
      }).catch(function () {})
    }
  })
  document.addEventListener('click', function () { panel.classList.add('hidden') })
}

function initNotifications() {
  if (!getToken()) return
  const roots = document.querySelectorAll('[data-notif-root]')
  if (!roots.length) return

  roots.forEach(initNotificationsRoot)
  refreshBadge()

  // Real-time updates: connect once, share across every bell on the page.
  // Probe sessions (set __NOOKLY_NO_SOCKET in the seed helper) skip the live
  // socket so headless DOM dumps don't hang on the persistent connection.
  if (window.localStorage && window.localStorage.getItem('__NOOKLY_NO_SOCKET') === '1') return
  loadSocketIoClient()
    .then(function () {
      notifSocket = window.io(API_BASE_URL, {
        auth: { token: getToken() },
        transports: ['websocket', 'polling'],
      })
      notifSocket.on('notification:new', function (n) {
        setUnreadCount(getUnreadCount() + 1)
        roots.forEach(function (root) {
          const list = listEl(root)
          if (!list || list.children.length === 0) return
          emptyEl(root).classList.add('hidden')
          const first = list.firstChild
          list.insertBefore(renderItem(n), first)
          while (list.children.length > 5) list.removeChild(list.lastChild)
        })
      })
    })
    .catch(function () {})
}

function boot() {
  // Headers (with the bell) are injected asynchronously by include.js, so
  // wait for that to finish before wiring up the dropdowns.
  if (document.querySelector('[data-notif-root]')) {
    initNotifications()
  } else {
    document.addEventListener('nookly:includes-done', initNotifications, { once: true })
  }
}

document.addEventListener('DOMContentLoaded', boot)