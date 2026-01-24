import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { openDB } from 'idb';

// Basic PWA Setup
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
self.skipWaiting();
clientsClaim();

// Share Target Handler
const SHARE_TARGET_ACTION = '/_share-target';
const DB_NAME = 'nitrate-grain-share';
const STORE_NAME = 'shared-files';

registerRoute(
    ({ url }) => url.pathname === SHARE_TARGET_ACTION,
    async ({ request }) => {
        const formData = await request.formData();
        const file = formData.get('file');

        if (file) {
            const db = await openDB(DB_NAME, 1, {
                upgrade(db) {
                    db.createObjectStore(STORE_NAME);
                },
            });

            // Store the file with a specific key.
            // We can support multiple files in future, but for now we replace the 'latest'.
            await db.put(STORE_NAME, file, 'latest-share');
        }

        return Response.redirect('/?shared_target=true', 303);
    },
    'POST'
);
