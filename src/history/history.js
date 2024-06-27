// @ts-check

import React, { useEffect } from 'react';

import { useNavigate, useParams } from 'react-router-dom';
import { unwrapShortHandle } from '../../coldsky/lib';
import { forAwait } from '../../coldsky/src/api/forAwait';
import { resolveHandleOrDID } from '../api/record-cache';

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

  const resolved = forAwait(handle, () => resolveHandleOrDID(handle));

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

      {
        resolved && 
        <pre>
          {JSON.stringify(resolved, null, 2)}
        </pre>
      }
    </div>
  );
}
