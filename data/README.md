# Bay Area terrain

`bay-area-elevation.png` supplies measured elevations for the webcam explorer.
It contains 2,972 × 3,464 samples over the explorer's existing Bay Area bounds,
derived from 195 zoom-12 [Mapzen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/).
The source tile spacing is approximately 30.2 metres at the center of the map.
This describes the elevation raster; the interactive mesh uses fewer vertices.

`bay-area-elevation-mobile.png` is a 1,487 × 1,733 variant with approximately
60.4-metre grid spacing and a 1.89 MB download (desktop: 5.90 MB). It uses the
same bounds, pixel-center convention, encoding and quarter-metre precision.
It is sampled independently from the decoded source elevation mosaic; it is
not a resized copy of the encoded RGB image. The metadata's `mobile` object
records its dimensions, checksum, spacing and geographic sanity checks.
Both dimensions fit within a 2,048-pixel texture limit.

The underlying sources include USGS 3DEP/NED (including California topobathy),
SRTM and GMTED2010, and NOAA ETOPO1. These are public-domain U.S. government
products. Terrain data courtesy of the U.S. Geological Survey and NOAA;
processed by Mapzen Terrain Tiles. See the provider's
[source documentation](https://github.com/tilezen/joerd/blob/master/docs/data-sources.md)
and [attribution information](https://github.com/tilezen/joerd/blob/master/docs/attribution.md).
The JSON file records source names, source tile URLs, hashes, version IDs and
modification dates. The source mosaic is archived data, with surveys of varying
ages; downloading it now does not make it a current survey.

## Encoding and coordinates

Decode standard [Terrarium RGB](https://github.com/tilezen/joerd/blob/master/docs/formats.md):

```js
const metres = red * 256 + green + blue / 256 - 32768;
```

The asset has no color-space transform. Do not apply sRGB decoding or lossy
image compression. The blue channel preserves quarter-metre increments.
That is storage precision, not a claim of quarter-metre survey accuracy.

First and last **pixel centers** are exactly on the bounds:
west −122.82°, east −121.80°, south 37.28°, north 38.22°.
Columns run west to east, rows north to south. The rows are uniformly spaced
in Web Mercator, not latitude. With `merc(lat) = log(tan(pi/4 + lat*pi/360))`:

```js
const u = (lon - west) / (east - west);
const v = (merc(lat) - merc(south)) / (merc(north) - merc(south));
const x = u * (width - 1);
const y = (1 - v) * (height - 1);
// Bilinearly sample decoded elevations at (x, y).
// For a Three.js texture with flipY=true, account for pixel centers:
// textureUV = (vec2(u, v) * (textureSize - 1) + 0.5) / textureSize
```

The processing bilinearly resamples decoded elevations to these fixed bounds,
clamps negative heights to sea level for the water surface, and rounds to
0.25 metres. Clamping also removes below-sea-level dry terrain. Source errors,
coastline seams and different source vertical datums remain possible. The
result is a terrain visualization, not a surveying or navigation dataset.

## Regeneration

Use Python 3 with `numpy`, `Pillow` and `requests` installed:

```sh
python3 scripts/build-bay-terrain.py
```

The script caches source tiles in the system temporary directory, downloads
with eight workers, fails if a tile is missing, validates the encoding round
trip, and checks two mountain and two sea-level coordinates in each variant.
It creates both PNGs and their shared JSON metadata. The PNGs are reproducible
from the recorded source tiles; metadata includes a new generation timestamp.
`--cache` and `--output`
override the corresponding directories. All assets are served from this site
at runtime, so viewers need no elevation-service credentials or third-party
elevation requests.
