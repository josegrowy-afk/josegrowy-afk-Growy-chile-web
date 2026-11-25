import React from 'react';

/**
 * Manchas difuminadas de fondo hechas únicamente con CSS (blur 110px, opacidad controlada).
 * Se ocultan automáticamente cuando el usuario activa el tono Formal.
 */
export const BackdropBlobs: React.FC<{ contained?: boolean; className?: string }> = ({
  contained = false,
  className = '',
}) => (
  <div
    aria-hidden="true"
    className={`growy-blobs ${contained ? '!absolute' : ''} ${className}`}
  >
    <div
      className="growy-blob -top-24 -left-24 w-[28rem] h-[28rem]"
      style={{ backgroundColor: 'var(--blob-coral)' }}
    />
    <div
      className="growy-blob top-1/4 -right-28 w-[30rem] h-[30rem]"
      style={{ backgroundColor: 'var(--blob-lilac)' }}
    />
    <div
      className="growy-blob -bottom-28 left-1/3 w-[26rem] h-[26rem]"
      style={{ backgroundColor: 'var(--blob-gold)' }}
    />
  </div>
);
