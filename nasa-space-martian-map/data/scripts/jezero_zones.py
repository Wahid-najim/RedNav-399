"""Jezero Z1-Z6 zone polygons (APPROXIMATE, from published zone descriptions).

Source: jezeroVerified.ts JEZERO_ZONES [R5][R11][R14][R16][V2][V4][V5] and the
28-page research pack. Boundaries are drawn from the published anchors
(Kodiak 18.4124N 77.3820E, delta front 18.4410N 77.4120E, Mandu Wall
18.4630N 77.3560E, Neretva breach 18.4720N 77.3420E, landing 18.4446N
77.4509E, Séítah 18.4382N 77.4421E) — they are NOT surveyed boundaries and
every consumer must label them "approximate, from published zone descriptions".

Polygon format: list of [lat, lon] pairs (same order as backend geology.json).
Priority (later wins where polygons overlap): Z1 (default floor) < Z2 < Z5
< Z4 < Z3 < Z6. The Z6 hub is only ~0.5 km around the landing site so
Séítah (0.62 km away) stays Z1, as the zone definitions require.

Carbonate wt% mapping (published ranges, Clavé et al. 2026 doi:10.1029/2025JE009107
and Science 2026 PIXL supplement): Z1 <5 wt%, Z2 3-9 wt%, Z3 6-16 wt%.
Z4/Z5/Z6 have NO published carbonate wt% -> no coverage (NaN), never 0.
The chem layer stores wt% / 20 as a 0..1 NORMALIZED index; the midpoint of
each published range is the design choice for the representative value
(Z1 2.5, Z2 6.0, Z3 11.0 wt%). The CRISM spectral index (0-0.11) is NEVER
wt% and is never used here.
"""
import math

MARS_R = 3_396_190.0

# [lat, lon] polygons, approximate.
ZONE_POLYGONS = {
    # Z2 western delta + Kodiak: fan between the Neretva mouth and the delta front.
    "Z2": [(18.395, 77.365), (18.395, 77.425), (18.440, 77.425), (18.460, 77.400), (18.460, 77.365)],
    # Z3 Margin Unit: inner-rim band, Mandu Wall anchor.
    "Z3": [(18.460, 77.330), (18.460, 77.400), (18.500, 77.400), (18.500, 77.330)],
    # Z4 Neretva Vallis + Bright Angel: channel corridor from the breach to the delta.
    "Z4": [(18.472, 77.342), (18.460, 77.360), (18.450, 77.365), (18.440, 77.355),
           (18.450, 77.335), (18.465, 77.325)],
    # Z5 rim + Broom Point: the western inner-rim wall band (measured DEM shows
    # a continuous >-2000 m rise along the whole west edge, cols 0-93) plus the
    # north-west high ground. This is the 610 m rim wall above the delta base [R16].
    "Z5": [(18.282, 77.242), (18.282, 77.310), (18.460, 77.310), (18.460, 77.330),
           (18.500, 77.330), (18.550, 77.300), (18.6187, 77.300), (18.6187, 77.242)],
    # Z6 landing hub: ~0.5 km octagon around Octavia E. Butler landing site.
    "Z6": [(18.4530, 77.4509), (18.4506, 77.4599), (18.4446, 77.4599), (18.4386, 77.4599),
           (18.4362, 77.4509), (18.4386, 77.4419), (18.4446, 77.4419), (18.4506, 77.4419)],
}

# Application order for rasterisation (later wins).
ZONE_PRIORITY = ["Z2", "Z5", "Z4", "Z3", "Z6"]

