// @ts-check

import React from 'react';

import { useNavigate, useParams } from 'react-router-dom';

export function History() {

  let { handle } = useParams();
  return (
    <div>
      History...
      {handle}
    </div>
  );
}
