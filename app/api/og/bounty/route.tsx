import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const C = {
  bg: '#0a0a0a',
  green: '#a7ff00',
  text: '#e0e0e0',
  dim: '#888',
  border: '#333',
  ethBlue: '#627EEA',
  hiveRed: '#E31337',
} as const;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const title = searchParams.get('title') || 'Skatehive Bounty';
    const rawAmount = searchParams.get('amount') || '0';
    // Format: strip trailing zeros but keep meaningful decimals
    const amountNum = parseFloat(rawAmount);
    const amount = isNaN(amountNum) ? '0'
      : amountNum >= 1 ? amountNum.toFixed(2)
      : amountNum >= 0.01 ? amountNum.toFixed(3)
      : amountNum.toFixed(4);
    const currency = searchParams.get('currency') || 'ETH';
    const source = searchParams.get('source') || 'poidh'; // 'hive' or 'poidh'
    const chain = searchParams.get('chain') || '';
    const status = searchParams.get('status') || 'OPEN';
    const deadline = searchParams.get('deadline') || '';
    const claims = searchParams.get('claims') || '0';

    const isHive = source === 'hive';
    const accentColor = isHive ? C.hiveRed : C.ethBlue;
    const statusColor = status === 'OPEN' ? '#27c93f' : '#ff5f56';

    // Background image URL from public directory
    const baseUrl = request.nextUrl.origin;
    const bgUrl = `${baseUrl}/images/moneybag.png`;

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            position: 'relative',
            fontFamily: 'monospace',
          }}
        >
          {/* Background image */}
          <img
            src={bgUrl}
            alt=""
            width="1200"
            height="630"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />

          {/* Dark overlay for readability */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.8) 100%)',
              display: 'flex',
            }}
          />

          {/* Content */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '40px 50px',
            }}
          >
            {/* Top bar: SKATEHIVE + status */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    color: C.green,
                    fontSize: '28px',
                    fontWeight: 'bold',
                    display: 'flex',
                    letterSpacing: '2px',
                  }}
                >
                  SKATEHIVE
                </div>
                <div
                  style={{
                    color: C.dim,
                    fontSize: '28px',
                    display: 'flex',
                  }}
                >
                  /
                </div>
                <div
                  style={{
                    color: C.dim,
                    fontSize: '22px',
                    display: 'flex',
                    textTransform: 'uppercase',
                  }}
                >
                  BOUNTY
                </div>
              </div>

              {/* Status badge */}
              <div
                style={{
                  display: 'flex',
                  border: `2px solid ${statusColor}`,
                  padding: '6px 20px',
                }}
              >
                <div
                  style={{
                    color: statusColor,
                    fontSize: '20px',
                    fontWeight: 'bold',
                    display: 'flex',
                    letterSpacing: '3px',
                  }}
                >
                  {status}
                </div>
              </div>
            </div>

            {/* Center: Reward amount (big) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '20px',
              }}
            >
              {/* Reward box */}
              <div
                style={{
                  display: 'flex',
                  border: `3px solid ${C.green}`,
                  padding: '20px 60px',
                  background: 'rgba(0, 0, 0, 0.6)',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                <div
                  style={{
                    color: accentColor,
                    fontSize: '32px',
                    display: 'flex',
                    fontWeight: 'bold',
                  }}
                >
                  {isHive ? '◆' : '⟠'}
                </div>
                <div
                  style={{
                    color: C.green,
                    fontSize: amount.length > 6 ? '56px' : amount.length > 4 ? '64px' : '72px',
                    fontWeight: '900',
                    display: 'flex',
                    lineHeight: '1',
                  }}
                >
                  {amount}
                </div>
                <div
                  style={{
                    color: C.dim,
                    fontSize: '32px',
                    fontWeight: 'bold',
                    display: 'flex',
                  }}
                >
                  {currency}
                </div>
              </div>

              {/* Title */}
              <div
                style={{
                  color: C.text,
                  fontSize: '36px',
                  fontWeight: 'bold',
                  display: 'flex',
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  maxWidth: '900px',
                  lineHeight: '1.3',
                }}
              >
                {title.length > 60 ? title.slice(0, 57) + '...' : title}
              </div>
            </div>

            {/* Bottom bar: meta info */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: `1px solid ${C.border}`,
                paddingTop: '16px',
              }}
            >
              <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
                {/* Chain/Source */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div
                    style={{
                      color: accentColor,
                      fontSize: '18px',
                      fontWeight: 'bold',
                      display: 'flex',
                    }}
                  >
                    {isHive ? '◆' : '⟠'}
                  </div>
                  <div
                    style={{
                      color: C.text,
                      fontSize: '18px',
                      fontWeight: 'bold',
                      display: 'flex',
                    }}
                  >
                    {chain || (isHive ? 'HIVE' : 'BASE')}
                  </div>
                </div>

                {/* Deadline */}
                {deadline && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ color: C.dim, fontSize: '16px', display: 'flex' }}>
                      DEADLINE:
                    </div>
                    <div style={{ color: '#ffbd2e', fontSize: '16px', fontWeight: 'bold', display: 'flex' }}>
                      {deadline}
                    </div>
                  </div>
                )}

                {/* Claims */}
                {parseInt(claims) > 0 && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ color: C.dim, fontSize: '16px', display: 'flex' }}>
                      CLAIMS:
                    </div>
                    <div style={{ color: C.green, fontSize: '16px', fontWeight: 'bold', display: 'flex' }}>
                      {claims}
                    </div>
                  </div>
                )}
              </div>

              {/* Skatehive URL */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ color: C.green, fontSize: '18px', display: 'flex' }}>
                  {'>_'}
                </div>
                <div style={{ color: C.dim, fontSize: '18px', display: 'flex' }}>
                  skatehive.app/bounties
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    );
  } catch {
    // Fallback
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0a0a0a',
            fontFamily: 'monospace',
          }}
        >
          <div style={{ color: '#a7ff00', fontSize: '48px', fontWeight: 'bold', display: 'flex' }}>
            SKATEHIVE BOUNTIES
          </div>
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }
}
