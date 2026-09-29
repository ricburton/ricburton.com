# Bay Area webcam source verification

Verified 20 additional, distinct public camera sites on 2026-09-29 at 16:04–16:06 UTC. These supplement the original Fort Funston, Mussel Rock, Mt Tamalpais, and Mt Diablo entries.

## Official sources

- [ALERTCalifornia public camera index](https://cameras.alertcalifornia.org/public-camera-data/all_cameras-v3.json): camera IDs, names, published coordinates, elevation, and latest-frame timestamps.
- [ALERTCalifornia public viewer JavaScript](https://cameras.alertcalifornia.org/alertcalifornia.js): `first_time_try_show_overlay()` reads the `id` URL query parameter; `Overlay.update_url()` writes it. `get_camera_url()` uses `/public-camera-data/<camera-id>/latest-frame.jpg` for full frames. Consequently viewer links use `https://cameras.alertcalifornia.org/?id=<camera-id>`.
- [Official crediting guidance](https://alertcalifornia.org/crediting-and-branding/): public use is permitted with the exact credit “ALERTCalifornia | UC San Diego”; preserve the information bar and partner logos. Render the full frame without cropping (for example, `object-fit: contain`).

## Location and freshness limits

Coordinates are copied exactly as published by the public index, which rounds these sites to two decimal places. They identify real camera sites but are not precise instrument survey positions. At this latitude that is approximately a 1 km grid; `locationPrecision` makes that limit explicit. Elevations are the index’s third coordinate, in metres; feet labels are converted from that value. Do not infer higher precision from the terrain mesh.

All 20 source URLs returned HTTP 200 with `image/jpeg`. Every image was fully decoded with Pillow as a non-blank 1920 × 1080 JPEG; hashes are distinct. The index reported frames 71–111 seconds old at the start of verification. `lastFrameAt` is the index timestamp, not an independently OCR-read image timestamp. `verifiedAt` records the successful source fetch. The second decoding pass also succeeded for every source. No image copies are committed.

The application’s 15-second polling interval does not imply that the publisher produces a new frame every 15 seconds. Cameras may pan, be obscured by weather, or go offline after this point-in-time verification. These are refreshing public snapshots with links to the official viewer, not embedded continuous video streams.

## Verified cameras

| Camera | Published latitude, longitude | Elevation (m) | Frame timestamp (UTC) | JPEG bytes | Official viewer |
| --- | --- | ---: | --- | ---: | --- |
| Sutro Tower 1 (`Axis-SutroTower1`) | 37.76, -122.45 | 254 | 2026-09-29T16:03:01Z | 186,551 | [View](https://cameras.alertcalifornia.org/?id=Axis-SutroTower1) |
| Wolfback Ridge (`Axis-WolfbackRidge`) | 37.85, -122.50 | 339 | 2026-09-29T16:03:14Z | 213,588 | [View](https://cameras.alertcalifornia.org/?id=Axis-WolfbackRidge) |
| Muir Beach Overlook (`Axis-MuirBeach`) | 37.86, -122.59 | 148 | 2026-09-29T16:02:55Z | 240,334 | [View](https://cameras.alertcalifornia.org/?id=Axis-MuirBeach) |
| Bolinas (`Axis-Bolinas`) | 37.94, -122.71 | 103 | 2026-09-29T16:02:46Z | 240,873 | [View](https://cameras.alertcalifornia.org/?id=Axis-Bolinas) |
| Barnabe Peak East (`Axis-BarnabeEast`) | 38.03, -122.72 | 445 | 2026-09-29T16:03:24Z | 155,728 | [View](https://cameras.alertcalifornia.org/?id=Axis-BarnabeEast) |
| Big Rock Ridge 1 (`Axis-BigRock`) | 38.06, -122.60 | 575 | 2026-09-29T16:03:11Z | 293,394 | [View](https://cameras.alertcalifornia.org/?id=Axis-BigRock) |
| Mt. Burdell 1 (`Axis-Burdell`) | 38.15, -122.59 | 477 | 2026-09-29T16:03:00Z | 343,838 | [View](https://cameras.alertcalifornia.org/?id=Axis-Burdell) |
| San Rafael Hill (`Axis-SanRafaelHill1`) | 37.98, -122.53 | 188 | 2026-09-29T16:02:56Z | 335,257 | [View](https://cameras.alertcalifornia.org/?id=Axis-SanRafaelHill1) |
| Nichol Knob (`Axis-NicholKnob1`) | 37.92, -122.38 | 113 | 2026-09-29T16:03:17Z | 191,530 | [View](https://cameras.alertcalifornia.org/?id=Axis-NicholKnob1) |
| Berkeley Downtown (`Axis-Berkeley`) | 37.87, -122.27 | 57 | 2026-09-29T16:03:17Z | 220,382 | [View](https://cameras.alertcalifornia.org/?id=Axis-Berkeley) |
| Chabot (`Axis-Chabot`) | 37.82, -122.19 | 467 | 2026-09-29T16:02:55Z | 352,709 | [View](https://cameras.alertcalifornia.org/?id=Axis-Chabot) |
| Round Top (`Axis-RoundTop`) | 37.85, -122.19 | 526 | 2026-09-29T16:03:24Z | 229,516 | [View](https://cameras.alertcalifornia.org/?id=Axis-RoundTop) |
| Rocky Ridge 1 (`Axis-RockyRidge1`) | 37.82, -122.06 | 614 | 2026-09-29T16:03:21Z | 262,229 | [View](https://cameras.alertcalifornia.org/?id=Axis-RockyRidge1) |
| Sunol Ridge 1 (`Axis-SunolRidge1`) | 37.62, -121.92 | 658 | 2026-09-29T16:03:18Z | 283,990 | [View](https://cameras.alertcalifornia.org/?id=Axis-SunolRidge1) |
| Mission Peak 1 (`Axis-Mission1`) | 37.48, -121.86 | 706 | 2026-09-29T16:03:17Z | 226,850 | [View](https://cameras.alertcalifornia.org/?id=Axis-Mission1) |
| San Bruno Mountain (`Axis-SanBrunoMtn1`) | 37.69, -122.44 | 398 | 2026-09-29T16:02:59Z | 246,799 | [View](https://cameras.alertcalifornia.org/?id=Axis-SanBrunoMtn1) |
| Pillar Point (`Axis-PillarPoint`) | 37.50, -122.48 | 1 | 2026-09-29T16:03:17Z | 190,337 | [View](https://cameras.alertcalifornia.org/?id=Axis-PillarPoint) |
| Redwood City 1 (`Axis-RedwoodCity1`) | 37.49, -122.23 | 3 | 2026-09-29T16:03:22Z | 187,513 | [View](https://cameras.alertcalifornia.org/?id=Axis-RedwoodCity1) |
| Stanford Dish (`Axis-StanfordDish`) | 37.41, -122.18 | 139 | 2026-09-29T16:03:26Z | 286,030 | [View](https://cameras.alertcalifornia.org/?id=Axis-StanfordDish) |
| Carol Drive Santa Clara 1 (`Axis-CarolDrive1`) | 37.29, -121.87 | 134 | 2026-09-29T16:03:16Z | 286,693 | [View](https://cameras.alertcalifornia.org/?id=Axis-CarolDrive1) |

## Retrieved frame fingerprints

SHA-256 hashes from the first successful verification fetch; a later fetch will normally differ as the camera refreshes.

```text
Axis-SutroTower1 9a3a9fc247728c30fc2b7dee0451ac575447d160d32818ecd47ae1fa67b585af
Axis-WolfbackRidge bbd61bb311f4583c0d9cb0a110bcdae553370caa71887ffdeaf40d195a5be170
Axis-MuirBeach a6437173a055ceee1f8af760c109d36c694ff64a0fde782b8a435cb58f776d8a
Axis-Bolinas cfc1b330430107cbd621335cef34d98b24d03c2177864725f1286c309d0973fc
Axis-BarnabeEast 07ffbbd0de97b99b50fec94cfaba4547a0a59945489409e4b9ca79f1d33a8a82
Axis-BigRock 20f8223e685236c292e3537d1ef5be87651774e7712746cf774ab814d29b686e
Axis-Burdell b6513d0d939a0387c658bb39d9e4c7f21183bb2cb52793944cab3e3a4e20b069
Axis-SanRafaelHill1 da7960656ea1e57700cd7546f968720e41401960808358d5a9ce67ab633d830a
Axis-NicholKnob1 7435ac3a9f3a5a96e24d96e19ac67521f993eb3256db716073745e15d0f16b36
Axis-Berkeley b0b2cd12501ed711bc7f6808f2f47acf6f514df13db5a26938274698468d6199
Axis-Chabot 7449a77b31597b277645f7d95f9b0c6f63f7065276927b8b9800dd9146323e17
Axis-RoundTop 20d78d9095a20a72a70ec19909af5a57e1a8c5f074beadc31aa5cf3b2cd0def4
Axis-RockyRidge1 198a35ec1872f90d63e5e3a9a17148beeda5b80f563378f8fd6c1c8bb5c0c77c
Axis-SunolRidge1 d864f46412da47a2ca960848327424d38b1df7f5ae34e267c20b773034da612d
Axis-Mission1 4b2f0dc9c0e3108e2d51c1fd2f6383da7682d59af1bfe62c55ce5b89d776d104
Axis-SanBrunoMtn1 04ff08eeab7095d27a1968928dca795fc63fa1b80d4071e10cdee4c97bab587a
Axis-PillarPoint 5c68b304daa88856940fcd513830f817b8ef63ddf006d12c298f625ff794d6f0
Axis-RedwoodCity1 5f6082c5ef27c6f8e3f14f769e6aacea443062a423bf44c638d88e58c22bf0a9
Axis-StanfordDish 30033886633444ad9a919f6cb6b7721a2b8b8617069084e89a5d5c2662610b33
Axis-CarolDrive1 4e824882f38d12f022975a5cad160a4b856402d745fcee9ec099e3ed6079326d
```
