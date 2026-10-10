/**
 * Fullscreen gallery lightbox — project cards + capability image grids.
 * Left/right arrows, keyboard, swipe. UX: click any project image to browse.
 */
(function () {
  function initLightbox() {
    const items = [];

    function bindTrigger(el, index) {
      el.style.cursor = 'pointer';
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      if (!el.hasAttribute('role')) el.setAttribute('role', 'button');

      el.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;
        openLightbox(index);
      });

      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLightbox(index);
        }
      });
    }

    function isDisplayed(el) {
      return window.getComputedStyle(el).display !== 'none'
        && window.getComputedStyle(el).visibility !== 'hidden';
    }

    // Experience-style cards: each card opens its OWN isolated gallery
    document.querySelectorAll('.project-card').forEach((card) => {
      if (card.classList.contains('project-card--label')) return;
      if (!isDisplayed(card)) return;
      const img = card.querySelector('.card-img, img');
      if (!img || !isDisplayed(img)) return;
      const title = card.querySelector('.card-title')?.textContent?.trim() || img.getAttribute('alt') || '';

      // Build this card's own image list
      const cardItems = [];
      cardItems.push({
        src: img.getAttribute('src'),
        alt: img.getAttribute('alt') || title,
        title: title,
        focusEl: card,
      });

      const extras = card.getAttribute('data-extra');
      if (extras) {
        extras.split(',').map(s => s.trim()).filter(Boolean).forEach(src => {
          cardItems.push({ src, alt: title, title, focusEl: card });
        });
      }

      // Register a global item entry just for capability grids (unused for cards)
      const index = items.length;
      items.push(...cardItems);

      if (!card.getAttribute('aria-label')) {
        card.setAttribute('aria-label', `View ${title || 'project image'}`);
      }

      // Each card click opens lightbox scoped to ONLY this card's images
      card.style.cursor = 'pointer';
      if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '0');
      if (!card.hasAttribute('role')) card.setAttribute('role', 'button');

      card.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;
        openLightboxScoped(cardItems, 0);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLightboxScoped(cardItems, 0);
        }
      });
    });

    // Capability grids: direct img[data-lightbox] — each image opens its own single-image lightbox
    document.querySelectorAll('img[data-lightbox]').forEach((img) => {
      if (img.closest('.project-card')) return;
      const title = img.getAttribute('alt') || '';
      const capItem = [{ src: img.getAttribute('src'), alt: title, title, focusEl: img }];
      if (!img.getAttribute('aria-label')) {
        img.setAttribute('aria-label', `View ${title || 'image'}`);
      }
      img.style.cursor = 'pointer';
      img.addEventListener('click', () => openLightboxScoped(capItem, 0));
    });

    if (!items.length) return;

    let currentIndex = 0;
    let activeItems = items; // scoped to current gallery

    const lightbox = document.createElement('div');
    lightbox.className = 'irit-lightbox';
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', 'Project image gallery');
    lightbox.innerHTML = `
      <div class="irit-lightbox-backdrop"></div>
      <div class="irit-lightbox-container">
        <button class="irit-lightbox-close" aria-label="Close gallery (Esc)">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <button class="irit-lightbox-nav prev" aria-label="Previous image (Left arrow)">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>

        <div class="irit-lightbox-figure">
          <div class="irit-lightbox-img-wrap">
            <img src="" alt="" class="irit-lightbox-img" />
          </div>
          <div class="irit-lightbox-caption">
            <span class="irit-lightbox-title"></span>
            <span class="irit-lightbox-counter"></span>
          </div>
        </div>

        <button class="irit-lightbox-nav next" aria-label="Next image (Right arrow)">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
    `;

    document.body.appendChild(lightbox);

    const backdrop = lightbox.querySelector('.irit-lightbox-backdrop');
    const imgElement = lightbox.querySelector('.irit-lightbox-img');
    const titleElement = lightbox.querySelector('.irit-lightbox-title');
    const counterElement = lightbox.querySelector('.irit-lightbox-counter');
    const closeBtn = lightbox.querySelector('.irit-lightbox-close');
    const prevBtn = lightbox.querySelector('.irit-lightbox-nav.prev');
    const nextBtn = lightbox.querySelector('.irit-lightbox-nav.next');
    const focusables = [closeBtn, prevBtn, nextBtn];

    function updateView() {
      const item = activeItems[currentIndex];
      imgElement.src = item.src;
      imgElement.alt = item.alt;
      titleElement.textContent = item.title;
      counterElement.textContent = activeItems.length > 1
        ? `${currentIndex + 1} / ${activeItems.length}`
        : '';
    }

    function openLightboxScoped(scopedItems, startIndex) {
      activeItems = scopedItems;
      currentIndex = startIndex;
      updateView();
      lightbox.classList.add('is-open');
      document.body.classList.add('lightbox-open');
      // Show/hide nav arrows based on item count
      const hasMultiple = activeItems.length > 1;
      prevBtn.style.display = hasMultiple ? '' : 'none';
      nextBtn.style.display = hasMultiple ? '' : 'none';
      closeBtn.focus();
    }

    function openLightbox(index) {
      openLightboxScoped(items, index);
    }

    function closeLightbox() {
      lightbox.classList.remove('is-open');
      document.body.classList.remove('lightbox-open');
      const focusEl = activeItems[currentIndex] && activeItems[currentIndex].focusEl;
      if (focusEl && typeof focusEl.focus === 'function') focusEl.focus();
    }

    function showPrev() {
      currentIndex = (currentIndex - 1 + activeItems.length) % activeItems.length;
      updateView();
    }

    function showNext() {
      currentIndex = (currentIndex + 1) % activeItems.length;
      updateView();
    }

    closeBtn.addEventListener('click', closeLightbox);
    backdrop.addEventListener('click', closeLightbox);
    prevBtn.addEventListener('click', showPrev);
    nextBtn.addEventListener('click', showNext);

    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('is-open')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeLightbox();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        showPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        showNext();
      } else if (e.key === 'Tab') {
        const active = document.activeElement;
        const idx = focusables.indexOf(active);
        if (e.shiftKey) {
          e.preventDefault();
          focusables[(idx <= 0 ? focusables.length : idx) - 1].focus();
        } else {
          e.preventDefault();
          focusables[(idx + 1) % focusables.length].focus();
        }
      }
    });

    let touchStartX = 0;
    let touchEndX = 0;

    lightbox.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    lightbox.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      const swipeDistance = touchEndX - touchStartX;
      if (Math.abs(swipeDistance) > 40) {
        if (swipeDistance < 0) showNext();
        else showPrev();
      }
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLightbox);
  } else {
    initLightbox();
  }
})();
