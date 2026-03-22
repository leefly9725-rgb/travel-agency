# lds-frontend-ui — Gotchas

## 1. UI 文字必须加入 web/ui-labels.js，不能硬编码

```js
// 错误：直接写中文字符串
el.textContent = '报价单号';

// 正确：通过 ui-labels.js
import { labels } from './ui-labels.js';
el.textContent = labels.quoteNumber;
// 在 ui-labels.js 中添加: quoteNumber: '报价单号'
```

---

## 2. 页面间不共享 JS 变量，只共享 web/app.js 和 web/app-utils.js

每个 `.html` 文件是独立页面（非 SPA），用户导航是完整的页面跳转。不要尝试通过全局变量在页面间传递数据，应用 URL 参数或 localStorage。

---

## 3. styles.css 是单一全局样式文件，修改影响所有页面

修改 `web/styles.css` 时：
- 先确认改动的 class 只在目标页面使用，不会影响其他页面
- 或者给 class 加页面前缀（如 `.quotes-page .card`）

---

## 4. 卡片点击事件绑定位置错误是当前已知 Bug

`web/quotes.html` 的卡片点击事件只绑定在 `<h3>` 上，点击卡片其他区域无响应。

```js
// 找到这个模式并修复：
document.querySelectorAll('.quote-card h3').forEach(el => {
  el.onclick = () => location.href = '/quote-detail.html?id=' + el.dataset.id;
});

// 改为：
document.querySelectorAll('.quote-card').forEach(card => {
  card.style.cursor = 'pointer';
  card.onclick = () => location.href = '/quote-detail.html?id=' + card.dataset.id;
});
```

---

## 5. 表格 `table-layout: fixed` 要配合明确的列宽才有效

```css
/* 没用：table-layout: fixed 但没有列宽 */
.items-table { table-layout: fixed; }  /* 列宽还是自动的 */

/* 有用：配合 col 宽度 */
.items-table { table-layout: fixed; width: 100%; }
.items-table .col-type { width: 90px; }
.items-table .col-name { /* 无宽度 = 吸收剩余 */ }
```

---

## 6. 修改 styles.css 后必须刷新所有相关页面验证

浏览器可能缓存旧 CSS。开发时用 `Ctrl+Shift+R` 强制刷新，或在 DevTools Network 中勾选 "Disable cache"。