ZONE_INFO = {
    "Z1": {"name": "Crater floor — Séítah / Máaz",
           "description": "Crater interior; Séítah 18.4382°N, 77.4421°E. About -2,600 m; traverse variation ~13 m; Séítah domes up to 17 m above Máaz.",
           "chemistry": "Séítah MgO 21.4 wt%, olivine CIPW 41.1 wt%, Fo54–72, grain 1.5 mm; Máaz MgO 2.7 wt%, plagioclase 37.9 wt%",
           "source": "[R14][V2]", "carbonate_wt_pct_mid": 2.5, "carbonate_wt_pct_range": "<5"},
    "Z2": {"name": "Western delta + Kodiak",
           "description": "West wall, mouth of Neretva Vallis; Kodiak 18.4124°N, 77.3820°E; delta front 18.4410°N, 77.4120°E. Fan top above floor; rim wall 610 m above delta base.",
           "chemistry": "Carbonate 3–9 wt% (Upper Fan); Fe/Mg clay in delta sediments",
           "source": "[R5][R6][V5]", "carbonate_wt_pct_mid": 6.0, "carbonate_wt_pct_range": "3–9"},
    "Z3": {"name": "Margin Unit — ancient shoreline",
           "description": "Inner rim edge; Mandu Wall 18.4630°N, 77.3560°E. 265 m explored span; a long sloping bench, not a cliff.",
           "chemistry": "Carbonate 6–16 wt%; PIXL MgO 21±10 wt% (E) / 26±12 wt% (W); CaSO4 + fluorite veins ~25 cm, eastern Margin only; 3 water events",
           "source": "[R11][V4][V5]", "carbonate_wt_pct_mid": 11.0, "carbonate_wt_pct_range": "6–16"},
    "Z4": {"name": "Neretva Vallis + Bright Angel",
           "description": "Channel through western rim; Bright Angel on N and S edges; Neretva breach 18.4720°N, 77.3420°E. Channel 400 m wide; Bright Angel exposure 1.2+ km; Cheyava Falls rock 1.0 × 0.6 m, sol 1212.",
           "chemistry": "Organic carbon + phosphorus; vivianite + greigite leopard spots (mm-scale); CaSO4 veins run the length of Cheyava Falls; Sapphire Canyon core sol 1215, 6.2 cm — POTENTIAL biosignature only, not confirmed life",
           "source": "[R12][R19][R30][V7]", "carbonate_wt_pct_mid": None, "carbonate_wt_pct_range": "not published"},
    "Z5": {"name": "Rim + Broom Point",
           "description": "Outer rim; Broom Point — location by zone + traverse, no lat/lon in PDFs. +300 m to Aurora Park, +800 m total relief at Lookout Hill; slopes up to 23°.",
           "chemistry": "Igneous / impactite; Silver Mountain, Green Gardens (serpentinite), Main River cores from rim",
           "source": "[R15][R22][R23][V7]", "carbonate_wt_pct_mid": None, "carbonate_wt_pct_range": "not published"},
    "Z6": {"name": "Octavia E. Butler Landing hub",
           "description": "18.4446°N, 77.4509°E. -2,570 m (reported), 30 m above general floor. Landing 18 Feb 2021; ~1.9 km east of delta remnants; landing ellipse 7.7 × 6.6 km.",
           "chemistry": "Máaz paver field; MOXIE site; first weather report site",
           "source": "[R26][R31][V3][V6]", "carbonate_wt_pct_mid": None, "carbonate_wt_pct_range": "not published"},
}


def latlon_to_rc(lat, lon, north_lat, west_lon, cell_m):
    """Same equirectangular math as backend/app/geo.py Grid. Returns float (row, col)."""
    r = (north_lat - lat) * (MARS_R * math.pi / 180.0) / cell_m
    c = (lon - west_lon) * (MARS_R * math.cos(math.radians(lat)) * math.pi / 180.0) / cell_m
    return r, c


def zone_masks(height, width, north_lat, west_lon, cell_m):
    """Rasterise the zone polygons onto the region grid with Pillow.

    Returns dict zone -> bool mask. Z1 = everything not covered by Z2-Z6.
    Later-priority zones overwrite earlier ones where polygons overlap.
    """
    from PIL import Image, ImageDraw
    img = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(img)
    zone_code = {"Z2": 2, "Z3": 3, "Z4": 4, "Z5": 5, "Z6": 6}
    for zid in ZONE_PRIORITY:
        xy = []
        for lat, lon in ZONE_POLYGONS[zid]:
            r, c = latlon_to_rc(lat, lon, north_lat, west_lon, cell_m)
            xy.append((c, r))
        draw.polygon(xy, fill=zone_code[zid])
    import numpy as np
    codes = np.asarray(img, dtype=np.uint8)
    masks = {zid: codes == code for zid, code in zone_code.items()}
    masks["Z1"] = codes == 0
    return masks
