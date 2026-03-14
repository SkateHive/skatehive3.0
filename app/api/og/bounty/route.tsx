import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const C = {
  bg: '#0a0a0a',
  green: '#a7ff00',
  greenDim: 'rgba(167, 255, 0, 0.15)',
  text: '#e0e0e0',
  dim: '#888',
  border: '#333',
  ethBlue: '#627EEA',
  hiveRed: '#E31337',
} as const;

// Inline ETH diamond as a data URI PNG won't work in edge, so we draw it with divs
function EthDiamond({ size = 28, color = C.ethBlue }: { size?: number; color?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      <div
        style={{
          width: `${size * 0.6}px`,
          height: `${size * 0.6}px`,
          background: color,
          transform: 'rotate(45deg)',
          display: 'flex',
        }}
      />
    </div>
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const title = searchParams.get('title') || 'Skatehive Bounty';
    const rawAmount = searchParams.get('amount') || '0';
    const amountNum = parseFloat(rawAmount);
    const amount = isNaN(amountNum) ? '0'
      : amountNum >= 1 ? amountNum.toFixed(2)
      : amountNum >= 0.01 ? amountNum.toFixed(3)
      : amountNum.toFixed(4);
    const currency = searchParams.get('currency') || 'ETH';
    const source = searchParams.get('source') || 'poidh';
    const chain = searchParams.get('chain') || '';
    const status = searchParams.get('status') || 'OPEN';
    const deadline = searchParams.get('deadline') || '';
    const claims = searchParams.get('claims') || '0';

    const isHive = source === 'hive';
    const accentColor = isHive ? C.hiveRed : C.ethBlue;
    const statusColor = status === 'OPEN' ? '#27c93f' : status === 'CANCELLED' ? '#ffbd2e' : '#ff5f56';

    const baseUrl = request.nextUrl.origin;
    const bgUrl = `${baseUrl}/images/moneybag.png`;

    // Font size scales with amount length
    const amountFontSize = amount.length > 6 ? 52 : amount.length > 4 ? 60 : 72;

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

          {/* Dark overlay */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.85) 100%)',
              display: 'flex',
            }}
          />

          {/* Content — extra horizontal padding for Farcaster frame cropping */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '44px 80px',
            }}
          >
            {/* Top bar */}
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
                    fontSize: '26px',
                    fontWeight: 'bold',
                    display: 'flex',
                    letterSpacing: '3px',
                  }}
                >
                  SKATEHIVE
                </div>
                <div style={{ color: C.dim, fontSize: '26px', display: 'flex' }}>/</div>
                <div
                  style={{
                    color: C.dim,
                    fontSize: '20px',
                    display: 'flex',
                    letterSpacing: '2px',
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
                  padding: '6px 24px',
                  background: 'rgba(0,0,0,0.5)',
                }}
              >
                <div
                  style={{
                    color: statusColor,
                    fontSize: '18px',
                    fontWeight: 'bold',
                    display: 'flex',
                    letterSpacing: '3px',
                  }}
                >
                  {status}
                </div>
              </div>
            </div>

            {/* Center: Reward + Title */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '24px',
              }}
            >
              {/* Reward box */}
              <div
                style={{
                  display: 'flex',
                  border: `3px solid ${C.green}`,
                  padding: '18px 50px',
                  background: 'rgba(0, 0, 0, 0.65)',
                  alignItems: 'center',
                  gap: '18px',
                  boxShadow: `0 0 30px ${C.greenDim}`,
                }}
              >
                {/* ETH diamond or Hive diamond */}
                <EthDiamond size={amountFontSize * 0.45} color={accentColor} />

                <div
                  style={{
                    color: C.green,
                    fontSize: `${amountFontSize}px`,
                    fontWeight: '900',
                    display: 'flex',
                    lineHeight: '1',
                    letterSpacing: '-1px',
                  }}
                >
                  {amount}
                </div>
                <div
                  style={{
                    color: C.dim,
                    fontSize: '28px',
                    fontWeight: 'bold',
                    display: 'flex',
                    marginLeft: '4px',
                  }}
                >
                  {currency}
                </div>
              </div>

              {/* Title */}
              <div
                style={{
                  color: C.text,
                  fontSize: title.length > 40 ? '30px' : '36px',
                  fontWeight: 'bold',
                  display: 'flex',
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  maxWidth: '850px',
                  lineHeight: '1.3',
                }}
              >
                {title.length > 60 ? title.slice(0, 57) + '...' : title}
              </div>
            </div>

            {/* Bottom bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: `1px solid ${C.border}`,
                paddingTop: '16px',
              }}
            >
              <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                {/* Chain */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <EthDiamond size={16} color={accentColor} />
                  <div
                    style={{
                      color: C.text,
                      fontSize: '16px',
                      fontWeight: 'bold',
                      display: 'flex',
                    }}
                  >
                    {chain || (isHive ? 'HIVE' : 'BASE')}
                  </div>
                </div>

                {/* Deadline */}
                {deadline && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <div style={{ color: C.dim, fontSize: '14px', display: 'flex' }}>DEADLINE:</div>
                    <div style={{ color: '#ffbd2e', fontSize: '14px', fontWeight: 'bold', display: 'flex' }}>{deadline}</div>
                  </div>
                )}

                {/* Claims */}
                {parseInt(claims) > 0 && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <div style={{ color: C.dim, fontSize: '14px', display: 'flex' }}>CLAIMS:</div>
                    <div style={{ color: C.green, fontSize: '14px', fontWeight: 'bold', display: 'flex' }}>{claims}</div>
                  </div>
                )}
              </div>

              {/* Skatehive URL */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ color: C.green, fontSize: '16px', display: 'flex' }}>{'>_'}</div>
                <div style={{ color: C.dim, fontSize: '16px', display: 'flex' }}>skatehive.app</div>
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
