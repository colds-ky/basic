// @ts-check

import React, { useEffect } from 'react';

import { useNavigate, useParams } from 'react-router-dom';
import { unwrapShortHandle } from '../../coldsky/lib';

export function History() {
  useEffect(() => {
    document.documentElement.classList.add('account');
  });

  return (
    <HistoryCore />
  );
}

function HistoryCore() {

  let { handle } = useParams();

  if (handle) {
    console.log({
      handle,
      unwrap: unwrapShortHandle(handle),
    });
  }

  return (
    <div>
      History...
      {handle}
    </div>
  );
}
