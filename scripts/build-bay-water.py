#!/usr/bin/env python3
"""Rasterize NOAA ENC water polygons into the terrain texture's exact bounds.

Requires Python 3, requests, numpy and Pillow. Downloads are cached in /tmp.
Run from any directory: python3 scripts/build-bay-water.py
This is a visual land/water classification, never a navigation product.
"""

import concurrent.futures
import datetime
import hashlib
import json
import math
from pathlib import Path
import tempfile

import numpy as np
from PIL import Image, ImageDraw
import requests


ROOT = Path(__file__).resolve().parents[1]
SERVICE = "https://encdirect.noaa.gov/arcgis/rest/services/encdirect/enc_coastal/MapServer"
LAYERS = {129: "Canal", 166: "Depth Area", 167: "Dredged Area", 170: "Lake", 174: "River"}
CACHE = Path(tempfile.gettempdir()) / "ricburton-bay-noaa-water"


def mercator(lat):
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def build():
    terrain = json.loads((ROOT / "data/bay-area-elevation.json").read_text())
    bounds = terrain["bounds"]
    width, height = terrain["width"], terrain["height"]
    north, south = mercator(bounds["north"]), mercator(bounds["south"])

    def xy(point):
        return ((point[0] - bounds["west"]) / (bounds["east"] - bounds["west"]) * (width - 1),
                (north - mercator(point[1])) / (north - south) * (height - 1))

    params = {
        "where": "1=1",
        "geometry": ",".join(str(bounds[k]) for k in ("west", "south", "east", "north")),
        "geometryType": "esriGeometryEnvelope", "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects", "outFields": "*", "outSR": "4326",
        "returnGeometry": "true", "f": "geojson",
    }
    CACHE.mkdir(parents=True, exist_ok=True)

    def download(layer):
        url = requests.Request("GET", f"{SERVICE}/{layer}/query", params=params).prepare().url
        cache_file = CACHE / f"{layer}-{hashlib.sha256(url.encode()).hexdigest()[:12]}.geojson"
        if cache_file.exists():
            blob = cache_file.read_bytes()
        else:
            response = requests.get(url, timeout=45)
            response.raise_for_status()
            blob = response.content
        data = json.loads(blob)
        if "features" not in data or data.get("exceededTransferLimit"):
            raise ValueError(f"Incomplete NOAA layer {layer}: {data.get('error', 'transfer limit')}")
        cache_file.write_bytes(blob)
        return layer, data, {"layer": LAYERS[layer], "url": url,
                            "featureCount": len(data["features"]),
                            "sha256": hashlib.sha256(blob).hexdigest(), "bytes": len(blob)}

    mask = np.zeros((height, width), dtype=np.uint8)
    manifests, charts = [], set()
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        for layer, data, manifest in pool.map(download, LAYERS):
            for feature in data["features"]:
                geometry = feature["geometry"]
                if geometry is None:
                    continue
                if geometry["type"] not in ("Polygon", "MultiPolygon"):
                    raise ValueError(f"Unexpected NOAA geometry {geometry['type']}")
                chart = feature["properties"].get("DSNM")
                if chart:
                    charts.add(chart)
                polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
                for polygon in polygons:
                    # Draw each polygon separately: holes must never erase a
                    # different chart's overlapping valid water polygon.
                    one = Image.new("L", (width, height), 0)
                    draw = ImageDraw.Draw(one)
                    for index, ring in enumerate(polygon):
                        draw.polygon([xy(point) for point in ring], fill=255 if index == 0 else 0)
                    np.maximum(mask, np.asarray(one), out=mask)
            manifests.append(manifest)
            print(f"NOAA {LAYERS[layer]}: {len(data['features'])} polygons", flush=True)

    checks = []
    for name, lon, lat, water in [
        ("Pacific Ocean", -122.70, 37.60, True),
        ("Golden Gate", -122.48, 37.82, True),
        ("Central Bay", -122.40, 37.85, True),
        ("San Pablo Bay", -122.39, 38.05, True),
        ("South Bay", -122.20, 37.60, True),
        ("Mount Tamalpais", -122.5965, 37.9235, False),
        ("Mount Diablo", -121.9143, 37.8816, False),
        ("San Francisco", -122.44, 37.76, False),
        ("Berkeley", -122.27, 37.87, False),
        ("San Francisco Airport", -122.375, 37.615, False),
        ("Alameda", -122.26, 37.77, False),
        ("Angel Island", -122.432, 37.861, False),
    ]:
        x, y = xy((lon, lat))
        actual = bool(mask[round(y), round(x)])
        if actual != water:
            raise ValueError(f"Water coverage check failed at {name}: {actual}")
        checks.append({"name": name, "longitude": lon, "latitude": lat, "water": actual})

    output = ROOT / "data/bay-area-water.png"
    Image.fromarray(mask).save(output, optimize=True)
    blob = output.read_bytes()
    metadata = {
        "file": output.name, "width": width, "height": height,
        "bounds": bounds, "projection": "EPSG:3857",
        "encoding": "Single-channel 8-bit PNG. 255 = charted water; 0 = land or inland area not covered by charted water polygons.",
        "pixelConvention": terrain["pixelConvention"], "sampling": terrain["sampling"],
        "source": SERVICE, "sourceLayers": manifests, "sourceCharts": sorted(charts),
        "attribution": "Water polygons provided by NOAA Office of Coast Survey, ENC Direct to GIS.",
        "license": "Public-domain U.S. government chart data. NOAA Office of Coast Survey publishes its products with no restrictions on use.",
        "licenseDocumentation": "https://www.nauticalcharts.noaa.gov/data/data-licensing.html",
        "sourceDocumentation": "https://encdirect.noaa.gov/help/encdirect_help.html",
        "modifications": ["Water feature polygons were reprojected from WGS84 to the terrain's Web Mercator grid.",
                          "Charted depth, dredged, lake, river and canal areas were rasterized and combined; no elevation threshold determines this coastline."],
        "limitations": "Coastal ENC chart detail and survey dates vary; the texture's roughly 30 m raster spacing is not a shoreline accuracy claim. Charted intertidal areas may be included. Inland water not included in these coastal charts remains unclassified. Water at inland elevation must not be flattened to sea level. For visual presentation only, never navigation.",
        "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "sha256": hashlib.sha256(blob).hexdigest(), "bytes": len(blob),
        "waterFraction": float(np.mean(mask) / 255), "sanityCheckSamples": checks,
    }
    output.with_suffix(".json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(f"Wrote {output.name}: {width}×{height}, {len(blob):,} bytes; {len(checks)} geography checks passed")


if __name__ == "__main__":
    build()
