(function () {
  'use strict';

  const ROLE_LABELS = {
    admin: '\u7cfb\u7edf\u7ba1\u7406\u5458',
    manager: '\u7ecf\u7406 / \u4e3b\u7ba1',
    standard_quote_specialist: '\u6807\u51c6\u62a5\u4ef7\u4e13\u5458',
    project_quote_specialist: '\u9879\u76ee\u578b\u62a5\u4ef7\u4e13\u5458'
  };

  const ICONS = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 13h7V4H4v9zm9 7h7V4h-7v16zM4 20h7v-5H4v5z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    standardQuotes: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M8 9.5h8M8 13h8M8 16.5h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    projectQuotes: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h3A2.5 2.5 0 0 1 12 7.5v0A2.5 2.5 0 0 0 14.5 10h3A2.5 2.5 0 0 1 20 12.5v4A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9z" stroke="currentColor" stroke-width="1.7"/><path d="M9 12h6M9 15h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    projects: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 19h16M6 19V8l6-4 6 4v11M9 10h6M9 13h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    receptions: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 19v-4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4M9 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm6 2a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    suppliers: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 20s7-3.5 7-8.5A7 7 0 1 0 5 11.5C5 16.5 12 20 12 20z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="11" r="2.5" stroke="currentColor" stroke-width="1.7"/></svg>',
    templates: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 5h12v14H6z" stroke="currentColor" stroke-width="1.7"/><path d="M9 9h6M9 12h6M9 15h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    documents: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 4h7l4 4v12H7z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M14 4v4h4M9 13h6M9 16h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    itemTypes: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 7h12M6 12h12M6 17h7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="17" cy="17" r="3" stroke="currentColor" stroke-width="1.7"/></svg>',
    admin: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-3z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9.5 12.5l1.5 1.5 3.5-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  const NAV_GROUPS = [
    {
      key: 'dashboard',
      label: '\u5de5\u4f5c\u53f0',
      items: [
        { key: 'dashboard', icon: ICONS.dashboard, label: '\u9996\u9875 / Dashboard', note: '\u5f53\u65e5\u4efb\u52a1\u4e0e\u8fd0\u8425\u6982\u89c8', href: '/index.html', match: ['/index.html', '/'] }
      ]
    },
    {
      key: 'quotes',
      label: '\u62a5\u4ef7\u7ba1\u7406',
      items: [
        { key: 'standard-quotes', icon: ICONS.standardQuotes, label: '\u6807\u51c6\u62a5\u4ef7', note: '\u65e5\u5e38\u5546\u52a1\u62a5\u4ef7', href: '/standard-quotes.html', permission: 'standard_quote.view' },
        { key: 'project-quotes', icon: ICONS.projectQuotes, label: '\u9879\u76ee\u578b\u62a5\u4ef7', note: '\u4f1a\u8bae\u4e0e\u6d3b\u52a8\u9879\u76ee', href: '/project-quotes.html', permission: 'project_quote.view' }
      ]
    },
    {
      key: 'projects',
      label: '\u9879\u76ee\u4e0e\u6267\u884c',
      items: [
        { key: 'projects', icon: ICONS.projects, label: '\u9879\u76ee\u5361\u6863 / \u9879\u76ee\u7ba1\u7406', note: '\u9879\u76ee\u6863\u6848\u4e0e\u627f\u63a5\u8ddf\u8fdb', href: '/projects.html', permission: 'standard_quote.view' },
        { key: 'receptions', icon: ICONS.receptions, label: '\u63a5\u5f85\u7ba1\u7406', note: '\u6267\u884c\u4efb\u52a1\u548c\u6392\u671f', href: '/receptions.html', permission: 'standard_quote.view' }
      ]
    },
    {
      key: 'resources',
      label: '\u8d44\u6e90\u4e0e\u4e3b\u6570\u636e',
      items: [
        { key: 'suppliers', icon: ICONS.suppliers, label: '\u4f9b\u5e94\u5546\u7ba1\u7406', note: '\u4ef7\u683c\u5e93\u4e0e\u4f9b\u5e94\u5546\u4fe1\u606f', href: '/suppliers.html', permission: 'supplier.view' },
        { key: 'templates', icon: ICONS.templates, label: '\u6a21\u677f\u7ba1\u7406', note: '\u62a5\u4ef7\u6a21\u677f\u4e0e\u590d\u7528\u8d44\u4ea7', href: '/templates.html', permission: 'standard_quote.view' },
        { key: 'documents', icon: ICONS.documents, label: '\u6587\u6863\u7ba1\u7406', note: '\u6587\u6863\u6e90\u6570\u636e\u9884\u89c8', href: '/documents.html', permission: 'standard_quote.view' },
        { key: 'item-types', icon: ICONS.itemTypes, label: '\u9879\u76ee\u7c7b\u578b\u7ba1\u7406', note: '\u62a5\u4ef7\u660e\u7ec6\u7c7b\u578b\u7ef4\u62a4', href: '/item-types.html', permission: 'project_type.view' }
      ]
    },
    {
      key: 'system',
      label: '\u7cfb\u7edf\u7ba1\u7406',
      items: [
        { key: 'admin-permissions', icon: ICONS.admin, label: '\u6743\u9650\u7ba1\u7406', note: '\u7528\u6237\u3001\u89d2\u8272\u4e0e\u6743\u9650', href: '/admin-permissions.html', permission: 'user.view' }
      ]
    }
  ];

  const PAGE_META = {
    '/index.html': { eyebrow: '\u5de5\u4f5c\u53f0', title: '\u8fd0\u8425\u5de5\u4f5c\u53f0', subtitle: '\u9996\u9875\u4fdd\u6301\u201c\u5de5\u4f5c\u53f0\u201d\u5b9a\u4f4d\uff0c\u5168\u5c40\u5bfc\u822a\u5219\u627f\u62c5\u957f\u671f\u6a21\u5757\u5165\u53e3\u3002' },
    '/standard-quotes.html': { eyebrow: '\u62a5\u4ef7\u7ba1\u7406', title: '\u6807\u51c6\u62a5\u4ef7', subtitle: '\u9762\u5411\u65e5\u5e38\u5546\u52a1\u63a5\u5f85\u4e0e\u5e38\u89c4\u62a5\u4ef7\u6d41\u7a0b\u3002' },
    '/project-quotes.html': { eyebrow: '\u62a5\u4ef7\u7ba1\u7406', title: '\u9879\u76ee\u578b\u62a5\u4ef7', subtitle: '\u9762\u5411\u4f1a\u8bae\u3001\u5c55\u4f1a\u4e0e\u6d3b\u52a8\u7c7b\u590d\u6742\u62a5\u4ef7\u3002' },
    '/projects.html': { eyebrow: '\u9879\u76ee\u4e0e\u6267\u884c', title: '\u9879\u76ee\u5361\u6863 / \u9879\u76ee\u7ba1\u7406', subtitle: '\u4ece\u62a5\u4ef7\u5411\u9879\u76ee\u6863\u6848\u4e0e\u6267\u884c\u7ebf\u7d22\u8fc7\u6e21\u3002' },
    '/receptions.html': { eyebrow: '\u9879\u76ee\u4e0e\u6267\u884c', title: '\u63a5\u5f85\u7ba1\u7406', subtitle: '\u805a\u7126\u6267\u884c\u4efb\u52a1\u3001\u4eba\u5458\u5b89\u6392\u4e0e\u63a5\u5f85\u95ed\u73af\u3002' },
    '/suppliers.html': { eyebrow: '\u8d44\u6e90\u4e0e\u4e3b\u6570\u636e', title: '\u4f9b\u5e94\u5546\u7ba1\u7406', subtitle: '\u96c6\u4e2d\u7ef4\u62a4\u4f9b\u5e94\u5546\u4ef7\u683c\u5e93\u548c\u4e3b\u6570\u636e\u3002' },
    '/templates.html': { eyebrow: '\u8d44\u6e90\u4e0e\u4e3b\u6570\u636e', title: '\u6a21\u677f\u7ba1\u7406', subtitle: '\u6c89\u6dc0\u9ad8\u9891\u62a5\u4ef7\u6a21\u677f\uff0c\u63d0\u9ad8\u590d\u7528\u6548\u7387\u3002' },
    '/documents.html': { eyebrow: '\u8d44\u6e90\u4e0e\u4e3b\u6570\u636e', title: '\u6587\u6863\u7ba1\u7406', subtitle: '\u4ee5\u6e90\u6570\u636e\u89c6\u89d2\u67e5\u770b\u6587\u6863\u51c6\u5907\u5ea6\u3002' },
    '/item-types.html': { eyebrow: '\u8d44\u6e90\u4e0e\u4e3b\u6570\u636e', title: '\u9879\u76ee\u7c7b\u578b\u7ba1\u7406', subtitle: '\u7ef4\u62a4\u62a5\u4ef7\u660e\u7ec6\u7684\u7c7b\u578b\u4e0e\u5206\u7c7b\u3002' },
    '/admin-permissions.html': { eyebrow: '\u7cfb\u7edf\u7ba1\u7406', title: '\u6743\u9650\u7ba1\u7406', subtitle: '\u7edf\u4e00\u7ba1\u7406\u7528\u6237\u3001\u89d2\u8272\u4e0e\u6743\u9650\u6388\u6743\u3002' }
  };

  function normalizePath(pathname) {
    if (!pathname || pathname === '/') return '/index.html';
    return pathname;
  }

  function parseRoles(roles) {
    if (!Array.isArray(roles)) return [];
    return roles.map((role) => {
      if (typeof role === 'string') return role;
      if (!role || typeof role !== 'object') return '';
      return role.code || role.id || role.name || '';
    }).filter(Boolean);
  }

  function getPrimaryRole(user) {
    const roles = parseRoles(user && user.roles);
    const order = ['admin', 'manager', 'standard_quote_specialist', 'project_quote_specialist'];
    for (const code of order) {
      if (roles.includes(code)) return code;
    }
    return roles[0] || '';
  }

  function getRoleLabel(user) {
    const code = getPrimaryRole(user);
    return ROLE_LABELS[code] || '\u901a\u7528\u5de5\u4f5c\u53f0';
  }

  function getCurrentUser() {
    return window.__CURRENT_USER__ || { display_name: '\u8fd0\u8425\u6210\u5458', roles: [], permissions: [] };
  }

  function canAccess(permissionCode) {
    if (!permissionCode) return true;
    if (typeof window.can === 'function') return window.can(permissionCode);
    const permissions = getCurrentUser().permissions || [];
    return permissions.includes('*') || permissions.includes(permissionCode);
  }

  function getVisibleGroups() {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccess(item.permission))
    })).filter((group) => group.items.length > 0);
  }

  function getCurrentPath() {
    return normalizePath(window.location.pathname);
  }

  function getActiveItem(groups, path) {
    for (const group of groups) {
      for (const item of group.items) {
        const matches = item.match || [item.href];
        if (matches.includes(path)) {
          return { group, item };
        }
      }
    }
    return null;
  }

  function ensureShell() {
    if (document.querySelector('.fy-app-shell')) return document.querySelector('.fy-app-shell');

    document.body.classList.add('fy-app-body');

    const shell = document.createElement('div');
    shell.className = 'fy-app-shell';
    shell.innerHTML = [
      '<header class="fy-app-topbar">',
      '  <a class="fy-app-brand" href="/index.html">',
      '    <div class="fy-app-brand-mark"><img src="/assets/logo.png" alt="Feiyang" /></div>',
      '    <div class="fy-app-brand-copy">',
      '      <span class="fy-app-brand-title">\u98de\u626c\u56fd\u9645\u65c5\u884c\u793e</span>',
      '      <span class="fy-app-brand-subtitle">Business Travel Operations System</span>',
      '    </div>',
      '  </a>',
      '  <div class="fy-app-topbar-right">',
      '    <div class="fy-app-account" id="fy-app-account">',
      '      <a class="fy-app-user-link" href="/profile.html" title="\u4e2a\u4eba\u8bbe\u7f6e">',
      '        <div class="fy-app-avatar" id="fy-app-avatar">?</div>',
      '        <div class="fy-app-user-copy">',
      '          <span class="fy-app-user-name" id="fy-app-user-name">\u8fd0\u8425\u6210\u5458</span>',
      '          <span class="fy-app-role-badge" id="fy-app-role-badge">\u901a\u7528\u5de5\u4f5c\u53f0</span>',
      '        </div>',
      '      </a>',
      '      <button class="fy-app-logout" id="fy-app-logout" type="button">\u9000\u51fa\u767b\u5f55</button>',
      '    </div>',
      '  </div>',
      '</header>',
      '<div class="fy-app-layout">',
      '  <aside class="fy-app-sidebar">',
      '    <div class="fy-app-sidebar-head">',
      '      <span class="fy-app-brand-subtitle">\u5168\u5c40\u5bfc\u822a</span>',
      '      <strong class="fy-app-sidebar-title">\u8fd0\u8425\u4e2d\u53f0\u6a21\u5757\u5165\u53e3</strong>',
      '      <p class="fy-app-sidebar-copy">\u5de5\u4f5c\u53f0\u8d1f\u8d23\u4efb\u52a1\u7126\u70b9\uff0c\u5de6\u4fa7\u5bfc\u822a\u627f\u62c5\u7a33\u5b9a\u957f\u671f\u5165\u53e3\u3002</p>',
      '    </div>',
      '    <nav class="fy-app-nav" id="fy-app-nav"></nav>',
      '  </aside>',
      '  <main class="fy-app-main">',
      '    <div class="fy-app-page-head">',
      '      <div class="fy-app-page-meta">',
      '        <span class="fy-app-page-eyebrow" id="fy-app-page-eyebrow"></span>',
      '        <h1 class="fy-app-page-title" id="fy-app-page-title"></h1>',
      '        <p class="fy-app-page-subtitle" id="fy-app-page-subtitle"></p>',
      '      </div>',
      '      <span class="fy-app-page-badge" id="fy-app-page-badge">V2</span>',
      '    </div>',
      '    <div class="fy-app-content" id="fy-app-content"></div>',
      '  </main>',
      '</div>'
    ].join('');

    const content = shell.querySelector('#fy-app-content');
    const movableNodes = Array.from(document.body.childNodes).filter((node) => {
      if (node === shell) return false;
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SCRIPT') return false;
      return !(node.nodeType === Node.TEXT_NODE && !node.textContent.trim());
    });

    movableNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.classList.contains('page-shell')) {
          node.classList.add('fy-shell-page-shell');
          const topbar = node.querySelector(':scope > .topbar');
          if (topbar && !topbar.querySelector('.topbar-actions')) {
            topbar.classList.add('fy-app-topbar-empty');
          }
        }
        if (node.classList.contains('fy-home-shell')) node.classList.add('fy-shell-home-shell');
        if (node.classList.contains('admin-shell')) node.classList.add('fy-shell-admin-shell');
      }
      content.appendChild(node);
    });

    document.body.appendChild(shell);

    shell.querySelector('#fy-app-logout').addEventListener('click', function () {
      localStorage.removeItem('app_token');
      localStorage.removeItem('app_refresh_token');
      window.location.href = '/login.html';
    });

    return shell;
  }

  function renderNav(shell) {
    const groups = getVisibleGroups();
    const path = getCurrentPath();
    const active = getActiveItem(groups, path);
    const nav = shell.querySelector('#fy-app-nav');
    nav.innerHTML = groups.map((group) => {
      const links = group.items.map((item) => {
        const isActive = active && active.item.key === item.key;
        return '<a class="fy-app-nav-link' + (isActive ? ' is-active' : '') + '" href="' + item.href + '"' + (isActive ? ' aria-current="page"' : '') + '>' +
          '<span class="fy-app-nav-icon">' + (item.icon || ICONS.dashboard) + '</span>' +
          '<span class="fy-app-nav-copy">' +
            '<span class="fy-app-nav-label">' + item.label + '</span>' +
            '<span class="fy-app-nav-note">' + item.note + '</span>' +
          '</span>' +
          '</a>';
      }).join('');
      return '<section class="fy-app-nav-group">' +
        '<div class="fy-app-nav-group-title">' + group.label + '</div>' +
        '<div class="fy-app-nav-list">' + links + '</div>' +
        '</section>';
    }).join('');

    const meta = PAGE_META[path] || PAGE_META['/index.html'];
    shell.querySelector('#fy-app-page-eyebrow').textContent = meta.eyebrow;
    shell.querySelector('#fy-app-page-title').textContent = meta.title;
    shell.querySelector('#fy-app-page-subtitle').textContent = meta.subtitle;
    shell.querySelector('#fy-app-page-badge').textContent = active ? active.group.label : '\u5168\u5c40\u5bfc\u822a';
    shell.querySelector('.fy-app-page-head').style.display = path === '/index.html' ? 'none' : 'flex';
  }

  function renderUser(shell) {
    const user = getCurrentUser();
    const displayName = user.display_name || user.email || '\u8fd0\u8425\u6210\u5458';
    const roleLabel = getRoleLabel(user);
    const avatar = displayName.trim().charAt(0).toUpperCase() || 'F';
    shell.querySelector('#fy-app-user-name').textContent = displayName;
    shell.querySelector('#fy-app-role-badge').textContent = roleLabel;
    shell.querySelector('#fy-app-avatar').textContent = avatar;
  }

  function mountShell() {
    const path = getCurrentPath();
    if (!PAGE_META[path]) return;
    const shell = ensureShell();
    renderNav(shell);
    renderUser(shell);
  }

  if (document.body) {
    mountShell();
  } else {
    document.addEventListener('DOMContentLoaded', mountShell, { once: true });
  }
  document.addEventListener('authReady', mountShell);
})();
