import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const C = {
  bg: '#050505',
  green: '#a7ff00',
  greenDim: 'rgba(167, 255, 0, 0.10)',
  greenGlow: 'rgba(167, 255, 0, 0.25)',
  text: '#f0f0f0',
  dim: '#888',
  border: '#222',
} as const;

async function getEthPrice(): Promise<number> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return data?.ethereum?.usd || 0;
  } catch {
    return 0;
  }
}

function formatUsd(usd: number): string {
  if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}k`;
  if (usd >= 100) return `$${Math.round(usd)}`;
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(4)}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const title = searchParams.get('title') || 'Skatehive Bounty';
    const rawAmount = searchParams.get('amount') || '0';
    const currency = searchParams.get('currency') || 'ETH';
    const source = searchParams.get('source') || 'poidh';
    const chain = searchParams.get('chain') || '';
    const status = searchParams.get('status') || 'OPEN';
    const claims = searchParams.get('claims') || '0';
    const format = searchParams.get('format') || 'og';

    const isFrame = format === 'frame';
    const W = 1200;
    const H = isFrame ? 800 : 630;

    const amountNum = parseFloat(rawAmount);
    const isNumericAmount = !isNaN(amountNum) && amountNum > 0;
    const amount = !isNumericAmount
      ? rawAmount
      : amountNum >= 1 ? amountNum.toFixed(2)
      : amountNum >= 0.01 ? amountNum.toFixed(3)
      : amountNum >= 0.001 ? amountNum.toFixed(4)
      : amountNum.toFixed(6);

    const isHive = source === 'hive';
    const isOpen = status === 'OPEN';

    const baseUrl = request.nextUrl.origin;
    const ethUrl = `${baseUrl}/images/ethvector.svg`;
    const poidhUrl = `${baseUrl}/images/poidh-icon.png`;

    // Get USD value for ETH bounties
    let usdValue = '';
    if (isNumericAmount && !isHive) {
      const ethPrice = await getEthPrice();
      if (ethPrice > 0) {
        usdValue = formatUsd(amountNum * ethPrice);
      }
    }

    // Dynamic font sizing
    const amountLen = amount.length;
    const amountFontSize = amountLen > 10 ? 48 : amountLen > 7 ? 56 : amountLen > 5 ? 68 : 80;

    const claimCount = parseInt(claims);

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            position: 'relative',
            fontFamily: 'monospace',
            overflow: 'hidden',
            backgroundColor: C.bg,
          }}
        >
          {/* Radial gradient background — dramatic spotlight */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'radial-gradient(ellipse 80% 60% at 50% 35%, rgba(167,255,0,0.06) 0%, transparent 70%)',
              display: 'flex',
            }}
          />

          {/* Diagonal accent lines — subtle grid pattern */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'repeating-linear-gradient(135deg, transparent, transparent 60px, rgba(167,255,0,0.015) 60px, rgba(167,255,0,0.015) 61px)',
              display: 'flex',
            }}
          />

          {/* Left accent bar */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '5px',
              height: '100%',
              background: `linear-gradient(180deg, transparent 5%, ${C.green} 30%, ${C.green} 70%, transparent 95%)`,
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
              padding: isFrame ? '50px 70px' : '40px 70px',
            }}
          >
            {/* === TOP BAR === */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              {/* SKATEHIVE / BOUNTY */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    color: C.green,
                    fontSize: '22px',
                    fontWeight: '900',
                    display: 'flex',
                    letterSpacing: '6px',
                  }}
                >
                  SKATEHIVE
                </div>
                <div style={{ color: C.dim, fontSize: '22px', display: 'flex' }}>/</div>
                <div
                  style={{
                    color: C.dim,
                    fontSize: '16px',
                    display: 'flex',
                    letterSpacing: '4px',
                  }}
                >
                  BOUNTY
                </div>
              </div>

              {/* Status + chain badges */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {/* Chain badge */}
                {chain && (
                  <div
                    style={{
                      display: 'flex',
                      border: `1px solid ${C.border}`,
                      padding: '5px 14px',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(0,0,0,0.5)',
                    }}
                  >
                    {!isHive && (
                      <img src={ethUrl} alt="" width={14} height={14} style={{ opacity: 0.7 }} />
                    )}
                    <div
                      style={{
                        color: C.dim,
                        fontSize: '13px',
                        fontWeight: 'bold',
                        display: 'flex',
                        letterSpacing: '2px',
                      }}
                    >
                      {chain}
                    </div>
                  </div>
                )}
                {/* Status */}
                <div
                  style={{
                    display: 'flex',
                    padding: '5px 16px',
                    background: isOpen ? 'rgba(167,255,0,0.12)' : 'rgba(255,95,86,0.12)',
                    border: `1px solid ${isOpen ? C.green : '#ff5f56'}`,
                  }}
                >
                  <div
                    style={{
                      color: isOpen ? C.green : '#ff5f56',
                      fontSize: '13px',
                      fontWeight: '900',
                      display: 'flex',
                      letterSpacing: '3px',
                    }}
                  >
                    {status}
                  </div>
                </div>
              </div>
            </div>

            {/* === CENTER: The Prize === */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: isFrame ? '18px' : '12px',
              }}
            >
              {/* Tagline */}
              <div
                style={{
                  color: C.green,
                  fontSize: '20px',
                  fontWeight: '900',
                  display: 'flex',
                  letterSpacing: '10px',
                  opacity: 0.7,
                }}
              >
                {isNumericAmount ? (isOpen ? 'CAN YOU LAND IT?' : 'BOUNTY CLOSED') : 'SKATE TRICK BOUNTIES'}
              </div>

              {/* Main amount display — only when we have a real amount */}
              {isNumericAmount ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '18px',
                  }}
                >
                  {/* ETH icon */}
                  {!isHive && (
                    <img
                      src={ethUrl}
                      alt=""
                      width={amountFontSize * 0.55}
                      height={amountFontSize * 0.55}
                      style={{ opacity: 0.9 }}
                    />
                  )}

                  {/* Amount */}
                  <div
                    style={{
                      color: C.text,
                      fontSize: `${amountFontSize}px`,
                      fontWeight: '900',
                      display: 'flex',
                      lineHeight: '1',
                      letterSpacing: '-2px',
                    }}
                  >
                    {amount}
                  </div>

                  {/* Currency */}
                  {currency && (
                    <div
                      style={{
                        color: C.green,
                        fontSize: '28px',
                        fontWeight: '900',
                        display: 'flex',
                        letterSpacing: '3px',
                      }}
                    >
                      {currency}
                    </div>
                  )}
              </div>
              ) : null}

              {/* USD value — only for specific bounties */}
              {usdValue && (
                <div
                  style={{
                    display: 'flex',
                    padding: '6px 28px',
                    background: C.greenDim,
                    border: `1px solid rgba(167,255,0,0.2)`,
                  }}
                >
                  <div
                    style={{
                      color: C.green,
                      fontSize: '22px',
                      fontWeight: 'bold',
                      display: 'flex',
                      letterSpacing: '2px',
                    }}
                  >
                    {usdValue} USD
                  </div>
                </div>
              )}

              {/* Separator line */}
              <div
                style={{
                  width: '80px',
                  height: '2px',
                  background: `linear-gradient(90deg, transparent, ${C.green}, transparent)`,
                  display: 'flex',
                  margin: '4px 0',
                }}
              />

              {/* Bounty title */}
              <div
                style={{
                  color: C.text,
                  fontSize: title.length > 50 ? '22px' : title.length > 35 ? '26px' : (isNumericAmount ? '30px' : '42px'),
                  fontWeight: '900',
                  display: 'flex',
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  maxWidth: '900px',
                  lineHeight: '1.3',
                  letterSpacing: '1px',
                }}
              >
                {title.length > 70 ? title.slice(0, 67) + '...' : title}
              </div>

              {/* Claims count */}
              {claimCount > 0 && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ color: C.dim, fontSize: '14px', display: 'flex', letterSpacing: '2px' }}>
                    {claimCount} {claimCount === 1 ? 'CLAIM' : 'CLAIMS'} SUBMITTED
                  </div>
                </div>
              )}
            </div>

            {/* === BOTTOM BAR === */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              {/* Left: skatehive.app */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    color: C.green,
                    fontSize: '16px',
                    fontWeight: '900',
                    display: 'flex',
                    letterSpacing: '3px',
                  }}
                >
                  skatehive.app
                </div>
              </div>

              {/* Right: POIDH branding */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    color: C.dim,
                    fontSize: '12px',
                    display: 'flex',
                    letterSpacing: '2px',
                  }}
                >
                  POWERED BY
                </div>
                <img
                  src={poidhUrl}
                  alt=""
                  width={36}
                  height={36}
                  style={{
                    borderRadius: '50%',
                    opacity: 0.85,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ),
      { width: W, height: H },
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
            backgroundColor: '#050505',
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
