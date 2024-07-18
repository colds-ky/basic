// @ts-check

export function makeClock() {
  const clock = {
    worldStartTime: Date.now(),
    nowMSec: 0,
    nowSeconds: 0,
    update
  };

  return clock;

  function update() {
    clock.nowSeconds =
      (clock.nowMSec = Date.now() - clock.worldStartTime)
      / 1000;
  }
}