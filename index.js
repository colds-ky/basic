(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __knownSymbol = (name, symbol) => {
    return (symbol = Symbol[name]) ? symbol : Symbol.for("Symbol." + name);
  };
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
    if (typeof require !== "undefined")
      return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
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
    };
    var method = (k) => it[k] = (x) => new Promise((yes, no) => resume(k, x, yes, no));
    var it = {};
    return generator = generator.apply(__this, __arguments), it[__knownSymbol("asyncIterator")] = () => it, method("next"), method("throw"), method("return"), it;
  };
  var __forAwait = (obj, it, method) => (it = obj[__knownSymbol("asyncIterator")]) ? it.call(obj) : (obj = obj[__knownSymbol("iterator")](), it = {}, method = (key, fn) => (fn = obj[key]) && (it[key] = (arg) => new Promise((yes, no, done) => (arg = fn.call(obj, arg), done = arg.done, Promise.resolve(arg.value).then((value) => yes({ value, done }), no)))), method("next"), method("return"), it);

  // src/api/indexing/pull-plc-directory.js
  var import_fs = __toESM(__require("fs"));
  var import_path = __toESM(__require("path"));

  // src/api/akpa.js
  function streamBuffer(callback) {
    return __asyncGenerator(this, null, function* () {
      let finallyTrigger = () => {
      };
      let stop = false;
      let buffer;
      let continueTrigger = () => {
      };
      let continuePromise = new Promise((resolve) => continueTrigger = resolve);
      let yieldPassedTrigger = () => {
      };
      let yieldPassedPromise = new Promise((resolve) => yieldPassedTrigger = resolve);
      let rejectError;
      const args = {
        yield: yieldFn,
        reject,
        complete,
        isEnded: false,
        finally: new Promise((resolve) => finallyTrigger = resolve)
      };
      callback(args);
      try {
        while (!stop) {
          yield new __await(continuePromise);
          if (rejectError)
            throw rejectError.error;
          if (stop)
            return;
          continuePromise = new Promise((resolve) => continueTrigger = resolve);
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
          if (!buffer)
            buffer = /** @type {TBuffer} */
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
    });
  }

  // lib/shorten.js
  function shortenDID(did) {
    return did && /** @type {T} */
    (did.replace(_shortenDID_Regex, "").toLowerCase() || void 0);
  }
  var _shortenDID_Regex = /^did\:plc\:/;
  function shortenHandle(handle) {
    handle = cheapNormalizeHandle(handle);
    return handle && /** @type {T} */
    (handle.replace(_shortenHandle_Regex, "").toLowerCase() || void 0);
  }
  var _shortenHandle_Regex = /\.bsky\.social$/;
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
      if (handle && handle.lastIndexOf("at://", 0) === 0)
        handle = handle.slice(5);
      else
        handle = handle.slice(3);
    }
    return handle || void 0;
  }
  function shortenPDC(pdc) {
    if (!pdc)
      return void 0;
    pdc = pdc.trim().toLowerCase();
    if (pdc === "https://bsky.social")
      return ".s";
    else if (pdc === "https://bsky.network")
      return ".n";
    else if (pdc === "https://bsky.app")
      return ".a";
    return pdc.replace(/^https:\/\//, "").replace(/host\.bsky\.network$/, "");
  }
  function parseTimestampOffset(dtOffsetStr) {
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
    offset = Math.floor(offset / 1e3);
    const seconds = offset % 60;
    offset = (offset - seconds) / 60;
    const minutes = offset % 60;
    offset = (offset - minutes) / 60;
    const hours = offset % 24;
    const days = (offset - hours) / 24;
    let str = (100 + seconds).toString().slice(1);
    if (days + hours + minutes) {
      str = (100 + minutes).toString().slice(1) + ":" + str;
      if (days + hours) {
        str = hours.toString() + ":" + str;
        if (days) {
          str = days + "+" + str;
        }
      }
    }
    return str;
  }
  function breakPostURL(url) {
    if (!url)
      return;
    const match = _breakPostURL_Regex.exec(url);
    if (!match)
      return;
    return { shortDID: match[1], postID: match[2] };
  }
  var _breakPostURL_Regex = /^http[s]?\:\/\/bsky\.app\/profile\/([a-z0-9\.\:]+)\/post\/([a-z0-9]+)$/;
  function breakFeedUri(uri) {
    if (!uri)
      return;
    const match = _breakFeedUri_Regex.exec(uri);
    if (!match || !match[3])
      return;
    return { shortDID: match[2], postID: match[3] };
  }
  var _breakFeedUri_Regex = /^at\:\/\/(did:plc:)?([a-z0-9]+)\/[a-z\.]+\/?(.*)?$/;

  // lib/plc-directory.js
  var FETCH_AHEAD_MSEC_MAX = 1e4;
  var FETCH_AHEAD_COUNT_MAX = 1e4;
  function plcDirectory(since, overrides) {
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
        if (stream.isEnded)
          return;
        const nextChunkText = yield nextChunkRe.text();
        const chunkLines = nextChunkText.split("\n");
        let overlap = 0;
        const nextChunkEnitres = [];
        for (const line of chunkLines) {
          if (lastChunkLines.has(line)) {
            overlap++;
            continue;
          }
          if (!line)
            continue;
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
            if (!buffer)
              return item;
            buffer.entries = buffer.entries.concat(item.entries);
            buffer.overlap += item.overlap;
            return buffer;
          }
        );
        if (stream.isEnded)
          return;
        const shouldWaitForConsumption = collectedEntriesSinceLastWaitedForConsumption > FETCH_AHEAD_COUNT_MAX || Date.now() - lastWaitedForConsumptionAt > FETCH_AHEAD_MSEC_MAX || !nextChunkEnitres.length;
        if (shouldWaitForConsumption) {
          yield waitForConsumption;
          if (stream.isEnded)
            return;
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
      const iteration = plcDirectory(since, overrides);
      try {
        for (var iter = __forAwait(iteration), more, temp, error; more = !(temp = yield new __await(iter.next())).done; more = false) {
          const chunk = temp.value;
          const compactEntries = [];
          for (const entry of chunk.entries) {
            const timestamp = new Date(entry.createdAt).getTime();
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

  // src/api/indexing/pull-plc-directory.js
  function pullPLCDirectoryCompact() {
    return __async(this, null, function* () {
      console.log("PLC directory CACHE");
      const directoryPath = import_path.default.resolve(__dirname, "src/api/indexing/repos/directory");
      console.log("Reading directory files...");
      const wholeDirectory = readAllDirectoryFiles(directoryPath);
      let maxDate = 0;
      for (const history of Object.values(wholeDirectory)) {
        for (const entry of history) {
          if (entry.timestamp > maxDate)
            maxDate = entry.timestamp;
        }
      }
      console.log("Pulling PLC directory...");
      let lastChunkEntry;
      try {
        for (var iter = __forAwait(plcDirectoryCompact(maxDate - 1e3)), more, temp, error; more = !(temp = yield iter.next()).done; more = false) {
          const chunk = temp.value;
          if (!chunk.entries.length) {
            console.log("No new entries, last ", lastChunkEntry || new Date(maxDate));
            continue;
          }
          lastChunkEntry = chunk.entries[chunk.entries.length - 1];
          console.log(
            chunk.entries.length,
            __spreadProps(__spreadValues({}, chunk.entries[0]), { timestamp: new Date(chunk.entries[0].timestamp).toISOString() }),
            "...",
            __spreadProps(__spreadValues({}, chunk.entries[chunk.entries.length - 1]), { timestamp: new Date(chunk.entries[chunk.entries.length - 1].timestamp).toISOString() })
          );
          for (const entry of chunk.entries) {
            const historyEntry = {
              timestamp: entry.timestamp,
              shortHandle: entry.shortHandle,
              shortPDC: entry.shortPDC
            };
            const dirEntry = wholeDirectory[entry.shortDID];
            if (!dirEntry)
              wholeDirectory[entry.shortDID] = [historyEntry];
            else
              dirEntry.push(historyEntry);
          }
          console.log("saving...");
          saveAllDirectoryFiles(directoryPath, wholeDirectory);
          console.log("OK.\n\n");
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
  function saveAllDirectoryFiles(directoryPath, wholeDirectory) {
    const byMonth = {};
    for (const [did, history] of Object.entries(wholeDirectory)) {
      const dt = new Date(history[0].timestamp);
      const yearMonth = dt.getUTCFullYear() + "/" + (dt.getUTCMonth() + 1);
      const monthMap = byMonth[yearMonth] || (byMonth[yearMonth] = {});
      monthMap[did] = history;
    }
    for (const [yearMonth, monthMap] of Object.entries(byMonth)) {
      const directoryJSON = import_path.default.join(directoryPath, yearMonth + ".json");
      if (!import_fs.default.existsSync(import_path.default.dirname(directoryJSON)))
        import_fs.default.mkdirSync(import_path.default.dirname(directoryJSON), { recursive: true });
      let saveJSON = "{\n";
      let carryTimestamp = Date.UTC(parseInt(yearMonth.split("/")[0]), parseInt(yearMonth.split("/")[1]) - 1, 1, 0, 0, 0, 0);
      let firstShortDID = true;
      const orderDIDs = Object.keys(monthMap).sort((shortDID1, shortDID2) => monthMap[shortDID1][0].timestamp - monthMap[shortDID2][0].timestamp);
      for (const shortDID of orderDIDs) {
        if (firstShortDID)
          firstShortDID = false;
        else
          saveJSON += ",\n";
        saveJSON += JSON.stringify(shortDID) + ":{";
        const history = monthMap[shortDID];
        let timestamp = carryTimestamp;
        let first = true;
        for (const entry of history) {
          if (first) {
            first = false;
            carryTimestamp = entry.timestamp;
          } else {
            saveJSON += ",";
          }
          const dtOffset = timestampOffsetToString(entry.timestamp - timestamp);
          timestamp = entry.timestamp;
          saveJSON += JSON.stringify(dtOffset) + ":" + JSON.stringify({
            h: !entry.shortHandle ? void 0 : entry.shortHandle.length > 20 ? entry.shortHandle.slice(0, 15) + ".." + entry.shortHandle.slice(-3) : entry.shortHandle,
            p: entry.shortPDC
          });
        }
        saveJSON += "}";
      }
      saveJSON += "\n}\n";
      import_fs.default.writeFileSync(directoryJSON, saveJSON);
    }
  }
  function readAllDirectoryFiles(directoryPath) {
    let year = 2022, month = 11;
    const untilYear = (/* @__PURE__ */ new Date()).getUTCFullYear(), untilMonth = (/* @__PURE__ */ new Date()).getUTCMonth() + 1;
    const wholeDirectory = {};
    while (year < untilYear || year === untilYear && month <= untilMonth) {
      const monthStr = month.toString();
      const directoryJSON = import_path.default.join(directoryPath, year.toString(), monthStr + ".json");
      if (import_fs.default.existsSync(directoryJSON)) {
        const directoryObj = JSON.parse(import_fs.default.readFileSync(directoryJSON, "utf-8"));
        let carryTimestamp = Date.UTC(year, month - 1, 1, 0, 0, 0, 0);
        for (const [did, history] of Object.entries(directoryObj)) {
          if (!wholeDirectory[did])
            wholeDirectory[did] = [];
          let first = true;
          let timestamp = carryTimestamp;
          for (const [dtOffsetStr, compact] of Object.entries(history)) {
            const dtOffset = parseTimestampOffset(dtOffsetStr);
            if (first) {
              carryTimestamp += dtOffset;
              first = false;
            }
            timestamp += dtOffset;
            wholeDirectory[did].push({
              timestamp,
              shortHandle: !compact.h ? void 0 : compact.h.length > 20 ? compact.h.slice(0, 15) + ".." + compact.h.slice(-3) : compact.h,
              shortPDC: compact.p
            });
          }
        }
      }
      month++;
      if (month > 12) {
        year++;
        month = 1;
      }
    }
    return wholeDirectory;
  }

  // src/index.js
  function pullPLCDirectoryLocal() {
    return __async(this, null, function* () {
      console.log("Pulling PLC directory...");
      try {
        for (var iter = __forAwait(plcDirectoryCompact()), more, temp, error; more = !(temp = yield iter.next()).done; more = false) {
          const chunk = temp.value;
          console.log(chunk.entries.length, chunk.entries[0], "...", chunk.entries[chunk.entries.length - 1]);
          break;
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
    pullPLCDirectoryCompact();
  } else {
    pullPLCDirectoryLocal();
  }
})();
//# sourceMappingURL=index.js.map
