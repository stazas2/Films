import Hls from 'hls.js';

export function createHls(videoEl: HTMLVideoElement, src: string): Hls | null {
  if (Hls.isSupported()) {
    const hls = new Hls({
      // Route all requests through our CORS proxy
      xhrSetup: (xhr, url) => {
        // If the URL is already proxied, leave it
        if (url.startsWith('/api/proxy')) {
          xhr.open('GET', url, true);
          return;
        }
        // Proxy external URLs
        xhr.open('GET', `/api/proxy?url=${encodeURIComponent(url)}`, true);
      },
    });

    hls.loadSource(src);
    hls.attachMedia(videoEl);

    return hls;
  }

  // Native HLS support (Safari)
  if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
    videoEl.src = src;
    return null;
  }

  console.error('HLS is not supported in this browser');
  return null;
}

export function destroyHls(hls: Hls | null) {
  if (hls) {
    hls.destroy();
  }
}
