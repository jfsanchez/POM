(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.hashwasm = {}));
}(this, (function (exports) { 'use strict';

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    /* eslint-disable import/prefer-default-export */
    /* eslint-disable no-bitwise */
    var _a;
    function getGlobal() {
        if (typeof globalThis !== 'undefined')
            return globalThis;
        // eslint-disable-next-line no-restricted-globals
        if (typeof self !== 'undefined')
            return self;
        if (typeof window !== 'undefined')
            return window;
        return global;
    }
    const globalObject = getGlobal();
    const nodeBuffer = (_a = globalObject.Buffer) !== null && _a !== void 0 ? _a : null;
    const textEncoder = globalObject.TextEncoder ? new globalObject.TextEncoder() : null;
    function intArrayToString(arr, len) {
        return String.fromCharCode(...arr.subarray(0, len));
    }
    function hexCharCodesToInt(a, b) {
        return (((a & 0xF) + ((a >> 6) | ((a >> 3) & 0x8))) << 4) | ((b & 0xF) + ((b >> 6) | ((b >> 3) & 0x8)));
    }
    function writeHexToUInt8(buf, str) {
        const size = str.length >> 1;
        for (let i = 0; i < size; i++) {
            const index = i << 1;
            buf[i] = hexCharCodesToInt(str.charCodeAt(index), str.charCodeAt(index + 1));
        }
    }
    const alpha = 'a'.charCodeAt(0) - 10;
    const digit = '0'.charCodeAt(0);
    function getDigestHex(tmpBuffer, input, hashLength) {
        let p = 0;
        /* eslint-disable no-plusplus */
        for (let i = 0; i < hashLength; i++) {
            let nibble = input[i] >>> 4;
            tmpBuffer[p++] = nibble > 9 ? nibble + alpha : nibble + digit;
            nibble = input[i] & 0xF;
            tmpBuffer[p++] = nibble > 9 ? nibble + alpha : nibble + digit;
        }
        /* eslint-enable no-plusplus */
        return String.fromCharCode.apply(null, tmpBuffer);
    }
    const getUInt8Buffer = nodeBuffer !== null
        ? (data) => {
            if (typeof data === 'string') {
                const buf = nodeBuffer.from(data, 'utf8');
                return new Uint8Array(buf.buffer, buf.byteOffset, buf.length);
            }
            if (nodeBuffer.isBuffer(data)) {
                return new Uint8Array(data.buffer, data.byteOffset, data.length);
            }
            if (ArrayBuffer.isView(data)) {
                return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
            }
            throw new Error('Invalid data type!');
        }
        : (data) => {
            if (typeof data === 'string') {
                return textEncoder.encode(data);
            }
            if (ArrayBuffer.isView(data)) {
                return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
            }
            throw new Error('Invalid data type!');
        };
    const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const base64Lookup = new Uint8Array(256);
    for (let i = 0; i < base64Chars.length; i++) {
        base64Lookup[base64Chars.charCodeAt(i)] = i;
    }
    function encodeBase64(data, pad = true) {
        const len = data.length;
        const extraBytes = len % 3;
        const parts = [];
        const len2 = len - extraBytes;
        for (let i = 0; i < len2; i += 3) {
            const tmp = ((data[i] << 16) & 0xFF0000)
                + ((data[i + 1] << 8) & 0xFF00)
                + (data[i + 2] & 0xFF);
            const triplet = base64Chars.charAt((tmp >> 18) & 0x3F)
                + base64Chars.charAt((tmp >> 12) & 0x3F)
                + base64Chars.charAt((tmp >> 6) & 0x3F)
                + base64Chars.charAt(tmp & 0x3F);
            parts.push(triplet);
        }
        if (extraBytes === 1) {
            const tmp = data[len - 1];
            const a = base64Chars.charAt(tmp >> 2);
            const b = base64Chars.charAt((tmp << 4) & 0x3F);
            parts.push(`${a}${b}`);
            if (pad) {
                parts.push('==');
            }
        }
        else if (extraBytes === 2) {
            const tmp = (data[len - 2] << 8) + data[len - 1];
            const a = base64Chars.charAt(tmp >> 10);
            const b = base64Chars.charAt((tmp >> 4) & 0x3F);
            const c = base64Chars.charAt((tmp << 2) & 0x3F);
            parts.push(`${a}${b}${c}`);
            if (pad) {
                parts.push('=');
            }
        }
        return parts.join('');
    }
    function getDecodeBase64Length(data) {
        let bufferLength = Math.floor(data.length * 0.75);
        const len = data.length;
        if (data[len - 1] === '=') {
            bufferLength -= 1;
            if (data[len - 2] === '=') {
                bufferLength -= 1;
            }
        }
        return bufferLength;
    }
    function decodeBase64(data) {
        const bufferLength = getDecodeBase64Length(data);
        const len = data.length;
        const bytes = new Uint8Array(bufferLength);
        let p = 0;
        for (let i = 0; i < len; i += 4) {
            const encoded1 = base64Lookup[data.charCodeAt(i)];
            const encoded2 = base64Lookup[data.charCodeAt(i + 1)];
            const encoded3 = base64Lookup[data.charCodeAt(i + 2)];
            const encoded4 = base64Lookup[data.charCodeAt(i + 3)];
            bytes[p] = (encoded1 << 2) | (encoded2 >> 4);
            p += 1;
            bytes[p] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
            p += 1;
            bytes[p] = ((encoded3 & 3) << 6) | (encoded4 & 63);
            p += 1;
        }
        return bytes;
    }

    class Mutex {
        constructor() {
            this.mutex = Promise.resolve();
        }
        lock() {
            let begin = () => { };
            this.mutex = this.mutex.then(() => new Promise(begin));
            return new Promise((res) => {
                begin = res;
            });
        }
        dispatch(fn) {
            return __awaiter(this, void 0, void 0, function* () {
                const unlock = yield this.lock();
                try {
                    return yield Promise.resolve(fn());
                }
                finally {
                    unlock();
                }
            });
        }
    }

    const MAX_HEAP = 16 * 1024;
    const wasmMutex = new Mutex();
    const wasmModuleCache = new Map();
    function WASMInterface(binary, hashLength) {
        return __awaiter(this, void 0, void 0, function* () {
            let wasmInstance = null;
            let memoryView = null;
            let initialized = false;
            if (typeof WebAssembly === 'undefined') {
                throw new Error('WebAssembly is not supported in this environment!');
            }
            const writeMemory = (data, offset = 0) => {
                memoryView.set(data, offset);
            };
            const getMemory = () => memoryView;
            const getExports = () => wasmInstance.exports;
            const setMemorySize = (totalSize) => {
                wasmInstance.exports.Hash_SetMemorySize(totalSize);
                const arrayOffset = wasmInstance.exports.Hash_GetBuffer();
                const memoryBuffer = wasmInstance.exports.memory.buffer;
                memoryView = new Uint8Array(memoryBuffer, arrayOffset, totalSize);
            };
            const loadWASMPromise = wasmMutex.dispatch(() => __awaiter(this, void 0, void 0, function* () {
                if (!wasmModuleCache.has(binary.name)) {
                    const asm = decodeBase64(binary.data);
                    const promise = WebAssembly.compile(asm);
                    wasmModuleCache.set(binary.name, promise);
                }
                const module = yield wasmModuleCache.get(binary.name);
                wasmInstance = yield WebAssembly.instantiate(module, {
                // env: {
                //   emscripten_memcpy_big: (dest, src, num) => {
                //     const memoryBuffer = wasmInstance.exports.memory.buffer;
                //     const memView = new Uint8Array(memoryBuffer, 0);
                //     memView.set(memView.subarray(src, src + num), dest);
                //   },
                //   print_memory: (offset, len) => {
                //     const memoryBuffer = wasmInstance.exports.memory.buffer;
                //     const memView = new Uint8Array(memoryBuffer, 0);
                //     console.log('print_int32', memView.subarray(offset, offset + len));
                //   },
                // },
                });
                // wasmInstance.exports._start();
            }));
            const setupInterface = () => __awaiter(this, void 0, void 0, function* () {
                if (!wasmInstance) {
                    yield loadWASMPromise;
                }
                const arrayOffset = wasmInstance.exports.Hash_GetBuffer();
                const memoryBuffer = wasmInstance.exports.memory.buffer;
                memoryView = new Uint8Array(memoryBuffer, arrayOffset, MAX_HEAP);
            });
            const init = (bits = null) => {
                initialized = true;
                wasmInstance.exports.Hash_Init(bits);
            };
            const updateUInt8Array = (data) => {
                let read = 0;
                while (read < data.length) {
                    const chunk = data.subarray(read, read + MAX_HEAP);
                    read += chunk.length;
                    memoryView.set(chunk);
                    wasmInstance.exports.Hash_Update(chunk.length);
                }
            };
            const update = (data) => {
                if (!initialized) {
                    throw new Error('update() called before init()');
                }
                const Uint8Buffer = getUInt8Buffer(data);
                updateUInt8Array(Uint8Buffer);
            };
            const digestChars = new Uint8Array(hashLength * 2);
            const digest = (outputType, padding = null) => {
                if (!initialized) {
                    throw new Error('digest() called before init()');
                }
                initialized = false;
                wasmInstance.exports.Hash_Final(padding);
                if (outputType === 'binary') {
                    // the data is copied to allow GC of the original memory object
                    return memoryView.slice(0, hashLength);
                }
                return getDigestHex(digestChars, memoryView, hashLength);
            };
            const isDataShort = (data) => {
                if (typeof data === 'string') {
                    // worst case is 4 bytes / char
                    return data.length < MAX_HEAP / 4;
                }
                return data.byteLength < MAX_HEAP;
            };
            let canSimplify = isDataShort;
            switch (binary.name) {
                case 'argon2.wasm':
                case 'scrypt.wasm':
                    canSimplify = () => true;
                    break;
                case 'blake2b.wasm':
                    // if there is a key at blake2b then cannot simplify
                    canSimplify = (data, initParam) => initParam <= 512 && isDataShort(data);
                    break;
                case 'xxhash64.wasm': // cannot simplify
                    canSimplify = () => false;
                    break;
            }
            // shorthand for (init + update + digest) for better performance
            const calculate = (data, initParam = null, digestParam = null) => {
                if (!canSimplify(data, initParam)) {
                    init(initParam);
                    update(data);
                    return digest('hex', digestParam);
                }
                const buffer = getUInt8Buffer(data);
                memoryView.set(buffer);
                wasmInstance.exports.Hash_Calculate(buffer.length, initParam, digestParam);
                return getDigestHex(digestChars, memoryView, hashLength);
            };
            yield setupInterface();
            return {
                getMemory,
                writeMemory,
                getExports,
                setMemorySize,
                init,
                update,
                digest,
                calculate,
                hashLength,
            };
        });
    }

    var name = "blake2b.wasm";
    var data = "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";
    var wasmJson = {
    	name: name,
    	data: data
    };

    function lockedCreate(mutex, binary, hashLength) {
        return __awaiter(this, void 0, void 0, function* () {
            const unlock = yield mutex.lock();
            const wasm = yield WASMInterface(binary, hashLength);
            unlock();
            return wasm;
        });
    }

    const mutex = new Mutex();
    let wasmCache = null;
    function validateBits(bits) {
        if (!Number.isInteger(bits) || bits < 8 || bits > 512 || bits % 8 !== 0) {
            return new Error('Invalid variant! Valid values: 8, 16, ..., 512');
        }
        return null;
    }
    function getInitParam(outputBits, keyBits) {
        // eslint-disable-next-line no-bitwise
        return outputBits | (keyBits << 16);
    }
    function blake2b(data, bits = 512, key = null) {
        if (validateBits(bits)) {
            return Promise.reject(validateBits(bits));
        }
        let keyBuffer = null;
        let initParam = bits;
        if (key !== null) {
            keyBuffer = getUInt8Buffer(key);
            if (keyBuffer.length > 64) {
                return Promise.reject(new Error('Max key length is 64 bytes'));
            }
            initParam = getInitParam(bits, keyBuffer.length);
        }
        const hashLength = bits / 8;
        if (wasmCache === null || wasmCache.hashLength !== hashLength) {
            return lockedCreate(mutex, wasmJson, hashLength)
                .then((wasm) => {
                wasmCache = wasm;
                if (initParam > 512) {
                    wasmCache.writeMemory(keyBuffer);
                }
                return wasmCache.calculate(data, initParam);
            });
        }
        try {
            if (initParam > 512) {
                wasmCache.writeMemory(keyBuffer);
            }
            const hash = wasmCache.calculate(data, initParam);
            return Promise.resolve(hash);
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    function createBLAKE2b(bits = 512, key = null) {
        if (validateBits(bits)) {
            return Promise.reject(validateBits(bits));
        }
        let keyBuffer = null;
        let initParam = bits;
        if (key !== null) {
            keyBuffer = getUInt8Buffer(key);
            if (keyBuffer.length > 64) {
                return Promise.reject(new Error('Max key length is 64 bytes'));
            }
            initParam = getInitParam(bits, keyBuffer.length);
        }
        const outputSize = bits / 8;
        return WASMInterface(wasmJson, outputSize).then((wasm) => {
            if (initParam > 512) {
                wasm.writeMemory(keyBuffer);
            }
            wasm.init(initParam);
            const obj = {
                init: initParam > 512
                    ? () => {
                        wasm.writeMemory(keyBuffer);
                        wasm.init(initParam);
                        return obj;
                    }
                    : () => {
                        wasm.init(initParam);
                        return obj;
                    },
                update: (data) => { wasm.update(data); return obj; },
                digest: (outputType) => wasm.digest(outputType),
                blockSize: 1024,
                digestSize: outputSize,
            };
            return obj;
        });
    }

    var name$1 = "argon2.wasm";
    var data$1 = "AGFzbQEAAAABLAZgAABgAn9/AGAEf39/fwBgEH9/f39/f39/f39/f39/f38AYAABf2ABfwF/AwcGAwIABQQBBQYBAQSAgAIHSgUGbWVtb3J5AgASSGFzaF9TZXRNZW1vcnlTaXplAAMOSGFzaF9HZXRCdWZmZXIABA5IYXNoX0NhbGN1bGF0ZQAFBl9zdGFydAACCtAzBpwPAQN+IAAgBCkDACIQIAApAwAiEXwgEUIBhkL+////H4MgEEL/////D4N+fCIQNwMAIAwgECAMKQMAhSIQQiCJIhE3AwAgCCARIAgpAwAiEnwgEkIBhkL+////H4MgEEIgiH58IhA3AwAgBCAQIAQpAwCFIhBCKIkiETcDACAAIBEgACkDACISfCAQQhiIQv////8PgyASQgGGQv7///8fg358IhA3AwAgDCAQIAwpAwCFIhBCMIkiETcDACAIIBEgCCkDACISfCAQQhCIQv////8PgyASQgGGQv7///8fg358IhA3AwAgBCAQIAQpAwCFQgGJNwMAIAEgBSkDACIQIAEpAwAiEXwgEUIBhkL+////H4MgEEL/////D4N+fCIQNwMAIA0gECANKQMAhSIQQiCJIhE3AwAgCSARIAkpAwAiEnwgEkIBhkL+////H4MgEEIgiH58IhA3AwAgBSAQIAUpAwCFIhBCKIkiETcDACABIBEgASkDACISfCAQQhiIQv////8PgyASQgGGQv7///8fg358IhA3AwAgDSAQIA0pAwCFIhBCMIkiETcDACAJIBEgCSkDACISfCAQQhCIQv////8PgyASQgGGQv7///8fg358IhA3AwAgBSAQIAUpAwCFQgGJNwMAIAIgBikDACIQIAIpAwAiEXwgEUIBhkL+////H4MgEEL/////D4N+fCIQNwMAIA4gECAOKQMAhSIQQiCJIhE3AwAgCiARIAopAwAiEnwgEkIBhkL+////H4MgEEIgiH58IhA3AwAgBiAQIAYpAwCFIhBCKIkiETcDACACIBEgAikDACISfCAQQhiIQv////8PgyASQgGGQv7///8fg358IhA3AwAgDiAQIA4pAwCFIhBCMIkiETcDACAKIBEgCikDACISfCAQQhCIQv////8PgyASQgGGQv7///8fg358IhA3AwAgBiAQIAYpAwCFQgGJNwMAIAMgBykDACIQIAMpAwAiEXwgEUIBhkL+////H4MgEEL/////D4N+fCIQNwMAIA8gECAPKQMAhSIQQiCJIhE3AwAgCyARIAspAwAiEnwgEkIBhkL+////H4MgEEIgiH58IhA3AwAgByAQIAcpAwCFIhBCKIkiETcDACADIBEgAykDACISfCAQQhiIQv////8PgyASQgGGQv7///8fg358IhA3AwAgDyAQIA8pAwCFIhBCMIkiETcDACALIBEgCykDACISfCAQQhCIQv////8PgyASQgGGQv7///8fg358IhA3AwAgByAQIAcpAwCFQgGJNwMAIAAgBSkDACIQIAApAwAiEXwgEUIBhkL+////H4MgEEL/////D4N+fCIQNwMAIA8gECAPKQMAhSIQQiCJIhE3AwAgCiARIAopAwAiEnwgEkIBhkL+////H4MgEEIgiH58IhA3AwAgBSAQIAUpAwCFIhBCKIkiETcDACAAIBEgACkDACISfCAQQhiIQv////8PgyASQgGGQv7///8fg358IhA3AwAgDyAQIA8pAwCFIhBCMIkiETcDACAKIBEgCikDACISfCAQQhCIQv////8PgyASQgGGQv7///8fg358IhA3AwAgBSAQIAUpAwCFQgGJNwMAIAEgBikDACIQIAEpAwAiEXwgEUIBhkL+////H4MgEEL/////D4N+fCIQNwMAIAwgECAMKQMAhSIQQiCJIhE3AwAgCyARIAspAwAiEnwgEkIBhkL+////H4MgEEIgiH58IhA3AwAgBiAQIAYpAwCFIhBCKIkiETcDACABIBEgASkDACISfCAQQhiIQv////8PgyASQgGGQv7///8fg358IhA3AwAgDCAQIAwpAwCFIhBCMIkiETcDACALIBEgCykDACISfCAQQhCIQv////8PgyASQgGGQv7///8fg358IhA3AwAgBiAQIAYpAwCFQgGJNwMAIAIgBykDACIQIAIpAwAiEXwgEUIBhkL+////H4MgEEL/////D4N+fCIQNwMAIA0gECANKQMAhSIQQiCJIhE3AwAgCCARIAgpAwAiEnwgEkIBhkL+////H4MgEEIgiH58IhA3AwAgByAQIAcpAwCFIhBCKIkiETcDACACIBEgAikDACISfCAQQhiIQv////8PgyASQgGGQv7///8fg358IhA3AwAgDSAQIA0pAwCFIhBCMIkiETcDACAIIBEgCCkDACISfCAQQhCIQv////8PgyASQgGGQv7///8fg358IhA3AwAgByAQIAcpAwCFQgGJNwMAIAMgBCkDACIQIAMpAwAiEXwgEUIBhkL+////H4MgEEL/////D4N+fCIQNwMAIA4gECAOKQMAhSIQQiCJIhE3AwAgCSARIAkpAwAiEnwgEkIBhkL+////H4MgEEIgiH58IhA3AwAgBCAQIAQpAwCFIhBCKIkiETcDACADIBEgAykDACISfCAQQhiIQv////8PgyASQgGGQv7///8fg358IhA3AwAgDiAQIA4pAwCFIhBCMIkiETcDACAJIBEgCSkDACISfCAQQhCIQv////8PgyASQgGGQv7///8fg358IhA3AwAgBCAQIAQpAwCFQgGJNwMAC4kaAQJ/QZAgIAIpAwAgASkDAIU3AwBBmCAgAikDCCABKQMIhTcDAEGgICACKQMQIAEpAxCFNwMAQaggIAIpAxggASkDGIU3AwBBsCAgAikDICABKQMghTcDAEG4ICACKQMoIAEpAyiFNwMAQcAgIAIpAzAgASkDMIU3AwBByCAgAikDOCABKQM4hTcDAEHQICACKQNAIAEpA0CFNwMAQdggIAIpA0ggASkDSIU3AwBB4CAgAikDUCABKQNQhTcDAEHoICACKQNYIAEpA1iFNwMAQfAgIAIpA2AgASkDYIU3AwBB+CAgAikDaCABKQNohTcDAEGAISACKQNwIAEpA3CFNwMAQYghIAIpA3ggASkDeIU3AwBBkCEgAikDgAEgASkDgAGFNwMAQZghIAIpA4gBIAEpA4gBhTcDAEGgISACKQOQASABKQOQAYU3AwBBqCEgAikDmAEgASkDmAGFNwMAQbAhIAIpA6ABIAEpA6ABhTcDAEG4ISACKQOoASABKQOoAYU3AwBBwCEgAikDsAEgASkDsAGFNwMAQcghIAIpA7gBIAEpA7gBhTcDAEHQISACKQPAASABKQPAAYU3AwBB2CEgAikDyAEgASkDyAGFNwMAQeAhIAIpA9ABIAEpA9ABhTcDAEHoISACKQPYASABKQPYAYU3AwBB8CEgAikD4AEgASkD4AGFNwMAQfghIAIpA+gBIAEpA+gBhTcDAEGAIiACKQPwASABKQPwAYU3AwBBiCIgAikD+AEgASkD+AGFNwMAQZAiIAIpA4ACIAEpA4AChTcD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";
    var wasmJson$1 = {
    	name: name$1,
    	data: data$1
    };

    function encodeResult(salt, options, res) {
        const parameters = [
            `m=${options.memorySize}`,
            `t=${options.iterations}`,
            `p=${options.parallelism}`,
        ].join(',');
        return `$argon2${options.hashType}$v=19$${parameters}$${encodeBase64(salt, false)}$${encodeBase64(res, false)}`;
    }
    const uint32View = new DataView(new ArrayBuffer(4));
    function int32LE(x) {
        uint32View.setInt32(0, x, true);
        return new Uint8Array(uint32View.buffer);
    }
    function hashFunc(blake512, buf, len) {
        return __awaiter(this, void 0, void 0, function* () {
            if (len <= 64) {
                const blake = yield createBLAKE2b(len * 8);
                blake.update(int32LE(len));
                blake.update(buf);
                return blake.digest('binary');
            }
            const r = Math.ceil(len / 32) - 2;
            const ret = new Uint8Array(len);
            blake512.init();
            blake512.update(int32LE(len));
            blake512.update(buf);
            let vp = blake512.digest('binary');
            ret.set(vp.subarray(0, 32), 0);
            for (let i = 1; i < r; i++) {
                blake512.init();
                blake512.update(vp);
                vp = blake512.digest('binary');
                ret.set(vp.subarray(0, 32), i * 32);
            }
            const partialBytesNeeded = len - 32 * r;
            let blakeSmall;
            if (partialBytesNeeded === 64) {
                blakeSmall = blake512;
                blakeSmall.init();
            }
            else {
                blakeSmall = yield createBLAKE2b(partialBytesNeeded * 8);
            }
            blakeSmall.update(vp);
            vp = blakeSmall.digest('binary');
            ret.set(vp.subarray(0, partialBytesNeeded), r * 32);
            return ret;
        });
    }
    function getHashType(type) {
        switch (type) {
            case 'd':
                return 0;
            case 'i':
                return 1;
            default:
                return 2;
        }
    }
    function argon2Internal(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { parallelism, iterations, hashLength } = options;
            const password = getUInt8Buffer(options.password);
            const salt = getUInt8Buffer(options.salt);
            const version = 0x13;
            const hashType = getHashType(options.hashType);
            const { memorySize } = options; // in KB
            const [argon2Interface, blake512] = yield Promise.all([
                WASMInterface(wasmJson$1, 1024),
                createBLAKE2b(512),
            ]);
            // last block is for storing the init vector
            argon2Interface.setMemorySize(memorySize * 1024 + 1024);
            const initVector = new Uint8Array(24);
            const initVectorView = new DataView(initVector.buffer);
            initVectorView.setInt32(0, parallelism, true);
            initVectorView.setInt32(4, hashLength, true);
            initVectorView.setInt32(8, memorySize, true);
            initVectorView.setInt32(12, iterations, true);
            initVectorView.setInt32(16, version, true);
            initVectorView.setInt32(20, hashType, true);
            argon2Interface.writeMemory(initVector, memorySize * 1024);
            blake512.init();
            blake512.update(initVector);
            blake512.update(int32LE(password.length));
            blake512.update(password);
            blake512.update(int32LE(salt.length));
            blake512.update(salt);
            blake512.update(int32LE(0)); // key length + key
            blake512.update(int32LE(0)); // associatedData length + associatedData
            const segments = Math.floor(memorySize / (parallelism * 4)); // length of each lane
            const lanes = segments * 4;
            const param = new Uint8Array(72);
            const H0 = blake512.digest('binary');
            param.set(H0);
            for (let lane = 0; lane < parallelism; lane++) {
                param.set(int32LE(0), 64);
                param.set(int32LE(lane), 68);
                let position = lane * lanes;
                let chunk = yield hashFunc(blake512, param, 1024);
                argon2Interface.writeMemory(chunk, position * 1024);
                position += 1;
                param.set(int32LE(1), 64);
                chunk = yield hashFunc(blake512, param, 1024);
                argon2Interface.writeMemory(chunk, position * 1024);
            }
            const C = new Uint8Array(1024);
            writeHexToUInt8(C, argon2Interface.calculate(new Uint8Array([]), memorySize));
            const res = yield hashFunc(blake512, C, hashLength);
            if (options.outputType === 'hex') {
                const digestChars = new Uint8Array(hashLength * 2);
                return getDigestHex(digestChars, res, hashLength);
            }
            if (options.outputType === 'encoded') {
                return encodeResult(salt, options, res);
            }
            // return binary format
            return res;
        });
    }
    const validateOptions = (options) => {
        if (!options || typeof options !== 'object') {
            throw new Error('Invalid options parameter. It requires an object.');
        }
        if (!options.password) {
            throw new Error('Password must be specified');
        }
        options.password = getUInt8Buffer(options.password);
        if (options.password.length < 1) {
            throw new Error('Password must be specified');
        }
        if (!options.salt) {
            throw new Error('Salt must be specified');
        }
        options.salt = getUInt8Buffer(options.salt);
        if (options.salt.length < 8) {
            throw new Error('Salt should be at least 8 bytes long');
        }
        if (!Number.isInteger(options.iterations) || options.iterations < 1) {
            throw new Error('Iterations should be a positive number');
        }
        if (!Number.isInteger(options.parallelism) || options.parallelism < 1) {
            throw new Error('Parallelism should be a positive number');
        }
        if (!Number.isInteger(options.hashLength) || options.hashLength < 4) {
            throw new Error('Hash length should be at least 4 bytes.');
        }
        if (!Number.isInteger(options.memorySize)) {
            throw new Error('Memory size should be specified.');
        }
        if (options.memorySize < 8 * options.parallelism) {
            throw new Error('Memory size should be at least 8 * parallelism.');
        }
        if (options.outputType === undefined) {
            options.outputType = 'hex';
        }
        if (!['hex', 'binary', 'encoded'].includes(options.outputType)) {
            throw new Error(`Insupported output type ${options.outputType}. Valid values: ['hex', 'binary', 'encoded']`);
        }
    };
    function argon2i(options) {
        return __awaiter(this, void 0, void 0, function* () {
            validateOptions(options);
            return argon2Internal(Object.assign(Object.assign({}, options), { hashType: 'i' }));
        });
    }
    function argon2id(options) {
        return __awaiter(this, void 0, void 0, function* () {
            validateOptions(options);
            return argon2Internal(Object.assign(Object.assign({}, options), { hashType: 'id' }));
        });
    }
    function argon2d(options) {
        return __awaiter(this, void 0, void 0, function* () {
            validateOptions(options);
            return argon2Internal(Object.assign(Object.assign({}, options), { hashType: 'd' }));
        });
    }
    const getHashParameters = (password, encoded) => {
        const regex = /^\$argon2(id|i|d)\$v=([0-9]+)\$((?:[mtp]=[0-9]+,){2}[mtp]=[0-9]+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;
        const match = encoded.match(regex);
        if (!match) {
            throw new Error('Invalid hash');
        }
        const [, hashType, version, parameters, salt, hash] = match;
        if (version !== '19') {
            throw new Error(`Unsupported version: ${version}`);
        }
        const parsedParameters = {};
        const paramMap = { m: 'memorySize', p: 'parallelism', t: 'iterations' };
        parameters.split(',').forEach((x) => {
            const [n, v] = x.split('=');
            parsedParameters[paramMap[n]] = parseInt(v, 10);
        });
        return Object.assign(Object.assign({}, parsedParameters), { password, hashType: hashType, salt: decodeBase64(salt), hashLength: getDecodeBase64Length(hash), outputType: 'encoded' });
    };
    const validateVerifyOptions = (options) => {
        if (!options || typeof options !== 'object') {
            throw new Error('Invalid options parameter. It requires an object.');
        }
        if (options.hash === undefined || typeof options.hash !== 'string') {
            throw new Error('Hash should be specified');
        }
    };
    function argon2Verify(options) {
        return __awaiter(this, void 0, void 0, function* () {
            validateVerifyOptions(options);
            const params = getHashParameters(options.password, options.hash);
            validateOptions(params);
            const hashStart = options.hash.lastIndexOf('$') + 1;
            const result = yield argon2Internal(params);
            return result.substring(hashStart) === options.hash.substring(hashStart);
        });
    }

    var name$2 = "crc32.wasm";
    var data$2 = "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";
    var wasmJson$2 = {
    	name: name$2,
    	data: data$2
    };

    const mutex$1 = new Mutex();
    let wasmCache$1 = null;
    function crc32(data) {
        if (wasmCache$1 === null) {
            return lockedCreate(mutex$1, wasmJson$2, 4)
                .then((wasm) => {
                wasmCache$1 = wasm;
                return wasmCache$1.calculate(data);
            });
        }
        try {
            const hash = wasmCache$1.calculate(data);
            return Promise.resolve(hash);
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    function createCRC32() {
        return WASMInterface(wasmJson$2, 4).then((wasm) => {
            wasm.init();
            const obj = {
                init: () => { wasm.init(); return obj; },
                update: (data) => { wasm.update(data); return obj; },
                digest: (outputType) => wasm.digest(outputType),
                blockSize: 4,
                digestSize: 4,
            };
            return obj;
        });
    }

    var name$3 = "md4.wasm";
    var data$3 = "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";
    var wasmJson$3 = {
    	name: name$3,
    	data: data$3
    };

    const mutex$2 = new Mutex();
    let wasmCache$2 = null;
    function md4(data) {
        if (wasmCache$2 === null) {
            return lockedCreate(mutex$2, wasmJson$3, 16)
                .then((wasm) => {
                wasmCache$2 = wasm;
                return wasmCache$2.calculate(data);
            });
        }
        try {
            const hash = wasmCache$2.calculate(data);
            return Promise.resolve(hash);
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    function createMD4() {
        return WASMInterface(wasmJson$3, 16).then((wasm) => {
            wasm.init();
            const obj = {
                init: () => { wasm.init(); return obj; },
                update: (data) => { wasm.update(data); return obj; },
                digest: (outputType) => wasm.digest(outputType),
                blockSize: 64,
                digestSize: 16,
            };
            return obj;
        });
    }

    var name$4 = "md5.wasm";
    var data$4 = "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7aoGakEGdyAEaiICIAVBf3NyIARzakGSmbP4eGpBCncgAmoiAyAEQX9zciACc2pB/ei/f2pBD3cgA2oiBWogAyANaiACIBZqIAQgEWogBSACQX9zciADc2pB0buRrHhqQRV3IAVqIgIgA0F/c3IgBXNqQc/8of0GakEGdyACaiIEIAVBf3NyIAJzakHgzbNxakEKdyAEaiIDIAJBf3NyIARzakGUhoWYempBD3cgA2oiBWogAyAQaiAEIBRqIAIgF2ogBSAEQX9zciADc2pBoaOg8ARqQRV3IAVqIgIgA0F/c3IgBXNqQYL9zbp/akEGdyACaiIEIAVBf3NyIAJzakG15Ovpe2pBCncgBGoiAyACQX9zciAEc2pBu6Xf1gJqQQ93IANqIgVqIAIgFWogBSAEQX9zciADc2pBkaeb3H5qQRV3aiECIAUgBmohBiADIAdqIQcgBCALaiELIABBQGshACABQUBqIgENAAtBlIgBIAc2AgBBkIgBIAY2AgBBjIgBIAI2AgBBiIgBIAs2AgAgAAvOAQECf0GAiAEoAgBBP3EiAUGYiAFqQYABOgAAIAFBAWohACABQT9zIgFBB00EfyAAQZiIAWogARADQcAAIQFBmIgBQcAAEAAaQQAFIAALQZiIAWogAUF4ahADQdSIAUGEiAEoAgA2AgBB04gBQYCIASgCACIAQRV2OgAAQdKIASAAQQ12OgAAQdGIASAAQQV2OgAAQdCIASAAQQN0IgA6AABBgIgBIAA2AgBBmIgBQcAAEAAaQYAIQYiIASkCADcDAEGICEGQiAEpAgA3AwALxwIBA39BgIgBQYCIASgCACIBIABqQf////8BcSIDNgIAQYSIASgCACECIAMgAUkEQEGEiAEgAkEBaiICNgIAC0GEiAEgAiAAQR12ajYCAAJAAn8CQAJAAn9BgAggAUE/cSICRQ0AGkHAACACayIDIABLDQFBACEBA0AgASACakGYiAFqIAFBgAhqLQAAOgAAIAFBAWoiASADRw0AC0GYiAFBwAAQABogACADayEAIANBgAhqCyEDIABBwABPDQEgAAwCCyAARQ0CIAJBmIgBakGACC0AADoAAEEBIQEgAEEBRg0CA0AgASACakGYiAFqIAFBgAhqLQAAOgAAIAFBAWoiASAARw0ACwwCCyADIABBQHEQACEDIABBP3ELIgJFDQBBACEBA0AgAUGYiAFqIAEgA2otAAA6AAAgAUEBaiIBIAJHDQALCwvWAgEBfwJAIAFFDQAgACABaiICQX9qQQA6AAAgAEEAOgAAIAFBA0kNACACQX5qQQA6AAAgAEEAOgABIAJBfWpBADoAACAAQQA6AAIgAUEHSQ0AIAJBfGpBADoAACAAQQA6AAMgAUEJSQ0AIABBACAAa0EDcSICaiIAQQA2AgAgACABIAJrQXxxIgJqIgFBfGpBADYCACACQQlJDQAgAEEANgIIIABBADYCBCABQXhqQQA2AgAgAUF0akEANgIAIAJBGUkNACAAQQA2AhggAEEANgIUIABBADYCECAAQQA2AgwgAUFwakEANgIAIAFBbGpBADYCACABQWhqQQA2AgAgAUFkakEANgIAIAIgAEEEcUEYciICayIBQSBJDQAgACACaiEAA0AgAEIANwMYIABCADcDECAAQgA3AwggAEIANwMAIABBIGohACABQWBqIgFBH0sNAAsLCwMAAQstAEGQiAFC/rnrxemOlZkQNwIAQYiIAUKBxpS6lvHq5m83AgBBgIgBQgA3AgALBQBBgAgLMwBBkIgBQv6568XpjpWZEDcCAEGIiAFCgcaUupbx6uZvNwIAQYCIAUIANwIAIAAQAhABCwsLAQBBoIkBCwNARQI=";
    var wasmJson$4 = {
    	name: name$4,
    	data: data$4
    };

    const mutex$3 = new Mutex();
    let wasmCache$3 = null;
    function md5(data) {
        if (wasmCache$3 === null) {
            return lockedCreate(mutex$3, wasmJson$4, 16)
                .then((wasm) => {
                wasmCache$3 = wasm;
                return wasmCache$3.calculate(data);
            });
        }
        try {
            const hash = wasmCache$3.calculate(data);
            return Promise.resolve(hash);
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    function createMD5() {
        return WASMInterface(wasmJson$4, 16).then((wasm) => {
            wasm.init();
            const obj = {
                init: () => { wasm.init(); return obj; },
                update: (data) => { wasm.update(data); return obj; },
                digest: (outputType) => wasm.digest(outputType),
                blockSize: 64,
                digestSize: 16,
            };
            return obj;
        });
    }

    var name$5 = "sha1.wasm";
    var data$5 = "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";
    var wasmJson$5 = {
    	name: name$5,
    	data: data$5
    };

    const mutex$4 = new Mutex();
    let wasmCache$4 = null;
    function sha1(data) {
        if (wasmCache$4 === null) {
            return lockedCreate(mutex$4, wasmJson$5, 20)
                .then((wasm) => {
                wasmCache$4 = wasm;
                return wasmCache$4.calculate(data);
            });
        }
        try {
            const hash = wasmCache$4.calculate(data);
            return Promise.resolve(hash);
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    function createSHA1() {
        return WASMInterface(wasmJson$5, 20).then((wasm) => {
            wasm.init();
            const obj = {
                init: () => { wasm.init(); return obj; },
                update: (data) => { wasm.update(data); return obj; },
                digest: (outputType) => wasm.digest(outputType),
                blockSize: 64,
                digestSize: 20,
            };
            return obj;
        });
    }

    var name$6 = "sha3.wasm";
    var data$6 = "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";
    var wasmJson$6 = {
    	name: name$6,
    	data: data$6
    };

    const mutex$5 = new Mutex();
    let wasmCache$5 = null;
    function validateBits$1(bits) {
        if (![224, 256, 384, 512].includes(bits)) {
            return new Error('Invalid variant! Valid values: 224, 256, 384, 512');
        }
        return null;
    }
    function sha3(data, bits = 512) {
        if (validateBits$1(bits)) {
            return Promise.reject(validateBits$1(bits));
        }
        const hashLength = bits / 8;
        if (wasmCache$5 === null || wasmCache$5.hashLength !== hashLength) {
            return lockedCreate(mutex$5, wasmJson$6, hashLength)
                .then((wasm) => {
                wasmCache$5 = wasm;
                return wasmCache$5.calculate(data, bits, 0x06);
            });
        }
        try {
            const hash = wasmCache$5.calculate(data, bits, 0x06);
            return Promise.resolve(hash);
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    function createSHA3(bits = 512) {
        if (validateBits$1(bits)) {
            return Promise.reject(validateBits$1(bits));
        }
        const outputSize = bits / 8;
        return WASMInterface(wasmJson$6, outputSize).then((wasm) => {
            wasm.init(bits);
            const obj = {
                init: () => { wasm.init(bits); return obj; },
                update: (data) => { wasm.update(data); return obj; },
                digest: (outputType) => wasm.digest(outputType, 0x06),
                blockSize: 200 - 2 * outputSize,
                digestSize: outputSize,
            };
            return obj;
        });
    }

    const mutex$6 = new Mutex();
    let wasmCache$6 = null;
    function validateBits$2(bits) {
        if (![224, 256, 384, 512].includes(bits)) {
            return new Error('Invalid variant! Valid values: 224, 256, 384, 512');
        }
        return null;
    }
    function keccak(data, bits = 512) {
        if (validateBits$2(bits)) {
            return Promise.reject(validateBits$2(bits));
        }
        const hashLength = bits / 8;
        if (wasmCache$6 === null || wasmCache$6.hashLength !== hashLength) {
            return lockedCreate(mutex$6, wasmJson$6, hashLength)
                .then((wasm) => {
                wasmCache$6 = wasm;
                return wasmCache$6.calculate(data, bits, 0x01);
            });
        }
        try {
            const hash = wasmCache$6.calculate(data, bits, 0x01);
            return Promise.resolve(hash);
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    function createKeccak(bits = 512) {
        if (validateBits$2(bits)) {
            return Promise.reject(validateBits$2(bits));
        }
        const outputSize = bits / 8;
        return WASMInterface(wasmJson$6, outputSize).then((wasm) => {
            wasm.init(bits);
            const obj = {
                init: () => { wasm.init(bits); return obj; },
                update: (data) => { wasm.update(data); return obj; },
                digest: (outputType) => wasm.digest(outputType, 0x01),
                blockSize: 200 - 2 * outputSize,
                digestSize: outputSize,
            };
            return obj;
        });
    }

    var name$7 = "sha256.wasm";
    var data$7 = "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";
    var wasmJson$7 = {
    	name: name$7,
    	data: data$7
    };

    const mutex$7 = new Mutex();
    let wasmCache$7 = null;
    function sha224(data) {
        if (wasmCache$7 === null) {
            return lockedCreate(mutex$7, wasmJson$7, 28)
                .then((wasm) => {
                wasmCache$7 = wasm;
                return wasmCache$7.calculate(data, 224);
            });
        }
        try {
            const hash = wasmCache$7.calculate(data, 224);
            return Promise.resolve(hash);
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    function createSHA224() {
        return WASMInterface(wasmJson$7, 28).then((wasm) => {
            wasm.init(224);
            const obj = {
                init: () => { wasm.init(224); return obj; },
                update: (data) => { wasm.update(data); return obj; },
                digest: (outputType) => wasm.digest(outputType),
                blockSize: 64,
                digestSize: 28,
            };
            return obj;
        });
    }

    const mutex$8 = new Mutex();
    let wasmCache$8 = null;
    function sha256(data) {
        if (wasmCache$8 === null) {
            return lockedCreate(mutex$8, wasmJson$7, 32)
                .then((wasm) => {
                wasmCache$8 = wasm;
                return wasmCache$8.calculate(data, 256);
            });
        }
        try {
            const hash = wasmCache$8.calculate(data, 256);
            return Promise.resolve(hash);
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    function createSHA256() {
        return WASMInterface(wasmJson$7, 32).then((wasm) => {
            wasm.init(256);
            const obj = {
                init: () => { wasm.init(256); return obj; },
                update: (data) => { wasm.update(data); return obj; },
                digest: (outputType) => wasm.digest(outputType),
                blockSize: 64,
                digestSize: 32,
            };
            return obj;
        });
    }

    var name$8 = "sha512.wasm";
    var data$8 = "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";
    var wasmJson$8 = {
    	name: name$8,
    	data: data$8
    };

    const mutex$9 = new Mutex();
    let wasmCache$9 = null;
    function sha384(data) {
        if (wasmCache$9 === null) {
            return lockedCreate(mutex$9, wasmJson$8, 48)
                .then((wasm) => {
                wasmCache$9 = wasm;
                return wasmCache$9.calculate(data, 384);
            });
        }
        try {
            const hash = wasmCache$9.calculate(data, 384);
            return Promise.resolve(hash);
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    function createSHA384() {
        return WASMInterface(wasmJson$8, 48).then((wasm) => {
            wasm.init(384);
            const obj = {
                init: () => { wasm.init(384); return obj; },
                update: (data) => { wasm.update(data); return obj; },
                digest: (outputType) => wasm.digest(outputType),
                blockSize: 128,
                digestSize: 48,
            };
            return obj;
        });
    }

    const mutex$a = new Mutex();
    let wasmCache$a = null;
    function sha512(data) {
        if (wasmCache$a === null) {
            return lockedCreate(mutex$a, wasmJson$8, 64)
                .then((wasm) => {
                wasmCache$a = wasm;
                return wasmCache$a.calculate(data, 512);
            });
        }
        try {
            const hash = wasmCache$a.calculate(data, 512);
            return Promise.resolve(hash);
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    function createSHA512() {
        return WASMInterface(wasmJson$8, 64).then((wasm) => {
            wasm.init(512);
            const obj = {
                init: () => { wasm.init(512); return obj; },
                update: (data) => { wasm.update(data); return obj; },
                digest: (outputType) => wasm.digest(outputType),
                blockSize: 128,
                digestSize: 64,
            };
            return obj;
        });
    }

    var name$9 = "xxhash32.wasm";
    var data$9 = "AGFzbQEAAAABFgVgAABgAX8AYAJ/fwBgAAF/YAF/AX8DBwYABAABAwIFBAEBBAQHXAcGbWVtb3J5AgAOSGFzaF9HZXRCdWZmZXIABAlIYXNoX0luaXQAAwtIYXNoX1VwZGF0ZQABCkhhc2hfRmluYWwAAA5IYXNoX0NhbGN1bGF0ZQAFBl9zdGFydAACCvQIBroCAgV/AX5BgAgpAwAiBachAAJ/IAVCEFoEQEHAiAEoAgBBB3dBsIgBKAIAQQF3akHIiAEoAgBBDHdqQdCIASgCAEESd2oMAQtByIgBKAIAQbHP2bIBagsgAGohAUGQiAEhBEGICCgCACIAQZCIAWohAwJAIABBA0wEQEGQiAEhAAwBC0GUiAEhAgNAIAQoAgBBvdzKlXxsIAFqQRF3Qa/W074CbCEBIAIiACEEIABBBGoiAiADTQ0ACwsgACADRwRAA0AgAC0AAEGxz9myAWwgAWpBC3dBsfPd8XlsIQEgAEEBaiIAIANHDQALC0GRCCABQQ92IAFzQfeUr694bCIAQQ12IABzQb3cypV8bCIAQRB2IgI6AABBkAggAEEYdjoAAEGTCCAAIAJzIgA6AABBkgggAEEIdjoAAAuMBQEHfyAARQRAQQAPC0GACEGACCkDACAArXw3AwACQEGICCgCACICIABqQQ9NBEBBkAghAQNAIAEtAAAhA0GICCACQQFqIgQ2AgAgAkGQiAFqIAM6AAAgAUEBaiEBIAQhAiAAQX9qIgANAAsMAQsgAEGACGohBwJAIAJFBEBB0IgBKAIAIQNByIgBKAIAIQVBwIgBKAIAIQRBsIgBKAIAIQZBkAghAQwBC0GQCCEBIAJBD00EQEGQCCEDQZ8IIAJrIQUDQCADLQAAIQFBiAggAkEBaiIENgIAIAJBkIgBaiABOgAAIAMgBUchBiADQQFqIgEhAyAEIQIgBg0ACwtBsIgBQbCIASgCAEGQiAEoAgBB95Svr3hsakENd0Gx893xeWwiBjYCAEHAiAFBwIgBKAIAQZSIASgCAEH3lK+veGxqQQ13QbHz3fF5bCIENgIAQciIAUHIiAEoAgBBmIgBKAIAQfeUr694bGpBDXdBsfPd8XlsIgU2AgBB0IgBQdCIASgCAEGciAEoAgBB95Svr3hsakENd0Gx893xeWwiAzYCAAsgASAHTQRAA0AgASgCDEH3lK+veGwgA2pBDXdBsfPd8XlsIQMgASgCCEH3lK+veGwgBWpBDXdBsfPd8XlsIQUgASgCBEH3lK+veGwgBGpBDXdBsfPd8XlsIQQgASgCAEH3lK+veGwgBmpBDXdBsfPd8XlsIQYgAUEQaiIBIAdNDQALC0EAIQJBwIgBIAQ2AgBBsIgBIAY2AgBByIgBIAU2AgBB0IgBIAM2AgBBiAggAEGQCGogAWsiADYCACAARQRAQQEPCwNAIAJBkIgBaiABIAJqLQAAOgAAIAJBAWoiAiAARw0ACwtBAQsDAAELSwBByIgBIAA2AgBBgAhCADcDAEHAiAEgAEH3lK+veGo2AgBBsIgBIABBqIiNoQJqNgIAQdCIASAAQc+Moo4GajYCAEGICEEANgIACwUAQZAIC1IAQciIASABNgIAQYAIQgA3AwBBwIgBIAFB95Svr3hqNgIAQbCIASABQaiIjaECajYCAEHQiAEgAUHPjKKOBmo2AgBBiAhBADYCACAAEAEaEAALCwoBAEHhiAELAkUC";
    var wasmJson$9 = {
    	name: name$9,
    	data: data$9
    };

    const mutex$b = new Mutex();
    let wasmCache$b = null;
    function validateSeed(seed) {
        if (!Number.isInteger(seed) || seed < 0 || seed > 0xFFFFFFFF) {
            return new Error('Seed must be a valid 32-bit long unsigned integer.');
        }
        return null;
    }
    function xxhash32(data, seed = 0) {
        if (validateSeed(seed)) {
            return Promise.reject(validateSeed(seed));
        }
        if (wasmCache$b === null) {
            return lockedCreate(mutex$b, wasmJson$9, 4)
                .then((wasm) => {
                wasmCache$b = wasm;
                return wasmCache$b.calculate(data, seed);
            });
        }
        try {
            const hash = wasmCache$b.calculate(data, seed);
            return Promise.resolve(hash);
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    function createXXHash32(seed = 0) {
        if (validateSeed(seed)) {
            return Promise.reject(validateSeed(seed));
        }
        return WASMInterface(wasmJson$9, 4).then((wasm) => {
            wasm.init(seed);
            const obj = {
                init: () => { wasm.init(seed); return obj; },
                update: (data) => { wasm.update(data); return obj; },
                digest: (outputType) => wasm.digest(outputType),
                blockSize: 16,
                digestSize: 4,
            };
            return obj;
        });
    }

    var name$a = "xxhash64.wasm";
    var data$a = "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";
    var wasmJson$a = {
    	name: name$a,
    	data: data$a
    };

    const mutex$c = new Mutex();
    let wasmCache$c = null;
    const seedBuffer = new ArrayBuffer(8);
    function validateSeed$1(seed) {
        if (!Number.isInteger(seed) || seed < 0 || seed > 0xFFFFFFFF) {
            return new Error('Seed must be given as two valid 32-bit long unsigned integer (lo + high).');
        }
        return null;
    }
    function writeSeed(low, high) {
        // write in little-endian format
        const buffer = new DataView(seedBuffer);
        buffer.setUint32(0, low, true);
        buffer.setUint32(4, high, true);
    }
    function xxhash64(data, seedLow = 0, seedHigh = 0) {
        if (validateSeed$1(seedLow)) {
            return Promise.reject(validateSeed$1(seedLow));
        }
        if (validateSeed$1(seedHigh)) {
            return Promise.reject(validateSeed$1(seedHigh));
        }
        if (wasmCache$c === null) {
            return lockedCreate(mutex$c, wasmJson$a, 8)
                .then((wasm) => {
                wasmCache$c = wasm;
                writeSeed(seedLow, seedHigh);
                wasmCache$c.writeMemory(new Uint8Array(seedBuffer));
                return wasmCache$c.calculate(data);
            });
        }
        try {
            writeSeed(seedLow, seedHigh);
            wasmCache$c.writeMemory(new Uint8Array(seedBuffer));
            const hash = wasmCache$c.calculate(data);
            return Promise.resolve(hash);
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    function createXXHash64(seedLow = 0, seedHigh = 0) {
        if (validateSeed$1(seedLow)) {
            return Promise.reject(validateSeed$1(seedLow));
        }
        if (validateSeed$1(seedHigh)) {
            return Promise.reject(validateSeed$1(seedHigh));
        }
        return WASMInterface(wasmJson$a, 8).then((wasm) => {
            writeSeed(seedLow, seedHigh);
            wasm.writeMemory(new Uint8Array(seedBuffer));
            wasm.init();
            const obj = {
                init: () => {
                    wasm.writeMemory(new Uint8Array(seedBuffer));
                    wasm.init();
                    return obj;
                },
                update: (data) => { wasm.update(data); return obj; },
                digest: (outputType) => wasm.digest(outputType),
                blockSize: 32,
                digestSize: 8,
            };
            return obj;
        });
    }

    var name$b = "ripemd160.wasm";
    var data$b = "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";
    var wasmJson$b = {
    	name: name$b,
    	data: data$b
    };

    const mutex$d = new Mutex();
    let wasmCache$d = null;
    function ripemd160(data) {
        if (wasmCache$d === null) {
            return lockedCreate(mutex$d, wasmJson$b, 20)
                .then((wasm) => {
                wasmCache$d = wasm;
                return wasmCache$d.calculate(data);
            });
        }
        try {
            const hash = wasmCache$d.calculate(data);
            return Promise.resolve(hash);
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    function createRIPEMD160() {
        return WASMInterface(wasmJson$b, 20).then((wasm) => {
            wasm.init();
            const obj = {
                init: () => { wasm.init(); return obj; },
                update: (data) => { wasm.update(data); return obj; },
                digest: (outputType) => wasm.digest(outputType),
                blockSize: 64,
                digestSize: 20,
            };
            return obj;
        });
    }

    function calculateKeyBuffer(hasher, key) {
        const { blockSize } = hasher;
        const buf = getUInt8Buffer(key);
        if (buf.length > blockSize) {
            hasher.update(buf);
            const uintArr = hasher.digest('binary');
            hasher.init();
            return uintArr;
        }
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.length);
    }
    function calculateHmac(hasher, key) {
        hasher.init();
        const { blockSize } = hasher;
        const keyBuf = calculateKeyBuffer(hasher, key);
        const keyBuffer = new Uint8Array(blockSize);
        keyBuffer.set(keyBuf);
        const opad = new Uint8Array(blockSize);
        for (let i = 0; i < blockSize; i++) {
            const v = keyBuffer[i];
            opad[i] = v ^ 0x5C;
            keyBuffer[i] = v ^ 0x36;
        }
        hasher.update(keyBuffer);
        const obj = {
            init: () => {
                hasher.init();
                hasher.update(keyBuffer);
                return obj;
            },
            update: (data) => {
                hasher.update(data);
                return obj;
            },
            digest: ((outputType) => {
                const uintArr = hasher.digest('binary');
                hasher.init();
                hasher.update(opad);
                hasher.update(uintArr);
                return hasher.digest(outputType);
            }),
            blockSize: hasher.blockSize,
            digestSize: hasher.digestSize,
        };
        return obj;
    }
    function createHMAC(hash, key) {
        if (!hash || !hash.then) {
            throw new Error('Invalid hash function is provided! Usage: createHMAC(createMD5(), "key").');
        }
        return hash.then((hasher) => calculateHmac(hasher, key));
    }

    function calculatePBKDF2(digest, salt, iterations, hashLength, outputType) {
        return __awaiter(this, void 0, void 0, function* () {
            const DK = new Uint8Array(hashLength);
            const block1 = new Uint8Array(salt.length + 4);
            const block1View = new DataView(block1.buffer);
            const saltBuffer = getUInt8Buffer(salt);
            const saltUIntBuffer = new Uint8Array(saltBuffer.buffer, saltBuffer.byteOffset, saltBuffer.length);
            block1.set(saltUIntBuffer);
            let destPos = 0;
            const hLen = digest.digestSize;
            const l = Math.ceil(hashLength / hLen);
            let T = null;
            let U = null;
            for (let i = 1; i <= l; i++) {
                block1View.setUint32(salt.length, i);
                digest.init();
                digest.update(block1);
                T = digest.digest('binary');
                U = T.slice();
                for (let j = 1; j < iterations; j++) {
                    digest.init();
                    digest.update(U);
                    U = digest.digest('binary');
                    for (let k = 0; k < hLen; k++) {
                        T[k] ^= U[k];
                    }
                }
                DK.set(T.subarray(0, hashLength - destPos), destPos);
                destPos += hLen;
            }
            if (outputType === 'binary') {
                return DK;
            }
            const digestChars = new Uint8Array(hashLength * 2);
            return getDigestHex(digestChars, DK, hashLength);
        });
    }
    const validateOptions$1 = (options) => {
        if (!options || typeof options !== 'object') {
            throw new Error('Invalid options parameter. It requires an object.');
        }
        if (!options.hashFunction || !options.hashFunction.then) {
            throw new Error('Invalid hash function is provided! Usage: pbkdf2("password", "salt", 1000, 32, createSHA1()).');
        }
        if (!Number.isInteger(options.iterations) || options.iterations < 1) {
            throw new Error('Iterations should be a positive number');
        }
        if (!Number.isInteger(options.hashLength) || options.hashLength < 1) {
            throw new Error('Hash length should be a positive number');
        }
        if (options.outputType === undefined) {
            options.outputType = 'hex';
        }
        if (!['hex', 'binary'].includes(options.outputType)) {
            throw new Error(`Insupported output type ${options.outputType}. Valid values: ['hex', 'binary']`);
        }
    };
    function pbkdf2(options) {
        return __awaiter(this, void 0, void 0, function* () {
            validateOptions$1(options);
            const hmac = yield createHMAC(options.hashFunction, options.password);
            return calculatePBKDF2(hmac, options.salt, options.iterations, options.hashLength, options.outputType);
        });
    }

    var name$c = "scrypt.wasm";
    var data$c = "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";
    var wasmJson$c = {
    	name: name$c,
    	data: data$c
    };

    function scryptInternal(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { costFactor, blockSize, parallelism, hashLength, } = options;
            const SHA256Hasher = createSHA256();
            const blockData = yield pbkdf2({
                password: options.password,
                salt: options.salt,
                iterations: 1,
                hashLength: 128 * blockSize * parallelism,
                hashFunction: SHA256Hasher,
                outputType: 'binary',
            });
            const scryptInterface = yield WASMInterface(wasmJson$c, 0);
            // last block is for storing the temporary vectors
            const VSize = 128 * blockSize * costFactor;
            const XYSize = 256 * blockSize;
            scryptInterface.setMemorySize(blockData.length + VSize + XYSize);
            scryptInterface.writeMemory(blockData, 0);
            // mix blocks
            scryptInterface.getExports().scrypt(blockSize, costFactor, parallelism);
            const expensiveSalt = scryptInterface
                .getMemory()
                .subarray(0, 128 * blockSize * parallelism);
            const outputData = yield pbkdf2({
                password: options.password,
                salt: expensiveSalt,
                iterations: 1,
                hashLength,
                hashFunction: SHA256Hasher,
                outputType: 'binary',
            });
            if (options.outputType === 'hex') {
                const digestChars = new Uint8Array(hashLength * 2);
                return getDigestHex(digestChars, outputData, hashLength);
            }
            // return binary format
            return outputData;
        });
    }
    // eslint-disable-next-line no-bitwise
    const isPowerOfTwo = (v) => v && !(v & (v - 1));
    const validateOptions$2 = (options) => {
        if (!options || typeof options !== 'object') {
            throw new Error('Invalid options parameter. It requires an object.');
        }
        if (!Number.isInteger(options.blockSize) || options.blockSize < 1) {
            throw new Error('Block size should be a positive number');
        }
        if (!Number.isInteger(options.costFactor)
            || options.costFactor < 2
            || !isPowerOfTwo(options.costFactor)) {
            throw new Error('Cost factor should be a power of 2, greater than 1');
        }
        if (!Number.isInteger(options.parallelism) || options.parallelism < 1) {
            throw new Error('Parallelism should be a positive number');
        }
        if (!Number.isInteger(options.hashLength) || options.hashLength < 1) {
            throw new Error('Hash length should be a positive number.');
        }
        if (options.outputType === undefined) {
            options.outputType = 'hex';
        }
        if (!['hex', 'binary'].includes(options.outputType)) {
            throw new Error(`Insupported output type ${options.outputType}. Valid values: ['hex', 'binary']`);
        }
    };
    function scrypt(options) {
        return __awaiter(this, void 0, void 0, function* () {
            validateOptions$2(options);
            return scryptInternal(options);
        });
    }

    var name$d = "bcrypt.wasm";
    var data$d = "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";
    var wasmJson$d = {
    	name: name$d,
    	data: data$d
    };

    function bcryptInternal(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { costFactor, password, salt } = options;
            const bcryptInterface = yield WASMInterface(wasmJson$d, 0);
            bcryptInterface.writeMemory(getUInt8Buffer(salt), 0);
            const passwordBuffer = getUInt8Buffer(password);
            bcryptInterface.writeMemory(passwordBuffer, 16);
            const shouldEncode = options.outputType === 'encoded' ? 1 : 0;
            bcryptInterface.getExports().bcrypt(passwordBuffer.length, costFactor, shouldEncode);
            const memory = bcryptInterface.getMemory();
            if (options.outputType === 'encoded') {
                return intArrayToString(memory, 60);
            }
            if (options.outputType === 'hex') {
                const digestChars = new Uint8Array(24 * 2);
                return getDigestHex(digestChars, memory, 24);
            }
            // return binary format
            // the data is copied to allow GC of the original memory buffer
            return memory.slice(0, 24);
        });
    }
    const validateOptions$3 = (options) => {
        if (!options || typeof options !== 'object') {
            throw new Error('Invalid options parameter. It requires an object.');
        }
        if (!Number.isInteger(options.costFactor) || options.costFactor < 4 || options.costFactor > 31) {
            throw new Error('Cost factor should be a number between 4 and 31');
        }
        options.password = getUInt8Buffer(options.password);
        if (options.password.length < 1) {
            throw new Error('Password should be at least 1 byte long');
        }
        if (options.password.length > 72) {
            throw new Error('Password should be at most 72 bytes long');
        }
        options.salt = getUInt8Buffer(options.salt);
        if (options.salt.length !== 16) {
            throw new Error('Salt should be 16 bytes long');
        }
        if (options.outputType === undefined) {
            options.outputType = 'encoded';
        }
        if (!['hex', 'binary', 'encoded'].includes(options.outputType)) {
            throw new Error(`Insupported output type ${options.outputType}. Valid values: ['hex', 'binary', 'encoded']`);
        }
    };
    function bcrypt(options) {
        return __awaiter(this, void 0, void 0, function* () {
            validateOptions$3(options);
            return bcryptInternal(options);
        });
    }
    const validateHashCharacters = (hash) => {
        if (!/^\$2[axyb]\$[0-3][0-9]\$[./A-Za-z0-9]{53}$/.test(hash)) {
            return false;
        }
        if (hash[4] === '0' && parseInt(hash[5], 10) < 4) {
            return false;
        }
        if (hash[4] === '3' && parseInt(hash[5], 10) > 1) {
            return false;
        }
        return true;
    };
    const validateVerifyOptions$1 = (options) => {
        if (!options || typeof options !== 'object') {
            throw new Error('Invalid options parameter. It requires an object.');
        }
        if (options.hash === undefined || typeof options.hash !== 'string') {
            throw new Error('Hash should be specified');
        }
        if (options.hash.length !== 60) {
            throw new Error('Hash should be 60 bytes long');
        }
        if (!validateHashCharacters(options.hash)) {
            throw new Error('Invalid hash');
        }
        options.password = getUInt8Buffer(options.password);
        if (options.password.length < 1) {
            throw new Error('Password should be at least 1 byte long');
        }
        if (options.password.length > 72) {
            throw new Error('Password should be at most 72 bytes long');
        }
    };
    function bcryptVerify(options) {
        return __awaiter(this, void 0, void 0, function* () {
            validateVerifyOptions$1(options);
            const { hash, password } = options;
            const bcryptInterface = yield WASMInterface(wasmJson$d, 0);
            bcryptInterface.writeMemory(getUInt8Buffer(hash), 0);
            const passwordBuffer = getUInt8Buffer(password);
            bcryptInterface.writeMemory(passwordBuffer, 60);
            return !!bcryptInterface.getExports().bcrypt_verify(passwordBuffer.length);
        });
    }

    exports.argon2Verify = argon2Verify;
    exports.argon2d = argon2d;
    exports.argon2i = argon2i;
    exports.argon2id = argon2id;
    exports.bcrypt = bcrypt;
    exports.bcryptVerify = bcryptVerify;
    exports.blake2b = blake2b;
    exports.crc32 = crc32;
    exports.createBLAKE2b = createBLAKE2b;
    exports.createCRC32 = createCRC32;
    exports.createHMAC = createHMAC;
    exports.createKeccak = createKeccak;
    exports.createMD4 = createMD4;
    exports.createMD5 = createMD5;
    exports.createRIPEMD160 = createRIPEMD160;
    exports.createSHA1 = createSHA1;
    exports.createSHA224 = createSHA224;
    exports.createSHA256 = createSHA256;
    exports.createSHA3 = createSHA3;
    exports.createSHA384 = createSHA384;
    exports.createSHA512 = createSHA512;
    exports.createXXHash32 = createXXHash32;
    exports.createXXHash64 = createXXHash64;
    exports.keccak = keccak;
    exports.md4 = md4;
    exports.md5 = md5;
    exports.pbkdf2 = pbkdf2;
    exports.ripemd160 = ripemd160;
    exports.scrypt = scrypt;
    exports.sha1 = sha1;
    exports.sha224 = sha224;
    exports.sha256 = sha256;
    exports.sha3 = sha3;
    exports.sha384 = sha384;
    exports.sha512 = sha512;
    exports.xxhash32 = xxhash32;
    exports.xxhash64 = xxhash64;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
