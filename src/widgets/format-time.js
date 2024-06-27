// @ts-check

import React from 'react';
import { localise, localiseNumberSuffix } from '../localise';

const dtBuf = new Date();
const dtNow = new Date();

/**
 * @param {{
 *  time?: number | string | Date | null | undefined,
 *  className?: string,
 *  Component?: any
 * }} _
 */
export function FormatTime({ time, className, Component }) {
  if (time == null) return null;

  const fmt = formatTimeStr(time);
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
 */
export function formatTimeStr(time) {
  if (time == null) return undefined;

  const now = Date.now();
  const tm =
    typeof time === 'number' ? time :
      typeof time === 'string' ? Date.parse(time) :
        time.getTime();

  const diffMsec = now - tm;
  if (Math.abs(diffMsec) < 120) {
    return localise('just now', { uk: 'щойно' });
  }

  dtBuf.setTime(tm);

  if (diffMsec < 0) {
    if (Math.abs(diffMsec) < 60 * 1000 * 12)
      return dtBuf.toLocaleTimeString();
    else
      return dtBuf.toLocaleString();
  }

  if (diffMsec < 60 * 1000) return localise('a minute ago', { uk: 'хвилину тому' });
  if (diffMsec < 59 * 60 * 1000) return Math.round(diffMsec / (60 * 60 * 1000)) + ' ' + localise('min ago', { uk: 'хв тому' });
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
