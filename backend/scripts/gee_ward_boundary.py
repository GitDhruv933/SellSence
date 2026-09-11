#!/usr/bin/env python3
"""
gee_ward_boundary.py — Step 1: load/draw the ward boundary in Earth Engine,
get its area, and cross-check population with WorldPop + built-up density
with GHSL.

This talks to Google Earth Engine, so it needs YOUR OWN Earth Engine
account and cannot be run by the SellSence backend on your behalf (Earth
Engine auth is per-Google-account, not something an app can do for you).
Run it locally/on your own machine, then POST the printed JSON to:

    POST /ward-analysis/boundary/:wardId

on the SellSence backend to attach the result to a ward.

Setup (one-time):
    pip install earthengine-api
    earthengine authenticate      # opens a browser to sign into your GEE account

Usage:
    # Option A: boundary already drawn as a GeoJSON file (e.g. exported
    # from geojson.io, QGIS, or the ward shapefile you have)
    python3 gee_ward_boundary.py --geojson my_ward.geojson

    # Option B: boundary already uploaded as an Earth Engine asset
    python3 gee_ward_boundary.py --asset users/yourname/ward_7_boundary
"""
import argparse
import json
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--geojson', help='Path to a GeoJSON file with the ward boundary polygon')
    group.add_argument('--asset', help='Earth Engine asset ID of an already-uploaded ward boundary')
    parser.add_argument('--worldpop-year', type=int, default=2020,
                         help='WorldPop year to use (default 2020, the latest globally consistent year)')
    parser.add_argument('--ghsl-year', type=int, default=2020,
                         help='GHSL epoch to use (default 2020)')
    args = parser.parse_args()

    try:
        import ee
    except ImportError:
        print('earthengine-api is not installed. Run: pip install earthengine-api', file=sys.stderr)
        sys.exit(1)

    try:
        ee.Initialize()
    except Exception:
        print('Earth Engine not authenticated in this environment. Run: earthengine authenticate', file=sys.stderr)
        sys.exit(1)

    if args.geojson:
        with open(args.geojson) as f:
            gj = json.load(f)
        geom_dict = gj['geometry'] if gj.get('type') == 'Feature' else gj
        geometry = ee.Geometry(geom_dict)
    else:
        geometry = ee.FeatureCollection(args.asset).geometry()

    # --- Area (Step 1) ---
    area_sq_km = geometry.area(maxError=1).divide(1_000_000).getInfo()

    # --- WorldPop population cross-check ---
    worldpop = (
        ee.ImageCollection('WorldPop/GP/100m/pop')
        .filter(ee.Filter.eq('year', args.worldpop_year))
        .mosaic()
    )
    pop_sum = worldpop.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=geometry,
        scale=100,
        maxPixels=1e10,
    ).get('population').getInfo()

    # --- GHSL built-up density cross-check ---
    # GHS_BUILT_S (built-up surface, m^2 per pixel) - mean fraction of
    # built-up surface as a simple density proxy over the ward.
    ghsl = ee.Image(f'JRC/GHSL/P2023A/GHS_BUILT_S/{args.ghsl_year}')
    built_up_mean = ghsl.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=geometry,
        scale=100,
        maxPixels=1e10,
    ).get('built_surface').getInfo()

    result = {
        'area_sq_km': round(area_sq_km, 4) if area_sq_km is not None else None,
        'population_worldpop': round(pop_sum, 1) if pop_sum is not None else None,
        'built_up_density_ghsl': round(built_up_mean, 4) if built_up_mean is not None else None,
        'boundary_geojson': geometry.getInfo(),
    }
    if result['area_sq_km'] and result['population_worldpop'] is not None:
        result['population_density_worldpop_check'] = round(result['population_worldpop'] / result['area_sq_km'], 2)

    print(json.dumps(result, indent=2))
    print(
        '\n# Cross-check note: compare population_density_worldpop_check above against\n'
        '# your census-derived population_density for this ward before trusting either one.',
        file=sys.stderr,
    )


if __name__ == '__main__':
    main()
