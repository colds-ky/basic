// @ts-check

function gist() {
  gist.allLoaded = allLoaded;

  function allLoaded() {

    const some = document.createElement('pre');
    some.textContent = 'All Loaded ' + typeof coldsky + ' ' + typeof THREE;
    document.body.appendChild(some);
  }
}
gist();