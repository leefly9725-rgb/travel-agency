window.AppUtils = {
  showMessage(elementId, text, type) {
    const box = document.getElementById(elementId);
    if (!box) {
      return;
    }
    if (!text) {
      box.textContent = "";
      box.className = "message-box hidden";
      return;
    }
    box.textContent = text;
    box.className = `message-box ${type === "error" ? "error" : "success"}`;
  },

  hideMessage(elementId) {
    this.showMessage(elementId, "", "success");
  },

  async fetchJson(url, options, fallbackMessage) {
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const token = isDev
      ? (window.AuthStore?.getToken() || 'dev-bypass-token')
      : window.AuthStore?.getToken();
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
    const mergedOptions = {
      ...options,
      headers: {
        ...authHeaders,
        ...(options?.headers || {}),
      },
    };
    const response = await fetch(url, mergedOptions);
    let payload;
    try {
      payload = await response.json();
    } catch (_e) {
      throw new Error(fallbackMessage || "服务器响应格式错误，请稍后重试。");
    }
    if (!response.ok) {
      if (response.status === 401) {
        window.AuthStore ? window.AuthStore.clearSession() : localStorage.removeItem('app_token');
        window.location.href = '/login.html';
        return;
      }
      const err = new Error(payload.message || payload.error || fallbackMessage || "请求失败，请稍后重试。");
      err.status = response.status;
      throw err;
    }
    return payload;
  },

  setFlash(message, type) {
    sessionStorage.setItem("lds_ops_flash", JSON.stringify({
      message,
      type: type || "success",
    }));
  },

  consumeFlash() {
    const raw = sessionStorage.getItem("lds_ops_flash");
    if (!raw) {
      return null;
    }
    sessionStorage.removeItem("lds_ops_flash");
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  applyFlash(elementId) {
    const flash = this.consumeFlash();
    if (!flash) {
      return;
    }
    this.showMessage(elementId, flash.message, flash.type);
  },

  formatCurrency(value, currency) {
    const normalizedCurrency = String(currency || "EUR").toUpperCase();
    const currencySymbolMap = {
      EUR: "EUR",
      RSD: "RSD",
      KM: "KM",
      ALL: "ALL",
      RMB: "RMB",
    };
    const displayCode = currencySymbolMap[normalizedCurrency] || normalizedCurrency;
    const amount = Number(value || 0).toFixed(2);
    return `${displayCode} ${amount}`;
  },

  formatCurrencyWithLabel(value, currency) {
    const label = window.AppUi?.getLabel("currencyLabels", currency) || currency;
    return `${this.formatCurrency(value, currency)}（${label}）`;
  },

  getToday() {
    return new Date().toISOString().slice(0, 10);
  },

  getNextHourDateTimeLocal() {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hour = String(now.getHours()).padStart(2, "0");
    const minute = String(now.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hour}:${minute}`;
  },

  setChineseValidity(root) {
    const fields = root.querySelectorAll("input, select, textarea");
    fields.forEach((field) => {
      const label = field.closest("label")?.querySelector("span")?.textContent?.trim() || "该字段";
      field.addEventListener("invalid", () => {
        if (field.validity.valueMissing) {
          field.setCustomValidity(`请填写${label}。`);
        } else if (field.validity.badInput || field.validity.typeMismatch) {
          field.setCustomValidity(`${label}格式不正确，请重新输入。`);
        } else if (field.validity.rangeUnderflow) {
          field.setCustomValidity(`${label}不能小于最小值。`);
        } else if (field.validity.rangeOverflow) {
          field.setCustomValidity(`${label}不能超过最大值。`);
        } else {
          field.setCustomValidity("");
        }
      });
      field.addEventListener("input", () => {
        field.setCustomValidity("");
      });
      field.addEventListener("change", () => {
        field.setCustomValidity("");
      });
    });
  },

  calculateInclusiveDays(startDate, endDate) {
    if (!startDate || !endDate) {
      return 1;
    }
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    const diff = end.getTime() - start.getTime();
    return Math.floor(diff / (24 * 60 * 60 * 1000)) + 1;
  },

  renderEmptyState(title, description) {
    return `
      <section class="panel">
        <div class="empty-state">
          <h2>${title}</h2>
          <p>${description}</p>
        </div>
      </section>
    `;
  },
};
