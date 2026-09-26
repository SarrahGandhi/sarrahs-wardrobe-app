# Local demo wardrobe photos

These existing product photos are fixtures for the local demo account. Each JPEG is
mapped to one seeded wardrobe item in `photos.json`, which records the original
product ID, product name, image URL, and source dataset.

Source: [ceyda/fashion-products-small](https://huggingface.co/datasets/ceyda/fashion-products-small),
a test dataset derived from Param Aggarwal's
[Fashion Product Images dataset](https://www.kaggle.com/datasets/paramaggarwal/fashion-product-images-dataset).
The gold-hoop photo is from [Unsplash](https://unsplash.com/photos/a-pair-of-gold-hoop-earrings-on-a-white-surface-Tqnxvv2fvAc) under the Unsplash License.
Other original images are served by Myntra's product-image CDN. They depict real products
and may show brand marks or models. They are approximate visual examples, not
photos of the user's possessions: cut, fabric, pattern, and other details may differ
from the synthetic seed attributes. Source records remain in the manifest so these
can be replaced with owned/licensed production photography before distribution.

Run `npm run supabase:seed` with the local Supabase stack running. The seed uploads
these checked-in JPEGs into the private `wardrobe-images` bucket, fills only missing
item photo references, and verifies that signed URLs work. No external downloads or
image-generation API calls are needed when seeding. Existing user photos are kept.
