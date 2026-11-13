'use strict';

const projects = new Map(window.PORTFOLIO.map(project => [project.id, project]));
const gallery = document.querySelector('.gallery');
const works = [...gallery.querySelectorAll('.work')];
const moreButton = document.querySelector('#show-more');
const filterButtons = [...document.querySelectorAll('[data-filter]')];
let currentFilter = 'all';
let expanded = false;
let layoutFrame;

function arrangeGallery() {
  cancelAnimationFrame(layoutFrame);
  layoutFrame = requestAnimationFrame(() => {
    gallery.classList.add('masonry-ready');
    works.forEach(work => {
      if (work.hidden || getComputedStyle(work).display === 'none') return;
      const height = work.querySelector('.work-inner').getBoundingClientRect().height;
      work.style.gridRowEnd = `span ${Math.ceil((height + 20) / 8)}`;
    });
  });
}

function filterGallery() {
  let count = 0;
  works.forEach((work, index) => {
    const matches = currentFilter === 'all' || work.dataset.category.split(' ').includes(currentFilter);
    const visible = matches && (currentFilter !== 'all' || expanded || index < 6);
    work.hidden = !visible;
    work.classList.toggle('revealed', visible);
    if (visible) count++;
  });
  filterButtons.forEach(button => {
    const selected = button.dataset.filter === currentFilter;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  moreButton.hidden = currentFilter !== 'all' || expanded;
  moreButton.setAttribute('aria-expanded', String(expanded));
  document.querySelector('#filter-status').textContent = `Показано работ: ${count}.`;
  arrangeGallery();
}

filterButtons.forEach(button => button.addEventListener('click', () => {
  currentFilter = button.dataset.filter;
  filterGallery();
}));
moreButton.addEventListener('click', () => {
  expanded = true;
  filterGallery();
  // Keep keyboard navigation at the newly revealed content.
  works[6].querySelector('button').focus({preventScroll: true});
});
window.addEventListener('resize', arrangeGallery, {passive: true});
gallery.querySelectorAll('img').forEach(img => img.addEventListener('load', arrangeGallery));
if ('ResizeObserver' in window) {
  const observer = new ResizeObserver(arrangeGallery);
  works.forEach(work => observer.observe(work.querySelector('.work-inner')));
}
if (document.fonts) document.fonts.ready.then(arrangeGallery);
filterGallery();

const telegramUrl = 'https://t.me/olyakutsenko';
const briefLink = document.querySelector('#brief-link');
const briefButtons = [...document.querySelectorAll('[data-brief]')];
let briefType = '';
function setBrief(type = '', reference = '') {
  briefType = type;
  briefButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.brief === type)));
  const lines = ['Здравствуйте!', '', 'Хочу обсудить визуальный проект для моего бренда.', ''];
  if (type) lines.push(`Направление: ${type}`);
  if (reference) lines.push(`Понравилась работа: ${reference}`);
  lines.push('', 'Мой бренд / продукт: ', 'Задача проекта: ', 'Желаемые сроки: ', '', 'Ссылка на бренд: ');
  briefLink.href = `${telegramUrl}?text=${encodeURIComponent(lines.join('\n'))}`;
}
briefButtons.forEach(button => button.addEventListener('click', () => {
  setBrief(briefType === button.dataset.brief ? '' : button.dataset.brief);
}));
document.querySelectorAll('[data-service]').forEach(link => link.addEventListener('click', () => {
  setBrief(link.dataset.service);
}));
setBrief();
const contactStatus = document.querySelector('#contact-status');
document.querySelector('#copy-contact').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(telegramUrl);
    contactStatus.textContent = 'Ссылка на Telegram скопирована.';
  } catch {
    // Leave a real, selectable address when clipboard permission is unavailable.
    contactStatus.textContent = `Скопируйте ссылку: ${telegramUrl}`;
  }
});

const dialog = document.querySelector('#project-dialog');
const video = document.querySelector('#dialog-video');
const image = document.querySelector('#dialog-image');
const loading = document.querySelector('#video-loading');
const videoError = document.querySelector('#video-error');
const playHint = document.querySelector('#play-hint');
const sourceLink = document.querySelector('#video-source-link');
let activeProject = null;
let returnFocus = null;
let playbackToken = 0;
let hls = null;
let hlsLoader = null;
let loadingTimeout;

function loadHlsLibrary() {
  if (window.Hls) return Promise.resolve(window.Hls);
  if (!hlsLoader) {
    hlsLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'assets/hls.min.js';
      script.onload = () => resolve(window.Hls);
      script.onerror = () => {
        script.remove();
        hlsLoader = null;
        reject(new Error('Video library unavailable'));
      };
      document.head.append(script);
    });
  }
  return hlsLoader;
}

