/* ============================================================
   Nookly shared JS: partial includes, active nav, mobile menu
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  includePartials().then(function () {
    initActiveNav()
    initMobileMenu()
    initShell()
    // Let late-initializing modules (e.g. notifications) wait for the
    // partials to actually be in the DOM before wiring up.
    document.dispatchEvent(new CustomEvent('nookly:includes-done'))
  })
})

/* Fetch and inject partials marked with data-include="path". */
async function includePartials() {
  const nodes = Array.from(document.querySelectorAll('[data-include]'))
  for (const node of nodes) {
    const path = node.getAttribute('data-include')
    try {
      const res = await fetch(path)
      if (!res.ok) throw new Error(res.status)
      const html = await res.text()
      const wrapper = document.createElement('div')
      wrapper.innerHTML = html.trim()
      const fragment = document.createDocumentFragment()
      while (wrapper.firstChild) fragment.appendChild(wrapper.firstChild)
      node.replaceWith(fragment)
    } catch (err) {
      console.warn('include failed:', path, err)
    }
  }
}

/* Highlight the sidebar link matching <body data-page="...">. */
function initActiveNav() {
  const page = document.body.getAttribute('data-page')
  if (!page) return
  document.querySelectorAll('[data-nav-key]').forEach(function (link) {
    if (link.getAttribute('data-nav-key') === page) {
      link.classList.add('bg-primary', 'text-primary-foreground')
    }
  })
}

/* Mobile menu toggle for the home header. */
function initMobileMenu() {
  const burger = document.querySelector('[data-menu-toggle]')
  const mobileNav = document.getElementById('mobile-nav')
  if (!burger || !mobileNav) return
  burger.addEventListener('click', function () {
    const open = mobileNav.getAttribute('data-open') !== 'true'
    mobileNav.setAttribute('data-open', open ? 'true' : 'false')
    mobileNav.style.display = open ? 'block' : 'none'
    burger.setAttribute('aria-expanded', String(open))
  })
}

/* Session-aware shell: fill workspace name/role, avatar, and wire sign-out.
   Uses auth.js helpers when they exist (guarded pages load them). */
function initShell() {
  let user = null
  try {
    user = typeof getUser === 'function' ? getUser() : null
  } catch (err) {
    user = null
  }

  const name = document.getElementById('workspace-name')
  const role = document.getElementById('workspace-role')
  if (name) name.textContent = user && user.email ? (user.name || user.email) : 'Guest'
  if (role) {
    if (user && user.email) {
      role.textContent = user.role === 'ADMIN' ? 'Administrator' : user.role === 'BUSINESS_OWNER' ? 'Business owner' : user.role
    } else {
      role.textContent = 'Not signed in'
    }
  }

  const avatar = document.getElementById('shell-avatar')
  if (avatar && user && user.email) {
    avatar.textContent = (user.name || user.email).slice(0, 1).toUpperCase()
  }

  // Header "Profile" link is only meaningful for signed-in users.
  const headerProfile = document.getElementById('header-profile-link')
  if (headerProfile) {
    headerProfile.classList.toggle('hidden', !(user && user.email))
  }

  document.querySelectorAll('.sign-out').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (typeof signOut === 'function') signOut('/index.html')
      else { clearSession(); window.location.href = '/index.html' }
    })
  })
}