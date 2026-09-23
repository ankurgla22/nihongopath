/**
 * Loads Noto Sans JP without blocking first paint.
 *
 * Through next/font the same font arrived as a 287 KB (96 KB gzipped) stylesheet of 372
 * unicode-range @font-face rules, inlined into the page CSS and therefore render-blocking:
 * Lighthouse measured it at 1.4 s of the mobile LCP. Loading Google's stylesheet with
 * media="print" fetches it at low priority off the critical path; the inline script flips
 * it to "all" once it has loaded, and <noscript> covers browsers without JavaScript.
 * Text renders immediately in the device's CJK font and swaps when the web font is ready.
 *
 * CSP already allows fonts.googleapis.com for styles and fonts.gstatic.com for fonts.
 */
/**
 * display=optional: if the font is not ready within the browser's short block period it is
 * simply not used for that page view, and the device's CJK font stays. No late swap, so no
 * layout shift and no second, later "largest paint" for Lighthouse to count as LCP. The font is
 * cached after the first visit and used from the second page onwards.
 */
const HREF = "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=optional";

export function JapaneseFont() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link id="jp-font" rel="stylesheet" href={HREF} media="print" />
      <script
        dangerouslySetInnerHTML={{
          __html: "(function(){var l=document.getElementById('jp-font');if(!l)return;function on(){l.media='all'}l.addEventListener('load',on);try{if(l.sheet&&l.sheet.cssRules.length)on()}catch(e){}})();",
        }}
      />
      <noscript>
        <link rel="stylesheet" href={HREF} />
      </noscript>
    </>
  );
}
