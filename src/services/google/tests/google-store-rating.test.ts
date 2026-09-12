import { expect, it } from 'vitest';
import { parseGoogleStoreRating } from '../google-store-rating';
it('reads the store rating and ignores unrelated JSON-LD', () => {
 expect(parseGoogleStoreRating('<script type="application/ld+json">{"@type":"SoftwareApplication","aggregateRating":{"ratingValue":"4.3817"}}</script>')).toBe(4.3817);
});
it('rejects missing and invalid ratings instead of fabricating a daily value', () => {
 expect(()=>parseGoogleStoreRating('<html>unavailable</html>')).toThrow();
 expect(()=>parseGoogleStoreRating('<script type="application/ld+json">{"aggregateRating":{"ratingValue":"0"}}</script>')).toThrow();
});
