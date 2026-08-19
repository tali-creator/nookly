/* ============================================================
   Shared business card component (browse / favorites / dashboard)
   Data shape: nearby/featured/favorites list items from the API.
   ============================================================ */

const CARD_TONES = [
  "bg-[#d7ebbd]",
  "bg-[#f5d2bb]",
  "bg-[#cbdcf2]",
  "bg-[#f3d8e5]",
  "bg-[#f0e6c8]",
  "bg-[#dcebc9]",
]

function toneFor(id) {
  let hash = 0
  const s = String(id || "")
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0
  return CARD_TONES[hash % CARD_TONES.length]
}

async function favoriteState(businessId) {
  try {
    const { data } = await apiGet("/favorites/check?deviceId=" + getDeviceId() + "&businessId=" + businessId)
    return !!data.favorited
  } catch {
    return false
  }
}

async function toggleFavorite(businessId) {
  const body = { deviceId: getDeviceId(), businessId }
  try {
    await apiPost("/favorites", body)
    return true
  } catch {
    try {
      await apiDelete("/favorites", body)
      return false
    } catch {
      return null
    }
  }
}

/* Renders one business card. onFavChange(businessId, isFav) fires after a toggle. */
function renderBusinessCard(business, onFavChange) {
  const article = document.createElement("article")
  article.className = "group overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-1 hover:shadow-lg"

  const cover = imageUrl(business.coverUrl)
  const headerStyle = cover
    ? 'style="background-image:url(' + cover + ');background-size:cover;background-position:center"'
    : ""
  const tone = cover ? "" : toneFor(business.id)
  const price = business.serviceItems && business.serviceItems.length
    ? formatNaira(business.serviceItems[0].price)
    : business.price != null ? formatNaira(business.price) : null

  const distance = business.distanceKm != null ? business.distanceKm.toFixed(1) + " km away" : null
  const open = isOpenNow(business.hours, business.timezone)
  const openBadge = open === null
    ? ""
    : '<span class="mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ' +
      (open ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground') +
      '">' + (open ? "Open now" : "Closed now") + "</span>"
  const verifiedBadge = business.owner && business.owner.isVerified
    ? '<span class="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 align-middle text-[11px] font-bold text-primary"><svg class="size-3" aria-hidden="true"><use href="#i-shield-check"/></svg>Verified</span>'
    : ""

  article.innerHTML = `
    <div class="relative flex h-48 items-end p-5 ${tone}" ${headerStyle}>
      <div class="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-foreground/10 to-transparent"></div>
      ${business.isFeatured ? '<span class="absolute left-4 top-4 rounded-full bg-background/85 px-3 py-1.5 text-[11px] font-bold backdrop-blur">Featured</span>' : ''}
      <button class="fav-btn absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-background/85 transition hover:scale-105" aria-label="Save to favorites" data-business-id="${business.id}">
        <svg class="size-4 heart-icon" aria-hidden="true"><use href="#i-heart"/></svg>
      </button>
      ${cover ? "" : '<div class="flex size-24 items-center justify-center rounded-full border-4 border-background/80 bg-background/40 text-2xl font-bold backdrop-blur">' + escapeHtml(initials(business.name)) + '</div>'}
    </div>
    <div class="p-5">
      <h3 class="font-mono text-lg font-bold">${escapeHtml(business.name)}</h3>
      <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(business.category ? business.category.name : "")}</p>
      ${openBadge}${verifiedBadge}
      <div class="mt-3 flex items-center justify-between text-sm">
        ${distance ? '<span class="text-muted-foreground">' + distance + '</span>' : '<span></span>'}
        ${price ? '<span class="text-muted-foreground">From <strong class="text-foreground">' + price + '</strong></span>' : ''}
      </div>
      <div class="mt-4 flex items-center justify-between border-t border-border pt-4">
        <a href="owner.html?businessId=${business.id}" class="text-sm font-bold text-primary">Visit owner <svg class="inline size-4" aria-hidden="true"><use href="#i-arrow-right"/></svg></a>
        <a href="business.html?id=${business.id}" class="text-sm font-bold text-muted-foreground hover:text-foreground">View profile</a>
      </div>
    </div>`

  const favBtn = article.querySelector(".fav-btn")
  const heart = article.querySelector(".heart-icon")
  favoriteState(business.id).then((isFav) => {
    heart.classList.toggle("fill-primary", isFav)
    heart.classList.toggle("text-primary", isFav)
    favBtn.setAttribute("aria-label", isFav ? "Remove from favorites" : "Save to favorites")
  })

  favBtn.addEventListener("click", async () => {
    const next = await toggleFavorite(business.id)
    if (next === null) return
    heart.classList.toggle("fill-primary", next)
    heart.classList.toggle("text-primary", next)
    favBtn.setAttribute("aria-label", next ? "Remove from favorites" : "Save to favorites")
    if (onFavChange) onFavChange(business.id, next)
  })

  return article
}