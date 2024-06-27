// @ts-check

function coldsky() {
  var searchINPUT = /** @type {HTMLInputElement} */(document.getElementById('searchINPUT'));
  searchINPUT.oninput =
    searchINPUT.onchange =
    searchINPUT.onkeyup =
    searchINPUT.onkeydown =
    searchINPUT.onkeypress =
    searchINPUT.onmousedown =
    searchINPUT.onmouseup =
    handleInput;

  /** @type {HTMLElement} */
  var autocompleteElement;

  var inputTimeout;
  function handleInput() {
    clearTimeout(inputTimeout);
    inputTimeout = setTimeout(handleInputDebounced, 500);
  }

  function getInputTextTrim() {
    return stringTrim(searchINPUT.value || '');
  }

  var currentInputTextTrim;
  function handleInputDebounced() {
    var text = getInputTextTrim();
    if (text === currentInputTextTrim) return;

    currentInputTextTrim = text;

    var wordStarts = getWordStartsLowerCase(text);

    if (!wordStarts.length) {
      if (autocompleteElement)
        autocompleteElement.style.display = 'none';
      return;
    }

    if (!autocompleteElement) {
      autocompleteElement = document.createElement('div');
      autocompleteElement.className = 'autocomplete';
      /** @type {*} */(searchINPUT.parentElement).appendChild(autocompleteElement);
    } else {
      autocompleteElement.style.display = '';
    }

    var wordStartIndices = [];
    var populatedCount = 0;
    for (var i = 0; i < wordStarts.length; i++) {
      (function (i) {
        var wordStart = wordStarts[i];
        fetchIndex(wordStart, function (error, matches) {
          populatedCount++;
          wordStartIndices[i] = matches || [];
          if (populatedCount === wordStarts.length) {
            if (getInputTextTrim() !== text) return;

            performIndexSearch(text, wordStarts, wordStartIndices);
          }
        });
      })(i);
    }
  }

  function performIndexSearch(text, wordStarts, wordStartIndices) {
    var searchWords = text.split(/\s+/g)
      .map(function (w) { return stringTrim(w).toLowerCase(); })
      .filter(function (w) { return !!w; });

    var combinedSearchUniverse = [];
    for (var i = 0; i < wordStartIndices.length; i++) {
      var bucket = wordStartIndices[i];
      for (var shortDID in bucket) {
        var accountIndexEntry = bucket[shortDID];
        if (typeof accountIndexEntry === 'string')
          combinedSearchUniverse.push({ shortDID: shortDID, handle: accountIndexEntry });
        else if (Array.isArray(accountIndexEntry))
          combinedSearchUniverse.push({ shortDID: shortDID, handle: accountIndexEntry[0], displayName: accountIndexEntry[1] });
      }
    }

    var searchResults = [];
    for (var i = 0; i < combinedSearchUniverse.length; i++) {
      var entry = combinedSearchUniverse[i];
      var shortDID = entry.shortDID;
      var handle = entry.handle || '';
      var displayName = entry.displayName || '';

      var rank = 0;
      var matchShortDID = false;
      var matchHandle = false;
      var matchDisplayName = false;
      for (var j = 0; j < searchWords.length; j++) {
        var searchWord = searchWords[j];
        var shortDIDRank = rankShortDID(searchWord, shortDID);
        if (shortDIDRank) matchShortDID = true;
        var handleRank = rankHandle(searchWord, handle);
        if (handleRank) matchHandle = true;
        var displayNameRank = rankDisplayName(searchWord, displayName);
        if (displayNameRank) matchDisplayName = true;

        rank += shortDIDRank + handleRank + displayNameRank;
      }

      if (rank > 0) searchResults.push({
        shortDID: shortDID,
        handle: handle,
        displayName: displayName,
        rank: rank,

        matchShortDID: matchShortDID,
        matchHandle: matchHandle,
        matchDisplayName: matchDisplayName
      });
    }

    searchResults.sort(function (a, b) {
      return b.rank - a.rank;
    });

    if (!searchResults.length) {
      autocompleteElement.textContent = 'No results';
      return;
    }

    autocompleteElement.innerHTML = '';

    var maxResults = Math.min(20, searchResults.length);
    for (let i = 0; i < maxResults; i++) {
      var result = searchResults[i];
      var resultElement = document.createElement('div');
      resultElement.className = 'result';

      var atElem = document.createElement('span');
      atElem.textContent = '@';
      atElem.className = 'at';
      resultElement.appendChild(atElem);

      var handleElem = document.createElement('span');
      handleElem.textContent = result.handle;
      handleElem.className = 'handle' + (result.matchHandle ? ' handle-match' : '');
      resultElement.appendChild(handleElem);
      if (result.handle.indexOf('.') < 0) {
        var stdHandleSuffixElem = document.createElement('span');
        stdHandleSuffixElem.textContent = '.bsky.social';
        stdHandleSuffixElem.className = 'stdHandleSuffix';
        handleElem.appendChild(stdHandleSuffixElem);
      }

      if (result.displayName) {
        var empty = document.createElement('span');
        empty.textContent = ' ';
        resultElement.appendChild(empty);

        var displayNameElem = document.createElement('span');
        displayNameElem.textContent = result.displayName;
        displayNameElem.className = 'displayName' + (result.matchDisplayName ? ' displayName-match' : '');
        resultElement.appendChild(displayNameElem);
      }

      if (result.matchShortDID) {
        var empty = document.createElement('span');
        empty.textContent = ' ';
        resultElement.appendChild(empty);

        var shortDIDElem = document.createElement('span');
        shortDIDElem.textContent = result.shortDID;
        shortDIDElem.className = 'shortDID' + (result.matchShortDID ? ' shortDID-match' : '');
        resultElement.appendChild(shortDIDElem);
      }

      autocompleteElement.appendChild(resultElement);
    }

    if (searchResults.length > maxResults) {
      var moreElem = document.createElement('div');
      moreElem.className = 'more';
      moreElem.textContent = 'More...';
      autocompleteElement.appendChild(moreElem);
    }
  }

  function rankShortDID(searchString, shortDID) {
    if (stringStartsWith(searchString, 'did:plc:') && stringStartsWith('did:plc:' + shortDID, searchString)) return 2000;
    if (stringStartsWith(shortDID, searchString)) return 1000;
    return 0;
  }

  function rankHandle(searchString, handle) {
    if (stringEndsWith(searchString, '.bsky.social')) {
      if (handle.indexOf('.') >= 0 && handle + '.bsky.social' === searchString) return 2000;
      else rankHandle(searchString.slice(0, -('.bsky.social').length), handle) / 2;
    }

    var posInHandle =
      handle.indexOf(searchString);

    if (posInHandle < 0) return 0;
    if (posInHandle === 0) return searchString.length * 1.5;
    else return searchString.length * 0.8;
  }

  function rankDisplayName(searchString, displayName) {
    var posInDisplayName = displayName.indexOf(searchString);
    if (posInDisplayName < 0) return 0;
    if (posInDisplayName === 0) return searchString.length * 1.5;
    if (displayName.charAt(posInDisplayName - 1) === ' ') return searchString.length * 0.9;
    else return searchString.length * 0.5;
  }

  var wordStartRegExp = /[A-Z]*[a-z]*/g;
  /**
   * @param {string} str
   * @param {number=} count
   * @param {string[]=} wordStarts
   */
  function getWordStartsLowerCase(str, count, wordStarts) {
    if (typeof count !== 'number' || !Number.isFinite(count)) count = 3;
    if (!wordStarts) wordStarts = [];
    str.replace(wordStartRegExp, function (match) {
      const wordStart = match && match.slice(0, count).toLowerCase();
      if (wordStart && wordStart.length === count && /** @type {string[]} */(wordStarts).indexOf(wordStart) < 0)
        /** @type {string[]} */(wordStarts).push(wordStart);
      return match;
    });
    return wordStarts;
  }

  var indexCache;
  function fetchIndex(wordStart, callback) {
    if (!indexCache) indexCache = {};
    if (indexCache[wordStart]) return callback(void 0, indexCache[wordStart]);
    var protocol = location.protocol === 'http' ? 'http' : 'https';
    var url =
      protocol + '://colds.ky/index/' +
      wordStart[0] + '/' +
      wordStart.slice(0, 2) + '/' +
      wordStart.slice(1) + '.json';

    // TODO: reimplement with XHR for compatibility
    fetch(url).then(function (x) { return x.json(); }).then(
      function (data) {
        indexCache[wordStart] = data;
        callback(void 0, data);
      },
      function (err) {
        callback(err);
      });
  }

  function stringStartsWith(str, prefix) {
    return !!str && !!prefix && str.lastIndexOf(prefix, 0) === 0;
  }

  function stringEndsWith(str, suffix) {
    return !!str && !!suffix && str.indexOf(suffix, str.length - suffix.length) >= 0;
  }

  function stringTrim(str) {
    return (str == null ? '' : String(str)).replace(/^\s+|\s+$/g, '');
  }
} coldsky();