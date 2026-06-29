"use strict";
(function () {
  /* ====== Estado en memoria (nunca se persiste) ====== */
  var STATE = {
    fileText: null,
    fileName: null,
    password: null,
    entries: [],
    cards: [],
    tickHandle: null,
    showCodes: true,
    dirty: false,
    timeMode: "real",
    timeFixed: null,
    timeOffset: 0
  };

  /* ====== Constantes del formato Proton Authenticator ====== */
  var ARGON2ID = {
    MEMORY_KIB: 19 * 1024,
    ITERATIONS: 2,
    PARALLELISM: 1,
    KEY_BYTES: 32,
    SALT_BYTES: 16
  };
  var AES_GCM_AAD = new TextEncoder().encode("proton.authenticator.export.v1");
  var NONCE_BYTES = 12;

  /* ====== Referencias DOM ====== */
  var lockScreen = document.getElementById("lock-screen");
  var appScreen = document.getElementById("app-screen");
  var unlockForm = document.getElementById("unlock-form");
  var passwordInput = document.getElementById("password");
  var lockError = document.getElementById("lock-error");
  var unlockBtn = document.getElementById("unlock-btn");
  var togglePw = document.getElementById("toggle-pw");
  var lockBtn = document.getElementById("lock-btn");
  var grid = document.getElementById("codes-grid");
  var emptyState = document.getElementById("empty-state");
  var searchInput = document.getElementById("search");
  var fileInput = document.getElementById("file-input");
  var pickerText = document.getElementById("picker-text");
  var pickerLabel = document.getElementById("file-picker-label");
  var showCodesLock = document.getElementById("show-codes-lock");
  var showCodesApp = document.getElementById("show-codes-app");
  var addBtn = document.getElementById("add-btn");
  var exportBtn = document.getElementById("export-btn");
  var pwBtn = document.getElementById("pw-btn");
  var addModal = document.getElementById("add-modal");
  var pwModal = document.getElementById("pw-modal");
  var blankVaultBtn = document.getElementById("blank-vault-btn");
  var blankModal = document.getElementById("blank-modal");
  var secretModal = document.getElementById("secret-modal");
  var editModal = document.getElementById("edit-modal");
  var secretQr = document.getElementById("secret-qr");
  var secretText = document.getElementById("secret-text");
  var secretToggleBtn = document.getElementById("secret-toggle-btn");
  var secretCopyBtn = document.getElementById("secret-copy-btn");
  var secretModalTitle = document.getElementById("secret-modal-title");
  var exampleBtn = document.getElementById("example-btn");
  var timeBtn = document.getElementById("time-btn");
  var timePopover = document.getElementById("time-popover");
  var timeFixed = document.getElementById("time-fixed");
  var timeOffsetDt = document.getElementById("time-offset-dt");
  var timeNowBtn = document.getElementById("time-now-btn");
  var timeSetBtn = document.getElementById("time-set-btn");
  var offsetWrap = document.getElementById("offset-input-wrap");
  var fixedWrap = document.getElementById("fixed-input-wrap");
  var timeEffective = document.getElementById("time-effective");
  var timeEffectiveValue = document.getElementById("time-effective-value");
  var timeDisplayHandle = null;

  /* ============================================================
     Base64 (estándar) — decodificación a Uint8Array
     ============================================================ */
  function base64Decode(str) {
    var clean = String(str).replace(/[^A-Za-z0-9+/=]/g, "");
    var bin = atob(clean);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function base64Encode(bytes) {
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function generateId() {
    var bytes = crypto.getRandomValues(new Uint8Array(12));
    var hex = "";
    for (var i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
    return hex;
  }

  /* ============================================================
     Base32 (RFC 4648) — para decodificar la semilla secreta
     ============================================================ */
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

  /* ============================================================
     Normalización del algoritmo a nombres de Web Crypto
     ============================================================ */
  function normAlgo(a) {
    var s = String(a || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (s.indexOf("512") !== -1) return "SHA-512";
    if (s.indexOf("256") !== -1) return "SHA-256";
    return "SHA-1";
  }

  /* ============================================================
     Generación TOTP / HOTP (RFC 6238 / 4226) con Web Crypto
     ============================================================ */
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

  function currentTime() {
    var now = Math.floor(Date.now() / 1000);
    if (STATE.timeMode === "fixed" && STATE.timeFixed !== null) return STATE.timeFixed;
    if (STATE.timeMode === "offset") return now + STATE.timeOffset;
    return now;
  }

  function formatTimestamp(ts) {
    var d = new Date(ts * 1000);
    var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }

  function toDateTimeLocal(d) {
    var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function updateTimeEffectiveDisplay() {
    if (STATE.timeMode === "real") {
      timeEffective.hidden = true;
      return;
    }
    timeEffective.hidden = false;
    timeEffectiveValue.textContent = formatTimestamp(currentTime());
  }

  function startTimeDisplay() {
    if (timeDisplayHandle) return;
    timeDisplayHandle = setInterval(updateTimeEffectiveDisplay, 1000);
  }

  function stopTimeDisplay() {
    if (timeDisplayHandle) { clearInterval(timeDisplayHandle); timeDisplayHandle = null; }
  }

  function generateCode(entry, offset) {
    var counter;
    if (entry.type === "steam") {
      counter = Math.floor(currentTime() / entry.period) + (offset || 0);
    } else if (entry.type === "hotp") {
      counter = (entry.counter || 0) + (offset || 0);
    } else {
      counter = Math.floor(currentTime() / entry.period) + (offset || 0);
    }
    var key = base32Decode(entry.secret);
    return hmacSign(key, counterBytes(counter), entry.algorithm).then(function (sig) {
      var num = truncate(sig);
      if (entry.type === "steam") {
        var chars = "23456789BCDFGHJKMNPQRTVWXY";
        var code = "";
        for (var i = 0; i < 5; i++) {
          code += chars[num % chars.length];
          num = Math.floor(num / chars.length);
        }
        return code;
      }
      var mod = Math.pow(10, entry.digits);
      return String(num % mod).padStart(entry.digits, "0");
    });
  }

  function formatCode(code, digits) {
    if (digits === 8) return code.slice(0, 4) + " " + code.slice(4);
    var parts = [];
    for (var i = 0; i < code.length; i += 3) parts.push(code.slice(i, i + 3));
    return parts.join(" ");
  }

  /* ============================================================
     Análisis (parsing) de URIs otpauth:// y steam://
     Sigue la misma lógica que el parser oficial de Proton
     (proton-pass-totp/src/totp.rs): el parámetro issuer= del
     query SIEMPRE tiene prioridad sobre el issuer del path.
     ============================================================ */
  function parseOtpAuthUri(uri) {
    if (uri.indexOf("steam://") === 0) {
      var steamSecret = decodeURIComponent(uri.substring("steam://".length));
      return {
        type: "steam",
        issuer: "Steam",
        name: "Steam",
        secret: steamSecret,
        period: 30,
        digits: 5,
        algorithm: "SHA-1",
        counter: 0
      };
    }

    var u;
    try { u = new URL(uri); } catch (e) { return null; }
    if (u.protocol !== "otpauth:") return null;
    var type = (u.host || "totp").toLowerCase();
    var rawPath = u.pathname.replace(/^\//, "");
    var pathname = decodeURIComponent(rawPath);
    var p = u.searchParams;
    var pIssuer = p.get("issuer");

    /* --- issuer (sigue la lógica de Proton) ---
       1) Si hay issuer= en el query → ese es el issuer (siempre)
       2) Si no, buscar dos puntos en el path → lo de antes es el issuer
       3) Si no hay dos puntos → sin issuer
    */
    var issuer = "";
    var pathIssuer = "";
    var colonIdx = pathname.indexOf(":");
    if (colonIdx !== -1) {
      pathIssuer = pathname.substring(0, colonIdx).trim();
    }

    if (pIssuer) {
      issuer = pIssuer;
    } else if (pathIssuer) {
      issuer = pathIssuer;
    }

    /* --- label / nombre (sigue la lógica de Proton) ---
       - Si hay dos puntos en el path y NO hay issuer= en el query
         que no coincida → el nombre es lo de después de los dos puntos
       - Si hay issuer= en el query que NO coincide con el issuer
         del path → el path entero es el nombre
       - Si no hay dos puntos → el path entero es el nombre
    */
    var name = "";
    if (colonIdx !== -1) {
      if (pIssuer && pIssuer !== pathIssuer) {
        name = pathname;
      } else {
        name = pathname.substring(colonIdx + 1).trim();
      }
    } else {
      name = pathname;
    }

    var secret = (p.get("secret") || "").replace(/\s/g, "");
    return {
      type: type === "hotp" ? "hotp" : "totp",
      issuer: issuer || "",
      name: name || "",
      secret: secret,
      period: parseInt(p.get("period"), 10) || 30,
      digits: parseInt(p.get("digits"), 10) || 6,
      algorithm: normAlgo(p.get("algorithm") || "SHA1"),
      counter: parseInt(p.get("counter"), 10) || 0
    };
  }

  /* ============================================================
     Normalización del JSON descifrado de Proton Authenticator
     Formato: { version:1, entries:[{id, content:{uri, entry_type, name}, note}] }
     ============================================================ */
  function parseCodes(data) {
    var entries;
    if (Array.isArray(data)) {
      entries = data;
    } else if (data && Array.isArray(data.entries)) {
      entries = data.entries;
    } else {
      throw new Error("Formato de JSON no reconocido.");
    }

    var result = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var entry;
      if (e && typeof e === "object" && e.content && e.content.uri) {
        entry = parseOtpAuthUri(e.content.uri);
        if (!entry) continue;
        /* content.name es el nombre para mostrar que usa Proton
           (totp.label o totp.issuer). Lo usamos:
           - como issuer si el URI no trae issuer
           - como name (subtítulo) si difiere del issuer (más limpio) */
        var cname = e.content.name || "";
        if (cname) {
          if (!entry.issuer) entry.issuer = cname;
          if (cname !== entry.issuer) entry.name = cname;
        }
        entry.id = e.id || generateId();
        entry.note = e.note || null;
      } else {
        var secret = String(e.secret || e.seed || "").replace(/\s+/g, "");
        var issuer = e.issuer || e.org || e.service || "";
        var name = e.name || e.account || e.label || e.username || e.email || "";
        entry = {
          type: String(e.type || "totp").toLowerCase(),
          issuer: String(issuer),
          name: String(name),
          secret: secret,
          period: parseInt(e.period, 10) || 30,
          digits: parseInt(e.digits, 10) || 6,
          algorithm: normAlgo(e.algorithm),
          counter: parseInt(e.counter, 10) || 0
        };
        entry.id = e.id || generateId();
        entry.note = e.note || null;
      }
      if (entry.secret) result.push(entry);
    }
    return result;
  }

  /* ============================================================
     Descifrado de la copia de Proton Authenticator
     Argon2id + AES-256-GCM
     ============================================================ */
  function deriveKeyArgon2id(password, saltBytes) {
    return hashwasm.argon2id({
      password: password,
      salt: saltBytes,
      parallelism: ARGON2ID.PARALLELISM,
      iterations: ARGON2ID.ITERATIONS,
      memorySize: ARGON2ID.MEMORY_KIB,
      hashLength: ARGON2ID.KEY_BYTES,
      outputType: "binary"
    });
  }

  function decryptAesGcm(keyBytes, nonceBytes, cipherData) {
    return crypto.subtle
      .importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"])
      .then(function (cryptoKey) {
        return crypto.subtle.decrypt(
          { name: "AES-GCM", iv: nonceBytes, additionalData: AES_GCM_AAD },
          cryptoKey,
          cipherData
        );
      });
  }

  function decryptBackup(text, password) {
    var trimmed = text.trim();
    var parsed;
    try { parsed = JSON.parse(trimmed); } catch (e) {
      throw new Error("El archivo no es un JSON válido.");
    }

    // Caso A: copia cifrada de Proton {version, salt, content}
    if (parsed && typeof parsed === "object" && parsed.salt && parsed.content) {
      if (parsed.version !== 1) {
        throw new Error("Versión de copia no soportada: " + parsed.version);
      }
      var salt = base64Decode(parsed.salt);
      if (salt.length !== ARGON2ID.SALT_BYTES) {
        throw new Error("Salt con longitud incorrecta (" + salt.length + " bytes).");
      }
      var content = base64Decode(parsed.content);
      if (content.length < NONCE_BYTES + 16) {
        throw new Error("Contenido cifrado demasiado corto.");
      }
      var nonce = content.slice(0, NONCE_BYTES);
      var cipherData = content.slice(NONCE_BYTES);

      return deriveKeyArgon2id(password, salt).then(function (keyBytes) {
        return decryptAesGcm(keyBytes, nonce, cipherData);
      }).then(function (decrypted) {
        var plainText = new TextDecoder().decode(decrypted);
        return JSON.parse(plainText);
      }).catch(function (err) {
        if (err && err.name === "OperationError") {
          throw new Error("DECRYPT_FAILED");
        }
        throw err;
      });
    }

    // Caso B: JSON en claro (sin cifrar)
    return Promise.resolve(parsed);
  }

  /* Determina si un texto es una copia cifrada (requiere contraseña)
     o un JSON en claro (no la requiere). */
  function isEncryptedBackup(text) {
    var trimmed = String(text).trim();
    if (!trimmed) return false;
    try {
      var parsed = JSON.parse(trimmed);
      return !!(parsed && typeof parsed === "object" &&
                parsed.salt && parsed.content);
    } catch (e) { return false; }
  }

  /* ============================================================
     Cifrado de la copia (inverso de decryptBackup)
     Construye el formato Proton: {version, salt, content}
     ============================================================ */
  function encryptBackup(plainText, password) {
    var salt = crypto.getRandomValues(new Uint8Array(ARGON2ID.SALT_BYTES));
    var nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
    var plainBytes = new TextEncoder().encode(plainText);

    return deriveKeyArgon2id(password, salt).then(function (keyBytes) {
      return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
    }).then(function (cryptoKey) {
      return crypto.subtle.encrypt(
        { name: "AES-GCM", iv: nonce, additionalData: AES_GCM_AAD },
        cryptoKey, plainBytes
      );
    }).then(function (encrypted) {
      var encBytes = new Uint8Array(encrypted);
      var content = new Uint8Array(nonce.length + encBytes.length);
      content.set(nonce, 0);
      content.set(encBytes, nonce.length);
      return JSON.stringify({
        version: 1,
        salt: base64Encode(salt),
        content: base64Encode(content)
      });
    });
  }

  /* Construye un URI otpauth:// a partir de una entrada canónica */
  function buildOtpAuthUri(entry) {
    var host = entry.type === "hotp" ? "hotp" : "totp";
    var label = encodeURIComponent(entry.name || "");
    var algo = String(entry.algorithm || "SHA-1").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (algo.indexOf("512") !== -1) algo = "SHA512";
    else if (algo.indexOf("256") !== -1) algo = "SHA256";
    else algo = "SHA1";
    var params = ["secret=" + encodeURIComponent(entry.secret)];
    if (entry.issuer) params.push("issuer=" + encodeURIComponent(entry.issuer));
    params.push("algorithm=" + algo);
    params.push("digits=" + entry.digits);
    params.push("period=" + entry.period);
    if (entry.type === "hotp") params.push("counter=" + (entry.counter || 0));
    return "otpauth://" + host + "/" + label + "?" + params.join("&");
  }

  /* Serializa las entradas al formato de texto plano de Proton */
  function buildProtonPlaintext(entries) {
    var exportEntries = entries.map(function (e) {
      var uri, entryType;
      if (e.type === "steam") {
        uri = "steam://" + e.secret;
        entryType = "Steam";
      } else {
        uri = buildOtpAuthUri(e);
        entryType = "Totp";
      }
      return {
        id: e.id,
        content: { uri: uri, entry_type: entryType, name: e.name || null },
        note: e.note || null
      };
    });
    return JSON.stringify({ version: 1, entries: exportEntries });
  }

  /* Descarga un archivo de texto */
  function downloadFile(filename, text) {
    var blob = new Blob([text], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 200);
  }

  /* ============================================================
     Carga del archivo (auto codes.json o selector de archivos)
     ============================================================ */
  function tryAutoLoadCodes() {
    return fetch("codes.json", { cache: "no-store" }).then(function (resp) {
      if (!resp.ok) return null;
      return resp.text().then(function (text) {
        STATE.fileText = text;
        STATE.fileName = "codes.json";
        return true;
      });
    }, function () { return null; });
  }

  /* Carga un archivo leído (texto) y decide si pedir contraseña o
     entrar directamente (si está en claro). Devuelve una promesa. */
  function ingestLoadedFile() {
    if (!STATE.fileText) {
      return Promise.resolve();
    }
    if (isEncryptedBackup(STATE.fileText)) {
      // Cifrado → mostrar pantalla de bloqueo para pedir contraseña
      // (preserva la contraseña si el usuario ya la había escrito)
      showLock(true);
      return Promise.resolve();
    }
    // En claro → entrar directamente a la app sin contraseña
    return decryptBackup(STATE.fileText, null)
      .then(function (data) { showApp(data); })
      .catch(function (err) {
        // Si falla el JSON en claro, mostrar pantalla de bloqueo con error
        showLock(true);
        lockError.textContent = "Error: " + ((err && err.message) || err);
      });
  }

  function loadFileFromFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        STATE.fileText = reader.result;
        STATE.fileName = file.name;
        resolve();
      };
      reader.onerror = function () { reject(new Error("No se pudo leer el archivo.")); };
      reader.readAsText(file);
    });
  }

  /* ============================================================
     Utilidades de presentación
     ============================================================ */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }

  function avatarLetter(text) {
    var t = (text || "?").trim();
    return (t.charAt(0) || "?").toUpperCase();
  }

  function avatarColor(seed) {
    var hash = 0;
    for (var i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    var h = Math.abs(hash) % 360;
    return "linear-gradient(135deg, hsl(" + h + ",68%,55%), hsl(" + ((h + 45) % 360) + ",68%,42%))";
  }

  var COPY_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';

  var EYE_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';

  var EYE_OFF_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M6.06 6.06a10 10 0 0 0-2.54 5.94 10 10 0 0 0 8.48 5.94 10 10 0 0 0 4.6-.86"/><path d="M2 2l20 20"/></svg>';

  var TRASH_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
    '<path d="M10 11v6M14 11v6"/></svg>';

  var EDIT_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>' +
    '<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';

  /* Enmascarar un código (según su longitud) para el modo oculto */
  function maskCode(len) {
    var n = len || 6;
    var dots = "";
    for (var i = 0; i < n; i++) dots += "•";
    return formatCode(dots, n);
  }

  /* Decide si una tarjeta debe mostrar su código.
     - Si el global está activado: visible salvo que la tarjeta esté fijada como oculta
     - Si el global está desactivado: oculta salvo que la tarjeta esté fijada como visible */
  function cardVisible(card) {
    return STATE.showCodes ? !card._pinned : !!card._pinned;
  }

  /* Aplica la visibilidad al texto del código y del siguiente */
  function applyVisibility(card) {
    var entry = card._entry;
    var st = card._st;
    var codeEl = card.querySelector(".code");
    var nextEl = card.querySelector(".next-code");
    var revealBtn = card.querySelector(".reveal-btn");
    if (!st.current) return;
    if (cardVisible(card)) {
      codeEl.textContent = formatCode(st.current, entry.digits);
      nextEl.textContent = formatCode(st.next, entry.digits);
      if (revealBtn) revealBtn.innerHTML = EYE_OFF_SVG;
    } else {
      codeEl.textContent = maskCode(st.current.length || entry.digits);
      nextEl.textContent = maskCode(st.next.length || entry.digits);
      if (revealBtn) revealBtn.innerHTML = EYE_SVG;
    }
  }

  /* Mostrar la vista de semilla secreta (reemplaza el anillo) */
  function showSecretView(card) {
    var codeArea = card.querySelector(".code-area");
    var nextRow = card.querySelector(".next-row");
    if (!codeArea || codeArea._secretView) return;
    codeArea._secretView = true;
    if (nextRow) nextRow.style.display = "none";
    codeArea.innerHTML =
      '<div class="secret-view">' +
        '<span class="secret-label">Semilla secreta</span>' +
        '<button class="copy-secret-btn" data-action="copy-secret" type="button">' + COPY_SVG + 'Copiar semilla secreta</button>' +
        '<button class="secret-back" data-action="back-code" type="button">← Volver al código</button>' +
      "</div>";
  }

  function hideSecretView(card) {
    var codeArea = card.querySelector(".code-area");
    var nextRow = card.querySelector(".next-row");
    if (!codeArea || !codeArea._secretView) return;
    codeArea._secretView = false;
    if (nextRow) nextRow.style.display = "";
    // Reconstruir el contenido original
    codeArea.innerHTML =
      '<svg class="ring" viewBox="0 0 120 120">' +
        '<circle class="ring-bg" cx="60" cy="60" r="' + RING_R + '"/>' +
        '<circle class="ring-fg" cx="60" cy="60" r="' + RING_R + '" stroke-dasharray="' + RING_C.toFixed(2) + '"/>' +
      "</svg>" +
      '<div class="code-wrap">' +
        '<div class="remaining"></div>' +
        '<div class="code" data-action="copy" title="Copiar código">------</div>' +
        '<button class="copy-current-btn" data-action="copy" type="button" title="Copiar código actual">' + COPY_SVG + "</button>" +
      "</div>";
    // Forzar regeneración
    card._st.step = -1;
    updateCard(card);
  }

  /* Genera un QR como SVG y lo inserta en un contenedor */
  function renderQr(container, text) {
    try {
      var typeNumber = 0; // autodetectar
      var qr = qrcode(typeNumber, "M");
      qr.addData(text);
      qr.make();
      container.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2 });
    } catch (e) {
      container.innerHTML = '<p style="color:#ff5252;font-size:0.8rem;">No se pudo generar el QR</p>';
    }
  }

  /* Abre el modal de semilla secreta con QR del otpauth:// y texto */
  var secretModalState = { uri: "", secret: "", showSecret: false };

  function openSecretModal(entry) {
    secretModalState.uri = buildOtpAuthUri(entry);
    secretModalState.secret = entry.secret || "";
    secretModalState.showSecret = false;
    secretModalTitle.textContent = "Importar en otro gestor";
    secretToggleBtn.textContent = "Mostrar semilla secreta para copiar";
    renderQr(secretQr, secretModalState.uri);
    secretText.textContent = secretModalState.uri;
    openModal(secretModal);
  }

  /* ============================================================
     Construcción de tarjetas
     ============================================================ */
  var RING_R = 54;
  var RING_C = 2 * Math.PI * RING_R;

  function buildCard(entry, index) {
    var card = document.createElement("div");
    card.className = "card";
    card.style.animationDelay = (index * 55) + "ms";

    var headTitle = entry.issuer || entry.name || "Cuenta";
    var headSub = entry.issuer ? entry.name : "";
    var seedColor = entry.issuer + "|" + entry.name;
    var pill = entry.type === "hotp" ? "HOTP" : (entry.type === "steam" ? "STEAM" : "TOTP");

    card.innerHTML =
      '<div class="card-head">' +
        '<div class="avatar" style="background:' + avatarColor(seedColor) + '">' + escapeHtml(avatarLetter(headTitle)) + "</div>" +
        '<div class="titles">' +
          '<div class="issuer" title="' + escapeAttr(headTitle) + '">' + escapeHtml(headTitle) + "</div>" +
          (headSub ? '<div class="account" title="' + escapeAttr(headSub) + '">' + escapeHtml(headSub) + "</div>" : "") +
        "</div>" +
        '<span class="type-pill" data-action="show-secret" title="Acceso a semilla secreta">' + pill + "</span>" +
        '<button class="delete-btn" data-action="edit" type="button" title="Editar código">' + EDIT_SVG + "</button>" +
        '<button class="delete-btn" data-action="delete" type="button" title="Eliminar código">' + TRASH_SVG + "</button>" +
      "</div>" +
      '<div class="code-area">' +
        '<svg class="ring" viewBox="0 0 120 120">' +
          '<circle class="ring-bg" cx="60" cy="60" r="' + RING_R + '"/>' +
          '<circle class="ring-fg" cx="60" cy="60" r="' + RING_R + '" stroke-dasharray="' + RING_C.toFixed(2) + '"/>' +
        "</svg>" +
        '<div class="code-wrap">' +
          '<div class="remaining"></div>' +
          '<div class="code" data-action="copy" title="Copiar código">------</div>' +
          '<button class="copy-current-btn" data-action="copy" type="button" title="Copiar código actual">' + COPY_SVG + "</button>" +
        "</div>" +
      "</div>" +
      '<div class="next-row">' +
        '<span class="next-label">Siguiente</span>' +
        '<span class="next-code" data-action="copy-next" title="Copiar siguiente código">------</span>' +
        '<button class="reveal-btn" data-action="reveal" type="button" title="Mostrar/ocultar este código">' + EYE_SVG + "</button>" +
        '<button class="copy-btn" data-action="copy-next" type="button" title="Copiar siguiente código">' + COPY_SVG + "</button>" +
      "</div>";

    card._entry = entry;
    card._st = { step: -1, current: "", next: "" };
    card._pinned = false;
    grid.appendChild(card);
    return card;
  }

  function updateCard(card) {
    var entry = card._entry;
    var st = card._st;
    var codeArea = card.querySelector(".code-area");
    // Si la tarjeta está en modo semilla secreta, no actualizar el anillo/código
    if (codeArea && codeArea._secretView) return Promise.resolve();
    var codeEl = card.querySelector(".code");
    var nextEl = card.querySelector(".next-code");
    var remainEl = card.querySelector(".remaining");
    var ringFg = card.querySelector(".ring-fg");
    if (!codeEl || !remainEl || !ringFg) return Promise.resolve();

    if (entry.type === "hotp") {
      if (st.step === -1) {
        return Promise.all([generateCode(entry, 0), generateCode(entry, 1)]).then(function (res) {
          st.current = res[0];
          st.next = res[1];
          st.step = 0;
          applyVisibility(card);
          remainEl.textContent = "HOTP";
          ringFg.style.strokeDashoffset = "0";
          card.classList.add("stage-1");
          card._stage = 1;
        });
      }
      return Promise.resolve();
    }

    var now = currentTime();
    var step = Math.floor(now / entry.period);
    var remaining = entry.period - (now % entry.period);
    var reset = step !== st.step;

    var cont = function () {
      if (reset) {
        ringFg.classList.add("snap");
        codeEl.classList.remove("pulse");
        void codeEl.offsetWidth;
        codeEl.classList.add("pulse");
      }
      var ratio = remaining / entry.period;
      ringFg.style.strokeDashoffset = (RING_C * (1 - ratio)).toFixed(2);
      remainEl.textContent = remaining + "s";
      // Etapa de color: 1 (verde claro, mucho tiempo) → 5 (rojo, a punto de expirar)
      var stage;
      if (ratio > 0.80) stage = 1;
      else if (ratio > 0.60) stage = 2;
      else if (ratio > 0.40) stage = 3;
      else if (ratio > 0.20) stage = 4;
      else stage = 5;
      if (card._stage !== stage) {
        card.classList.remove("stage-1", "stage-2", "stage-3", "stage-4", "stage-5");
        card.classList.add("stage-" + stage);
        card._stage = stage;
      }
      if (reset) {
        void ringFg.offsetWidth;
        ringFg.classList.remove("snap");
      }
    };

    if (reset) {
      st.step = step;
      return Promise.all([generateCode(entry, 0), generateCode(entry, 1)]).then(function (res) {
        st.current = res[0];
        st.next = res[1];
        applyVisibility(card);
        cont();
      });
    }
    cont();
    return Promise.resolve();
  }

  function tick() {
    for (var i = 0; i < STATE.cards.length; i++) updateCard(STATE.cards[i]);
  }

  /* ============================================================
     Portapapeles + toast
     ============================================================ */
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

  /* ============================================================
     Modales
     ============================================================ */
  function openModal(modal) { modal.hidden = false; }
  function closeModal(modal) { modal.hidden = true; }

  /* ============================================================
     Gestión de códigos: añadir, eliminar
     ============================================================ */
  function markDirty() {
    STATE.dirty = true;
  }

  function addEntry(entry) {
    STATE.entries.push(entry);
    var card = buildCard(entry, STATE.cards.length);
    STATE.cards.push(card);
    updateCard(card);
    applyVisibility(card);
    markDirty();
    applyFilter();
  }

  function deleteEntry(card) {
    var idx = STATE.cards.indexOf(card);
    if (idx === -1) return;
    var entry = card._entry;
    // eliminar de entries
    for (var i = 0; i < STATE.entries.length; i++) {
      if (STATE.entries[i].id === entry.id) { STATE.entries.splice(i, 1); break; }
    }
    STATE.cards.splice(idx, 1);
    card.remove();
    markDirty();
    applyFilter();
  }

  /* Editar una entrada existente: actualiza entry, reconstruye la tarjeta */
  function editEntry(card, newEntry) {
    var entry = card._entry;
    // mantener id
    newEntry.id = entry.id;
    // actualizar en STATE.entries
    for (var i = 0; i < STATE.entries.length; i++) {
      if (STATE.entries[i].id === entry.id) { STATE.entries[i] = newEntry; break; }
    }
    // reconstruir la tarjeta en su posición
    var idx = STATE.cards.indexOf(card);
    card.remove();
    var newCard = buildCard(newEntry, idx);
    newCard.style.animationDelay = "0ms";
    newCard.style.animation = "cardIn 0.3s cubic-bezier(0.22,1,0.36,1) forwards";
    STATE.cards[idx] = newCard;
    // insertar en el DOM en la misma posición
    if (idx < grid.children.length) {
      grid.insertBefore(newCard, grid.children[idx]);
    } else {
      grid.appendChild(newCard);
    }
    updateCard(newCard);
    applyVisibility(newCard);
    markDirty();
    applyFilter();
  }

  /* Abre el modal de edición con los datos de la entrada */
  function openEditModal(entry) {
    document.getElementById("e-issuer").value = entry.issuer || "";
    document.getElementById("e-name").value = entry.name || "";
    document.getElementById("e-secret").value = entry.secret || "";
    document.getElementById("e-type").value = entry.type === "hotp" ? "hotp" : "totp";
    document.getElementById("e-algo").value = String(entry.algorithm || "SHA-1").toUpperCase().replace(/[^A-Z0-9]/g, "") === "SHA512" ? "SHA512" :
      String(entry.algorithm || "SHA-1").toUpperCase().replace(/[^A-Z0-9]/g, "") === "SHA256" ? "SHA256" : "SHA1";
    document.getElementById("e-digits").value = entry.digits || 6;
    document.getElementById("e-period").value = entry.period || 30;
    document.getElementById("e-counter").value = entry.counter || 0;
    document.getElementById("e-note").value = entry.note || "";
    document.getElementById("e-counter-wrap").classList.toggle("active", entry.type === "hotp");
    document.getElementById("edit-error").textContent = "";
    editModal._editingEntry = entry;
    openModal(editModal);
    setTimeout(function () { document.getElementById("e-issuer").focus(); }, 50);
  }

  /* ============================================================
     Exportar códigos (cifrado Proton)
     ============================================================ */
  function exportCodes() {
    if (!STATE.entries.length) { toast("No hay códigos para exportar"); return; }
    if (!STATE.password) {
      // Sin contraseña (archivo en claro) → pedir una para el export
      openModal(pwModal);
      pwModal._exportPending = true;
      return;
    }
    doExport(STATE.password);
  }

  function doExport(password) {
    toast("Cifrando y exportando…");
    var plainText = buildProtonPlaintext(STATE.entries);
    encryptBackup(plainText, password).then(function (json) {
      var now = new Date();
      var date = now.toISOString().slice(0, 10);
      downloadFile("proton_authenticator_backup_" + date + ".json", json);
      STATE.dirty = false;
      toast("Códigos exportados");
    }).catch(function (err) {
      toast("Error al exportar: " + ((err && err.message) || err));
    });
  }

  /* ============================================================
     Visibilidad global de los códigos
     ============================================================ */
  function setShowCodes(value) {
    STATE.showCodes = !!value;
    // Sincronizar ambos toggles
    if (showCodesLock) showCodesLock.checked = STATE.showCodes;
    if (showCodesApp) showCodesApp.checked = STATE.showCodes;
    // Marcar la pantalla principal para el estilo de códigos ocultos
    appScreen.classList.toggle("codes-hidden", !STATE.showCodes);
    // Al cambiar el global, reiniciar el estado individual de cada tarjeta
    for (var i = 0; i < STATE.cards.length; i++) STATE.cards[i]._pinned = false;
    // Reaplicar visibilidad a todas las tarjetas
    for (var j = 0; j < STATE.cards.length; j++) applyVisibility(STATE.cards[j]);
  }

  /* ============================================================
     Flujo principal
     ============================================================ */
  function showLock(preservePassword) {
    if (STATE.tickHandle) { clearInterval(STATE.tickHandle); STATE.tickHandle = null; }
    STATE.cards = [];
    grid.innerHTML = "";
    appScreen.classList.remove("active");
    lockScreen.classList.add("active");
    if (!preservePassword) passwordInput.value = "";
    lockError.textContent = "";
    searchInput.value = "";
    updateFileInfo();
    setTimeout(function () { passwordInput.focus(); }, 50);
  }

  function truncateFileName(name, max) {
    if (!name) return "";
    var n = String(name);
    if (n.length <= max) return n;
    return n.substring(0, max - 1) + "…";
  }

  function updateFileInfo() {
    if (STATE.fileName) {
      pickerText.textContent = "Cambiar archivo: " + truncateFileName(STATE.fileName, 28);
      pickerText.title = STATE.fileName;
      pickerLabel.classList.add("loaded");
    } else {
      pickerText.innerHTML = "Subir archivo de backup en JSON (<u>U</u>)";
      pickerText.title = "";
      pickerLabel.classList.remove("loaded");
    }
  }

  function setLoading(on, label) {
    unlockBtn.disabled = on;
    unlockBtn.querySelector(".btn-label").textContent = label || (on ? "Descifrando…" : "Desbloquear");
    unlockBtn.querySelector(".btn-spin").hidden = !on;
  }

  /* Muestra la pantalla principal con los datos descifrados. */
  function showApp(data) {
    var codes = data ? parseCodes(data) : [];
    STATE.entries = codes;
    STATE.cards = [];
    grid.innerHTML = "";
    codes.forEach(function (e, i) { STATE.cards.push(buildCard(e, i)); });
    setShowCodes(STATE.showCodes);
    tick();
    STATE.tickHandle = setInterval(tick, 1000);
    STATE.dirty = false;
    addBtn.disabled = false;
    exportBtn.disabled = false;
    pwBtn.disabled = false;
    lockScreen.classList.remove("active");
    appScreen.classList.add("active");
  }

  function tryUnlock(password) {
    if (!STATE.fileText) {
      lockError.textContent = "Selecciona primero un archivo de copia.";
      return;
    }
    lockError.textContent = "";
    setLoading(true, "Descifrando (Argon2id)…");
    decryptBackup(STATE.fileText, password)
      .then(function (data) {
        STATE.password = password;
        showApp(data);
      })
      .catch(function (err) {
        var msg = (err && err.message) ? err.message : String(err);
        if (msg === "DECRYPT_FAILED" || /OperationError|decrypt/i.test(msg)) {
          lockError.textContent = "Contraseña incorrecta o archivo dañado.";
        } else {
          lockError.textContent = "Error: " + msg;
        }
        passwordInput.select();
      })
      .then(function () { setLoading(false); });
  }

  /* ============================================================
     Búsqueda
     ============================================================ */
  function applyFilter() {
    var q = searchInput.value.trim().toLowerCase();
    var visible = 0;
    for (var i = 0; i < STATE.cards.length; i++) {
      var c = STATE.cards[i];
      var e = c._entry;
      var hay = (e.issuer + " " + e.name).toLowerCase();
      var match = !q || hay.indexOf(q) !== -1;
      c.classList.toggle("hidden", !match);
      if (match) visible++;
    }
    emptyState.hidden = visible !== 0;
  }

  /* ============================================================
     Eventos
     ============================================================ */
  document.addEventListener("DOMContentLoaded", function () {
    // Estado inicial de visibilidad desde el toggle de la pantalla de bloqueo
    STATE.showCodes = showCodesLock.checked;

    // Por defecto se carga codes.json del directorio actual. Si no existe,
    // el usuario deberá seleccionar un archivo con el selector.
    tryAutoLoadCodes().then(function (found) {
      if (found) {
        updateFileInfo();
        ingestLoadedFile();
      } else {
        showLock();
      }
    });

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

    lockBtn.addEventListener("click", function () {
      // Bloquear: borra toda la memoria sensible y vuelve a la pantalla de bloqueo
      if (STATE.tickHandle) { clearInterval(STATE.tickHandle); STATE.tickHandle = null; }
      STATE.cards = [];
      STATE.entries = [];
      STATE.password = null;
      STATE.fileText = null;
      STATE.fileName = null;
      STATE.dirty = false;
      grid.innerHTML = "";
      if (fileInput) fileInput.value = "";
      addBtn.disabled = true;
      exportBtn.disabled = true;
      pwBtn.disabled = true;
      showLock();
    });

    // Toggles de mostrar/ocultar códigos (pantalla de bloqueo y principal)
    showCodesLock.addEventListener("change", function () {
      setShowCodes(showCodesLock.checked);
    });
    showCodesApp.addEventListener("change", function () {
      setShowCodes(showCodesApp.checked);
    });

    searchInput.addEventListener("input", applyFilter);

    // Atajos de teclado: / (buscar), B (bloquear), A (añadir), C (cambiar clave), D (descargar)
    document.addEventListener("keydown", function (e) {
      // Ignorar si ya se está escribiendo en un campo o hay un modal abierto
      var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
      if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;
      // Solo en la pantalla principal
      if (!appScreen.classList.contains("active")) return;
      var key = e.key.toLowerCase();
      if (key === "/") {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
        return;
      }
      if (key === "b" && !addBtn.disabled) { e.preventDefault(); lockBtn.click(); return; }
      if (key === "a" && !addBtn.disabled) { e.preventDefault(); addBtn.click(); return; }
      if (key === "c" && !pwBtn.disabled) { e.preventDefault(); pwBtn.click(); return; }
      if (key === "d" && !exportBtn.disabled) { e.preventDefault(); exportBtn.click(); return; }
    });

    // Salir de la búsqueda con Escape
    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        searchInput.value = "";
        applyFilter();
        searchInput.blur();
      }
    });

    fileInput.addEventListener("change", function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      loadFileFromFile(file).then(function () {
        updateFileInfo();
        lockError.textContent = "";
        ingestLoadedFile();
      }, function (err) {
        lockError.textContent = "Error: " + (err.message || err);
      });
    });

    // Delegación: copiar / revelar / eliminar / cerrar modal
    document.addEventListener("click", function (e) {
      // Cerrar modal (los botones usan data-modal-close, no data-action)
      var closer = e.target.closest("[data-modal-close]");
      if (closer) {
        var mid = closer.getAttribute("data-modal-close");
        if (mid) closeModal(document.getElementById(mid));
        return;
      }

      var t = e.target.closest("[data-action]");
      if (!t) return;
      var action = t.getAttribute("data-action");

      var card = t.closest(".card");
      if (!card) return;

      // Eliminar código
      if (action === "delete") {
        var entry = card._entry;
        var label = entry.issuer || entry.name || "este código";
        if (confirm("¿Eliminar el código de " + label + "?")) {
          deleteEntry(card);
          toast("Código eliminado");
        }
        return;
      }

      // Editar código
      if (action === "edit") {
        openEditModal(card._entry);
        return;
      }

      // Revelar/ocultar un código individual (invierte el estado de esa tarjeta)
      if (action === "reveal") {
        card._pinned = !card._pinned;
        applyVisibility(card);
        return;
      }

      // Mostrar semilla secreta (click en etiqueta TOTP/HOTP/STEAM)
      if (action === "show-secret") {
        showSecretView(card);
        return;
      }

      // Volver del view de semilla al código
      if (action === "back-code") {
        hideSecretView(card);
        return;
      }

      // Copiar semilla secreta → abrir modal con QR
      if (action === "copy-secret") {
        openSecretModal(card._entry);
        return;
      }

      // Copiar (funciona aunque el código esté oculto)
      // copy = actual, copy-next = futuro
      var st = card._st;
      var raw = action === "copy-next" ? st.next : st.current;
      if (!raw) return;
      copyText(raw.replace(/\s/g, "")).then(function (ok) {
        toast(ok ? (action === "copy-next" ? "Siguiente código copiado" : "Código copiado") : "No se pudo copiar");
      });
    });

    /* --- Botones de la topbar --- */
    addBtn.addEventListener("click", function () {
      openModal(addModal);
      document.getElementById("add-uri").value = "";
      document.getElementById("add-error").textContent = "";
      setTimeout(function () { document.getElementById("add-uri").focus(); }, 50);
    });

    exportBtn.addEventListener("click", exportCodes);

    pwBtn.addEventListener("click", function () {
      openModal(pwModal);
      pwModal._exportPending = false;
      document.getElementById("new-pw").value = "";
      document.getElementById("new-pw2").value = "";
      document.getElementById("pw-error").textContent = "";
      setTimeout(function () { document.getElementById("new-pw").focus(); }, 50);
    });

    /* --- Fijar fecha/hora --- */
    timeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      timePopover.classList.toggle("show");
      if (timePopover.classList.contains("show")) {
        // Pre-llenar el input de offset con la hora actual del sistema
        if (!timeOffsetDt.value) {
          timeOffsetDt.value = toDateTimeLocal(new Date());
        }
        updateTimeEffectiveDisplay();
        startTimeDisplay();
      } else {
        stopTimeDisplay();
      }
    });
    document.addEventListener("click", function (e) {
      if (!timePopover.contains(e.target) && e.target !== timeBtn) {
        timePopover.classList.remove("show");
        stopTimeDisplay();
      }
    });
    // Mostrar/ocultar campos según el modo seleccionado
    timePopover.querySelectorAll('input[name="time-mode"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        var mode = this.value;
        offsetWrap.hidden = mode !== "offset";
        fixedWrap.hidden = mode !== "fixed";
        updateTimeEffectiveDisplay();
      });
    });
    timeNowBtn.addEventListener("click", function () {
      STATE.timeMode = "real";
      STATE.timeFixed = null;
      STATE.timeOffset = 0;
      timeFixed.value = "";
      timeOffsetDt.value = "";
      timePopover.querySelector('input[value="real"]').checked = true;
      offsetWrap.hidden = true;
      fixedWrap.hidden = true;
      updateTimeEffectiveDisplay();
      timePopover.classList.remove("show");
      stopTimeDisplay();
      toast("Usando hora actual");
    });
    timeSetBtn.addEventListener("click", function () {
      var mode = timePopover.querySelector('input[name="time-mode"]:checked');
      mode = mode ? mode.value : "real";
      if (mode === "real") {
        STATE.timeMode = "real";
        STATE.timeFixed = null;
        STATE.timeOffset = 0;
        toast("Usando hora actual");
      } else if (mode === "offset") {
        var val = timeOffsetDt.value;
        if (!val) { toast("Selecciona una fecha/hora"); return; }
        var d = new Date(val);
        if (isNaN(d.getTime())) { toast("Fecha no válida"); return; }
        var picked = Math.floor(d.getTime() / 1000);
        var sysNow = Math.floor(Date.now() / 1000);
        STATE.timeMode = "offset";
        STATE.timeOffset = picked - sysNow;
        toast("Hora corregida (diferencia " + (STATE.timeOffset >= 0 ? "+" : "") + STATE.timeOffset + "s)");
      } else if (mode === "fixed") {
        var fval = timeFixed.value;
        if (!fval) { toast("Selecciona una fecha"); return; }
        var fd = new Date(fval);
        if (isNaN(fd.getTime())) { toast("Fecha no válida"); return; }
        STATE.timeMode = "fixed";
        STATE.timeFixed = Math.floor(fd.getTime() / 1000);
        toast("Hora fijada");
      }
      updateTimeEffectiveDisplay();
      timePopover.classList.remove("show");
      stopTimeDisplay();
    });

    /* --- Crear bóveda en blanco --- */
    blankVaultBtn.addEventListener("click", function () {
      openModal(blankModal);
      document.getElementById("blank-pw").value = "";
      document.getElementById("blank-pw2").value = "";
      document.getElementById("blank-error").textContent = "";
      setTimeout(function () { document.getElementById("blank-pw").focus(); }, 50);
    });

    document.getElementById("blank-confirm").addEventListener("click", function () {
      var errEl = document.getElementById("blank-error");
      errEl.textContent = "";
      var pw1 = document.getElementById("blank-pw").value;
      var pw2 = document.getElementById("blank-pw2").value;
      if (!pw1) { errEl.textContent = "Introduce una contraseña."; return; }
      if (pw1 !== pw2) { errEl.textContent = "Las contraseñas no coinciden."; return; }
      STATE.password = pw1;
      STATE.fileName = null;
      STATE.fileText = null;
      closeModal(blankModal);
      showApp(null);
    });

    /* --- Modal semilla secreta: toggle QR/semilla y copiar --- */
    secretToggleBtn.addEventListener("click", function () {
      secretModalState.showSecret = !secretModalState.showSecret;
      if (secretModalState.showSecret) {
        secretModalTitle.textContent = "Semilla secreta";
        secretToggleBtn.textContent = "← Volver al código QR";
        renderQr(secretQr, secretModalState.secret);
        secretText.textContent = secretModalState.secret;
      } else {
        secretModalTitle.textContent = "Importar en otro gestor";
        secretToggleBtn.textContent = "Mostrar semilla secreta para copiar";
        renderQr(secretQr, secretModalState.uri);
        secretText.textContent = secretModalState.uri;
      }
    });
    secretCopyBtn.addEventListener("click", function () {
      var text = secretModalState.showSecret ? secretModalState.secret : secretModalState.uri;
      copyText(text).then(function (ok) {
        toast(ok ? "Copiado" : "No se pudo copiar");
      });
    });

    /* --- Usar archivo de ejemplo --- */
    exampleBtn.addEventListener("click", function () {
      fetch("assets/examples/codes.example.json", { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("No se pudo cargar el archivo de ejemplo");
        return r.text();
      }).then(function (text) {
        STATE.fileText = text;
        STATE.fileName = "assets/examples/codes.example.json";
        updateFileInfo();
        ingestLoadedFile();
      }).catch(function (err) {
        lockError.textContent = "Error: " + (err.message || err);
      });
    });

    /* --- Pestañas del modal Añadir --- */
    addModal.querySelectorAll(".tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        addModal.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        var name = tab.getAttribute("data-tab");
        addModal.querySelectorAll(".tab-pane").forEach(function (pane) {
          pane.hidden = pane.getAttribute("data-tab") !== name;
        });
      });
    });

    // Mostrar/ocultar campo contador según tipo
    document.getElementById("m-type").addEventListener("change", function () {
      document.getElementById("m-counter-wrap").classList.toggle("active", this.value === "hotp");
    });

    // Mostrar/ocultar campo contador en editar según tipo
    document.getElementById("e-type").addEventListener("change", function () {
      document.getElementById("e-counter-wrap").classList.toggle("active", this.value === "hotp");
    });

    /* --- Confirmar editar código --- */
    document.getElementById("edit-confirm").addEventListener("click", function () {
      var errEl = document.getElementById("edit-error");
      errEl.textContent = "";
      var secret = document.getElementById("e-secret").value.trim().replace(/\s/g, "");
      if (!secret) { errEl.textContent = "El secreto es obligatorio."; return; }
      var entry = editModal._editingEntry;
      if (!entry) { closeModal(editModal); return; }
      var newEntry = {
        id: entry.id,
        type: document.getElementById("e-type").value === "hotp" ? "hotp" : "totp",
        issuer: document.getElementById("e-issuer").value.trim(),
        name: document.getElementById("e-name").value.trim(),
        secret: secret,
        period: parseInt(document.getElementById("e-period").value, 10) || 30,
        digits: parseInt(document.getElementById("e-digits").value, 10) || 6,
        algorithm: normAlgo(document.getElementById("e-algo").value),
        counter: parseInt(document.getElementById("e-counter").value, 10) || 0,
        note: document.getElementById("e-note").value.trim() || null
      };
      // encontrar la tarjeta correspondiente
      var card = null;
      for (var i = 0; i < STATE.cards.length; i++) {
        if (STATE.cards[i]._entry.id === entry.id) { card = STATE.cards[i]; break; }
      }
      if (card) editEntry(card, newEntry);
      closeModal(editModal);
      toast("Código actualizado");
    });

    /* --- Confirmar añadir código --- */
    document.getElementById("add-confirm").addEventListener("click", function () {
      var errEl = document.getElementById("add-error");
      errEl.textContent = "";
      var activeTab = addModal.querySelector(".tab.active").getAttribute("data-tab");
      var entry;

      if (activeTab === "uri") {
        var uri = document.getElementById("add-uri").value.trim();
        if (!uri) { errEl.textContent = "Pega un URI otpauth:// o steam://"; return; }
        entry = parseOtpAuthUri(uri);
        if (!entry || !entry.secret) { errEl.textContent = "URI no válido."; return; }
      } else {
        var secret = document.getElementById("m-secret").value.trim().replace(/\s/g, "");
        if (!secret) { errEl.textContent = "El secreto es obligatorio."; return; }
        entry = {
          id: generateId(),
          type: document.getElementById("m-type").value === "hotp" ? "hotp" : "totp",
          issuer: document.getElementById("m-issuer").value.trim(),
          name: document.getElementById("m-name").value.trim(),
          secret: secret,
          period: parseInt(document.getElementById("m-period").value, 10) || 30,
          digits: parseInt(document.getElementById("m-digits").value, 10) || 6,
          algorithm: normAlgo(document.getElementById("m-algo").value),
          counter: parseInt(document.getElementById("m-counter").value, 10) || 0,
          note: null
        };
      }
      entry.id = entry.id || generateId();
      entry.note = entry.note || null;
      addEntry(entry);
      closeModal(addModal);
      toast("Código añadido");
    });

    /* --- Confirmar cambiar contraseña --- */
    document.getElementById("pw-confirm").addEventListener("click", function () {
      var errEl = document.getElementById("pw-error");
      errEl.textContent = "";
      var pw1 = document.getElementById("new-pw").value;
      var pw2 = document.getElementById("new-pw2").value;
      if (!pw1) { errEl.textContent = "Introduce una contraseña."; return; }
      if (pw1 !== pw2) { errEl.textContent = "Las contraseñas no coinciden."; return; }
      STATE.password = pw1;
      markDirty();
      closeModal(pwModal);
      if (pwModal._exportPending) {
        pwModal._exportPending = false;
        doExport(pw1);
      } else {
        toast("Contraseña cambiada. Exporta para guardar los cambios.");
      }
    });

    /* --- Escanear QR con la cámara --- */
    document.getElementById("scan-btn").addEventListener("click", function () {
      if (typeof window.jsQR === "undefined") {
        toast("No se pudo cargar el lector QR (jsQR). Revisa la conexión.");
        return;
      }
      startQrScanner(function (data) {
        // Asegurar que la pestaña URI está activa
        var uriTab = document.querySelector('.tab[data-tab="uri"]');
        if (uriTab && !uriTab.classList.contains("active")) uriTab.click();
        document.getElementById("add-uri").value = data;
        document.getElementById("add-error").textContent = "";
        toast("Código QR leído");
      });
    });

    function startQrScanner(onSuccess) {
      var overlay = document.createElement("div");
      overlay.className = "qr-overlay";
      overlay.innerHTML =
        '<video id="qr-video" autoplay playsinline muted></video>' +
        '<div class="qr-frame"></div>' +
        '<div class="qr-hint">Centra el código QR dentro del recuadro</div>' +
        '<button class="qr-close" type="button" aria-label="Cerrar">×</button>';
      document.body.appendChild(overlay);

      var video = overlay.querySelector("#qr-video");
      var closeBtn = overlay.querySelector(".qr-close");
      var hint = overlay.querySelector(".qr-hint");
      var canvas = document.createElement("canvas");
      var ctx = canvas.getContext("2d", { willReadFrequently: true });
      var stream = null;
      var raf = null;
      var stopped = false;

      function showError(msg) {
        if (stopped) return;
        stopped = true;
        if (raf) cancelAnimationFrame(raf);
        if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
        video.style.display = "none";
        var frame = overlay.querySelector(".qr-frame");
        if (frame) frame.style.display = "none";
        hint.innerHTML = msg + '<br><br><span style="opacity:.7">Toca × para cerrar</span>';
        hint.style.fontSize = "0.95rem";
        hint.style.padding = "0 24px";
      }

      function stop() {
        stopped = true;
        if (raf) cancelAnimationFrame(raf);
        if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }
      closeBtn.addEventListener("click", stop);

      // Comprobar contexto seguro (getUserMedia solo funciona en https o localhost)
      var isSecure = location.protocol === "https:" ||
                     location.hostname === "localhost" ||
                     location.hostname === "127.0.0.1";
      if (!isSecure || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showError("La cámara requiere HTTPS (o localhost).<br>Accede desde una URL <strong>https://</strong> o por <strong>localhost:8080</strong>.");
        return;
      }

      try {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
          .then(function (s) {
            stream = s;
            video.srcObject = s;
            return video.play();
          })
          .then(function () {
            (function tick() {
              if (stopped) return;
              if (video.readyState >= 2 && video.videoWidth > 0) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
                var res = window.jsQR(img.data, img.width, img.height);
                if (res && res.data) {
                  var data = res.data.trim();
                  if (data) {
                    stop();
                    onSuccess(data);
                    return;
                  }
                }
              }
              raf = requestAnimationFrame(tick);
            })();
          })
          .catch(function (err) {
            var msg = (err && err.name === "NotAllowedError")
              ? "Permiso de cámara denegado.<br>Actívalo en los ajustes del navegador."
              : "No se pudo acceder a la cámara: " + (err && err.message ? err.message : err);
            showError(msg);
          });
      } catch (err) {
        showError("No se pudo acceder a la cámara: " + (err.message || err));
      }
    }

    /* --- Cerrar modales con Escape --- */
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (!addModal.hidden) { closeModal(addModal); return; }
      if (!pwModal.hidden) { closeModal(pwModal); return; }
      if (!blankModal.hidden) { closeModal(blankModal); return; }
      if (!secretModal.hidden) { closeModal(secretModal); return; }
      if (!editModal.hidden) { closeModal(editModal); return; }
    });

    /* --- Aviso al salir de la página con cambios sin guardar --- */
    window.addEventListener("beforeunload", function (e) {
      if (STATE.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
  });
})();
