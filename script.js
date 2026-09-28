const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.site-nav');
const hero = document.querySelector('.hero');
const form = document.querySelector('.contact-form');
const formStatus = document.querySelector('.form-status');
const servicesScene = document.querySelector('.services-scene');
const serviceItems = [...document.querySelectorAll('.service-sequence li')];
const servicesStage = document.querySelector('.services-stage');
const briefDialog = document.querySelector('.brief-dialog');
const briefForm = document.querySelector('.brief-form');
const briefSteps = [...document.querySelectorAll('.brief-step')];
const briefOpenButtons = [...document.querySelectorAll('[data-open-brief]')];
const briefCloseButton = document.querySelector('[data-close-brief]');
const briefBackButton = document.querySelector('[data-brief-back]');
const briefNextButton = document.querySelector('[data-brief-next]');
const briefSubmitButton = document.querySelector('.brief-submit');
const briefProgress = document.querySelector('.brief-progress-bar');
const briefProgressLabel = document.querySelector('.brief-progress-label');
const briefFormStatus = document.querySelector('.brief-form-status');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (briefDialog && briefForm && briefSteps.length) {
  let currentBriefStep = 0;
  let briefReturnFocus = null;
  const supportsModalDialog = typeof briefDialog.showModal === 'function';

  const updateBrief = (nextStep) => {
    currentBriefStep = Math.max(0, Math.min(nextStep, briefSteps.length - 1));
    briefSteps.forEach((step, index) => {
      const isActive = index === currentBriefStep;
      step.hidden = !isActive;
      step.classList.toggle('is-active', isActive);
    });

    if (briefBackButton) briefBackButton.disabled = currentBriefStep === 0;
    if (briefNextButton) briefNextButton.hidden = currentBriefStep === briefSteps.length - 1;
    if (briefSubmitButton) briefSubmitButton.hidden = currentBriefStep !== briefSteps.length - 1;
    if (briefProgress) briefProgress.style.width = `${((currentBriefStep + 1) / briefSteps.length) * 100}%`;
    if (briefProgressLabel) briefProgressLabel.textContent = `Шаг ${currentBriefStep + 1} из ${briefSteps.length}`;
    if (briefFormStatus) briefFormStatus.textContent = '';
    briefForm.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  const openBrief = (trigger) => {
    briefReturnFocus = trigger;
    if (supportsModalDialog) {
      if (!briefDialog.open) briefDialog.showModal();
    } else {
      briefDialog.setAttribute('open', '');
      briefDialog.setAttribute('aria-modal', 'true');
    }
    document.body.classList.add('brief-open');
    updateBrief(currentBriefStep);
    window.setTimeout(() => {
      briefSteps[currentBriefStep]?.querySelector('input, textarea, button')?.focus({ preventScroll: true });
    }, reduceMotion ? 0 : 280);
  };

  const closeBrief = () => {
    if (supportsModalDialog) {
      if (briefDialog.open) briefDialog.close();
      return;
    }
    briefDialog.removeAttribute('open');
    briefDialog.removeAttribute('aria-modal');
    document.body.classList.remove('brief-open');
    briefReturnFocus?.focus({ preventScroll: true });
  };

  briefOpenButtons.forEach((button) => button.addEventListener('click', (event) => {
    event.preventDefault();
    openBrief(button);
  }));
  briefCloseButton?.addEventListener('click', (event) => {
    event.preventDefault();
    closeBrief();
  });
  briefBackButton?.addEventListener('click', () => updateBrief(currentBriefStep - 1));
  briefNextButton?.addEventListener('click', () => updateBrief(currentBriefStep + 1));

  briefDialog.addEventListener('click', (event) => {
    if (event.target !== briefDialog) return;
    const shell = briefDialog.querySelector('.brief-shell').getBoundingClientRect();
    const outsideShell =
      event.clientX < shell.left || event.clientX > shell.right ||
      event.clientY < shell.top || event.clientY > shell.bottom;
    if (outsideShell) closeBrief();
  });

  briefDialog.addEventListener('close', () => {
    document.body.classList.remove('brief-open');
    briefReturnFocus?.focus({ preventScroll: true });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && briefDialog.hasAttribute('open')) closeBrief();
  });

  briefForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!briefForm.checkValidity()) {
      briefForm.reportValidity();
      if (briefFormStatus) briefFormStatus.textContent = 'Заполните обязательные поля и подтвердите согласие.';
      return;
    }

    if (briefFormStatus) {
      briefFormStatus.textContent = 'Бриф заполнен. Подключение отправки выполним вместе с основной формой сайта.';
    }
  });

}

