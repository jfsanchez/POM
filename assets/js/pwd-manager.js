"use strict";
(function () {
  /* ===== State (RAM only) ===== */
  var S = {
    items: [],
    vaults: {},
    vaultOrder: [],
    password: null,
    fileName: null,
    showAllUsers: false,
    showAllNotes: false,
    showAllOtps: false,
    typeFilter: [],
    usernamesVisible: {},
    passwordsVisible: {},
    notesVisible: {},
    otpsVisible: {},
    customFieldsOpen: {},
    filesOpen: {},
    editingId: null,
    emptyVaultMode: false,
    fileSource: null,
    gridCols: 3,
    tempFiles: [],
    totpCache: {},
    tickHandle: null
  };

  /* ===== DOM refs ===== */
  var lockScreen = document.getElementById("lock-screen");
  var appScreen = document.getElementById("app-screen");
  var unlockForm = document.getElementById("unlock-form");
  var passwordInput = document.getElementById("password");
  var lockError = document.getElementById("lock-error");
  var unlockBtn = document.getElementById("unlock-btn");
  var togglePw = document.getElementById("toggle-pw");
  var lockBtn = document.getElementById("lock-btn");
  var fileInput = document.getElementById("file-input");
  var pickerText = document.getElementById("picker-text");
  var pickerLabel = document.getElementById("file-picker-label");
  var fileStatus = document.getElementById("file-status");
  var fileStatusIcon = document.getElementById("file-status-icon");
  var fileStatusName = document.getElementById("file-status-name");
  var fileStatusSource = document.getElementById("file-status-source");
  var fileStatusClear = document.getElementById("file-status-clear");
  var fileSourceOptions = document.getElementById("file-source-options");
  var optionsSection = document.querySelector(".options-section");
  var loadDefaultBtn = document.getElementById("load-default-btn");
  var createVaultBtn = document.getElementById("create-vault-btn");
  var defShowUsers = document.getElementById("def-show-users");
  var defShowOtps = document.getElementById("def-show-otps");
  var defShowNotes = document.getElementById("def-show-notes");
  var itemsList = document.getElementById("items-list");
  var emptyState = document.getElementById("empty-state");
  var searchInput = document.getElementById("search");
  var showAllToggle = document.getElementById("show-all-users");
  var showAllNotesToggle = document.getElementById("show-all-notes");
  var showAllOtpsToggle = document.getElementById("show-all-otps");
  var viewOptionsBtn = document.getElementById("view-options-btn");
  var viewDropdown = document.getElementById("view-dropdown");
  var viewSummary = document.getElementById("view-summary");
  var gridBtn = document.getElementById("grid-btn");
  var gridLabel = document.getElementById("grid-label");
  var vdTypes = document.getElementById("vd-types");
  var viewOpen = false;
  var addBtn = document.getElementById("add-btn");
  var exportBtn = document.getElementById("export-btn");
  var changePwBtn = document.getElementById("change-pw-btn");
  var itemCount = document.getElementById("item-count");

  /* Modals */
  var itemModal = document.getElementById("item-modal");
  var pwModal = document.getElementById("pw-modal");
  var createModal = document.getElementById("create-modal");

  /* Item modal fields */
  var itemModalTitle = document.getElementById("item-modal-title");
  var itemName = document.getElementById("item-name");
  var itemVault = document.getElementById("item-vault");
  var itemType = document.getElementById("item-type");
  var itemEmail = document.getElementById("item-email");
  var itemUsername = document.getElementById("item-username");
  var itemPassword = document.getElementById("item-password");
  var genPassword = document.getElementById("gen-password");
  var itemTotp = document.getElementById("item-totp");
  var itemUrl = document.getElementById("item-url");
  var itemNotes = document.getElementById("item-notes");
  var itemError = document.getElementById("item-error");
  var itemSave = document.getElementById("item-save");
  var itemFileInput = document.getElementById("item-file-input");
  var itemFilePicker = document.getElementById("item-file-picker");
  var itemFileText = document.getElementById("item-file-text");
  var itemFilesList = document.getElementById("item-files-list");
  var itemEmailLabel = document.getElementById("item-email-label");

  /* TOTP preview in edit modal */
  var totpPreview = document.getElementById("totp-preview");
  var previewTotpCode = document.getElementById("preview-totp-code");
  var previewTotpNext = document.getElementById("preview-totp-next");
  var previewTotpRing = document.getElementById("preview-totp-ring");
  var totpPreviewTimer = null;

  /* PW modal fields */
  var newPw = document.getElementById("new-pw");
  var newPw2 = document.getElementById("new-pw2");
  var pwError = document.getElementById("pw-error");
  var pwConfirm = document.getElementById("pw-confirm");

  /* Create modal fields */
  var createPw = document.getElementById("create-pw");
  var createPw2 = document.getElementById("create-pw2");
  var createError = document.getElementById("create-error");
  var createConfirm = document.getElementById("create-confirm");

  /* ===== Utilities ===== */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function generateId() {
    var bytes = crypto.getRandomValues(new Uint8Array(12));
    var hex = "";
    for (var i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
    return hex;
  }

  function toast(msg) {
    var t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add("show"); });
    setTimeout(function () {
      t.classList.remove("show");
      setTimeout(function () { t.remove(); }, 300);
    }, 1500);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
    return ok;
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 200);
  }

  function maskText(text, show) {
    if (!text) return "";
    if (show) return text;
    if (text.length <= 3) return text;
    return text.substring(0, 3) + "\u2026\u2026";
  }

  function getDisplayUser(item) { return item.itemUsername || item.itemEmail || ""; }
  function hasTotp(item) { return !!(item.totpUri && item.totpUri.startsWith("otpauth")); }

  /* ===== Base32 (RFC 4648) ===== */
  var B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  function base32Decode(str) {
    var clean = String(str).replace(/\s+/g, "").replace(/=+$/, "").toUpperCase();
    var out = [], buffer = 0, bits = 0;
    for (var i = 0; i < clean.length; i++) {
      var val = B32.indexOf(clean[i]);
      if (val === -1) continue;
      buffer = (buffer << 5) | val;
      bits += 5;
      if (bits >= 8) {
        out.push((buffer >> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    return new Uint8Array(out);
  }

  /* ===== TOTP calculation (RFC 6238) ===== */
  var RING_C = 2 * Math.PI * 12; /* r=12 => ~75.4 */

  function normAlgo(a) {
    var s = String(a || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (s.indexOf("512") !== -1) return "SHA-512";
    if (s.indexOf("256") !== -1) return "SHA-256";
    return "SHA-1";
  }

  function counterBytes(n) {
    var buf = new ArrayBuffer(8);
    var view = new DataView(buf);
    view.setUint32(0, Math.floor(n / 0x100000000));
    view.setUint32(4, n >>> 0);
    return new Uint8Array(buf);
  }

  function hmacSign(keyBytes, msgBytes, algo) {
    return crypto.subtle
      .importKey("raw", keyBytes, { name: "HMAC", hash: algo }, false, ["sign"])
      .then(function (ck) { return crypto.subtle.sign("HMAC", ck, msgBytes); })
      .then(function (sig) { return new Uint8Array(sig); });
  }

  function truncate(sig) {
    var off = sig[sig.length - 1] & 0x0f;
    return (
      ((sig[off] & 0x7f) << 24) |
      ((sig[off + 1] & 0xff) << 16) |
      ((sig[off + 2] & 0xff) << 8) |
      (sig[off + 3] & 0xff)
    );
  }

  function generateTotp(totpUri, offset) {
    offset = offset || 0;
    var config = parseTotpUri(totpUri);
    if (!config) return Promise.reject(new Error("TOTP URI inv\u00e1lido"));
    var counter = Math.floor(Date.now() / 1000 / config.period) + offset;
    var key = base32Decode(config.secret);
    return hmacSign(key, counterBytes(counter), config.algorithm).then(function (sig) {
      var num = truncate(sig);
      var mod = Math.pow(10, config.digits);
      return {
        code: String(num % mod).padStart(config.digits, "0"),
        remaining: config.period - (Math.floor(Date.now() / 1000) % config.period),
        period: config.period,
        config: config
      };
    });
  }

  function parseTotpUri(uri) {
    try {
      var u = new URL(uri);
      if (u.protocol !== "otpauth:") return null;
      var p = u.searchParams;
      var secret = (p.get("secret") || "").replace(/\s/g, "");
      if (!secret) return null;
      return {
        secret: secret,
        period: parseInt(p.get("period"), 10) || 30,
        digits: parseInt(p.get("digits"), 10) || 6,
        algorithm: normAlgo(p.get("algorithm") || "SHA1")
      };
    } catch (e) { return null; }
  }

  /* ===== OpenPGP helpers ===== */
  async function decryptPGP(binaryData, password) {
    var head = new TextDecoder().decode(binaryData.slice(0, 100));
    var message;
    if (head.startsWith("-----BEGIN PGP")) {
      var armored = new TextDecoder().decode(binaryData);
      message = await openpgp.readMessage({ armoredMessage: armored });
    } else {
      message = await openpgp.readMessage({ binaryMessage: binaryData });
    }
    var result = await openpgp.decrypt({
      message: message,
      passwords: [password],
      format: 'utf8'
    });
    return result.data;
  }

  async function encryptPGP(plaintext, password) {
    var message = await openpgp.createMessage({ text: plaintext });
    var encrypted = await openpgp.encrypt({
      message: message,
      passwords: [password],
      format: 'binary'
    });
    return encrypted;
  }

  /* ===== ZIP handling ===== */
  async function decryptZip(zipData, password) {
    var zip = await JSZip.loadAsync(zipData);
    var files = zip.files;
    /* Si el zip contiene un data.json directamente, es un zip sin cifrar */
    var jsonFile = null;
    for (var path in files) {
      if (path.endsWith("data.json") && !files[path].dir) {
        jsonFile = files[path];
        break;
      }
    }
    if (jsonFile) {
      return await jsonFile.async("string");
    }
    /* Zip cifrado: buscar Proton Pass/data.pgp */
    var pgpFile = null;
    for (path in files) {
      if (path.endsWith("data.pgp") && !files[path].dir) {
        pgpFile = files[path];
        break;
      }
    }
    if (!pgpFile) throw new Error("No se encontr\u00f3 data.json ni data.pgp en el zip");
    var pgpData = await pgpFile.async("uint8array");
    return await decryptPGP(pgpData, password);
  }

  async function encryptAndZip(plaintext, password) {
    var encrypted = await encryptPGP(plaintext, password);
    var zip = new JSZip();
    zip.file("Proton Pass/data.pgp", encrypted);
    for (var i = 0; i < S.items.length; i++) {
      var itemFiles = S.items[i].files || [];
      for (var j = 0; j < itemFiles.length; j++) {
        var f = itemFiles[j];
        if (f.data) {
          var bytes = base64ToBytes(f.data);
          zip.file("files/" + f.name, bytes);
        }
      }
    }
    var blob = await zip.generateAsync({ type: "blob" });
    return blob;
  }

  function base64ToBytes(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function generatePassword(length) {
    length = length || 20;
    var charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
    var values = crypto.getRandomValues(new Uint8Array(length));
    var result = "";
    for (var i = 0; i < length; i++) result += charset[values[i] % charset.length];
    return result;
  }

  /* ===== Type config ===== */
  var TYPE_ICONS = {
    login: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.778-7.778zm0 0L15.5 6.5m0 0 3 3L22 6l-3-3"/></svg>',
    note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>',
    alias: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="m22 6-10 7L2 6"/></svg>',
    creditCard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/><path d="M5 14h2"/><path d="M9 14h4"/></svg>',
    identity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M16 11h2"/><path d="M18 13h2"/></svg>',
    password: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
  };

  var TYPE_COLORS = {
    login: "#7c4dff",
    note: "#d4a017",
    alias: "#6b7280",
    creditCard: "#2d7d46",
    identity: "#0d9488",
    password: "#b91c1c"
  };

  var TYPE_LABELS = {
    login: "Inicio de sesi\u00f3n",
    note: "Nota",
    alias: "Alias",
    creditCard: "Tarjeta",
    identity: "Identidad",
    password: "Contrase\u00f1a"
  };

  /* Type-specific content fields: { key, label, render(show/hide), copy } */
  var TYPE_FIELDS = {
    creditCard: [
      { key: "cardNumber", label: "N\u00famero", masked: true },
      { key: "cardholderName", label: "Titular" },
      { key: "expirationDate", label: "Caducidad" },
      { key: "cvv", label: "CVV", masked: true },
      { key: "pin", label: "PIN", masked: true }
    ],
    identity: [
      { key: "firstName", label: "Nombre" },
      { key: "lastName", label: "Apellido" },
      { key: "email", label: "Email" },
      { key: "phoneNumber", label: "Tel\u00e9fono" },
      { key: "organization", label: "Organizaci\u00f3n" },
      { key: "streetAddress", label: "Direcci\u00f3n" },
      { key: "city", label: "Ciudad" },
      { key: "state", label: "Estado/Provincia" },
      { key: "zipOrPostalCode", label: "C\u00f3digo postal" },
      { key: "country", label: "Pa\u00eds" },
      { key: "birthDate", label: "Fecha de nacimiento" }
    ],
    password: []
  };

  /* ===== Data parsing ===== */
  function parseData(jsonStr) {
    var data;
    try { data = JSON.parse(jsonStr); } catch (e) { throw new Error("JSON inv\u00e1lido"); }
    if (!data.vaults || typeof data.vaults !== "object") {
      throw new Error("Formato no reconocido: falta 'vaults'");
    }
    S.vaults = {};
    S.vaultOrder = [];
    S.items = [];
    for (var shareId in data.vaults) {
      var vault = data.vaults[shareId];
      S.vaults[shareId] = {
        name: vault.name || shareId,
        description: vault.description || "",
        color: (vault.display && vault.display.color) || 0,
        icon: (vault.display && vault.display.icon) || 0
      };
      S.vaultOrder.push(shareId);
      if (vault.items && Array.isArray(vault.items)) {
        for (var i = 0; i < vault.items.length; i++) {
          var it = vault.items[i];
          if (it.state === 2) continue;
          var d = it.data || {};
          var m = d.metadata || {};
          var c = d.content || {};
          var rawContent = {};
          for (var _k in c) { if (c.hasOwnProperty(_k)) rawContent[_k] = c[_k]; }
          S.items.push({
            itemId: it.itemId || generateId(),
            shareId: it.shareId || shareId,
            name: m.name || "Sin nombre",
            note: m.note || "",
            type: d.type || "login",
            itemEmail: c.itemEmail || "",
            itemUsername: c.itemUsername || "",
            password: c.password || "",
            urls: c.urls || [],
            totpUri: c.totpUri || "",
            extraFields: d.extraFields || [],
            rawContent: rawContent,
            state: it.state || 1,
            createTime: it.createTime || 0,
            modifyTime: it.modifyTime || 0,
            files: [],
            aliasEmail: it.aliasEmail || ""
          });
        }
      }
    }
    S.emptyVaultMode = false;
  }

  function buildData() {
    var groups = {};
    for (var i = 0; i < S.items.length; i++) {
      var item = S.items[i];
      var sid = item.shareId || "default";
      if (!groups[sid]) groups[sid] = [];
      var content = item.rawContent ? JSON.parse(JSON.stringify(item.rawContent)) : {};
      content.itemEmail = item.itemEmail || "";
      content.itemUsername = item.itemUsername || "";
      content.password = item.password || "";
      content.urls = item.urls || [];
      content.totpUri = item.totpUri || "";
      content.passkeys = content.passkeys || [];
      groups[sid].push({
        itemId: item.itemId,
        shareId: sid,
        data: {
          metadata: { name: item.name, note: item.note || "", itemUuid: (item.itemId || "").substring(0, 8) },
          extraFields: item.extraFields || [],
          type: item.type || "login",
          content: content
        },
        state: 1,
        aliasEmail: item.type === "alias" ? (item.aliasEmail || null) : null,
        contentFormatVersion: 1,
        createTime: item.createTime || Math.floor(Date.now() / 1000),
        modifyTime: Math.floor(Date.now() / 1000),
        pinned: false
      });
    }
    var vaults = {};
    for (var j = 0; j < S.vaultOrder.length; j++) {
      var sid2 = S.vaultOrder[j];
      var v = S.vaults[sid2] || { name: "B\u00f3veda", description: "", display: { color: 1, icon: 1 } };
      vaults[sid2] = {
        name: v.name,
        description: v.description || "",
        display: { color: v.color || 1, icon: v.icon || 1 },
        items: groups[sid2] || []
      };
    }
    return JSON.stringify({
      version: "1.21.2",
      userId: "",
      encrypted: false,
      vaults: vaults
    });
  }

  /* ===== Vault colors ===== */
  var VAULT_COLORS = ["#7c4dff", "#00e5ff", "#69f0ae", "#ff5252", "#ffb74d", "#ff4081", "#b388ff", "#18ffff"];

  function getVaultColor(shareId) {
    var v = S.vaults[shareId];
    if (v && v.color !== undefined) return VAULT_COLORS[v.color % VAULT_COLORS.length];
    return VAULT_COLORS[0];
  }

  function getVaultName(shareId) {
    var v = S.vaults[shareId];
    return v ? v.name : shareId;
  }

  var FAVICON_COLORS = ["#e74c3c","#e67e22","#f1c40f","#2ecc71","#1abc9c","#3498db","#9b59b6","#e91e63","#00bcd4","#ff5722","#607d8b","#795548"];

  function faviconColor(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = ((h << 5) - h) + name.charCodeAt(i);
    return FAVICON_COLORS[Math.abs(h) % FAVICON_COLORS.length];
  }

  /* ===== Rendering ===== */
  var SVG_LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
  var SVG_UNLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';
  var SVG_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
  var SVG_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
  var SVG_DELETE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6M14 11v6"/></svg>';
  var SVG_CHEVRON_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
  var SVG_EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var SVG_EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10 10 0 0 1 12 5c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.56 3.68M6.06 6.06a10 10 0 0 0-2.54 5.94 10 10 0 0 0 8.48 5.94 10 10 0 0 0 4.6-.86M2 2l20 20"/></svg>';
  var SVG_DOWNLOAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>';
  var SVG_USER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  var SVG_NOTE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
  var SVG_OTP_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M22 12c0 5.5-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2s10 4.5 10 10Z"/><path d="m15 9-6 6"/></svg>';

  function renderItems() {
    itemsList.innerHTML = "";
    S.totpCache = {};
    var q = searchInput.value.trim().toLowerCase();
    var tf = S.typeFilter;
    var visible = 0;
    for (var i = 0; i < S.items.length; i++) {
      var item = S.items[i];
      if (tf.length > 0 && tf.indexOf(item.type) !== -1) continue;
      var hay = (item.name + " " + getDisplayUser(item) + " " + item.note).toLowerCase();
      var match = !q || hay.indexOf(q) !== -1;
      if (!match) continue;
      visible++;
      renderItem(item, visible - 1);
    }
    emptyState.hidden = visible !== 0;
    itemCount.textContent = visible + " e" + (visible !== 1 ? "s" : "");
    if (visible > 0 && S.tickHandle) {
      totpTick();
    }
  }

  function renderItem(item, index) {
    var card = document.createElement("div");
    card.className = "pwd-card";
    card.style.animationDelay = (index * 40) + "ms";
    card.dataset.id = item.itemId;

    var vaultColor = getVaultColor(item.shareId);
    var vaultName = getVaultName(item.shareId);
    var user = getDisplayUser(item);
    var showUser = S.showAllUsers || S.usernamesVisible[item.itemId];
    var showPass = S.passwordsVisible[item.itemId];
    var showNote = S.showAllNotes || S.notesVisible[item.itemId];
    var hasCF = item.extraFields && item.extraFields.length > 0;
    var cfOpen = S.customFieldsOpen[item.itemId];
    var hasOTP = hasTotp(item);
    var showOTP = S.otpsVisible[item.itemId] !== undefined ? S.otpsVisible[item.itemId] : S.showAllOtps;

    var tColor = TYPE_COLORS[item.type] || "#888";
    var tIcon = TYPE_ICONS[item.type] || "";
    var fColor = faviconColor(item.name);
    var initial = item.name.charAt(0).toUpperCase();
    var html = '<div class="vault-badge"><span class="vault-dot-sm" style="background:' + vaultColor + '"></span>' + escapeHtml(vaultName) + '</div>';
    html += '<div class="pwd-header">';
    html += '<span class="type-badge" style="color:' + tColor + ';background:' + tColor + '18">' + tIcon + '</span>';
    html += '<span class="card-favicon" style="background:' + fColor + '">' + escapeHtml(initial) + '</span>';
    html += '<span class="pwd-name" data-action="edit" data-id="' + item.itemId + '">' + escapeHtml(item.name) + '</span>';
    html += '<div class="pwd-actions">';
    html += '<button class="edit-btn" data-action="edit" data-id="' + item.itemId + '" title="Editar">' + SVG_EDIT + '</button>';
    html += '<button class="danger" data-action="delete" data-id="' + item.itemId + '" title="Eliminar">' + SVG_DELETE + '</button>';
    html += '</div></div>';

    /* Username row */
    if (user) {
      var userVal = maskText(user, showUser);
      html += '<div class="pwd-row" data-field="user" data-id="' + item.itemId + '">';
      html += '<span class="pwd-label">Usuario</span>';
      html += '<span class="pwd-value' + (showUser ? '' : ' masked') + '">' + escapeHtml(userVal) + '</span>';
      html += '<button class="pwd-btn" data-action="toggle-user" data-id="' + item.itemId + '" title="Mostrar/ocultar">' + (showUser ? SVG_EYE_OFF : SVG_EYE) + '</button>';
      html += '<button class="pwd-btn" data-action="copy" data-field="user" data-id="' + item.itemId + '" title="Copiar">' + SVG_COPY + '</button>';
      html += '</div>';
    }

    /* Alias row (for alias type items) */
    if (item.type === "alias" && item.aliasEmail) {
      html += '<div class="pwd-row" data-field="alias" data-id="' + item.itemId + '">';
      html += '<span class="pwd-label">Alias</span>';
      html += '<span class="pwd-value">' + escapeHtml(item.aliasEmail) + '</span>';
      html += '<button class="pwd-btn" data-action="copy" data-field="alias" data-id="' + item.itemId + '" title="Copiar">' + SVG_COPY + '</button>';
      html += '</div>';
    }

    /* Type-specific content fields */
    if (item.rawContent) {
      var knownFields = TYPE_FIELDS[item.type] || [];
      /* Show known fields (skip pin in card view) */
      for (var tfIdx = 0; tfIdx < knownFields.length; tfIdx++) {
        var tfDef = knownFields[tfIdx];
        if (tfDef.key === "pin") continue;
        var tfVal = item.rawContent[tfDef.key];
        if (!tfVal) continue;
        html += '<div class="pwd-row" data-field="' + item.type + '-' + tfDef.key + '" data-id="' + item.itemId + '">';
        html += '<span class="pwd-label">' + tfDef.label + '</span>';
        html += '<span class="pwd-value' + (tfDef.masked ? ' masked' : '') + '">' + escapeHtml(tfVal) + '</span>';
        html += '<button class="pwd-btn" data-action="copy-data" data-type="' + item.type + '" data-key="' + tfDef.key + '" data-id="' + item.itemId + '" title="Copiar">' + SVG_COPY + '</button>';
        html += '</div>';
      }
      /* Show extra rawContent fields not in knownFields */
      for (var rck in item.rawContent) {
        if (!item.rawContent.hasOwnProperty(rck)) continue;
        if (!item.rawContent[rck]) continue;
        if (rck === "pin") continue;
        var found = false;
        for (var fi = 0; fi < knownFields.length; fi++) {
          if (knownFields[fi].key === rck) { found = true; break; }
        }
        if (found) continue;
        if (rck === "itemEmail" || rck === "itemUsername" || rck === "password" || rck === "urls" || rck === "totpUri" || rck === "passkeys") continue;
        var label = rck.replace(/([A-Z])/g, ' $1').replace(/^./, function (c) { return c.toUpperCase(); });
        html += '<div class="pwd-row" data-field="' + item.type + '-' + rck + '" data-id="' + item.itemId + '">';
        html += '<span class="pwd-label">' + escapeHtml(label) + '</span>';
        html += '<span class="pwd-value">' + escapeHtml(String(item.rawContent[rck])) + '</span>';
        html += '<button class="pwd-btn" data-action="copy-data" data-type="' + item.type + '" data-key="' + rck + '" data-id="' + item.itemId + '" title="Copiar">' + SVG_COPY + '</button>';
        html += '</div>';
      }
    }

    /* Password row (skip for alias — no password; creditCard/identity have PIN separate) */
    if (item.type !== "alias" && item.type !== "creditCard" && item.type !== "identity" && item.password) {
      var passVal = maskText(item.password, showPass);
      html += '<div class="pwd-row" data-field="pass" data-id="' + item.itemId + '">';
      html += '<span class="pwd-label">Clave</span>';
      html += '<span class="pwd-value' + (showPass ? '' : ' masked') + '">' + escapeHtml(passVal) + '</span>';
      html += '<button class="pwd-btn" data-action="toggle-pass" data-id="' + item.itemId + '" title="Mostrar/ocultar">' + (showPass ? SVG_EYE_OFF : SVG_EYE) + '</button>';
      html += '<button class="pwd-btn" data-action="copy" data-field="pass" data-id="' + item.itemId + '" title="Copiar">' + SVG_COPY + '</button>';
      html += '</div>';
    }

    /* TOTP row */
    if (hasOTP) {
      var otpDisplay = showOTP ? "------" : "\u2022\u2022\u2022\u2022\u2022\u2022";
      html += '<div class="pwd-row" data-field="otp" data-id="' + item.itemId + '">';
      html += '<span class="pwd-label">TOTP</span>';
      html += '<svg class="totp-ring" viewBox="0 0 28 28"><circle class="totp-ring-bg" cx="14" cy="14" r="12"/><circle class="totp-ring-fg" cx="14" cy="14" r="12" stroke-dasharray="' + RING_C.toFixed(2) + '" stroke-dashoffset="0"/></svg>';
      html += '<span class="totp-code-value' + (showOTP ? '' : ' masked') + '" id="otp-val-' + item.itemId + '">' + escapeHtml(otpDisplay) + '</span>';
      html += '<span class="totp-remaining" id="otp-rem-' + item.itemId + '"></span>';
      html += '<button class="pwd-btn" data-action="toggle-otp" data-id="' + item.itemId + '" title="Mostrar/ocultar">' + (showOTP ? SVG_EYE_OFF : SVG_EYE) + '</button>';
      html += '<button class="pwd-btn" data-action="copy" data-field="otp" data-id="' + item.itemId + '" title="Copiar">' + SVG_COPY + '</button>';
      html += '</div>';
      /* Initial computation */
      computeTotp(item);
    }

    /* Notes row */
    if (item.note) {
      var noteVal = maskText(item.note, showNote);
      html += '<div class="pwd-row" data-field="note" data-id="' + item.itemId + '">';
      html += '<span class="pwd-label">Notas</span>';
      html += '<span class="pwd-value' + (showNote ? '' : ' masked') + '">' + escapeHtml(noteVal) + '</span>';
      html += '<button class="pwd-btn" data-action="toggle-note" data-id="' + item.itemId + '" title="Mostrar/ocultar">' + (showNote ? SVG_EYE_OFF : SVG_EYE) + '</button>';
      html += '</div>';
    }

    /* Custom fields */
    if (hasCF) {
      html += '<div class="pwd-row">';
      html += '<button class="custom-toggle' + (cfOpen ? ' open' : '') + '" data-action="toggle-cf" data-id="' + item.itemId + '">' + SVG_CHEVRON_DOWN;
      html += '<span>Campos personalizados (' + item.extraFields.length + ')</span></button>';
      html += '</div>';
      html += '<div class="custom-fields' + (cfOpen ? ' open' : '') + '" data-cf="' + item.itemId + '">';
      for (var j = 0; j < item.extraFields.length; j++) {
        var ef = item.extraFields[j];
        var efHidden = ef.type === "hidden";
        var efVal = efHidden ? maskText(ef.data.content || "", false) : (ef.data.content || "");
        html += '<div class="pwd-row">';
        html += '<span class="pwd-label">' + escapeHtml(ef.fieldName) + '</span>';
        html += '<span class="pwd-value masked">' + escapeHtml(efVal) + '</span>';
        if (efHidden) {
          html += '<button class="pwd-btn" data-action="copy" data-field="cf" data-cf-idx="' + j + '" data-id="' + item.itemId + '" title="Copiar">' + SVG_COPY + '</button>';
        }
        html += '</div>';
      }
      html += '</div>';
    }

    /* Files */
    if (item.files && item.files.length > 0) {
      var filesOpen = S.filesOpen[item.itemId];
      html += '<div class="pwd-row">';
      html += '<button class="file-toggle' + (filesOpen ? ' open' : '') + '" data-action="toggle-files" data-id="' + item.itemId + '">' + SVG_CHEVRON_DOWN;
      html += '<span>Archivos (' + item.files.length + ')</span></button>';
      html += '</div>';
      html += '<div class="file-list' + (filesOpen ? ' open' : '') + '" data-flist="' + item.itemId + '">';
      for (var fi = 0; fi < item.files.length; fi++) {
        var f = item.files[fi];
        html += '<div class="pwd-row">';
        html += '<span class="pwd-label">' + escapeHtml(f.name) + '</span>';
        html += '<span class="pwd-value" style="font-size:0.78rem;color:var(--muted)">' + formatFileSize(f.size) + '</span>';
        html += '<button class="pwd-btn" data-action="download-file" data-id="' + item.itemId + '" data-file-idx="' + fi + '" title="Descargar">' + SVG_DOWNLOAD + '</button>';
        html += '</div>';
      }
      html += '</div>';
    }

    card.style.setProperty("--type-color", tColor);
    card.innerHTML = html;
    itemsList.appendChild(card);
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  /* ===== Targeted visibility updates (no re-render) ===== */
  function updateFieldVisibility(field, id) {
    var card = itemsList.querySelector('[data-id="' + id + '"]');
    if (!card) return;
    var row = card.querySelector('[data-field="' + field + '"]');
    if (!row) return;
    var item = getItemById(id);
    if (!item) return;

    var show;
    if (field === "user") {
      show = S.showAllUsers || S.usernamesVisible[id];
    } else if (field === "pass") {
      show = S.passwordsVisible[id];
    } else if (field === "note") {
      show = S.showAllNotes || S.notesVisible[id];
    } else if (field === "otp") {
      show = S.otpsVisible[id] !== undefined ? S.otpsVisible[id] : S.showAllOtps;
    } else return;

    var valueEl = row.querySelector(".pwd-value, .totp-code-value");
    var btn = row.querySelector("[data-action^='toggle-']");
    if (!valueEl || !btn) return;

    var text;
    if (field === "otp") {
      text = show ? (S.totpCache[id] ? S.totpCache[id].code : "------") : "\u2022\u2022\u2022\u2022\u2022\u2022";
      valueEl.classList.toggle("masked", !show);
    } else {
      var raw = field === "user" ? getDisplayUser(item) : (field === "pass" ? item.password : item.note);
      text = maskText(raw || "", show);
      valueEl.classList.toggle("masked", !show);
    }
    valueEl.textContent = text;
    btn.innerHTML = show ? SVG_EYE_OFF : SVG_EYE;
  }

  /* ===== TOTP computation ===== */
  function computeTotp(item) {
    if (!hasTotp(item)) return;
    generateTotp(item.totpUri).then(function (result) {
      S.totpCache[item.itemId] = result;
      updateTotpDisplay(item.itemId, result);
    }).catch(function () {});
  }

  function updateTotpDisplay(id, result) {
    var show = S.otpsVisible[id] !== undefined ? S.otpsVisible[id] : S.showAllOtps;
    var valEl = document.getElementById("otp-val-" + id);
    var remEl = document.getElementById("otp-rem-" + id);
    var ringEl = null;
    if (!valEl) return;
    valEl.textContent = show ? result.code : "\u2022\u2022\u2022\u2022\u2022\u2022";
    if (remEl) {
      remEl.textContent = result.remaining + "s";
      remEl.classList.toggle("urgent", result.remaining <= 5);
    }
    /* Update ring */
    var row = valEl.closest('[data-field="otp"]');
    if (row) {
      var ring = row.querySelector(".totp-ring-fg");
      if (ring) {
        var ratio = result.remaining / result.period;
        ring.style.strokeDashoffset = (RING_C * (1 - ratio)).toFixed(2);
        ring.classList.toggle("urgent", result.remaining <= 5);
      }
    }
  }

  function totpTick() {
    var now = Math.floor(Date.now() / 1000);
    var step = Math.floor(now / 15); /* check every 15s boundary for recompute */
    for (var i = 0; i < S.items.length; i++) {
      var item = S.items[i];
      if (!hasTotp(item)) continue;
      var cached = S.totpCache[item.itemId];
      if (cached) {
        var remaining = cached.period - (now % cached.period);
        if (remaining <= 0 || remaining > cached.period) {
          computeTotp(item);
        } else {
          updateTotpDisplay(item.itemId, {
            code: cached.code,
            remaining: remaining,
            period: cached.period,
            config: cached.config
          });
        }
      } else {
        computeTotp(item);
      }
    }
  }

  function updateTotpPreview(uri) {
    if (itemModal.hidden) {
      if (totpPreviewTimer) { clearTimeout(totpPreviewTimer); totpPreviewTimer = null; }
      return;
    }
    var config = parseTotpUri(uri);
    if (!config) {
      totpPreview.hidden = true;
      if (totpPreviewTimer) { clearTimeout(totpPreviewTimer); totpPreviewTimer = null; }
      return;
    }
    totpPreview.hidden = false;
    var now = Math.floor(Date.now() / 1000);
    var counter = Math.floor(now / config.period);
    var remaining = config.period - (now % config.period);
    var key = base32Decode(config.secret);
    var R = 2 * Math.PI * 12;

    hmacSign(key, counterBytes(counter), config.algorithm).then(function (sig) {
      var num = truncate(sig);
      var mod = Math.pow(10, config.digits);
      var code = String(num % mod).padStart(config.digits, "0");
      previewTotpCode.textContent = code;
      var ratio = remaining / config.period;
      previewTotpRing.style.strokeDasharray = R.toFixed(2);
      previewTotpRing.style.strokeDashoffset = (R * (1 - ratio)).toFixed(2);
      previewTotpRing.classList.toggle("urgent", remaining <= 5);
      return hmacSign(key, counterBytes(counter + 1), config.algorithm);
    }).then(function (sig2) {
      var num2 = truncate(sig2);
      var mod2 = Math.pow(10, config.digits);
      var code2 = String(num2 % mod2).padStart(config.digits, "0");
      previewTotpNext.textContent = code2;
    }).catch(function () {});

    if (totpPreviewTimer) clearTimeout(totpPreviewTimer);
    totpPreviewTimer = setTimeout(function () {
      updateTotpPreview(document.getElementById("item-totp").value);
    }, 1000);
  }

  var TYPE_LABELS = {
    login: "Inicio de sesi\u00f3n",
    alias: "Alias",
    creditCard: "Tarjeta",
    note: "Nota",
    identity: "Identidad",
    password: "Contrase\u00f1a"
  };

  function typeLabel(t) { return TYPE_LABELS[t] || "Otros"; }

  var TYPES_ORDER = ["login", "alias", "creditCard", "note", "identity", "password"];

  function collectTypes() {
    var set = [];
    for (var i = 0; i < S.items.length; i++) {
      var t = S.items[i].type;
      if (set.indexOf(t) === -1) set.push(t);
    }
    set.sort();
    /* Ensure known types come first in order, append unknown ones */
    var ordered = [];
    for (var ti = 0; ti < TYPES_ORDER.length; ti++) {
      if (set.indexOf(TYPES_ORDER[ti]) !== -1) ordered.push(TYPES_ORDER[ti]);
    }
    for (var si = 0; si < set.length; si++) {
      if (ordered.indexOf(set[si]) === -1) ordered.push(set[si]);
    }
    if (ordered.length === 0) ordered.push("login");
    return ordered;
  }

  function populateTypeFilters() {
    var types = collectTypes();
    vdTypes.innerHTML = "";
    for (var i = 0; i < types.length; i++) {
      var t = types[i];
      var label = document.createElement("label");
      label.className = "vd-check";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = S.typeFilter.length === 0 || S.typeFilter.indexOf(t) === -1;
      cb.addEventListener("change", function (type) {
        return function () {
          if (this.checked) {
            var idx = S.typeFilter.indexOf(type);
            if (idx !== -1) S.typeFilter.splice(idx, 1);
          } else {
            if (S.typeFilter.indexOf(type) === -1) S.typeFilter.push(type);
          }
          renderItems();
          updateViewSummary();
        };
      }(t));
      label.appendChild(cb);
      label.appendChild(document.createTextNode(" " + typeLabel(t)));
      vdTypes.appendChild(label);
    }
  }

  function updateViewSummary() {
    var types = collectTypes();
    var activeTypes = S.typeFilter.length === 0 ? types : types.filter(function (t) { return S.typeFilter.indexOf(t) === -1; });
    var tLabel;
    if (activeTypes.length === 0) tLabel = "Ninguno";
    else if (activeTypes.length === types.length) tLabel = "Todo";
    else tLabel = activeTypes.map(function (t) { return typeLabel(t); }).join(", ");
    var fullLabel = tLabel;
    var tip = fullLabel === "Ninguno" || fullLabel === "Todo" ? "" : escapeHtml("Filtros: " + fullLabel);
    viewOptionsBtn.title = tip;
    var h = '<span class="view-summary-items" title="' + tip + '">';
    h += '<span class="vsi ' + (S.showAllUsers ? 'active' : 'inactive') + '" title="Usuarios">' + SVG_USER_ICON + '</span>';
    h += '<span class="vsi ' + (S.showAllNotes ? 'active' : 'inactive') + '" title="Notas">' + SVG_NOTE_ICON + '</span>';
    h += '<span class="vsi ' + (S.showAllOtps ? 'active' : 'inactive') + '" title="OTP">' + SVG_OTP_ICON + '</span>';
    h += '</span>';
    h += '<span style="margin-left:4px;font-size:0.78rem;color:var(--muted)">| ' + tLabel + '</span>';
    viewSummary.innerHTML = h;
  }

  function closeViewDropdown(e) {
    if (!viewOpen) return;
    if (e && viewOptionsBtn.contains(e.target)) return;
    if (e && viewDropdown.contains(e.target)) return;
    viewDropdown.hidden = true;
    viewOpen = false;
    if (e) document.removeEventListener("click", closeViewDropdown);
  }

  var FIELD_VIS = {
    login: ["email", "username", "password", "totp", "url", "notes"],
    note: ["notes"],
    alias: ["email", "notes"],
    creditCard: ["notes"],
    identity: ["notes"],
    password: ["password", "notes"]
  };

  function updateModalFields(type) {
    var groups = document.querySelectorAll("[data-edit-group]");
    var show = FIELD_VIS[type] || ["email", "username", "password", "totp", "url", "notes"];
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      var key = g.getAttribute("data-edit-group");
      g.hidden = show.indexOf(key) === -1;
    }
    totpPreview.hidden = show.indexOf("totp") === -1;
    if (itemEmailLabel) {
      itemEmailLabel.textContent = type === "alias" ? "Alias" : "Email";
      itemEmail.placeholder = type === "alias" ? "correo@ejemplo.com" : "usuario@ejemplo.com";
    }
    var rc = null;
    if (S.editingId) { var ei = getItemById(S.editingId); if (ei) rc = ei.rawContent; }
    renderTypeFields(type, rc);
  }

  var FIELD_ALIASES = {
    creditCard: { number: 1, verificationNumber: 1 },
    identity: {}
  };

  function renderTypeFields(type, rawContent) {
    var container = document.getElementById("item-type-fields");
    if (!container) return;
    var fields = TYPE_FIELDS[type] || [];
    var h = "";
    /* Known fields */
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      h += '<label class="form-field form-field-full type-field">';
      h += '<span>' + f.label + '</span>';
      h += '<input class="type-field-input" data-tf="' + f.key + '" type="text" placeholder="' + f.label + '" autocomplete="off" spellcheck="false">';
      h += '</label>';
    }
    /* Extra rawContent fields not in TYPE_FIELDS or aliases */
    var skip = {};
    for (var fi = 0; fi < fields.length; fi++) skip[fields[fi].key] = true;
    var aliases = FIELD_ALIASES[type] || {};
    for (var ak in aliases) { if (aliases.hasOwnProperty(ak)) skip[ak] = true; }
    if (rawContent) {
      for (var rck in rawContent) {
        if (!rawContent.hasOwnProperty(rck)) continue;
        if (!rawContent[rck]) continue;
        if (skip[rck]) continue;
        if (rck === "itemEmail" || rck === "itemUsername" || rck === "password" || rck === "urls" || rck === "totpUri" || rck === "passkeys") continue;
        var label = rck.replace(/([A-Z])/g, ' $1').replace(/^./, function (c) { return c.toUpperCase(); });
        h += '<label class="form-field form-field-full type-field">';
        h += '<span>' + escapeHtml(label) + '</span>';
        h += '<input class="type-field-input" data-tf="' + rck + '" type="text" placeholder="' + label + '" autocomplete="off" spellcheck="false">';
        h += '</label>';
      }
    }
    if (!h) {
      container.innerHTML = "";
      container.hidden = true;
    } else {
      container.innerHTML = h;
      container.hidden = false;
    }
  }

  /* ===== CRUD ===== */
  function getItemById(id) {
    for (var i = 0; i < S.items.length; i++) {
      if (S.items[i].itemId === id) return S.items[i];
    }
    return null;
  }

  function deleteItem(id) {
    for (var i = 0; i < S.items.length; i++) {
      if (S.items[i].itemId === id) {
        var label = S.items[i].name;
        if (!confirm("\u00bfEliminar \"" + label + "\"?")) return;
        S.items.splice(i, 1);
        renderItems();
        toast("Elemento eliminado");
        markDirty();
        return;
      }
    }
  }

  function openNewItemModal() {
    S.editingId = null;
    itemModalTitle.textContent = "Nuevo elemento";
    itemName.value = "";
    itemEmail.value = "";
    itemUsername.value = "";
    itemPassword.value = "";
    itemTotp.value = "";
    itemUrl.value = "";
    itemNotes.value = "";
    var tfInputs = document.querySelectorAll(".type-field-input");
    for (var tfi2 = 0; tfi2 < tfInputs.length; tfi2++) {
      tfInputs[tfi2].value = "";
    }
    itemError.textContent = "";
    S.tempFiles = [];
    updateFilesList();
    populateVaultSelect();
    if (S.vaultOrder.length > 0) itemVault.value = S.vaultOrder[0];
    updateModalFields(itemType.value);
    openModal(itemModal);
    updateTotpPreview(itemTotp.value);
  }

  function openEditItemModal(id) {
    var item = getItemById(id);
    if (!item) return;
    S.editingId = id;
    itemModalTitle.textContent = "Editar elemento";
    itemName.value = item.name;
    itemType.value = item.type;
    updateModalFields(itemType.value);
    itemEmail.value = item.itemEmail || (item.type === "alias" ? (item.aliasEmail || "") : "");
    itemUsername.value = item.itemUsername || "";
    itemPassword.value = item.password || "";
    itemTotp.value = item.totpUri || "";
    itemUrl.value = (item.urls && item.urls[0]) || "";
    itemNotes.value = item.note || "";
    /* Populate type-specific fields, checking rawContent aliases */
    if (item.rawContent) {
      var revAlias = {};
      if (item.type === "creditCard") {
        if (item.rawContent.number !== undefined) revAlias.cardNumber = "number";
        if (item.rawContent.verificationNumber !== undefined) revAlias.cvv = "verificationNumber";
      }
      var tfInputs = document.querySelectorAll(".type-field-input");
      for (var tfi = 0; tfi < tfInputs.length; tfi++) {
        var inp = tfInputs[tfi];
        var key = inp.getAttribute("data-tf");
        var val = item.rawContent[key];
        if (val === undefined && revAlias[key]) val = item.rawContent[revAlias[key]];
        if (val !== undefined) inp.value = val;
      }
    }
    itemError.textContent = "";
    S.tempFiles = (item.files || []).slice();
    updateFilesList();
    populateVaultSelect();
    itemVault.value = item.shareId;
    openModal(itemModal);
    updateTotpPreview(itemTotp.value);
  }

  function populateVaultSelect() {
    itemVault.innerHTML = "";
    for (var i = 0; i < S.vaultOrder.length; i++) {
      var sid = S.vaultOrder[i];
      var opt = document.createElement("option");
      opt.value = sid;
      opt.textContent = S.vaults[sid] ? S.vaults[sid].name : sid;
      itemVault.appendChild(opt);
    }
  }

  function updateFilesList() {
    if (S.tempFiles.length === 0) {
      itemFilesList.innerHTML = '<div style="font-size:0.82rem;color:var(--muted);padding:6px 0">Ning\u00fan archivo seleccionado</div>';
    } else {
      var h = '';
      for (var i = 0; i < S.tempFiles.length; i++) {
        var f = S.tempFiles[i];
        h += '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:0.85rem">';
        h += '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(f.name) + '</span>';
        h += '<span style="color:var(--muted);font-size:0.75rem">' + formatFileSize(f.size) + '</span>';
        h += '<button class="pwd-btn" data-action="remove-temp-file" data-idx="' + i + '" title="Quitar" style="padding:3px 6px">' + SVG_DELETE + '</button>';
        h += '</div>';
      }
      itemFilesList.innerHTML = h;
    }
    itemFileText.textContent = S.tempFiles.length > 0 ? S.tempFiles.length + ' archivo(s)' : 'Seleccionar archivos...';
  }

  function saveItem() {
    var name = itemName.value.trim();
    if (!name) { itemError.textContent = "El nombre es obligatorio."; return; }

    /* Build rawContent from type-specific fields */
    var rawContent = {};
    var tfInputs = document.querySelectorAll(".type-field-input");
    for (var tfi3 = 0; tfi3 < tfInputs.length; tfi3++) {
      var inp = tfInputs[tfi3];
      var key = inp.getAttribute("data-tf");
      if (key) rawContent[key] = inp.value.trim();
    }
    /* Preserve existing rawContent for fields not in the form */
    if (S.editingId) {
      var existing2 = getItemById(S.editingId);
      if (existing2 && existing2.rawContent) {
        for (var _k2 in existing2.rawContent) {
          if (existing2.rawContent.hasOwnProperty(_k2) && rawContent[_k2] === undefined) {
            rawContent[_k2] = existing2.rawContent[_k2];
          }
        }
      }
    }

    var entry = {
      name: name,
      shareId: itemVault.value,
      type: itemType.value,
      itemEmail: itemEmail.value.trim(),
      itemUsername: itemUsername.value.trim(),
      password: itemPassword.value,
      totpUri: itemTotp.value.trim(),
      urls: itemUrl.value.trim() ? [itemUrl.value.trim()] : [],
      note: itemNotes.value.trim(),
      extraFields: [],
      rawContent: rawContent,
      createTime: Math.floor(Date.now() / 1000),
      modifyTime: Math.floor(Date.now() / 1000),
      files: S.tempFiles.slice(),
      aliasEmail: itemType.value === "alias" ? itemEmail.value.trim() : ""
    };

    if (S.editingId) {
      var existing = getItemById(S.editingId);
      if (existing) {
        entry.itemId = existing.itemId;
        entry.createTime = existing.createTime;
        entry.extraFields = existing.extraFields || [];
        for (var k = 0; k < S.items.length; k++) {
          if (S.items[k].itemId === S.editingId) {
            S.items[k] = entry;
            break;
          }
        }
      }
    } else {
      entry.itemId = generateId();
      S.items.push(entry);
      if (S.vaultOrder.indexOf(entry.shareId) === -1) {
        S.vaultOrder.push(entry.shareId);
        if (!S.vaults[entry.shareId]) {
          S.vaults[entry.shareId] = { name: "B\u00f3veda", description: "", color: 0, icon: 1 };
        }
      }
    }
    S.tempFiles = [];
    closeModal(itemModal);
    renderItems();
    toast(S.editingId ? "Elemento actualizado" : "Elemento creado");
    markDirty();
    S.editingId = null;
  }

  function markDirty() { window._dirty = true; }

  function updateGridMode() {
    var mainEl = document.querySelector("main");
    if (mainEl) {
      mainEl.style.padding = S.gridCols > 1 ? "0" : "";
    }
    document.body.style.padding = S.gridCols > 1 ? "0 6px" : "";
    if (itemsList) {
      itemsList.className = "pwd-list" + (S.gridCols > 1 ? " cols-" + S.gridCols : "");
    }
    if (gridLabel) gridLabel.textContent = S.gridCols;
  }

  /* ===== Modal helpers ===== */
  function openModal(modal) { modal.hidden = false; }
  function closeModal(modal) { modal.hidden = true; }

  /* ===== Lock / Unlock ===== */
  function showLock() {
    if (S.tickHandle) { clearInterval(S.tickHandle); S.tickHandle = null; }
    S.items = [];
    S.vaults = {};
    S.vaultOrder = [];
    S.password = null;
    S.zipData = null;
    S.fileName = null;
    S.fileSource = null;
    S.emptyVaultMode = false;
    S.showAllUsers = false;
    S.showAllNotes = false;
    S.showAllOtps = false;
    S.gridCols = 3;
    var _m = document.querySelector("main");
    if (_m) _m.style.padding = "";
    document.body.style.padding = "";
    S.usernamesVisible = {};
    S.passwordsVisible = {};
    S.notesVisible = {};
    S.otpsVisible = {};
    S.customFieldsOpen = {};
    S.filesOpen = {};
    S.tempFiles = [];
    S.totpCache = {};
    itemsList.innerHTML = "";
    appScreen.classList.remove("active");
    lockScreen.classList.add("active");
    passwordInput.value = "";
    lockError.textContent = "";
    searchInput.value = "";
    if (fileInput) fileInput.value = "";
    updateFileInfo();
    setTimeout(function () { passwordInput.focus(); }, 50);
  }

  function updateFileInfo() {
    if (S.fileName) {
      fileStatus.hidden = false;
      fileStatusName.textContent = S.fileName;
      fileSourceOptions.hidden = true;
      if (S.fileSource === "default") {
        fileStatusIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>';
        fileStatusSource.textContent = "archivo de prueba";
      } else {
        fileStatusIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>';
        fileStatusSource.textContent = "archivo local";
      }
      pickerText.textContent = "Cambiar archivo\u2026";
      pickerLabel.classList.add("loaded");
    } else {
      fileStatus.hidden = true;
      fileSourceOptions.hidden = false;
      pickerText.textContent = "Seleccionar archivo zip\u2026";
      pickerLabel.classList.remove("loaded");
    }
  }

  function setLoading(on) {
    unlockBtn.disabled = on;
    unlockBtn.querySelector(".btn-label").textContent = on ? "Descifrando\u2026" : "Desbloquear";
    unlockBtn.querySelector(".btn-spin").hidden = !on;
  }

  function showApp() {
    updateGridMode();
    renderItems();
    showAllToggle.checked = defShowUsers.checked;
    showAllNotesToggle.checked = defShowNotes.checked;
    showAllOtpsToggle.checked = defShowOtps.checked;
    S.showAllUsers = defShowUsers.checked;
    S.showAllNotes = defShowNotes.checked;
    S.showAllOtps = defShowOtps.checked;
    S.typeFilter = [];
    populateTypeFilters();
    updateViewSummary();
    lockScreen.classList.remove("active");
    appScreen.classList.add("active");
    if (S.tickHandle) clearInterval(S.tickHandle);
    S.tickHandle = setInterval(totpTick, 1000);
  }

  /* ===== Try unlock ===== */
  function tryUnlock(password) {
    if (!S.zipData && !S.emptyVaultMode) {
      lockError.textContent = "Selecciona o carga primero un archivo zip.";
      return;
    }
    lockError.textContent = "";
    setLoading(true);
    var promise;
    if (S.emptyVaultMode) {
      promise = Promise.resolve(JSON.stringify({
        version: "1.21.2",
        userId: "",
        encrypted: false,
        vaults: {
          "vault-1": {
            name: "Mi b\u00f3veda",
            description: "",
            display: { color: 1, icon: 1 },
            items: []
          }
        }
      }));
    } else {
      promise = decryptZip(S.zipData, password);
    }
    promise.then(function (jsonStr) {
      parseData(jsonStr);
      S.password = password;
      showApp();
    }).catch(function (err) {
      var msg = (err && err.message) ? err.message : String(err);
      if (/incorrect|bad|decrypt|wrong|fail/i.test(msg)) {
        lockError.textContent = "Contrase\u00f1a incorrecta o archivo da\u00f1ado.";
      } else {
        lockError.textContent = "Error: " + msg;
      }
      passwordInput.select();
    }).then(function () { setLoading(false); });
  }

  /* ===== Export ===== */
  async function doExport() {
    if (S.items.length === 0) { toast("No hay elementos para exportar"); return; }
    if (!S.password) { toast("No hay contrase\u00f1a establecida"); return; }
    try {
      toast("Cifrando y exportando\u2026");
      var plain = buildData();
      var blob = await encryptAndZip(plain, S.password);
      var now = new Date();
      var date = now.toISOString().slice(0, 10);
      var ts = Math.floor(now.getTime() / 1000);
      downloadBlob(blob, "LPM_export_" + date + "_" + ts + ".zip");
      window._dirty = false;
      toast("Archivo descargado");
    } catch (err) {
      toast("Error al exportar: " + ((err && err.message) || err));
    }
  }

  /* ===== Load default zip ===== */
  function loadDefaultZip() {
    lockError.textContent = "";
    setLoading(true);
    fetch("assets/examples/default-proton-passwords.zip", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("No se encontr\u00f3 el archivo de prueba");
        return res.arrayBuffer();
      })
      .then(function (buf) {
        S.zipData = buf;
        S.fileName = "assets/examples/default-proton-passwords.zip";
        S.fileSource = "default";
        S.emptyVaultMode = false;
        updateFileInfo();
        passwordInput.value = "A";
        toast("Archivo de prueba cargado, descifrando\u2026");
        tryUnlock("A");
      })
      .catch(function (err) {
        setLoading(false);
        lockError.textContent = "Error: " + ((err && err.message) || err);
      });
  }

  /* ===== Create empty vault ===== */
  function openCreateModal() {
    createPw.value = "";
    createPw2.value = "";
    createError.textContent = "";
    openModal(createModal);
  }

  function doCreateVault() {
    var pw1 = createPw.value;
    var pw2 = createPw2.value;
    if (!pw1) { createError.textContent = "Introduce una contrase\u00f1a."; return; }
    if (pw1 !== pw2) { createError.textContent = "Las contrase\u00f1as no coinciden."; return; }
    if (pw1.length < 1) { createError.textContent = "La contrase\u00f1a debe tener al menos 1 car\u00e1cter."; return; }

    closeModal(createModal);
    S.password = pw1;
    S.fileName = null;
    S.zipData = null;
    S.emptyVaultMode = true;
    S.tempFiles = [];
    updateFileInfo();

    var emptyJson = JSON.stringify({
      version: "1.21.2",
      userId: "",
      encrypted: false,
      vaults: {
        "vault-1": {
          name: "Mi b\u00f3veda",
          description: "",
          display: { color: 1, icon: 1 },
          items: []
        }
      }
    });
    try {
      parseData(emptyJson);
      showApp();
      toast("B\u00f3veda vac\u00eda creada");
    } catch (err) {
      lockError.textContent = "Error: " + ((err && err.message) || err);
    }
  }

  /* ===== Change password ===== */
  function openPwModal() {
    newPw.value = "";
    newPw2.value = "";
    pwError.textContent = "";
    openModal(pwModal);
  }

  function doChangePassword() {
    var pw1 = newPw.value;
    var pw2 = newPw2.value;
    if (!pw1) { pwError.textContent = "Introduce una contrase\u00f1a."; return; }
    if (pw1 !== pw2) { pwError.textContent = "Las contrase\u00f1as no coinciden."; return; }
    S.password = pw1;
    closeModal(pwModal);
    markDirty();
    toast("Contrase\u00f1a cambiada. Descarga el zip para guardar los cambios.");
  }

  /* ===== Events ===== */
  document.addEventListener("DOMContentLoaded", function () {
    showLock();

    /* Unlock form */
    unlockForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var pw = passwordInput.value;
      if (!pw) { passwordInput.focus(); return; }
      tryUnlock(pw);
    });

    togglePw.addEventListener("click", function () {
      passwordInput.type = passwordInput.type === "password" ? "text" : "password";
      passwordInput.focus();
    });

    /* Lock */
    lockBtn.addEventListener("click", function () {
      showLock();
    });

    /* File upload */
    fileInput.addEventListener("change", function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      lockError.textContent = "";
      var reader = new FileReader();
      reader.onload = function (ev) {
        S.zipData = ev.target.result;
        S.fileName = file.name;
        S.fileSource = "uploaded";
        S.emptyVaultMode = false;
        updateFileInfo();
        lockError.textContent = "";
        /* Comprobar si el zip tiene un data.json (zip sin cifrar) */
        JSZip.loadAsync(S.zipData).then(function (zip) {
          var hasJson = false;
          for (var name in zip.files) {
            if (name.endsWith("data.json") && !zip.files[name].dir) {
              hasJson = true;
              break;
            }
          }
          if (hasJson) {
            toast("Zip sin contrase\u00f1a detectado, abriendo\u2026");
            tryUnlock("");
          } else {
            setTimeout(function () { passwordInput.focus(); }, 50);
            toast("Archivo cargado: " + file.name);
          }
        }).catch(function () {
          setTimeout(function () { passwordInput.focus(); }, 50);
          toast("Archivo cargado: " + file.name);
        });
      };
      reader.onerror = function () {
        lockError.textContent = "No se pudo leer el archivo.";
      };
      reader.readAsArrayBuffer(file);
    });

    /* Clear file */
    fileStatusClear.addEventListener("click", function () {
      S.zipData = null;
      S.fileName = null;
      S.fileSource = null;
      if (fileInput) fileInput.value = "";
      updateFileInfo();
      lockError.textContent = "";
    });

    /* Load default */
    loadDefaultBtn.addEventListener("click", loadDefaultZip);

    /* Create vault */
    createVaultBtn.addEventListener("click", openCreateModal);
    createConfirm.addEventListener("click", doCreateVault);

    /* Export */
    exportBtn.addEventListener("click", doExport);

    /* Change password */
    changePwBtn.addEventListener("click", openPwModal);
    pwConfirm.addEventListener("click", doChangePassword);

    /* Add new */
    addBtn.addEventListener("click", openNewItemModal);
    itemSave.addEventListener("click", saveItem);

    /* Grid columns toggle */
    gridBtn.addEventListener("click", function () {
      S.gridCols = S.gridCols >= 3 ? 1 : S.gridCols + 1;
      updateGridMode();
      renderItems();
    });

    /* Generate password */
    genPassword.addEventListener("click", function () {
      itemPassword.value = generatePassword(24);
    });

    /* TOTP preview live update */
    itemTotp.addEventListener("input", function () {
      updateTotpPreview(itemTotp.value);
    });

    /* Type field visibility in edit modal */
    itemType.addEventListener("change", function () { updateModalFields(itemType.value); });

    /* View options dropdown toggle */
    viewOptionsBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      viewOpen = !viewOpen;
      viewDropdown.hidden = !viewOpen;
      if (viewOpen) {
        setTimeout(function () { document.addEventListener("click", closeViewDropdown); }, 0);
      } else {
        document.removeEventListener("click", closeViewDropdown);
      }
    });

    /* File picker for item attachments */
    itemFilePicker.addEventListener("click", function () { itemFileInput.click(); });
    itemFileInput.addEventListener("change", function () {
      var files = itemFileInput.files;
      if (!files || files.length === 0) return;
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        var reader = new FileReader();
        reader.onload = (function (f) {
          return function (ev) {
            var b64 = ev.target.result.split(",")[1] || ev.target.result;
            S.tempFiles.push({
              id: generateId(),
              name: f.name,
              size: f.size,
              data: b64
            });
            updateFilesList();
          };
        })(file);
        reader.readAsDataURL(file);
      }
      itemFileInput.value = "";
    });

    /* Search */
    searchInput.addEventListener("input", renderItems);

    /* Alt+letter shortcuts for action buttons */
    document.addEventListener("keydown", function (e) {
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        var key = e.key.toLowerCase();
        if (key === "a") {
          e.preventDefault();
          if (appScreen.classList.contains("active")) { addBtn.click(); }
        } else if (key === "d") {
          e.preventDefault();
          if (appScreen.classList.contains("active")) { exportBtn.click(); }
        } else if (key === "c") {
          e.preventDefault();
          if (appScreen.classList.contains("active")) { changePwBtn.click(); }
        } else if (key === "l") {
          e.preventDefault();
          if (appScreen.classList.contains("active")) { lockBtn.click(); }
        }
      }
    });

    /* Keyboard shortcuts */
    document.addEventListener("keydown", function (e) {
      var ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "n") {
        e.preventDefault();
        if (appScreen.classList.contains("active")) openNewItemModal();
        return;
      }
      if (ctrl && e.key === "s") {
        e.preventDefault();
        if (appScreen.classList.contains("active")) doExport();
        return;
      }
      if (ctrl && e.key === "p") {
        e.preventDefault();
        if (appScreen.classList.contains("active")) openPwModal();
        return;
      }
      if (e.key === "/" && appScreen.classList.contains("active")) {
        var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
        if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
      if (appScreen.classList.contains("active")) {
        var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
        if (tag !== "input" && tag !== "textarea" && !e.target.isContentEditable) {
          var key = e.key.toLowerCase();
          if (key === "a") { e.preventDefault(); addBtn.click(); return; }
          if (key === "d") { e.preventDefault(); exportBtn.click(); return; }
          if (key === "c") { e.preventDefault(); changePwBtn.click(); return; }
          if (key === "b") { e.preventDefault(); lockBtn.click(); return; }
        }
      }
      if (e.key === "Escape") {
        if (!itemModal.hidden) { closeModal(itemModal); return; }
        if (!pwModal.hidden) { closeModal(pwModal); return; }
        if (!createModal.hidden) { closeModal(createModal); return; }
        searchInput.value = "";
        renderItems();
        searchInput.blur();
      }
    });

    /* Global toggle: usuarios */
    showAllToggle.addEventListener("change", function () {
      S.showAllUsers = showAllToggle.checked;
      if (S.showAllUsers) {
        S.usernamesVisible = {};
      }
      for (var ui = 0; ui < S.items.length; ui++) {
        updateFieldVisibility("user", S.items[ui].itemId);
      }
      updateViewSummary();
    });

    /* Global toggle: notas */
    showAllNotesToggle.addEventListener("change", function () {
      S.showAllNotes = showAllNotesToggle.checked;
      if (S.showAllNotes) {
        S.notesVisible = {};
      }
      for (var ni = 0; ni < S.items.length; ni++) {
        updateFieldVisibility("note", S.items[ni].itemId);
      }
      updateViewSummary();
    });

    /* Global toggle: OTP */
    showAllOtpsToggle.addEventListener("change", function () {
      S.showAllOtps = showAllOtpsToggle.checked;
      S.otpsVisible = {};
      for (var oi = 0; oi < S.items.length; oi++) {
        var otpItem = S.items[oi];
        updateFieldVisibility("otp", otpItem.itemId);
        if (hasTotp(otpItem) && S.totpCache[otpItem.itemId]) {
          updateTotpDisplay(otpItem.itemId, S.totpCache[otpItem.itemId]);
        }
      }
      updateViewSummary();
    });

    /* Lock screen defaults → global state */
    defShowUsers.addEventListener("change", function () {
      S.showAllUsers = defShowUsers.checked;
    });
    defShowOtps.addEventListener("change", function () {
      S.showAllOtps = defShowOtps.checked;
    });
    defShowNotes.addEventListener("change", function () {
      S.showAllNotes = defShowNotes.checked;
    });

    /* Delegated clicks */
    document.addEventListener("click", function (e) {
      var closer = e.target.closest("[data-modal-close]");
      if (closer) {
        var mid = closer.getAttribute("data-modal-close");
        if (mid) closeModal(document.getElementById(mid));
        return;
      }

      var btn = e.target.closest("[data-action]");
      if (!btn) return;
      var action = btn.getAttribute("data-action");
      var id = btn.getAttribute("data-id");

      if (action === "delete" && id) { deleteItem(id); return; }
      if (action === "edit" && id) { openEditItemModal(id); return; }

      /* Visibility toggles — targeted updates */
      if (action === "toggle-user" && id) {
        S.usernamesVisible[id] = !S.usernamesVisible[id];
        updateFieldVisibility("user", id);
        return;
      }
      if (action === "toggle-pass" && id) {
        S.passwordsVisible[id] = !S.passwordsVisible[id];
        updateFieldVisibility("pass", id);
        return;
      }
      if (action === "toggle-note" && id) {
        S.notesVisible[id] = !S.notesVisible[id];
        updateFieldVisibility("note", id);
        return;
      }
      if (action === "toggle-otp" && id) {
        var cur = S.otpsVisible[id];
        S.otpsVisible[id] = cur !== undefined ? !cur : !S.showAllOtps;
        updateFieldVisibility("otp", id);
        return;
      }
      if (action === "toggle-cf" && id) {
        S.customFieldsOpen[id] = !S.customFieldsOpen[id];
        var cfCard = itemsList.querySelector('[data-id="' + id + '"]');
        if (cfCard) {
          var cfBtn = cfCard.querySelector('[data-action="toggle-cf"]');
          var cfBody = cfCard.querySelector('[data-cf="' + id + '"]');
          if (cfBtn) cfBtn.classList.toggle("open");
          if (cfBody) cfBody.classList.toggle("open");
        }
        return;
      }
      if (action === "toggle-files" && id) {
        S.filesOpen[id] = !S.filesOpen[id];
        var ffCard = itemsList.querySelector('[data-id="' + id + '"]');
        if (ffCard) {
          var ffBtn = ffCard.querySelector('[data-action="toggle-files"]');
          var ffBody = ffCard.querySelector('[data-flist="' + id + '"]');
          if (ffBtn) ffBtn.classList.toggle("open");
          if (ffBody) ffBody.classList.toggle("open");
        }
        return;
      }

      if (action === "download-file" && id) {
        var item = getItemById(id);
        if (!item) return;
        var fi = parseInt(btn.getAttribute("data-file-idx"), 10);
        if (!isNaN(fi) && item.files && item.files[fi]) {
          var f = item.files[fi];
          if (f.data) {
            var bytes = base64ToBytes(f.data);
            var blob = new Blob([bytes]);
            downloadBlob(blob, f.name);
          }
        }
        return;
      }

      if (action === "remove-temp-file") {
        var idx = parseInt(btn.getAttribute("data-idx"), 10);
        if (!isNaN(idx) && S.tempFiles[idx]) {
          S.tempFiles.splice(idx, 1);
          updateFilesList();
        }
        return;
      }

      if (action === "copy-tp") {
        var codeEl = document.getElementById("preview-totp-code");
        if (codeEl && codeEl.textContent && codeEl.textContent.indexOf("-") === -1) {
          copyText(codeEl.textContent).then(function (ok) {
            toast(ok ? "Copiado" : "No se pudo copiar");
          });
        }
        return;
      }

      if (action === "copy") {
        var field = btn.getAttribute("data-field");
        var item = getItemById(id);
        if (!item) return;
        var text = "";
        if (field === "user") text = getDisplayUser(item);
        else if (field === "alias") text = item.aliasEmail || "";
        else if (field === "pass") text = item.password || "";
        else if (field === "otp") {
          var cached = S.totpCache[id];
          text = cached ? cached.code : "";
        }
        else if (field === "cf") {
          var idx = parseInt(btn.getAttribute("data-cf-idx"), 10);
          if (!isNaN(idx) && item.extraFields && item.extraFields[idx]) {
            text = item.extraFields[idx].data.content || "";
          }
        }
        if (text) {
          copyText(text).then(function (ok) {
            toast(ok ? "Copiado" : "No se pudo copiar");
          });
        }
        return;
      }

      if (action === "copy-data") {
        var type = btn.getAttribute("data-type");
        var key = btn.getAttribute("data-key");
        var item2 = getItemById(id);
        if (item2 && item2.rawContent && item2.rawContent[key]) {
          copyText(item2.rawContent[key]).then(function (ok) {
            toast(ok ? "Copiado" : "No se pudo copiar");
          });
        }
        return;
      }
    });

    /* Before unload warning */
    window.addEventListener("beforeunload", function (e) {
      if (window._dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
  });
})();
