// @ts-check

import React from 'react';

import { useNavigate, useParams } from 'react-router-dom';
import { unwrapShortHandle } from 'coldsky';

export function History() {

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
