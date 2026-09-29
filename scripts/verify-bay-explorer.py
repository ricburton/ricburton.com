#!/usr/bin/env python3
"""Offline Bay explorer regression checks (Python, Pillow, numpy and Node).

Run from any directory: python3 scripts/verify-bay-explorer.py
Checks shipped assets and the actual JavaScript CPU samplers. Does not claim
browser rendering, GPU performance, accessibility or current webcam availability.
"""

import hashlib
from html.parser import HTMLParser
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from urllib.parse import parse_qs, urlparse

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]


def require(condition, message):
    if not condition:
        raise AssertionError(message)


class Modules(HTMLParser):
    def __init__(self):
        super().__init__()
        self.active = False
        self.blocks = []

    def handle_starttag(self, tag, attrs):
        if tag == "script" and dict(attrs).get("type") == "module":
            self.active = True
            self.blocks.append("")

    def handle_endtag(self, tag):
        if tag == "script":
            self.active = False

    def handle_data(self, data):
        if self.active:
            self.blocks[-1] += data


def function_source(script, name):
    """Extract these small numerical functions without rewriting their logic."""
    start = script.index("function " + name + "(")
    brace = script.index("{", start)
    depth = 1
    end = brace + 1
    while depth:
        depth += (script[end] == "{") - (script[end] == "}")
        end += 1
    return script[start:end]


def merc(latitude):
    return math.asinh(math.tan(math.radians(latitude)))


def load_asset(stem, metadata=None):
    if metadata is None:
        metadata = json.loads((ROOT / "data" / (stem + ".json")).read_text())
    path = ROOT / "data" / metadata["file"]
    blob = path.read_bytes()
    require(hashlib.sha256(blob).hexdigest() == metadata["sha256"], stem + " checksum")
    require(len(blob) == metadata["bytes"], stem + " byte count")
    image = Image.open(path)
    image.load()
    require(image.size == (metadata["width"], metadata["height"]), stem + " dimensions")
    return metadata, image


