#!/usr/bin/env python3
"""Build the webcam explorer's measured terrain asset from public Terrain Tiles.

Requires Python 3, numpy, Pillow and requests. Run from any directory:
    python3 scripts/build-bay-terrain.py

Source downloads are cached outside the repository. No key is required.
The output remains Terrarium RGB, resampled in elevation space and quantized
to quarter metres. This quantization is precision, not an accuracy claim.
"""

import argparse
import concurrent.futures
import datetime
import hashlib
import io
import json
import math
from pathlib import Path
import tempfile
import time

import numpy as np
from PIL import Image
import requests


BOUNDS = {"west": -122.82, "east": -121.80, "south": 37.28, "north": 38.22}
ZOOM = 12
TILE_SIZE = 256
SOURCE = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"


def mercator_y(lat):
    return (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2


def decode(rgb):
    rgb = np.asarray(rgb, dtype=np.float32)
    return rgb[..., 0] * 256 + rgb[..., 1] + rgb[..., 2] / 256 - 32768


def download_tile(x, y, cache):
    png = cache / f"{ZOOM}-{x}-{y}.png"
    meta_file = png.with_suffix(".json")
    if png.exists() and meta_file.exists():
        blob = png.read_bytes()
        meta = json.loads(meta_file.read_text())
        if hashlib.sha256(blob).hexdigest() == meta["sha256"]:
            return x, y, decode(Image.open(io.BytesIO(blob)).convert("RGB")), meta
    url = SOURCE.format(z=ZOOM, x=x, y=y)
    for attempt in range(3):
        try:
            response = requests.get(url, timeout=35)
            response.raise_for_status()
            blob = response.content
            image = Image.open(io.BytesIO(blob)).convert("RGB")
            if image.size != (TILE_SIZE, TILE_SIZE):
                raise ValueError(f"Unexpected tile dimensions at {url}: {image.size}")
            meta = {
                "x": x, "y": y, "url": url,
                "sha256": hashlib.sha256(blob).hexdigest(),
                "bytes": len(blob),
                "lastModified": response.headers.get("Last-Modified"),
                "etag": response.headers.get("ETag"),
                "versionId": response.headers.get("x-amz-version-id"),
                "sources": response.headers.get("x-amz-meta-x-imagery-sources", ""),
            }
            png.write_bytes(blob)
            meta_file.write_text(json.dumps(meta, indent=2) + "\n")
            return x, y, decode(image), meta
        except (requests.RequestException, OSError, ValueError):
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def sample(grid, lon, lat):
    u = (lon - BOUNDS["west"]) / (BOUNDS["east"] - BOUNDS["west"])
    v = ((mercator_y(lat) - mercator_y(BOUNDS["north"])) /
         (mercator_y(BOUNDS["south"]) - mercator_y(BOUNDS["north"])))
    x = np.clip(u * (grid.shape[1] - 1), 0, grid.shape[1] - 1)
    y = np.clip(v * (grid.shape[0] - 1), 0, grid.shape[0] - 1)
    x0, y0 = int(x), int(y)
    x1, y1 = min(x0 + 1, grid.shape[1] - 1), min(y0 + 1, grid.shape[0] - 1)
    a = grid[y0, x0] * (1 - (x - x0)) + grid[y0, x1] * (x - x0)
    b = grid[y1, x0] * (1 - (x - x0)) + grid[y1, x1] * (x - x0)
    return float(a * (1 - (y - y0)) + b * (y - y0))


def resample_mosaic(mosaic, bounds, offset, width, height, vertical_step):
    west, east, north, south = bounds
    tx0, ty0 = offset
    # Source pixels are cell centered. Destination first/last pixel centers
    # lie on the exact geographic bounds, at uniform Web Mercator spacing.
    xs = np.linspace(west, east, width) - tx0 * TILE_SIZE - .5
    ys = np.linspace(north, south, height) - ty0 * TILE_SIZE - .5
    xi, yi = np.floor(xs).astype(int), np.floor(ys).astype(int)
    xf, yf = (xs - xi)[None, :], (ys - yi)[:, None]
    top = mosaic[yi[:, None], xi[None, :]] * (1 - xf) + mosaic[yi[:, None], xi[None, :] + 1] * xf
    bottom = mosaic[yi[:, None] + 1, xi[None, :]] * (1 - xf) + mosaic[yi[:, None] + 1, xi[None, :] + 1] * xf
    grid = np.maximum(0, top * (1 - yf) + bottom * yf)
    return np.round(grid / vertical_step) * vertical_step


def save_terrarium(grid, path):
    # Keep the unshifted height array separate for validation and metadata.
    shifted = np.empty_like(grid)
    np.add(grid, 32768, out=shifted)
    np.multiply(shifted, 256, out=shifted)
    packed = np.round(shifted).astype(np.uint32)
    rgb = np.stack(((packed >> 16) & 255, (packed >> 8) & 255, packed & 255), axis=-1).astype(np.uint8)
    Image.fromarray(rgb).save(path, optimize=True)
    decoded = decode(Image.open(path).convert("RGB"))
    if not np.array_equal(decoded, grid):
        raise ValueError(f"Terrarium output failed its lossless encoding round trip: {path}")
    return decoded


def build(args):
    args.cache.mkdir(parents=True, exist_ok=True)
    args.output.mkdir(parents=True, exist_ok=True)
    size = TILE_SIZE * (2 ** ZOOM)
    west = (BOUNDS["west"] + 180) / 360 * size
    east = (BOUNDS["east"] + 180) / 360 * size
    north = mercator_y(BOUNDS["north"]) * size
    south = mercator_y(BOUNDS["south"]) * size
    # Include every source pixel needed by bilinear sampling at the boundaries.
    tx0, tx1 = math.floor((west - .5) / TILE_SIZE), math.floor((east + .5) / TILE_SIZE)
    ty0, ty1 = math.floor((north - .5) / TILE_SIZE), math.floor((south + .5) / TILE_SIZE)
    tile_coords = [(x, y) for y in range(ty0, ty1 + 1) for x in range(tx0, tx1 + 1)]
    mosaic = np.full(((ty1 - ty0 + 1) * TILE_SIZE,
                      (tx1 - tx0 + 1) * TILE_SIZE), np.nan, dtype=np.float32)
    manifests = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        jobs = [pool.submit(download_tile, x, y, args.cache) for x, y in tile_coords]
        for count, job in enumerate(concurrent.futures.as_completed(jobs), 1):
            x, y, heights, meta = job.result()
            ox, oy = (x - tx0) * TILE_SIZE, (y - ty0) * TILE_SIZE
            mosaic[oy:oy + TILE_SIZE, ox:ox + TILE_SIZE] = heights
            manifests.append(meta)
            if count % 25 == 0 or count == len(jobs):
                print(f"Terrain tiles {count}/{len(jobs)}", flush=True)
    if not np.isfinite(mosaic).all():
        raise ValueError("Incomplete or invalid elevation mosaic")

    width, height = math.ceil(east - west) + 1, math.ceil(south - north) + 1
    source_bounds, source_offset = (west, east, north, south), (tx0, ty0)
    grid = resample_mosaic(mosaic, source_bounds, source_offset, width, height, args.vertical_step)
    output_png = args.output / "bay-area-elevation.png"
    decoded = save_terrarium(grid, output_png)
    # Resample decoded source elevations, never packed RGB color bytes. The
    # smaller tier has the identical geographic/pixel-center contract.
    mobile_width, mobile_height = math.ceil((east - west) / 2) + 1, math.ceil((south - north) / 2) + 1
    mobile_grid = resample_mosaic(mosaic, source_bounds, source_offset, mobile_width, mobile_height, args.vertical_step)
    mobile_png = args.output / "bay-area-elevation-mobile.png"
    mobile_decoded = save_terrarium(mobile_grid, mobile_png)

    validation = [
        ("Mount Tamalpais East Peak", -122.5965, 37.9235, 650, 850),
        ("Mount Diablo", -121.9143, 37.8816, 1000, 1250),
        ("Pacific Ocean", -122.70, 37.60, 0, 0),
        ("Central Bay", -122.40, 37.85, 0, 2),
    ]
    samples, mobile_samples = [], []
    for name, lon, lat, lower, upper in validation:
        elevation = sample(decoded, lon, lat)
        if not lower <= elevation <= upper:
            raise ValueError(f"Geographic sanity check failed: {name} = {elevation}")
        samples.append({"name": name, "longitude": lon, "latitude": lat,
                        "elevationMetres": round(elevation, 2)})
        mobile_elevation = sample(mobile_decoded, lon, lat)
        if not lower <= mobile_elevation <= upper:
            raise ValueError(f"Mobile geographic sanity check failed: {name} = {mobile_elevation}")
        mobile_samples.append({"name": name, "longitude": lon, "latitude": lat,
                               "elevationMetres": round(mobile_elevation, 2)})
    sources = sorted({s.strip() for tile in manifests for s in tile["sources"].split(",") if s.strip()})
    center_lat = (BOUNDS["north"] + BOUNDS["south"]) / 2
    nominal_spacing = math.cos(math.radians(center_lat)) * 2 * math.pi * 6378137 / size
    metadata = {
        "file": output_png.name,
        "width": width, "height": height, "bounds": BOUNDS,
        "projection": "EPSG:3857",
        "encoding": "Terrarium RGB: elevationMetres = R * 256 + G + B / 256 - 32768",
        "verticalQuantizationMetres": args.vertical_step,
        "pixelConvention": "First and last pixel centers coincide with geographic bounds. Columns increase west to east; rows increase north to south. Rows are uniformly spaced in Web Mercator, not latitude.",
        "sampling": {
            "u": "(longitude - west) / (east - west)",
            "v": "(merc(latitude) - merc(south)) / (merc(north) - merc(south)); merc(lat) = log(tan(pi/4 + lat*pi/360))",
            "cpu": "x = u * (width - 1); y = (1 - v) * (height - 1); bilinear decoded elevations",
            "texture": "For a flipY=true texture: uv = (vec2(u, v) * (textureSize - 1) + 0.5) / textureSize; no sRGB color transform.",
        },
        "sourceZoom": ZOOM,
        "nominalSourceSpacingMetresAtCenter": round(nominal_spacing, 3),
        "sourceTileCount": len(manifests),
        "sourceUrlTemplate": SOURCE,
        "sourceDocumentation": "https://github.com/tilezen/joerd/blob/master/docs/data-sources.md",
        "encodingDocumentation": "https://github.com/tilezen/joerd/blob/master/docs/formats.md",
        "attribution": "Terrain data courtesy of the U.S. Geological Survey and NOAA; processed by Mapzen Terrain Tiles.",
        "attributionDocumentation": "https://github.com/tilezen/joerd/blob/master/docs/attribution.md",
        "license": "USGS 3DEP/NED, SRTM, GMTED2010 and NOAA ETOPO1 source products are public-domain U.S. government data. See the linked attribution documentation for source details.",
        "modifications": ["Bilinear resampling of decoded elevation onto fixed geographic bounds in Web Mercator.",
                          "Below-sea-level terrain and bathymetry clamped to 0 metres for the water surface.",
                          f"Elevations rounded to {args.vertical_step:g} metre increments and re-encoded as Terrarium RGB."],
        "limitations": "This is an approximate 30-metre terrain visualization derived from archived terrain tiles, not current surveying data. Source survey dates, source resolutions, vertical datums and artifacts vary. Quantization precision does not imply vertical accuracy. Clamping removes below-sea-level dry land as well as bathymetry.",
        "sourceDatasets": sources,
        "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "sha256": hashlib.sha256(output_png.read_bytes()).hexdigest(),
        "bytes": output_png.stat().st_size,
        "elevationRangeMetres": [float(grid.min()), float(grid.max())],
        "sanityCheckSamples": samples,
        "mobile": {
            "file": mobile_png.name,
            "width": mobile_width, "height": mobile_height,
            "bounds": BOUNDS, "projection": "EPSG:3857",
            "encoding": "Terrarium RGB: elevationMetres = R * 256 + G + B / 256 - 32768",
            "pixelConvention": "Same pixel-center and Web Mercator contract as the desktop asset; use this variant's width and height.",
            "verticalQuantizationMetres": args.vertical_step,
            "nominalGridSpacingMetresAtCenter": round(nominal_spacing * (east - west) / (mobile_width - 1), 3),
            "modifications": "Independently bilinearly sampled from the same decoded zoom-12 source mosaic at half the raster density, clamped to sea level, quantized and re-encoded. No image-color resizing.",
            "bytes": mobile_png.stat().st_size,
            "sha256": hashlib.sha256(mobile_png.read_bytes()).hexdigest(),
            "elevationRangeMetres": [float(mobile_grid.min()), float(mobile_grid.max())],
            "sanityCheckSamples": mobile_samples,
        },
        "tiles": sorted(manifests, key=lambda tile: (tile["y"], tile["x"])),
    }
    (args.output / "bay-area-elevation.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(json.dumps({k: metadata[k] for k in ["width", "height", "bytes", "sha256", "nominalSourceSpacingMetresAtCenter", "elevationRangeMetres", "sanityCheckSamples", "mobile"]}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=Path(tempfile.gettempdir()) / "ricburton-terrain-z12")
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "data")
    parser.add_argument("--vertical-step", type=float, default=.25,
                        choices=[1 / 256, .25, .5, 1], help="Terrarium output elevation quantization in metres")
    build(parser.parse_args())
