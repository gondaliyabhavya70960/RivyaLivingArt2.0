import Script from "next/script";

/**
 * Env-gated marketing tags (MKT-002) — Meta Pixel and/or GA4. OFF BY DEFAULT:
 * renders nothing unless `NEXT_PUBLIC_META_PIXEL_ID` / `NEXT_PUBLIC_GA_ID` are
 * set, so no third-party tracking ships until you deliberately enable it.
 * Loaded `afterInteractive` so tags never block hydration or LCP.
 *
 * WhatsApp-CTA conversions are reported as a Meta `Contact` event from
 * `WhatsAppTracker`. NOTE: enable only alongside a consent mechanism
 * appropriate to your audience/jurisdiction, and the CSP (report-only today)
 * already allow-lists the Meta/Google hosts for when you flip it on.
 */
export function MarketingScripts() {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();
  const gaId = process.env.NEXT_PUBLIC_GA_ID?.trim();
  if (!pixelId && !gaId) return null;

  return (
    <>
      {pixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${pixelId}');fbq('track','PageView');`}
        </Script>
      )}
      {gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`}
          </Script>
        </>
      )}
    </>
  );
}
