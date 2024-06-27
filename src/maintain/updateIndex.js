// @ts-check
async function updateIndex() {
}

if (typeof window !== 'undefined') {
  __dirname = location.pathname.slice(0, location.pathname.lastIndexOf('/')) || '/';
  window['updateIndex'] = updateIndex;
}