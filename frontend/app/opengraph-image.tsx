import { ImageResponse } from 'next/og';

export const alt = 'HireVerify background verification services by Brainhunt Ventures';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          color: '#f8fafc',
          background:
            'radial-gradient(circle at 85% 15%, #1e5d5b 0, transparent 34%), linear-gradient(135deg, #0b1228 0%, #111b35 58%, #172b48 100%)',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div
            style={{
              display: 'flex',
              width: '56px',
              height: '56px',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '16px',
              color: '#09242a',
              background: '#56d9a7',
              fontSize: '34px',
              fontWeight: 700,
            }}
          >
            H
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '28px', fontWeight: 700 }}>HireVerify</span>
            <span style={{ marginTop: '4px', color: '#aab7cb', fontSize: '17px' }}>
              by Brainhunt Ventures
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', maxWidth: '980px', flexDirection: 'column' }}>
          <span style={{ color: '#56d9a7', fontSize: '20px', fontWeight: 700, letterSpacing: '3px' }}>
            BACKGROUND VERIFICATION SERVICES
          </span>
          <span style={{ marginTop: '22px', fontSize: '58px', fontWeight: 700, lineHeight: 1.12 }}>
            Confident hiring starts with clear verification.
          </span>
          <span style={{ marginTop: '22px', color: '#cbd5e1', fontSize: '24px' }}>
            Candidate screening across identity, employment, address, education and more.
          </span>
        </div>
        <div style={{ display: 'flex', color: '#aab7cb', fontSize: '18px' }}>
          hireverify.brainhuntventures.com
        </div>
      </div>
    ),
    size,
  );
}
