// @ts-check

export function bootWorker() {
  console.log('WORKER initialised');

  self.addEventListener('message', (event) => {
    console.log('Message received from main script', event.data);
  });

  self.postMessage({ init: { time: Date.now(), label: 'Worker initialized' } });
}