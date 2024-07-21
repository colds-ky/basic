// @ts-check

import React from 'react';
import { localise } from '../app-shared/localise';

const dtBuf = new Date();
const dtSince = new Date();
const dtNow = new Date();

/**
 * @param {{
 *  since?: number | string | Date | null | undefined,
 *  time?: number | string | Date | null | undefined,
 *  className?: string,
 *  Component?: any
 * }} _
 */
export function FormatTime({ time, since, className, Component }) {
  if (time == null) return null;

  const fmt = formatTimeStr(time, since);
  if (!fmt) return null;

  const UseComponent = Component || 'time';
  const useClassName =
    className ? className + ' formatted-time' :
      'formatted-time';

  let fullTimeStr;
  if (typeof time === 'string') {
    dtBuf.setTime(Date.parse(time));
    fullTimeStr = dtBuf.toLocaleString();
  } else if (typeof time === 'number') {
    dtBuf.setTime(time);
    fullTimeStr = dtBuf.toLocaleString();
  } else {
    fullTimeStr = dtBuf.toLocaleString();
  }

  return (
    <UseComponent
      className={useClassName}
      title={fullTimeStr}
    >
      {fmt}
    </UseComponent>
  );
}

/**
 * @param {string | number | Date | null | undefined} time
 * @param {string | number | Date | null | undefined} since
 */
export function formatTimeStr(time, since) {
  if (time == null) return undefined;

  const tm =
    typeof time === 'number' ? time :
      typeof time === 'string' ? Date.parse(time) :
        time.getTime();
  const snc =
    typeof since === 'number' ? since :
      typeof since === 'string' ? Date.parse(since) :
        since ? since.getTime() : 0;

  if (since) {
    const diffSinceMsec = tm - snc;
    if (diffSinceMsec < 0) return formatTimeStrExact(tm);

    if (diffSinceMsec < 60 * 1000)
      return '+' + Math.round(diffSinceMsec / 1000) + localise('s', { uk: 'с' });

    if (diffSinceMsec < 70 * 60 * 1000)
      return '+' + Math.round(diffSinceMsec / 1000 / 60) + localise('min', { uk: 'хв' });

      if (diffSinceMsec < 24 * 60 * 60 * 1000) {
        const h = Math.floor(diffSinceMsec / 1000 / 60 / 60);
        const m = Math.floor((diffSinceMsec - h * 60 * 60 * 1000) / 1000 / 60);
        if (!m) return '+' + h + localise('h', { uk: 'год' });
        return '+' + h + localise('h', { uk: 'год' }) + ' ' + m + localise('min', { uk: 'хв' });
      }

      const days = diffSinceMsec / 1000 / 60 / 60 / 24;
      if (days < 40)
        return '+' + Math.round(days) + localise('d', { uk: 'д' });
    }

  return formatTimeStrExact(tm);
}

/** @param {number} tm */
function formatTimeStrExact(tm) {

  const now = Date.now();

  const diffMsec = now - tm;
  if (Math.abs(diffMsec) < 120 * 1000) {
    return localise('just now', { uk: 'щойно' });
  }

  dtBuf.setTime(tm);

  if (diffMsec < 0) {
    if (Math.abs(diffMsec) < 60 * 1000 * 12)
      return dtBuf.toLocaleTimeString();
    else
      return dtBuf.toLocaleString();
  }

  if (diffMsec < 91 * 1000) return localise('a minute ago', { uk: 'хвилину тому' });
  if (diffMsec < 59 * 60 * 1000) return Math.round(diffMsec / (60 * 1000)) + ' ' + localise('min ago', { uk: 'хв тому' });
  if (dtBuf.getFullYear() === dtNow.getFullYear() &&
    dtBuf.getMonth() === dtNow.getMonth() &&
    dtBuf.getDate() === dtNow.getDate()) {
    return localise(
      dtBuf.getHours() + ':' + (dtBuf.getMinutes() + 100).toString().substring(1) + (dtBuf.getHours() < 12 ? 'am' : 'pm'),
      {
        uk: dtBuf.getHours() + ':' + (dtBuf.getMinutes() + 100).toString().substring(1)
      });
  }

  if (dtBuf.getFullYear() === dtNow.getFullYear())
    return dtBuf.getDate() + ' ' + localise(monthEN[dtBuf.getMonth()], { uk: monthUK[dtBuf.getMonth()] });
  else
    return dtBuf.toLocaleDateString();
}

const monthEN = 'Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec'.split(',');
const monthUK = 'січня,лютого,березня,квітня,травня,червня,липня,серпня,вересня,жовтня,листопада,грудня'.split(',');
