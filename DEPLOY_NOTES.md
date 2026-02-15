If the site appears blank after deployment on GitHub Pages, an old service worker or cached files may be interfering.

To clear old service workers and caches from your browser console, run:

```javascript
navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
location.reload();
```

Then reload the page. If you still see issues, open DevTools (Console) and paste any errors here so I can debug further.
