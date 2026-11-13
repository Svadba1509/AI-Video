'use strict';

(() => {
  const links = [...document.querySelectorAll('[data-collection-image]')];
  const viewer = document.querySelector('#collection-viewer');
  if (!viewer || typeof viewer.showModal !== 'function') return;
  const image = document.querySelector('#viewer-image');
  const canvas = document.querySelector('#viewer-canvas');
  const zoom = document.querySelector('#viewer-zoom');
  const count = document.querySelector('#viewer-count');
  const original = document.querySelector('#viewer-original');
  const inquiry = document.querySelector('#viewer-inquiry');
  let currentIndex = 0;
  let opener = null;
  let pointerStart = null;

  function setZoom(enabled) {
    viewer.classList.toggle('is-zoomed', enabled);
    zoom.setAttribute('aria-pressed', String(enabled));
    zoom.textContent = enabled ? 'Вписать в экран' : 'Оригинальный размер';
    canvas.scrollTop = 0;
    canvas.scrollLeft = 0;
  }

  function updateZoomAvailability() {
    if (!viewer.open || viewer.classList.contains('is-zoomed')) return;
    zoom.disabled = image.naturalWidth <= image.clientWidth + 1 && image.naturalHeight <= image.clientHeight + 1;
  }

  function showImage(index) {
    currentIndex = (index + links.length) % links.length;
    const link = links[currentIndex];
    const source = link.querySelector('img');
    setZoom(false);
    zoom.disabled = false;
    image.alt = source.alt;
    image.src = link.href;
    document.querySelector('#viewer-title').textContent = link.dataset.title;
    document.querySelector('#viewer-subtitle').textContent = link.dataset.subtitle;
    count.textContent = `${currentIndex + 1} / ${links.length}`;
    original.href = link.href;
    inquiry.href = link.dataset.inquiry;
    if (image.complete) requestAnimationFrame(updateZoomAvailability);
  }

  links.forEach((link, index) => link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    opener = link;
    viewer.showModal();
    document.body.classList.add('modal-open');
    showImage(index);
    document.querySelector('#viewer-close').focus({preventScroll: true});
  }));

  document.querySelector('#viewer-prev').addEventListener('click', () => showImage(currentIndex - 1));
  document.querySelector('#viewer-next').addEventListener('click', () => showImage(currentIndex + 1));
  document.querySelector('#viewer-close').addEventListener('click', () => viewer.close());
  zoom.addEventListener('click', () => setZoom(!viewer.classList.contains('is-zoomed')));
  image.addEventListener('load', updateZoomAvailability);
  window.addEventListener('resize', updateZoomAvailability, {passive: true});
  image.addEventListener('error', () => {
    document.querySelector('#viewer-subtitle').textContent = 'Не удалось загрузить изображение. Откройте исходник кнопкой ↗.';
  });

  viewer.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      showImage(currentIndex + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch' && !viewer.classList.contains('is-zoomed')) pointerStart = {x: event.clientX, y: event.clientY};
  });
  canvas.addEventListener('pointerup', event => {
    if (!pointerStart) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.abs(dx) > 55 && Math.abs(dy) < 65) showImage(currentIndex + (dx < 0 ? 1 : -1));
  });
  canvas.addEventListener('pointercancel', () => { pointerStart = null; });
  viewer.addEventListener('click', event => {
    if (event.target !== viewer) return;
    const rect = viewer.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) viewer.close();
  });
  viewer.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
    setZoom(false);
    pointerStart = null;
    image.removeAttribute('src');
    opener?.focus({preventScroll: true});
  });
})();
