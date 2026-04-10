import { ImageResponse } from 'next/og';

export const alt = 'NZ Parliamentary Expenses | Transparency Dashboard';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(to bottom right, #000000, #111111)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          padding: '64px',
          border: '16px solid #222222',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: '72px',
            fontWeight: 800,
            backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #a1a1aa 100%)',
            backgroundClip: 'text',
            color: 'transparent',
            lineHeight: 1.2,
            marginBottom: '32px',
          }}
        >
          NZ Parliamentary Expenses
        </div>
        
        <div
          style={{
            fontSize: '36px',
            color: '#a1a1aa',
            marginBottom: '64px',
            fontWeight: 500,
          }}
        >
          Transparency Dashboard
        </div>
        
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            gap: '40px',
            marginTop: 'auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              padding: '16px 32px',
              border: '2px solid #333',
              borderRadius: '16px',
              background: '#111',
              fontSize: '24px',
              color: '#fff',
            }}
          >
            2008–2025 Data
          </div>
          <div
            style={{
              display: 'flex',
              padding: '16px 32px',
              border: '2px solid #3f3f46',
              borderRadius: '16px',
              background: 'linear-gradient(to right, #3f3f46, #18181b)',
              fontSize: '24px',
              color: '#fff',
            }}
          >
            Search MPs & Ministers
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
