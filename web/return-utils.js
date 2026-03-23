(function () {
  'use strict';

  function normalizePath(candidate, fallback) {
    if (!candidate) return fallback;
    try {
      const url = new URL(candidate, window.location.origin);
      if (url.origin !== window.location.origin) return fallback;
      const path = `${url.pathname}${url.search}${url.hash}`;
      return path.startsWith('/') ? path : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function getCurrentPath() {
    return `${window.location.pathname}${window.location.search}`;
  }

  function getReturnParam() {
    return normalizePath(new URLSearchParams(window.location.search).get('return'), '');
  }

  function getReturnUrl(fallback) {
    return getReturnParam() || fallback;
  }

  function withReturn(target, returnTarget) {
    const url = new URL(target, window.location.origin);
    const safeReturn = normalizePath(returnTarget || getCurrentPath(), '/index.html');
    url.searchParams.set('return', safeReturn);
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function applyReturnLink(target, fallback) {
    const element = typeof target === 'string' ? document.querySelector(target) : target;
    if (!element) return fallback;
    const resolved = getReturnUrl(fallback);
    element.setAttribute('href', resolved);
    return resolved;
  }

  function navigateToReturn(fallback) {
    window.location.href = getReturnUrl(fallback);
  }

  window.AppReturn = {
    getCurrentPath,
    getReturnParam,
    getReturnUrl,
    withReturn,
    applyReturnLink,
    navigateToReturn,
  };
})();
