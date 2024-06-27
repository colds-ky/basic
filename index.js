// @ts-check

function gist() {
  gist.allLoaded = allLoaded;
  if (document.readyState === 'complete') setTimeout(() => gist.allLoaded(), 1000);
  else window.addEventListener('load', () => gist.allLoaded());

  function allLoaded() {
    gist.allLoaded = () => { };

    const some = document.createElement('pre');
    some.textContent = 'All Loaded ' + typeof coldsky + ' ' + typeof THREE;
    document.body.appendChild(some);

    runFirehoseAndClustering();
  }

  async function runFirehoseAndClustering() {
    var buf = [];
    flushBufNext = Date.now() + 1000;
    var outputDIV = document.createElement('div');
    document.body.appendChild(outputDIV);

    for await (const chunk of coldsky.firehose()) {
      if (chunk.length) {
        if (chunk.length === 1) buf.push(chunk[0]);
        else buf = buf.concat(chunk);
      }

      if (Date.now() >= flushBufNext) {
        outputDIV.textContent = buf.length + ' buf';
        flushBufNext = Date.now() + 1000;
        buf = [];
      }
    }
  }
}
gist();
