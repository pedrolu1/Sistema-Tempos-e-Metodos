const listeners = new Set();

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [page, query] = raw.split('?');
  const params = Object.fromEntries(new URLSearchParams(query || ''));
  return { page: page || '', params };
}

export function navigate(page, params = {}) {
  const qs = new URLSearchParams(params).toString();
  location.hash = `/${page}${qs ? `?${qs}` : ''}`;
}

export function currentRoute() {
  return parseHash();
}

export function onRouteChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

window.addEventListener('hashchange', () => {
  const route = parseHash();
  listeners.forEach((cb) => cb(route));
});
