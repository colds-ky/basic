// @ts-check

async function updateDIDs() {
  try {
    console.log('fetching cursors...');
    const cursors = await fetch('/dids/cursors.json').then(r => r.json());
    console.log(cursors);
  } catch (error) {
    console.log('error ', error);
  }
}

if (typeof window !== 'undefined') {
  __dirname = location.pathname.slice(0, location.pathname.lastIndexOf('/')) || '/';

  window['updateDIDs'] = updateDIDs;
}