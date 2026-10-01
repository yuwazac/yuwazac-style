// Network-only service worker. Never caches checkout, admin or customer data.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Yuwazac Style — offline</title><body style="font:18px system-ui;padding:30px;background:#fbfaf6;color:#2d4537"><h1>You are offline.</h1><p>Reconnect to load products or place a test order. No order was sent.</p><a href="/">Try again</a></body></html>',{headers:{'Content-Type':'text/html; charset=utf-8'}})))});
