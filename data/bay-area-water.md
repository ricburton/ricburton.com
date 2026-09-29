# Bay Area water classification

`bay-area-water.png` uses real NOAA electronic chart polygons to distinguish
water from nearby low-lying land. It has the same pixel-center bounds and
Web Mercator grid as `bay-area-elevation.png`. White (255) means charted water;
black (0) means land or inland area not covered by these charted polygons.
Use it as a data texture, without an sRGB transform. It is a classification
mask, not a height map: inland lakes must retain their terrain elevation.

The polygons come from [NOAA ENC Direct to GIS](https://encdirect.noaa.gov/arcgis/rest/services/encdirect/enc_coastal/MapServer):
depth areas, dredged areas, lakes, rivers, and canals. The JSON sidecar records
the exact query URLs, source response hashes, source charts, modifications,
and checked land/water locations. Chart detail varies, and the approximately
30-metre raster spacing does not imply 30-metre shoreline accuracy. Intertidal
areas can be included; inland waters absent from coastal charts remain absent.
This is a visual map layer, unsuitable for navigation.

Credit: **Water polygons provided by NOAA Office of Coast Survey, ENC Direct to GIS.**
NOAA publishes its chart products with no restrictions on use; see its
[data licensing policy](https://www.nauticalcharts.noaa.gov/data/data-licensing.html).

Rebuild using Python with requests, numpy and Pillow installed:

```sh
python3 scripts/build-bay-water.py
```

Source queries are cached under the system temporary directory. Remove that
specific cache directory (`ricburton-bay-noaa-water`) to request new source data.