function stopMedia() {
  clearTimeout(loadingTimeout);
  hls?.destroy();
  hls = null;
  video.pause();
  video.removeAttribute('src');
  video.load();
  loading.hidden = true;
  playHint.hidden = true;
}

function showMediaError(token) {
  if (token !== playbackToken || !dialog.open) return;
  clearTimeout(loadingTimeout);
  loading.hidden = true;
  videoError.hidden = false;
}

function requestPlayback(token) {
  const promise = video.play();
  if (promise) promise.catch(error => {
    if (token !== playbackToken || !dialog.open) return;
    if (error.name === 'NotAllowedError') {
      loading.hidden = true;
      playHint.hidden = false;
    } else if (error.name !== 'AbortError') {
      showMediaError(token);
    }
  });
}

async function playProject(project, token) {
  loading.hidden = false;
  // Do not leave a stalled network request behind an endless spinner.
  loadingTimeout = setTimeout(() => showMediaError(token), 30000);
  if (project.video) {
    video.src = `assets/${project.video}`;
    requestPlayback(token);
    return;
  }
  const url = `assets/${project.hls}`;
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;
    requestPlayback(token);
    return;
  }
  try {
    const Hls = await loadHlsLibrary();
    if (token !== playbackToken || !dialog.open) return;
    if (!Hls.isSupported()) {
      showMediaError(token);
      return;
    }
    hls = new Hls({maxBufferLength: 15, backBufferLength: 15, enableWorker: true});
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (token === playbackToken && dialog.open) requestPlayback(token);
    });
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) showMediaError(token);
    });
    hls.loadSource(url);
    hls.attachMedia(video);
  } catch {
    showMediaError(token);
  }
}

function openProject(button) {
  const project = projects.get(button.dataset.project);
  if (!project) return;
  const token = ++playbackToken;
  activeProject = null;
  stopMedia();
  activeProject = project;
  returnFocus = button;
  videoError.hidden = true;
  document.querySelector('#dialog-title').textContent = project.title;
  document.querySelector('#dialog-label').textContent = project.label;
  document.querySelector('#dialog-description').textContent = project.description;
  const details = document.querySelector('#dialog-details');
  details.replaceChildren(...project.details.map(text => {
    const item = document.createElement('li');
    item.textContent = text;
    return item;
  }));
  const isVideo = Boolean(project.video || project.hls);
  video.hidden = !isVideo;
  image.hidden = isVideo;
  if (isVideo) {
    video.poster = `assets/${project.poster}`;
    image.removeAttribute('src');
    sourceLink.href = project.original;
    document.querySelector('#video-error-link').href = project.original;
    sourceLink.hidden = false;
  } else {
    image.src = `assets/${project.poster}`;
    image.alt = project.alt;
    sourceLink.hidden = true;
    sourceLink.removeAttribute('href');
  }
  document.querySelector('#similar-project').firstChild.textContent = isVideo ? 'Хочу похожий ролик ' : 'Обсудить такую эстетику ';
  dialog.showModal();
  dialog.scrollTop = 0;
  document.body.classList.add('modal-open');
  if (isVideo) playProject(project, token);
}

document.querySelectorAll('[data-project]').forEach(button => {
  button.addEventListener('click', () => openProject(button));
});
video.addEventListener('playing', () => {
  clearTimeout(loadingTimeout);
  loading.hidden = true;
  playHint.hidden = true;
  videoError.hidden = true;
});
video.addEventListener('canplay', () => { loading.hidden = true; });
video.addEventListener('error', () => {
  if (activeProject && dialog.open && video.hasAttribute('src')) showMediaError(playbackToken);
});
document.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});
let moveToContact = false;
dialog.addEventListener('close', () => {
  playbackToken++;
  activeProject = null;
  stopMedia();
  videoError.hidden = true;
  document.body.classList.remove('modal-open');
  if (moveToContact) {
    moveToContact = false;
    briefLink.focus({preventScroll: true});
    document.querySelector('#contact').scrollIntoView({behavior: 'auto'});
  } else {
    returnFocus?.focus({preventScroll: true});
  }
});
document.querySelector('#similar-project').addEventListener('click', () => {
  setBrief('', activeProject?.title || '');
  moveToContact = true;
  dialog.close();
});

const mobileContact = document.querySelector('.mobile-contact');
let heroVisible = true;
let contactVisible = false;
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.target.classList.contains('hero')) heroVisible = entry.isIntersecting;
      if (entry.target.id === 'contact') contactVisible = entry.isIntersecting;
    });
    mobileContact.classList.toggle('visible', !heroVisible && !contactVisible);
  }, {threshold: 0});
  observer.observe(document.querySelector('.hero'));
  observer.observe(document.querySelector('#contact'));
}