if (menuButton && navigation) {
  const closeMenu = () => {
    menuButton.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
    document.body.classList.remove('menu-open');
  };

  menuButton.addEventListener('click', () => {
    const willOpen = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(willOpen));
    navigation.classList.toggle('is-open', willOpen);
    document.body.classList.toggle('menu-open', willOpen);
  });

  navigation.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 800) closeMenu();
  });
}

if (hero && !reduceMotion) {
  let scanPlayed = false;
  const playScan = () => {
    if (scanPlayed || window.scrollY < 20) return;
    scanPlayed = true;
    hero.classList.add('is-scanning');
  };
  window.addEventListener('scroll', playScan, { passive: true });
}

const observeSequence = (items, onChange) => {
  if (!items.length) return;
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) onChange(visible.target);
    },
    { rootMargin: '-32% 0px -32%', threshold: [0.15, 0.35, 0.6] },
  );
  items.forEach((item) => observer.observe(item));
  onChange(items[0]);
};

const mobileServicesQuery = window.matchMedia('(max-width: 900px)');

const setActiveService = (activeItem) => {
  const index = Number(activeItem.dataset.service || 0);
  serviceItems.forEach((item) => {
    const isActive = item === activeItem;
    item.classList.toggle('is-active', isActive);
    if (mobileServicesQuery.matches) item.setAttribute('aria-expanded', String(isActive));
  });
  servicesScene?.setAttribute('data-service-active', String(index));
  if (!servicesStage) return;
  servicesStage.dataset.modelState = String(index);
};

const syncServiceInteractionMode = () => {
  serviceItems.forEach((item) => {
    if (mobileServicesQuery.matches) {
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-expanded', String(item.classList.contains('is-active')));
    } else {
      item.removeAttribute('role');
      item.removeAttribute('tabindex');
      item.removeAttribute('aria-expanded');
    }
  });
};

observeSequence(serviceItems, (activeItem) => {
  if (mobileServicesQuery.matches) return;
  setActiveService(activeItem);
});

serviceItems.forEach((item) => {
  item.addEventListener('click', () => {
    if (mobileServicesQuery.matches) setActiveService(item);
  });
  item.addEventListener('keydown', (event) => {
    if (!mobileServicesQuery.matches || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    setActiveService(item);
  });
});

syncServiceInteractionMode();
mobileServicesQuery.addEventListener('change', syncServiceInteractionMode);

if (reduceMotion) {
  document.querySelectorAll('video[autoplay]').forEach((video) => video.pause());
}

if (form && formStatus) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = form.elements.namedItem('name');
    const phone = form.elements.namedItem('phone');
    if (!name.value.trim() || !phone.value.trim()) {
      formStatus.textContent = 'Укажите имя и номер телефона.';
      const firstEmpty = !name.value.trim() ? name : phone;
      firstEmpty.setAttribute('aria-invalid', 'true');
      firstEmpty.focus();
      return;
    }
    name.removeAttribute('aria-invalid');
    phone.removeAttribute('aria-invalid');
    formStatus.textContent = 'Форма готова. Обработчик отправки подключим на следующем этапе.';
  });
}

document.querySelectorAll('[data-gallery]').forEach((gallery) => {
  const slides = [...gallery.querySelectorAll('[data-gallery-slide]')];
  const previousButton = gallery.querySelector('[data-gallery-prev]');
  const nextButton = gallery.querySelector('[data-gallery-next]');
  const counter = gallery.querySelector('[data-gallery-count]');
  const caption = gallery.querySelector('[data-gallery-caption]');
  if (slides.length < 2) return;

  let activeIndex = 0;
  const renderGallery = () => {
    slides.forEach((slide, index) => {
      slide.classList.toggle('is-active', index === activeIndex);
      slide.setAttribute('aria-hidden', String(index !== activeIndex));
    });
    if (counter) {
      counter.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    }
    if (caption) caption.textContent = slides[activeIndex].dataset.caption || '';
  };

  previousButton?.addEventListener('click', () => {
    activeIndex = (activeIndex - 1 + slides.length) % slides.length;
    renderGallery();
  });
  nextButton?.addEventListener('click', () => {
    activeIndex = (activeIndex + 1) % slides.length;
    renderGallery();
  });
  renderGallery();
});

const siteHeader = document.querySelector('.site-header');
if (siteHeader) {
  let headerFrame = 0;
  const updateHeaderSurface = () => {
    siteHeader.classList.toggle('is-scrolled', window.scrollY > 28);
    headerFrame = 0;
  };
  const requestHeaderUpdate = () => {
    if (!headerFrame) headerFrame = window.requestAnimationFrame(updateHeaderSurface);
  };
  window.addEventListener('scroll', requestHeaderUpdate, { passive: true });
  updateHeaderSurface();
}