def main():
    node = shutil.which("node")
    require(node, "Node is required for checking the shipped module and numerical functions")
    parser = Modules()
    parser.feed((ROOT / "webcams.html").read_text())
    require(len(parser.blocks) == 1, "Expected one explorer JavaScript module")
    script = parser.blocks[0]
    subprocess.run([node, "--check", "--input-type=module"], input=script, text=True, check=True)
    print("PASS: shipped JavaScript module parses")

    meta, terrain = load_asset("bay-area-elevation")
    bounds = meta["bounds"]
    width, height = terrain.size
    rgb = np.asarray(terrain.convert("RGB"), dtype=np.float64)
    elevations = rgb[:, :, 0] * 256 + rgb[:, :, 1] + rgb[:, :, 2] / 256 - 32768
    require(np.isfinite(elevations).all(), "Terrain contains non-finite elevations")
    require(np.all(elevations >= 0), "Sea-level-clamped terrain contains negative elevations")
    require(np.allclose([elevations.min(), elevations.max()], meta["elevationRangeMetres"]),
            "Terrain range differs from the source manifest")
    quantized = elevations / meta["verticalQuantizationMetres"]
    require(np.allclose(quantized, np.rint(quantized)), "Terrain encoding lost its stated quantization")
    north, south = merc(bounds["north"]), merc(bounds["south"])

    def xy(lon, lat):
        return ((lon - bounds["west"]) / (bounds["east"] - bounds["west"]) * (width - 1),
                (north - merc(lat)) / (north - south) * (height - 1))

    def sample(lon, lat, image=terrain):
        w, h = image.size
        x = (lon - bounds["west"]) / (bounds["east"] - bounds["west"]) * (w - 1)
        y = (north - merc(lat)) / (north - south) * (h - 1)
        x, y = max(0, min(w - 1, x)), max(0, min(h - 1, y))
        ix, iy = min(w - 2, math.floor(x)), min(h - 2, math.floor(y))
        fx, fy = x - ix, y - iy
        def at(x, y):
            r, g, b = image.getpixel((x, y))[:3]
            return r * 256 + g + b / 256 - 32768
        top = at(ix, iy) * (1 - fx) + at(ix + 1, iy) * fx
        bottom = at(ix, iy + 1) * (1 - fx) + at(ix + 1, iy + 1) * fx
        return float(top * (1 - fy) + bottom * fy)

    landmarks = [
        ("Mount Tamalpais East Peak", -122.5965, 37.9235, 700, 850),
        ("Mount Diablo", -121.9143, 37.8816, 1100, 1250),
        ("San Bruno Mountain", -122.4364, 37.6872, 300, 450),
        ("Pacific Ocean", -122.7, 37.6, 0, 0.01),
        ("Central Bay", -122.4, 37.85, 0, 0.01),
    ]
    for name, lon, lat, low, high in landmarks:
        value = sample(lon, lat)
        require(low <= value <= high, f"{name}: elevation {value:.2f} outside {low}–{high} m")
    for point in meta["sanityCheckSamples"]:
        value = sample(point["longitude"], point["latitude"])
        require(abs(value - point["elevationMetres"]) < 0.02, point["name"] + " manifest roundtrip")
    print("PASS: DEM checksum, encoding, orientation and known peak/ocean elevations")
    mobile_meta, mobile_terrain = load_asset("bay-area-elevation-mobile", meta["mobile"])
    require(mobile_meta["bounds"] == bounds, "Mobile DEM geographic bounds")
    for point in mobile_meta["sanityCheckSamples"]:
        value = sample(point["longitude"], point["latitude"], mobile_terrain)
        require(abs(value - point["elevationMetres"]) < 0.02, point["name"] + " mobile DEM roundtrip")
    print("PASS: mobile DEM checksum, dimensions and landmark encoding")

    water_meta, water_image = load_asset("bay-area-water")
    require(water_meta["bounds"] == bounds and water_image.size == terrain.size,
            "Water and terrain do not share the same geographic grid")
    water = np.asarray(water_image)
    require(water.ndim == 2 and set(np.unique(water)).issubset({0, 255}), "Water mask is not binary")
    for point in water_meta["sanityCheckSamples"]:
        x, y = xy(point["longitude"], point["latitude"])
        require(bool(water[round(y), round(x)]) == point["water"],
                point["name"] + " water/land classification")
    require(abs(float(np.mean(water) / 255) - water_meta["waterFraction"]) < 1e-9,
            "Water coverage differs from its manifest")
    print(f"PASS: NOAA mask alignment and {len(water_meta['sanityCheckSamples'])} water/land locations")

    cameras = json.loads((ROOT / "data/bay-area-webcams.json").read_text())
    originals = re.search(r"const CAMS\s*=\s*\[(.*?)\n\];", script, re.S).group(1)
    original_ids = set(re.findall(r"\bid\s*:\s*['\"]([^'\"]+)['\"]", originals))
    require(len(original_ids) == 4, "Expected the original four camera sites")
    require(len(cameras) == 20, "Expected the 20 verified additional cameras")
    require(len({c["id"] for c in cameras}) == len(cameras), "Duplicate camera IDs")
    require(len({(c["lat"], c["lon"]) for c in cameras}) == len(cameras), "Duplicate camera sites")
    require(not {c["id"] for c in cameras}.intersection(original_ids),
            "Additional camera ID collides with an original camera")
    for camera in cameras:
        for key in ("lat", "lon", "elevM"):
            value = camera[key]
            require(type(value) in (int, float) and math.isfinite(value), camera["id"] + " " + key)
        require(bounds["west"] <= camera["lon"] <= bounds["east"] and
                bounds["south"] <= camera["lat"] <= bounds["north"], camera["id"] + " map bounds")
        require(camera["type"] == "snapshot" and camera["yt"] is None and "discover" not in camera,
                camera["id"] + " must retain a fixed, honest snapshot source")
        require(camera["credit"] == "ALERTCalifornia | UC San Diego" and camera["locationPrecision"],
                camera["id"] + " credit/location precision")
        viewer = urlparse(camera["link"])
        require(viewer.scheme == "https" and viewer.netloc == "cameras.alertcalifornia.org" and
                parse_qs(viewer.query).get("id") == [camera["sourceId"]], camera["id"] + " viewer URL")
        expected = "https://cameras.alertcalifornia.org/public-camera-data/" + camera["sourceId"] + "/latest-frame.jpg"
        require(camera["sources"] == [expected], camera["id"] + " snapshot URL")
    print("PASS: 20 unique, in-bounds snapshot records and official viewing URLs")

    # Execute the actual production sampling functions, including the mesh height
    # lookup used by wind and marker anchors, against the shipped PNG bytes.
    constants = []
    for name in ("LON0", "W", "S", "merc", "mN"):
        constants.append(re.search(r"const " + name + r"\s*=.*?;", script).group(0))
    points = [{"lon": row[1], "lat": row[2]} for row in landmarks]
    points += [{"lon": c["lon"], "lat": c["lat"]} for c in cameras]
    points += [{"lon": lon, "lat": lat} for lon in (bounds["west"], bounds["east"])
               for lat in (bounds["south"], bounds["north"])]
    outputs = []
    with tempfile.TemporaryDirectory(prefix="verify-bay-explorer-") as temp:
      for compact, variant in ((False, terrain), (True, mobile_terrain)):
        pixels_path = Path(temp) / "dem.rgba"
        pixels_path.write_bytes(variant.convert("RGBA").tobytes())
        js = "import fs from 'node:fs';\n" + "\n".join(constants)
        js += f"\nconst demWidth={variant.width},demHeight={variant.height};"
        js += "\nconst demPixels=fs.readFileSync(" + json.dumps(str(pixels_path)) + ");"
        js += "\n" + function_source(script, "sampleElevation")
        js += "\nconst points=" + json.dumps(points) + ";"
        js += "\nconst direct=points.map(p=>sampleElevation(p.lon,p.lat));const meshes=[];"
        # Evaluate the tier expressions themselves so capability changes are tested.
        tier = re.search(r"const RES\s*=.*?;", script).group(0)
        small = re.search(r"const useSmallTerrain\s*=.*?;", script).group(0)
        js += "\nconst compact=" + json.dumps(compact) + ";const navigator={deviceMemory:8};"
        js += "\nconst renderer={capabilities:{maxTextureSize:4096}};" + small + tier
        js += "\nconst elevArr=new Float32Array(RES*RES);const start=performance.now();"
        js += "\nfor(let row=0;row<RES;row++)for(let col=0;col<RES;col++){" \
              "elevArr[row*RES+col]=sampleElevation(LON0+col/(RES-1)*(LON1-LON0)," \
              "LAT1-row/(RES-1)*(LAT1-LAT0));}"
        js += "\n" + function_source(script, "heightAtWorld")
        js += "\nmeshes.push({res:RES,scale:S,width:W,depth:D,buildMs:performance.now()-start," \
              "heights:points.map(p=>heightAtWorld(((p.lon-LON0)/(LON1-LON0)-.5)*W," \
              "((LAT1-p.lat)/(LAT1-LAT0)-.5)*D))});"
        js += "\nconsole.log(JSON.stringify({direct,meshes}));"
        result = subprocess.run([node, "--input-type=module"], input=js, text=True,
                                capture_output=True)
        require(result.returncode == 0, "Production sampler execution failed:\n" + result.stderr)
        outputs.append((variant, json.loads(result.stdout)))
    for variant, output in outputs:
      for point, actual in zip(points, output["direct"]):
        require(abs(actual - sample(point["lon"], point["lat"], variant)) < 1e-5,
                "Production CPU sampler disagrees with PNG georeferencing")
      for mesh in output["meshes"]:
        res = mesh["res"]
        for point, actual in zip(points, mesh["heights"]):
            gx = min(res - 1.001, max(0, (point["lon"] - bounds["west"]) /
                     (bounds["east"] - bounds["west"]) * (res - 1)))
            gy = min(res - 1.001, max(0, (bounds["north"] - point["lat"]) /
                     (bounds["north"] - bounds["south"]) * (res - 1)))
            ix, iy = math.floor(gx), math.floor(gy)
            expected = 0
            for col, wx in ((ix, 1 - gx + ix), (ix + 1, gx - ix)):
                for row, wy in ((iy, 1 - gy + iy), (iy + 1, gy - iy)):
                    lon = bounds["west"] + col / (res - 1) * (bounds["east"] - bounds["west"])
                    lat = bounds["north"] - row / (res - 1) * (bounds["north"] - bounds["south"])
                    expected += sample(lon, lat, variant) * wx * wy * mesh["scale"]
            require(abs(actual - expected) < 1e-5, "Marker/wind terrain lookup orientation or scale mismatch")
        print(f"PASS: {res}² mesh height contract at {len(points)} sites "
              f"({2*(res-1)**2:,} terrain triangles; CPU sampling {mesh['buildMs']:.0f} ms)")
    print("All offline checks passed. GPU, interaction and live-feed checks require a browser.")


if __name__ == "__main__":
    main()
