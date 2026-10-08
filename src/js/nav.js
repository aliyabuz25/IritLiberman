/**
 * Global Navigation — hover (CSS) + click toggle + outside / section close
 * UX: Selected Experience & Capabilities dropdowns; close on outside click
 * or when switching to another navbar section.
 * Mobile: accordion groups + hamburger aria + body scroll lock + focus trap.
 */
document.addEventListener('DOMContentLoaded', () => {
  const navGroups = document.querySelectorAll('.nav-group');
  const navToggle = document.getElementById('nav-toggle-checkbox');
  const hamburger = document.querySelector('.hamburger');
  const mainNav = document.getElementById('main-nav');
  const siteHeader = document.querySelector('.site-header');

  let lastFocusedBeforeMenu = null;

  function closeAll(except) {
    navGroups.forEach((group) => {
      if (group !== except) {
        group.classList.remove('active');
        const label = group.querySelector('.nav-group-label');
        if (label) label.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function getOverlayFocusables() {
    if (!siteHeader) return [];
    const roots = [mainNav, siteHeader.querySelector('.discuss-btn'), hamburger].filter(Boolean);
    const list = [];
    roots.forEach((root) => {
      if (root.matches && root.matches('a, button, [tabindex]:not([tabindex="-1"]), label.hamburger')) {
        list.push(root);
      }
      root.querySelectorAll(
        'a[href], button, [tabindex]:not([tabindex="-1"]), .nav-group-label'
      ).forEach((el) => {
        if (!list.includes(el)) list.push(el);
      });
    });
    return list;
  }

  function syncMenuState() {
    const open = !!(navToggle && navToggle.checked);
    document.body.classList.toggle('nav-open', open);
    if (hamburger) {
      hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
      hamburger.setAttribute('aria-label', open ? 'Close menu' : 'Toggle menu');
      if (mainNav && !hamburger.hasAttribute('aria-controls')) {
        hamburger.setAttribute('aria-controls', 'main-nav');
      }
    }
    if (open) {
      lastFocusedBeforeMenu = document.activeElement;
      const focusables = getOverlayFocusables();
      const first = focusables.find((el) => el !== hamburger) || hamburger;
      if (first && typeof first.focus === 'function') {
        requestAnimationFrame(() => first.focus());
      }
    } else {
      closeAll();
      if (lastFocusedBeforeMenu && typeof lastFocusedBeforeMenu.focus === 'function') {
        const restore = lastFocusedBeforeMenu;
        lastFocusedBeforeMenu = null;
        if (document.body.contains(restore)) restore.focus();
      }
    }
  }

  if (hamburger) {
    if (!hamburger.hasAttribute('aria-controls') && mainNav) {
      hamburger.setAttribute('aria-controls', 'main-nav');
    }
    if (!hamburger.hasAttribute('aria-expanded')) {
      hamburger.setAttribute('aria-expanded', 'false');
    }
  }

  if (navToggle) {
    navToggle.addEventListener('change', syncMenuState);
    syncMenuState();
  }

  navGroups.forEach((group, i) => {
    const label = group.querySelector('.nav-group-label');
    const dropdown = group.querySelector('.nav-dropdown');
    if (!label || !dropdown) return;

    if (!dropdown.id) {
      dropdown.id = `nav-dropdown-${i + 1}`;
    }

    if (!label.hasAttribute('role')) {
      label.setAttribute('role', 'button');
      label.setAttribute('tabindex', '0');
      label.setAttribute('aria-haspopup', 'true');
    }
    label.setAttribute('aria-controls', dropdown.id);
    label.setAttribute('aria-expanded', group.classList.contains('active') ? 'true' : 'false');

    function toggleGroup(e) {
      if (e) e.preventDefault();
      const isOpen = group.classList.contains('active');
      closeAll(group);
      group.classList.toggle('active', !isOpen);
      label.setAttribute('aria-expanded', (!isOpen).toString());
    }

    label.addEventListener('click', toggleGroup);
    label.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        toggleGroup(e);
      }
    });

    // Hovering another section closes the previously click-opened sibling
    group.addEventListener('mouseenter', () => {
      closeAll(group);
      if (group.matches(':hover')) {
        label.setAttribute('aria-expanded', 'true');
      }
    });
    group.addEventListener('mouseleave', () => {
      if (!group.classList.contains('active')) {
        label.setAttribute('aria-expanded', 'false');
      }
    });
  });

  // Mark current page for AT
  document.querySelectorAll('.nav-dropdown a.active, .nav-link.active').forEach((link) => {
    link.setAttribute('aria-current', 'page');
  });

  // Close when clicking outside any nav-group (desktop dropdowns)
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-group')) {
      closeAll();
    }
  });

  // Close when navigating to About / Contact / Discuss / dropdown links
  const navRoots = document.querySelectorAll('.main-nav, .nav, .site-header');
  navRoots.forEach((root) => {
    root.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        closeAll();
        if (navToggle && navToggle.checked) {
          navToggle.checked = false;
          syncMenuState();
        }
      });
    });
  });

  // Esc closes mobile overlay and desktop dropdowns
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;

    if (navToggle && navToggle.checked) {
      navToggle.checked = false;
      syncMenuState();
      if (hamburger) hamburger.focus();
      return;
    }

    const openGroup = document.querySelector('.nav-group.active');
    if (openGroup) {
      const label = openGroup.querySelector('.nav-group-label');
      closeAll();
      if (label) label.focus();
    }
  });

  // Tab trap while mobile overlay is open
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !navToggle || !navToggle.checked) return;
    const focusables = getOverlayFocusables();
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (e.shiftKey) {
      if (active === first || !siteHeader.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last || !siteHeader.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  });
});
