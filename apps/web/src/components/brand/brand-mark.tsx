/** The Runway mark: a circle with a tilted horizon bar (catalog §1.0/§1.8). */
export function BrandMark({size = 26, stroke = 2.5}: {size?: number; stroke?: number}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `${stroke}px solid var(--ink)`,
        position: 'relative',
        overflow: 'hidden',
        flex: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: size * 0.46,
          height: stroke,
          background: 'var(--ink)',
          transform: 'translate(-50%,-50%) rotate(-35deg)',
        }}
      />
    </div>
  );
}
