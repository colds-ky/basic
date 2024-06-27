(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __knownSymbol = (name, symbol) => (symbol = Symbol[name]) ? symbol : Symbol.for("Symbol." + name);
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };
  var __await = function(promise, isYieldStar) {
    this[0] = promise;
    this[1] = isYieldStar;
  };
  var __asyncGenerator = (__this, __arguments, generator) => {
    var resume = (k, v, yes, no) => {
      try {
        var x = generator[k](v), isAwait = (v = x.value) instanceof __await, done = x.done;
        Promise.resolve(isAwait ? v[0] : v).then((y) => isAwait ? resume(k === "return" ? k : "next", v[1] ? { done: y.done, value: y.value } : y, yes, no) : yes({ value: y, done })).catch((e) => resume("throw", e, yes, no));
      } catch (e) {
        no(e);
      }
    }, method = (k) => it[k] = (x) => new Promise((yes, no) => resume(k, x, yes, no)), it = {};
    return generator = generator.apply(__this, __arguments), it[__knownSymbol("asyncIterator")] = () => it, method("next"), method("throw"), method("return"), it;
  };
  var __forAwait = (obj, it, method) => (it = obj[__knownSymbol("asyncIterator")]) ? it.call(obj) : (obj = obj[__knownSymbol("iterator")](), it = {}, method = (key, fn) => (fn = obj[key]) && (it[key] = (arg) => new Promise((yes, no, done) => (arg = fn.call(obj, arg), done = arg.done, Promise.resolve(arg.value).then((value) => yes({ value, done }), no)))), method("next"), method("return"), it);

  // lib/shorten.js
  function shortenDID(did) {
    return did && /** @type {T} */
    (did.replace(_shortenDID_Regex, "").toLowerCase() || void 0);
  }
  function shortenHandle(handle) {
    handle = cheapNormalizeHandle(handle);
    return handle && /** @type {T} */
    (handle.replace(_shortenHandle_Regex, "").toLowerCase() || void 0);
  }
  function cheapNormalizeHandle(handle) {
    handle = handle && handle.trim().toLowerCase();
    if (handle && handle.charCodeAt(0) === 64)
      handle = handle.slice(1);
    const urlprefix = "https://bsky.app/";
    if (handle && handle.lastIndexOf(urlprefix, 0) === 0) {
      const postURL = breakPostURL(handle);
      if (postURL && postURL.shortDID)
        return postURL.shortDID;
    }
    if (handle && handle.lastIndexOf("at:", 0) === 0) {
      const feedUri = breakFeedUri(handle);
      if (feedUri && feedUri.shortDID)
        return feedUri.shortDID;
      if (handle && handle.lastIndexOf("at://", 0) === 0) handle = handle.slice(5);
      else handle = handle.slice(3);
    }
    return handle || void 0;
  }
  function shortenPDC(pdc) {
    if (!pdc) return void 0;
    pdc = pdc.trim().toLowerCase();
    if (pdc === "https://bsky.social") return ".s";
    else if (pdc === "https://bsky.network") return ".n";
    else if (pdc === "https://bsky.app") return ".a";
    return pdc.replace(/^https:\/\//, "").replace(/host\.bsky\.network$/, "");
  }
  function parseTimestampOffset(dtOffsetStr) {
    if (!dtOffsetStr) return void 0;
    let offset = 0;
    let lead = 0;
    const plusPos = dtOffsetStr.indexOf("+");
    if (plusPos >= 0) {
      offset = Number(dtOffsetStr.substring(0, plusPos)) * 24 * 60 * 60 * 1e3;
      lead = plusPos + 1;
    }
    const secondsColonPos = dtOffsetStr.lastIndexOf(":");
    if (secondsColonPos < 0) {
      offset += Number(dtOffsetStr.substring(lead)) * 1e3;
    } else {
      offset += Number(dtOffsetStr.substring(secondsColonPos + 1)) * 1e3;
      const minutesColonPos = dtOffsetStr.lastIndexOf(":", secondsColonPos - 1);
      if (minutesColonPos < 0) {
        offset += Number(dtOffsetStr.substring(lead, secondsColonPos)) * 60 * 1e3;
      } else {
        offset += Number(dtOffsetStr.substring(minutesColonPos + 1, secondsColonPos)) * 60 * 1e3;
        offset += Number(dtOffsetStr.substring(lead, minutesColonPos)) * 60 * 60 * 1e3;
      }
    }
    return offset;
  }
  function timestampOffsetToString(offset) {
    if (offset > offsetTooLarge) {
      console.error("timestampOffsetToString: offset too large", offset, new Date(offset));
    }
    const milliseconds = offset % 1e3;
    offset = (offset - milliseconds) / 1e3;
    const seconds = offset % 60;
    offset = (offset - seconds) / 60;
    const minutes = offset % 60;
    offset = (offset - minutes) / 60;
    const hours = offset % 24;
    const days = (offset - hours) / 24;
    let str = (100 + seconds).toString().slice(1);
    if (milliseconds) {
      str = str + "." + (1e3 + milliseconds).toString().slice(1).replace(/0+$/, "");
    }
    if (days + hours + minutes) {
      str = (100 + minutes).toString().slice(1) + ":" + str;
      if (days + hours) {
        str = hours.toString() + ":" + str;
        if (days) {
          str = days + "+" + str;
        }
      }
    }
    if (str.lastIndexOf("0", 0) === 0) str = str.slice(1);
    return str;
  }
  function breakPostURL(url) {
    var _a, _b;
    if (!url) return;
    const matchBsky = _breakBskyPostURL_Regex.exec(url);
    if (matchBsky) return { shortDID: shortenDID(matchBsky[1]), postID: (_a = matchBsky[2]) == null ? void 0 : _a.toString().toLowerCase() };
    const matchGisting = _breakGistingPostURL_Regex.exec(url);
    if (matchGisting) return { shortDID: shortenDID(matchGisting[2]), postID: (_b = matchGisting[3]) == null ? void 0 : _b.toString().toLowerCase() };
  }
  function breakFeedUri(uri) {
    if (!uri) return;
    const match = _breakFeedUri_Regex.exec(uri);
    if (!match || !match[3]) return;
    return { shortDID: match[2], postID: match[3] };
  }
  var _shortenDID_Regex, _shortenHandle_Regex, offsetTooLarge, _breakBskyPostURL_Regex, _breakGistingPostURL_Regex, _breakFeedUri_Regex;
  var init_shorten = __esm({
    "lib/shorten.js"() {
      _shortenDID_Regex = /^did\:plc\:/;
      _shortenHandle_Regex = /\.bsky\.social$/;
      offsetTooLarge = Date.UTC(2022, 1, 1);
      _breakBskyPostURL_Regex = /^http[s]?\:\/\/bsky\.app\/profile\/([a-z0-9\.\:\-]+)\/post\/([a-z0-9]+)(\/|$)/i;
      _breakGistingPostURL_Regex = /^http[s]?\:\/\/(gist\.ing|gisti\.ng|gist\.ink)\/([a-z0-9\.\:\-]+)\/([a-z0-9]+)(\/|$)/i;
      _breakFeedUri_Regex = /^at\:\/\/(did:plc:)?([a-z0-9]+)\/[a-z\.]+\/?(.*)?$/;
    }
  });

  // src/api/indexing/persistence.js
  function parseRegistrationStore(file, jsonText) {
    const bucketMap = JSON.parse(jsonText);
    const store = createEmptyStore(file);
    let carryTimestamp = 0;
    for (const shortDID in bucketMap) {
      if (shortDID === "next") {
        store.next = bucketMap.next;
        continue;
      }
      const registrationHistory = bucketMap[shortDID];
      for (const entry of registrationHistory) {
        if (!carryTimestamp) carryTimestamp = new Date(entry.t).getTime();
        else carryTimestamp += parseTimestampOffset(entry.t) || 0;
        break;
      }
      const registrationEntry = {
        created: carryTimestamp,
        updates: registrationHistory
      };
      updateRanges(carryTimestamp, store);
      updateLatestCreation(carryTimestamp, store);
      let carryHistoryOffset = 0;
      let firstHistoryEntry = true;
      for (const dateOrTimestamp in registrationHistory) {
        if (firstHistoryEntry) {
          firstHistoryEntry = false;
          continue;
        }
        carryHistoryOffset += parseTimestampOffset(dateOrTimestamp) || 0;
        updateRanges(carryTimestamp + carryHistoryOffset, store);
      }
      store.set(shortDID, registrationEntry);
    }
    return store;
  }
  function deriveStoreFilenameFromTimestamp(prevTimestamp, timestamp) {
    const dt2 = new Date(timestamp);
    const dtPrev = prevTimestamp ? new Date(prevTimestamp) : void 0;
    let filename = dt2.getUTCFullYear() + "-" + (101 + dt2.getUTCMonth()).toString().slice(1) + "/" + dt2.getUTCDate();
    if (dt2.getUTCFullYear() === (dtPrev == null ? void 0 : dtPrev.getUTCFullYear()) && dt2.getUTCMonth() === (dtPrev == null ? void 0 : dtPrev.getUTCMonth()) && dt2.getUTCDate() === (dtPrev == null ? void 0 : dtPrev.getUTCDate())) {
      filename += "-" + dt2.getUTCHours().toString().slice(1) + (101 + dt2.getUTCMinutes()).toString().slice(1);
      if (dt2.getUTCHours() === dtPrev.getUTCHours() && dt2.getUTCMinutes() === dtPrev.getUTCMinutes()) {
        filename += "-" + (101 + dt2.getUTCSeconds()).toString().slice(1);
        if (dt2.getUTCSeconds() === dtPrev.getUTCSeconds()) {
          filename += "_" + (1001 + dt2.getUTCMilliseconds()).toString().slice(1);
          if (dt2.getUTCMilliseconds() === dtPrev.getUTCMilliseconds()) {
            filename += "-" + Math.random().toString(36).slice(2, 4);
          }
        }
      }
    }
    return filename;
  }
  function createEmptyStore(file) {
    const store = (
      /** @type {RegistrationStore} */
      new MapExtended()
    );
    store.file = file;
    return store;
  }
  function updateRanges(timestamp, store) {
    if (!timestamp) return;
    if (!store.earliestRegistration || timestamp < store.earliestRegistration) store.earliestRegistration = timestamp;
    if (!store.latestAction || timestamp > store.latestAction) store.latestAction = timestamp;
  }
  function updateLatestCreation(createdTimestamp, store) {
    if (!createdTimestamp) return;
    if (!store.latestRegistration || createdTimestamp > store.latestRegistration) store.latestRegistration = createdTimestamp;
  }
  function stringifyRegistrationStore(store) {
    let jsonText = "{\n";
    let first = true;
    for (const shortDID of store.keys()) {
      const registrationEntry = (
        /** @type {RegistrationHistory} */
        store.get(shortDID)
      );
      jsonText += first ? '"' + shortDID + '":' + JSON.stringify(registrationEntry.updates) : ',\n"' + shortDID + '":' + JSON.stringify(registrationEntry.updates);
      first = false;
    }
    if (store.has("next")) throw new Error("How come store has NEXT?");
    if (store.next) jsonText += ',\n"next":' + JSON.stringify(store.next);
    jsonText += "\n}\n";
    return jsonText;
  }
  var MapExtended;
  var init_persistence = __esm({
    "src/api/indexing/persistence.js"() {
      init_shorten();
      MapExtended = class extends Map {
        constructor() {
          super(...arguments);
          __publicField(this, "file", "");
          __publicField(this, "next");
          __publicField(this, "earliestRegistration", 0);
          __publicField(this, "latestRegistration", 0);
          __publicField(this, "latestAction", 0);
        }
      };
    }
  });

  // src/api/akpa.js
  function streamBuffer(callback) {
    let finallyTrigger = () => {
      args.isEnded = true;
    };
    let stop = false;
    let buffer;
    let continueTrigger = () => {
    };
    let continuePromise = new Promise((resolve) => continueTrigger = function continueTriggerInitiallySet() {
      resolve();
    });
    let yieldPassedTrigger = () => {
    };
    let yieldPassedPromise = new Promise((resolve) => yieldPassedTrigger = resolve);
    let rejectError;
    const args = {
      yield: yieldFn,
      reject,
      complete,
      isEnded: false,
      finally: new Promise((resolve) => {
        finallyTrigger = () => {
          args.isEnded = true;
          resolve();
        };
      })
    };
    callback(args);
    return iterate();
    function iterate() {
      return __asyncGenerator(this, null, function* () {
        try {
          while (!stop) {
            yield new __await(continuePromise);
            if (rejectError)
              throw rejectError.error;
            if (stop) return;
            continuePromise = new Promise((resolve) => continueTrigger = function continueTriggerSubsequentlySet() {
              resolve();
            });
            const yieldBuffer = buffer;
            buffer = void 0;
            if (yieldBuffer) {
              yield yieldBuffer;
              const yieldCompleted = yieldPassedTrigger;
              yieldPassedPromise = new Promise((resolve) => yieldPassedTrigger = resolve);
              yieldCompleted();
            }
          }
        } finally {
          finallyTrigger();
        }
      });
    }
    function yieldFn(item, combine) {
      if (stop) {
        console.error("Cannot yield after complete.");
        return (
          /** @type Promise<void> */
          new Promise((resolve) => resolve())
        );
      }
      if (rejectError) {
        console.error("Cannot yield after reject.");
        return (
          /** @type Promise<void> */
          new Promise((resolve) => resolve())
        );
      }
      if (typeof combine === "function") {
        buffer = combine(buffer, item);
      } else {
        if (!buffer) buffer = /** @type {TBuffer} */
        [];
        buffer.push(item);
      }
      continueTrigger();
      return yieldPassedPromise;
    }
    function reject(error) {
      if (stop) {
        console.error("Cannot reject after complete.");
        return;
      }
      if (rejectError) {
        console.error("Cannot reject after reject.");
        return;
      }
      rejectError = { error };
      args.isEnded = true;
    }
    function complete() {
      stop = true;
      args.isEnded = true;
      continueTrigger();
    }
  }
  var init_akpa = __esm({
    "src/api/akpa.js"() {
    }
  });

  // src/api/retry-fetch.js
  function retryFetch(req, init, ...rest) {
    return __async(this, null, function* () {
      let corsproxyMightBeNeeded = !(init == null ? void 0 : init.method) || ((init == null ? void 0 : init.method) || "").toUpperCase() === "get";
      if (req.nocorsproxy || (init == null ? void 0 : init.nocorsproxy)) corsproxyMightBeNeeded = false;
      const started = Date.now();
      let tryCount = 0;
      while (true) {
        try {
          const useCors = tryCount && corsproxyMightBeNeeded && Math.random() > 0.5;
          const re = useCors ? yield fetchWithCors(req, init) : yield (
            /** @type {*} */
            fetch(req, init, ...rest)
          );
          if (re.status >= 200 && re.status < 400 || re.status === 404) {
            if (!useCors) corsproxyMightBeNeeded = false;
            return re;
          }
          retry(new Error("HTTP" + re.status + " " + re.statusText));
        } catch (e) {
          yield retry(e);
        }
      }
      function retry(error) {
        tryCount++;
        let onretry = req.onretry || (init == null ? void 0 : init.onretry);
        const now = Date.now();
        let waitFor = Math.min(
          3e4,
          Math.max(300, (now - started) / 3)
        ) * (0.7 + Math.random() * 0.6);
        if (typeof onretry === "function") {
          const args = { error, started, tryCount, waitUntil: now + waitFor };
          onretry(args);
          if (args.waitUntil >= now)
            waitFor = args.waitUntil - now;
        }
        console.warn(
          tryCount + " error" + (tryCount > 1 ? "s" : "") + ", retry in ",
          waitFor,
          "ms ",
          req,
          error
        );
        return new Promise((resolve) => setTimeout(resolve, waitFor));
      }
    });
  }
  function fetchWithCors(req, init, ...rest) {
    if (typeof req === "string") {
      req = wrapCorsProxy(req);
    } else if (req instanceof Request) {
      req = new Request(wrapCorsProxy(req.url), req);
    } else if (req instanceof URL) {
      req = new URL(wrapCorsProxy(req.href));
    } else {
      req = __spreadProps(__spreadValues(
        {},
        /** @type {*} */
        req
      ), {
        url: wrapCorsProxy(
          /** @type {*} */
          req.url
        )
      });
    }
    return (
      /** @type {*} */
      fetch(req, init, ...rest)
    );
  }
  function wrapCorsProxy(url) {
    const dt2 = Date.now();
    const wrappedURL = "https://corsproxy.io/?" + url + (url.indexOf("?") < 0 ? "?" : "&") + "t" + dt2 + "=" + (dt2 + 1);
    return wrappedURL;
  }
  var init_retry_fetch = __esm({
    "src/api/retry-fetch.js"() {
    }
  });

  // lib/plc-directory.js
  function plcDirectoryRaw(since, overrides) {
    const useFetch = (overrides == null ? void 0 : overrides.fetch) || fetch;
    return streamBuffer((stream) => __async(this, null, function* () {
      const EXPORT_URL = "https://plc.directory/export";
      let sinceTime;
      if (since) {
        if (typeof since === "string") {
          since = new Date(since);
        } else if (typeof since === "number") {
          since = new Date(since);
        }
        if (Number.isFinite(since.getTime()))
          sinceTime = since.toISOString();
      }
      const lastChunkLines = /* @__PURE__ */ new Set();
      let lastWaitedForConsumptionAt = Date.now();
      let collectedEntriesSinceLastWaitedForConsumption = 0;
      while (true) {
        const nextChunkRe = yield useFetch(
          EXPORT_URL + (sinceTime ? "?after=" + sinceTime : "")
        );
        if (stream.isEnded) return;
        const nextChunkText = yield nextChunkRe.text();
        const chunkLines = nextChunkText.split("\n");
        let overlap = 0;
        const nextChunkEnitres = [];
        for (const line of chunkLines) {
          if (lastChunkLines.has(line)) {
            overlap++;
            continue;
          }
          if (!line) continue;
          nextChunkEnitres.push(JSON.parse(line));
        }
        if (nextChunkEnitres.length) {
          lastChunkLines.clear();
          for (const line of chunkLines) {
            lastChunkLines.add(line);
          }
          collectedEntriesSinceLastWaitedForConsumption += nextChunkEnitres.length;
        }
        const waitForConsumption = stream.yield(
          { entries: nextChunkEnitres, overlap },
          (buffer, item) => {
            if (!buffer) return item;
            buffer.entries = buffer.entries.concat(item.entries);
            buffer.overlap += item.overlap;
            return buffer;
          }
        );
        if (stream.isEnded) return;
        const shouldWaitForConsumption = collectedEntriesSinceLastWaitedForConsumption > FETCH_AHEAD_COUNT_MAX || Date.now() - lastWaitedForConsumptionAt > FETCH_AHEAD_MSEC_MAX || !nextChunkEnitres.length;
        if (shouldWaitForConsumption) {
          yield waitForConsumption;
          if (stream.isEnded) return;
        }
        let nextSinceTime;
        for (let i = 0; i < nextChunkEnitres.length; i++) {
          const entry = nextChunkEnitres[nextChunkEnitres.length - i - 1];
          if (entry.createdAt) {
            const timestamp = new Date(entry.createdAt);
            if (!nextSinceTime && timestamp.getTime()) {
              nextSinceTime = timestamp;
            } else if (nextSinceTime && timestamp.getTime() && timestamp.getTime() < nextSinceTime.getTime()) {
              sinceTime = timestamp.toISOString();
              break;
            }
          }
        }
      }
    }));
  }
  function plcDirectoryCompact(since, overrides) {
    return __asyncGenerator(this, null, function* () {
      var _a, _b, _c;
      const iteration = plcDirectoryRaw(since, overrides);
      try {
        for (var iter = __forAwait(iteration), more, temp, error; more = !(temp = yield new __await(iter.next())).done; more = false) {
          const chunk = temp.value;
          const compactEntries = [];
          for (const entry of chunk.entries) {
            const timestamp = Date.parse(entry.createdAt);
            const compact = {
              timestamp,
              shortDID: shortenDID(entry.did),
              shortHandle: shortenHandle(
                ((_a = entry.operation.alsoKnownAs) == null ? void 0 : _a[0]) || entry.operation.handle
              ),
              shortPDC: shortenPDC(
                ((_c = (_b = entry.operation.services) == null ? void 0 : _b.atproto_pds) == null ? void 0 : _c.endpoint) || entry.operation.service
              )
            };
            compactEntries.push(compact);
          }
          yield { entries: compactEntries };
        }
      } catch (temp) {
        error = [temp];
      } finally {
        try {
          more && (temp = iter.return) && (yield new __await(temp.call(iter)));
        } finally {
          if (error)
            throw error[0];
        }
      }
    });
  }
  var FETCH_AHEAD_MSEC_MAX, FETCH_AHEAD_COUNT_MAX;
  var init_plc_directory = __esm({
    "lib/plc-directory.js"() {
      init_akpa();
      init_retry_fetch();
      init_shorten();
      FETCH_AHEAD_MSEC_MAX = 1e4;
      FETCH_AHEAD_COUNT_MAX = 1e4;
    }
  });

  // src/api/indexing/indexing-run.js
  var indexing_run_exports = {};
  __export(indexing_run_exports, {
    indexingRun: () => indexingRun
  });
  function indexingRun(_0) {
    return __asyncGenerator(this, arguments, function* ({ read, fetch: useFetch }) {
      let stores = [];
      const storeByShortDID = /* @__PURE__ */ new Map();
      let maxDate = (/* @__PURE__ */ new Date("2022-11-01")).getTime();
      try {
        for (var iter = __forAwait(loadAllStores({ read })), more, temp, error; more = !(temp = yield new __await(iter.next())).done; more = false) {
          const progress = temp.value;
          stores = progress.stores;
          for (const store of stores) {
            for (const shortDID of store.keys()) {
              storeByShortDID.set(shortDID, store);
              if (store.latestRegistration > maxDate)
                maxDate = store.latestRegistration;
            }
          }
          yield progress;
        }
      } catch (temp) {
        error = [temp];
      } finally {
        try {
          more && (temp = iter.return) && (yield new __await(temp.call(iter)));
        } finally {
          if (error)
            throw error[0];
        }
      }
      if (!useFetch) useFetch = (req, opts) => retryFetch(req, __spreadProps(__spreadValues({}, opts), { nocorsproxy: true }));
      console.log(
        "\n\n\nSTARTING TO PULL DIRECTORY",
        new Date(maxDate).toISOString()
      );
      try {
        for (var iter2 = __forAwait(pullDirectory({ stores, storeByShortDID, startDate: maxDate, fetch: useFetch })), more2, temp2, error2; more2 = !(temp2 = yield new __await(iter2.next())).done; more2 = false) {
          const progress = temp2.value;
          stores = progress.stores;
          for (const store of stores) {
            validateStore(store);
          }
          yield progress;
        }
      } catch (temp2) {
        error2 = [temp2];
      } finally {
        try {
          more2 && (temp2 = iter2.return) && (yield new __await(temp2.call(iter2)));
        } finally {
          if (error2)
            throw error2[0];
        }
      }
    });
  }
  function validateStore(store) {
    let firstDate = 0;
    let firstDateSource = "uninitialized";
    const invalidDates = [];
    for (const { date, source } of dates()) {
      if (!firstDate) {
        firstDate = date;
        firstDateSource = source;
      }
      if (getMonthStart(date) !== getMonthStart(firstDate)) {
        invalidDates.push({ date, source });
      }
    }
    if (invalidDates.length) {
      throw new Error(
        invalidDates.length + " Invalid dates in store " + store.file + ":\n  " + invalidDates.map(({ date, source }) => "[" + new Date(date).toLocaleDateString() + "] " + source).join("\n  ") + "\nfirstDate " + firstDateSource + " " + new Date(firstDate).toLocaleDateString()
      );
    }
    function* dates() {
      yield { date: store.earliestRegistration, source: "earliestRegistration" };
      yield { date: store.latestRegistration, source: "latestRegistration" };
      let carryTimestamp = 0;
      for (const shortDID of store.keys()) {
        if (shortDID === "next") throw new Error("next should not be a shortDID key");
        const history = store.get(shortDID);
        if (!history) throw new Error("No history for shortDID " + shortDID);
        yield { date: history.created, source: "history[" + shortDID + "].created" };
        const update = history.updates[0];
        if (!carryTimestamp) carryTimestamp = new Date(update.t).getTime();
        else carryTimestamp += parseTimestampOffset(update.t) || 0;
        if (Math.abs(carryTimestamp - history.created) > 1001)
          throw new Error(
            store.file + " " + shortDID + " carryTimestamp !== history.created " + (history.created - carryTimestamp) + "ms " + new Date(carryTimestamp).toISOString() + " !== " + new Date(history.created).toISOString() + " " + shortDID + " " + store.file + " " + JSON.stringify(update)
          );
        yield { date: carryTimestamp, source: "history[" + shortDID + "].updates[0] " + JSON.stringify(update) };
      }
    }
  }
  function pullDirectory(_0) {
    return __asyncGenerator(this, arguments, function* ({ stores, storeByShortDID, startDate, fetch: fetch2 }) {
      try {
        for (var iter = __forAwait(plcDirectoryCompact(startDate, { fetch: fetch2 })), more, temp, error; more = !(temp = yield new __await(iter.next())).done; more = false) {
          const chunk = temp.value;
          const affectedShortDIDs = /* @__PURE__ */ new Set();
          const affectedStores = /* @__PURE__ */ new Set();
          let earliestRegistration;
          let latestRegistration;
          let latestAction;
          let addedShortDIDs = [];
          for (const entry of chunk.entries) {
            if (affectedShortDIDs.has(entry.shortDID) && !storeByShortDID.has(entry.shortDID)) {
              console.warn("How is it possible for affectedShortDIDs.has(entry.shortDID) but not storeByShortDID.has(entry.shortDID) ", entry.shortDID);
              console.log();
            }
            const existingStore = storeByShortDID.get(entry.shortDID);
            if (existingStore) {
              const existingHistory = (
                /** @type {RegistrationHistory} */
                existingStore.get(entry.shortDID)
              );
              if (!addHistoryToExistingShortDID(existingHistory, entry)) {
                continue;
              }
              if (!latestAction || entry.timestamp > latestAction)
                latestAction = entry.timestamp;
              affectedStores.add(existingStore);
              affectedShortDIDs.add(entry.shortDID);
            } else {
              affectedShortDIDs.add(entry.shortDID);
              const history = {
                created: entry.timestamp,
                updates: [{
                  t: new Date(entry.timestamp).toISOString(),
                  h: clampShortHandle(entry.shortHandle),
                  p: entry.shortPDC === ".s" ? void 0 : entry.shortPDC
                }]
              };
              addedShortDIDs.push(entry.shortDID);
              if (addedShortDIDs.length > affectedShortDIDs.size) {
                console.warn("How is it possible for [", addedShortDIDs.length, "]addedShortDIDs.length > [" + affectedShortDIDs.size + "]affectedShortDIDs.size");
                console.log();
              }
              if (!earliestRegistration || entry.timestamp < earliestRegistration)
                earliestRegistration = entry.timestamp;
              if (!latestRegistration || entry.timestamp > latestRegistration)
                latestRegistration = entry.timestamp;
              if (!latestAction || entry.timestamp > latestAction)
                latestAction = entry.timestamp;
              const { store, insertStoreAt } = findStoreToAddTimestamp(stores, entry.timestamp);
              if (store) {
                affectedStores.add(store);
                if (!store.latestRegistration || entry.timestamp >= store.latestRegistration) {
                  addNewShortDIDToExistingStoreEnd(store, history, entry);
                } else {
                  addNewShortDIDToExistingStoreMiddle(store, history, entry);
                }
                storeByShortDID.set(entry.shortDID, store);
                affectedStores.add(store);
              } else {
                const { newStore, prevStore } = createNewStoreAddShortDID(stores, insertStoreAt, history, entry);
                storeByShortDID.set(entry.shortDID, newStore);
                stores.push(newStore);
                affectedStores.add(newStore);
                if (prevStore) affectedStores.add(prevStore);
              }
            }
          }
          yield {
            stores,
            loadedAllStores: true,
            addedShortDIDs,
            affectedShortDIDs: Array.from(affectedShortDIDs),
            affectedStores: Array.from(affectedStores),
            earliestRegistration,
            latestRegistration,
            latestAction
          };
          earliestRegistration = latestRegistration = latestAction = void 0;
        }
      } catch (temp) {
        error = [temp];
      } finally {
        try {
          more && (temp = iter.return) && (yield new __await(temp.call(iter)));
        } finally {
          if (error)
            throw error[0];
        }
      }
    });
  }
  function addHistoryToExistingShortDID(history, entry) {
    const clampedShortHandle = entry.shortHandle ? clampShortHandle(entry.shortHandle) : void 0;
    const defaultedPDC = entry.shortPDC === ".s" ? void 0 : entry.shortPDC;
    let firstHistoryEntry = true;
    let carryTimestamp = history.created;
    let carryClampedShortHandle;
    let carryPDC;
    for (let i = 0; i < history.updates.length; i++) {
      const existingUpdate = history.updates[i];
      const dateOrTimestamp = existingUpdate.t;
      let carryTimestampNext = firstHistoryEntry ? carryTimestamp : carryTimestamp += parseTimestampOffset(dateOrTimestamp) || 0;
      if (firstHistoryEntry) firstHistoryEntry = false;
      if (carryTimestampNext > entry.timestamp) {
        console.warn(
          "Past history update? ",
          {
            entry,
            history,
            carryTimestamp: new Date(carryTimestamp),
            carryTimestampNext: new Date(carryTimestampNext)
          }
        );
        const updateRequired2 = checkUpdateRequired(clampedShortHandle, defaultedPDC, carryClampedShortHandle, carryPDC);
        if (!updateRequired2) return false;
        history.updates.splice(i, 0, {
          t: timestampOffsetToString(entry.timestamp - carryTimestamp),
          h: clampedShortHandle === carryClampedShortHandle ? void 0 : clampedShortHandle,
          p: defaultedPDC === carryPDC ? void 0 : defaultedPDC
        });
        return true;
      }
      carryTimestamp = carryTimestampNext;
      if (existingUpdate.h) carryClampedShortHandle = existingUpdate.h;
      if (existingUpdate.p) carryPDC = existingUpdate.p;
    }
    const updateRequired = checkUpdateRequired(clampedShortHandle, defaultedPDC, carryClampedShortHandle, carryPDC);
    if (!updateRequired) return false;
    history.updates.push({
      t: timestampOffsetToString(entry.timestamp - carryTimestamp),
      h: clampedShortHandle === carryClampedShortHandle ? void 0 : clampedShortHandle,
      p: defaultedPDC === carryPDC ? void 0 : defaultedPDC
    });
    return true;
  }
  function checkUpdateRequired(clampedShortHandle, defaultedPDC, carryClampedShortHandle, carryPDC) {
    const updateRequired = (clampedShortHandle || carryClampedShortHandle) && clampedShortHandle !== carryClampedShortHandle || (defaultedPDC || carryPDC) && defaultedPDC !== carryPDC;
    return updateRequired;
  }
  function addNewShortDIDToExistingStoreEnd(store, history, entry) {
    store.set(entry.shortDID, history);
    if (!store.earliestRegistration) store.earliestRegistration = entry.timestamp;
    if (store.latestRegistration) {
      history.updates[0].t = timestampOffsetToString(entry.timestamp - store.latestRegistration);
    }
    store.latestRegistration = entry.timestamp;
    if (!store.latestAction || entry.timestamp > store.latestAction)
      store.latestAction = entry.timestamp;
  }
  function addNewShortDIDToExistingStoreMiddle(store, history, entry) {
    const entries = Array.from(store.entries());
    store.clear();
    let added = false;
    let prevTimestamp = 0;
    for (const [existingShortDID, existingHistory] of entries) {
      if (entry.timestamp > existingHistory.created) {
        if (!added) {
          if (prevTimestamp) {
            history.updates[0].t = timestampOffsetToString(entry.timestamp - prevTimestamp);
          }
          store.set(entry.shortDID, history);
          prevTimestamp = history.created;
          added = true;
        }
        history.updates[0].t = timestampOffsetToString(existingHistory.created - prevTimestamp);
      }
      store.set(existingShortDID, existingHistory);
      prevTimestamp = existingHistory.created;
    }
    if (!store.has(entry.shortDID)) {
      console.warn(
        "This shortDID should not appear at the end according to latestCreation " + new Date(
          /** @type {number} */
          store.latestRegistration
        ) + " being after" + new Date(history.created),
        { entry, store }
      );
      store.set(entry.shortDID, history);
    }
    if (!store.latestAction || entry.timestamp > store.latestAction)
      store.latestAction = entry.timestamp;
  }
  function createNewStoreAddShortDID(stores, insertStoreAt, history, entry) {
    var _a;
    const prevStore = stores[insertStoreAt - 1];
    const file = deriveStoreFilenameFromTimestamp(
      (_a = prevStore == null ? void 0 : prevStore.values().next().value) == null ? void 0 : _a.created,
      entry.timestamp
    );
    const newStore = createEmptyStore(file);
    newStore.next = prevStore == null ? void 0 : prevStore.next;
    if (prevStore) prevStore.next = file;
    newStore.latestAction = newStore.latestRegistration = newStore.earliestRegistration = entry.timestamp;
    newStore.set(entry.shortDID, history);
    return { newStore, prevStore };
  }
  function findStoreToAddTimestamp(stores, timestamp) {
    if (!(stores == null ? void 0 : stores.length)) return { insertStoreAt: 0 };
    const latestStore = stores[stores.length - 1];
    if (!latestStore.earliestRegistration || timestamp >= latestStore.earliestRegistration || stores.length === 1) {
      const canAddToExistingStore = latestStore.size < MAX_STORE_SIZE && getMonthStart(latestStore.latestRegistration) === getMonthStart(timestamp);
      if (canAddToExistingStore) return { store: latestStore };
      else return { insertStoreAt: stores.length };
    }
    const monthStartTimestamp = getMonthStart(timestamp);
    for (let storeIndex = stores.length - 1; storeIndex > 0; storeIndex--) {
      const tryStore = stores[storeIndex];
      if (timestamp < (tryStore.earliestRegistration || 0)) continue;
      if (timestamp < (tryStore.latestAction || 0)) return { store: tryStore };
      const nextStore = stores[storeIndex + 1];
      const monthStartNext = getMonthStart(nextStore.earliestRegistration || 0);
      if (monthStartTimestamp === monthStartNext) {
        if (nextStore.size < MAX_STORE_SIZE * 1.2) return { store: nextStore };
        else return { insertStoreAt: storeIndex + 1 };
      } else {
        return { insertStoreAt: storeIndex + 1 };
      }
    }
    return { insertStoreAt: 0 };
  }
  function getMonthStart(timestamp) {
    dt.setTime(timestamp);
    dt.setUTCDate(1);
    dt.setUTCHours(0);
    dt.setUTCMinutes(0);
    dt.setUTCSeconds(0);
    dt.setUTCMilliseconds(0);
    return dt.getTime();
  }
  function clampShortHandle(shortHandle) {
    let clampShortHandle2 = shortHandle;
    if (clampShortHandle2 && clampShortHandle2.length > 30)
      clampShortHandle2 = clampShortHandle2.slice(0, 25) + "..." + clampShortHandle2.slice(-2);
    return clampShortHandle2;
  }
  function loadAllStores(_0) {
    return __asyncGenerator(this, arguments, function* ({ read }) {
      const inceptionText = yield new __await(read("inception.json"));
      let next = inceptionText ? JSON.parse(inceptionText).next : void 0;
      if (!next) return yield { stores: [], loadedAllStores: true };
      const stores = [];
      let earliestRegistration;
      let latestRegistration;
      let latestAction;
      while (next) {
        const storeText = yield new __await(read(next + ".json"));
        if (!storeText) break;
        const store = parseRegistrationStore(next, storeText);
        const affectedShortDIDs = Array.from(store.keys());
        if (!earliestRegistration || store.earliestRegistration && store.earliestRegistration < earliestRegistration)
          earliestRegistration = store.earliestRegistration;
        if (!latestRegistration || store.latestRegistration && store.latestRegistration > latestRegistration)
          latestRegistration = store.latestRegistration;
        if (!latestAction || store.latestAction && store.latestAction > latestAction)
          latestAction = store.latestAction;
        stores.push(store);
        if (!store.next) {
          yield {
            loadedAllStores: true,
            stores,
            // last yield, return raw underlying array
            earliestRegistration,
            latestRegistration,
            latestAction,
            affectedStores: [store],
            affectedShortDIDs,
            addedShortDIDs: affectedShortDIDs
          };
          return;
        }
        next = store.next;
        yield {
          loadedAllStores: false,
          stores: stores.slice(),
          earliestRegistration,
          latestRegistration,
          latestAction,
          affectedStores: [store],
          affectedShortDIDs
        };
        earliestRegistration = latestRegistration = latestAction = void 0;
      }
      yield {
        loadedAllStores: true,
        stores,
        // last yield, return raw underlying array
        earliestRegistration,
        latestRegistration,
        latestAction
        // no affectedStores or affectedShortDIDs - last read was empty
      };
    });
  }
  var MAX_STORE_SIZE, dt;
  var init_indexing_run = __esm({
    "src/api/indexing/indexing-run.js"() {
      init_plc_directory();
      init_shorten();
      init_retry_fetch();
      init_persistence();
      MAX_STORE_SIZE = 5e4;
      dt = /* @__PURE__ */ new Date();
    }
  });

  // src/api/indexing/pull-plc-directory.js
  init_persistence();
  function pullPLCDirectoryCompact() {
    return __async(this, null, function* () {
      const fs = __require("fs");
      const path = __require("path");
      const { indexingRun: indexingRun2 } = (init_indexing_run(), __toCommonJS(indexing_run_exports));
      console.log("\n\n\nPLC directory CACHE");
      const directoryPath = path.resolve(__dirname, "src/api/indexing/repos");
      const rootPath = path.resolve(directoryPath, "colds-ky-dids-history.github.io");
      const run = indexingRun2({
        read: (localPath) => new Promise((resolve, reject) => {
          const normalizeLocalPath = localPath.replace(/^\//, "");
          const filePath = path.resolve(
            /^20/.test(normalizeLocalPath) ? directoryPath : rootPath,
            normalizeLocalPath
          );
          fs.readFile(filePath, "utf8", (err, data) => {
            console.log("  READ>>", filePath, err ? "ERROR" : "OK");
            if (err) resolve(void 0);
            else resolve(data);
          });
        })
      });
      let firstLoaded = true;
      try {
        for (var iter = __forAwait(run), more, temp, error; more = !(temp = yield iter.next()).done; more = false) {
          const progress = temp.value;
          const reportProgress = {};
          if (progress.affectedStores) reportProgress.affectedStores = progress.affectedStores.map((store) => store.file);
          if (progress.earliestRegistration) reportProgress.earliestRegistration = new Date(progress.earliestRegistration);
          if (progress.latestRegistration) reportProgress.latestRegistration = new Date(progress.latestRegistration);
          if (progress.latestAction) reportProgress.latestAction = new Date(progress.latestAction);
          if (progress.addedShortDIDs) reportProgress.addedShortDIDs = progress.addedShortDIDs.length;
          if (progress.affectedShortDIDs) reportProgress.affectedShortDIDs = progress.affectedShortDIDs.length;
          if (progress.stores) {
            reportProgress.registrations = 0;
            for (const sto of progress.stores)
              reportProgress.registrations += sto.size;
          }
          if (firstLoaded && progress.loadedAllStores) {
            firstLoaded = false;
            console.log("\n\n");
          }
          console.log(reportProgress);
          if (!progress.loadedAllStores) continue;
          console.log("  WRITE>>");
          if (progress.affectedStores) {
            const storesInWritingOrder = progress.affectedStores.slice().sort((a, b) => a.latestRegistration - b.latestRegistration);
            for (const sto of storesInWritingOrder) {
              const filePath = path.resolve(directoryPath, sto.file + ".json");
              process.stdout.write("    " + filePath);
              const json = stringifyRegistrationStore(sto);
              yield new Promise((resolve, reject) => {
                fs.writeFile(filePath, json, (error2) => {
                  if (error2) reject(error2);
                  else resolve(void 0);
                });
              });
              console.log();
            }
            const inceptionPath = path.resolve(rootPath, "inception.json");
            const inceptionStr = JSON.stringify({
              next: progress.stores[0].file,
              stores: progress.stores.map((store) => store.file)
            }, null, 2);
            const currentInception = fs.existsSync(inceptionPath) ? fs.readFileSync(inceptionPath, "utf8") : "";
            if (currentInception !== inceptionStr) {
              process.stdout.write("  " + path.resolve(rootPath, "inception.json"));
              fs.writeFileSync(inceptionPath, inceptionStr);
              console.log(" ++++ CHANGED.");
            }
          }
          console.log(" OK");
        }
      } catch (temp) {
        error = [temp];
      } finally {
        try {
          more && (temp = iter.return) && (yield temp.call(iter));
        } finally {
          if (error)
            throw error[0];
        }
      }
    });
  }

  // src/api/indexing/index.js
  init_indexing_run();

  // src/index.js
  init_retry_fetch();
  function pullPLCDirectoryLocal() {
    return __async(this, null, function* () {
      var _a, _b;
      console.log("Pulling PLC directory...");
      const run = indexingRun({
        read: (localPath) => __async(this, null, function* () {
          return;
          try {
            const re = yield fetch(
              location.protocol + "//history.dids.colds.ky/" + localPath.replace(/^\//, "")
            );
            if (re.status !== 200) return;
            const text = yield re.text();
            return text;
          } catch (fetchError) {
            console.warn(localPath, fetchError);
          }
        }),
        fetch: retryFetch
      });
      let count = 0;
      try {
        for (var iter = __forAwait(run), more, temp, error; more = !(temp = yield iter.next()).done; more = false) {
          const progress = temp.value;
          console.log(__spreadProps(__spreadValues({
            progress
          }, progress), {
            earliestRegistration: progress.earliestRegistration && new Date(progress.earliestRegistration),
            latestRegistration: progress.latestRegistration && new Date(progress.latestRegistration),
            latestAction: progress.latestAction && new Date(progress.latestAction),
            affectedStores: (_a = progress.affectedStores) == null ? void 0 : _a.map((store) => store.file),
            stores: (_b = progress.stores) == null ? void 0 : _b.map((store) => store.file)
          }));
          console.log("\n\n\n");
          count++;
        }
      } catch (temp) {
        error = [temp];
      } finally {
        try {
          more && (temp = iter.return) && (yield temp.call(iter));
        } finally {
          if (error)
            throw error[0];
        }
      }
    });
  }
  if (typeof __require === "function" && typeof process !== "undefined" && typeof process.exit === "function") {
    console.log("node");
    pullPLCDirectoryCompact();
  } else {
    console.log("browser, see window.pullPLCDirectoryLocal / handleFirehoseToStore ");
    window["pullPLCDirectoryLocal"] = pullPLCDirectoryLocal;
    window["handleFirehoseToStore"] = handleFirehoseToStore;
  }
  function handleFirehoseToStore() {
    return __async(this, null, function* () {
      var _a;
      var INTERVAL_FIREHOSE = 2e3;
      console.log("libs...");
      const coldsky = yield waitForLib();
      const store = coldsky.defineCacheIndexedDBStore();
      window["store"] = store;
      console.log("firehose connect...");
      let lastProcess = Date.now();
      let addedTotal = 0;
      let unexpected;
      try {
        for (var iter = __forAwait(coldsky.firehose()), more, temp, error; more = !(temp = yield iter.next()).done; more = false) {
          const blocks = temp.value;
          for (const block of blocks) {
            if (block.messages.length) {
              for (const p of block.messages) {
                store.captureRecord(p, block.receiveTimestamp);
                addedTotal++;
              }
            }
            if ((_a = block.unexpected) == null ? void 0 : _a.length) {
              if (!unexpected) unexpected = block.unexpected;
              else unexpected = unexpected.concat(block.unexpected);
            }
          }
          console.log("processed ", addedTotal, " into store");
          if (unexpected)
            console.log("unexpected ", unexpected);
          addedTotal = 0;
          const waitMore = INTERVAL_FIREHOSE - (Date.now() - lastProcess);
          if (waitMore > 0) yield new Promise((resolve, reject) => setTimeout(resolve, waitMore));
          lastProcess = Date.now();
        }
      } catch (temp) {
        error = [temp];
      } finally {
        try {
          more && (temp = iter.return) && (yield temp.call(iter));
        } finally {
          if (error)
            throw error[0];
        }
      }
      function waitForLib() {
        if (window["coldsky"]) return window["coldsky"];
        return new Promise((resolve, reject) => {
          let stopInterval = setInterval(() => {
            if (window["coldsky"]) {
              clearInterval(stopInterval);
              resolve(window["coldsky"]);
            }
          }, 300);
        });
      }
    });
  }
})();
//# sourceMappingURL=index.js.map
