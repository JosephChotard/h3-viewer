import { H3HexagonLayer } from "@deck.gl/geo-layers";
import DeckGL from "@deck.gl/react";
import { MapView, MapViewState, WebMercatorViewport } from "deck.gl";
import { polygonToCells } from "h3-js";
import { useCallback, useEffect, useState } from "react";
import { Map } from "react-map-gl";
import "./App.css";

const debounce = (fn: Function, ms = 300) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    return function (this: any, ...args: any[]) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), ms);
    };
};

const throttle = (fn: Function, wait: number = 300) => {
    let inThrottle: boolean,
        lastFn: ReturnType<typeof setTimeout>,
        lastTime: number;
    return function (this: any, ...args: any[]) {
        const context = this;
        if (!inThrottle) {
            fn.apply(context, args);
            lastTime = Date.now();
            inThrottle = true;
        } else {
            clearTimeout(lastFn);
            lastFn = setTimeout(() => {
                if (Date.now() - lastTime >= wait) {
                    fn.apply(context, args);
                    lastTime = Date.now();
                }
            }, Math.max(wait - (Date.now() - lastTime), 0));
        }
    };
};

const getLayer = (data: string[]) =>
    new H3HexagonLayer<string>({
        id: "H3HexagonLayer",
        extruded: false,
        getHexagon: (d: string) => d,
        getFillColor: [0, 0, 0, 0],
        getLineColor: [100, 100, 100],
        getLineWidth: 2,
        lineWidthUnits: "pixels",
        elevationScale: 20,
        pickable: true,
        data,
        wrapLongitude: true,
    });

type OurViewState = {
    width: number;
    height: number;
} & MapViewState;

function adjustToRange(value: number, min: number, max: number): number {
    const range = max - min;
    return ((((value - min) % range) + range) % range) + min;
}

function adjustLongitude(longitude: number): number {
    return adjustToRange(longitude, -180, 180);
}

type Bounds = {
    minLat: number;
    minLon: number;
    maxLat: number;
    maxLon: number;
};

const getVisibleBounds = (viewState: OurViewState) => {
    const viewport = new WebMercatorViewport(viewState);
    const { width, height } = viewState;

    const topLeft = viewport.unproject([0, 0]);
    const bottomRight = viewport.unproject([width, height]);

    const minLat = bottomRight[1];
    const minLon = topLeft[0];
    const maxLat = topLeft[1];
    const maxLon = bottomRight[0];

    return {
        minLat,
        minLon,
        maxLat,
        maxLon,
    } as Bounds;
};

const splitPolygon = ({ minLat, minLon, maxLat, maxLon }: Bounds) =>
    splitLongitudeRange(minLon, maxLon).map(([minLon, maxLon]) => ({
        minLat,
        minLon,
        maxLat,
        maxLon,
    }));

function splitLongitudeRange(
    minLon: number,
    maxLon: number
): [number, number][] {
    const result: [number, number][] = [];

    let curPos = minLon;

    let adjustedMax = adjustLongitude(maxLon);

    while (curPos < maxLon) {
        let normalized = adjustLongitude(curPos);
        let next = normalized < 0 ? 0 : 180;
        curPos = curPos + next - normalized;
        if (curPos > maxLon) {
            result.push([normalized, adjustedMax]);
        } else {
            result.push([normalized, next]);
        }
    }

    return result;
}

console.log(splitLongitudeRange(-59, 70));

const boundsToPolygon = ({ minLat, minLon, maxLat, maxLon }: Bounds) => [
    [minLon, minLat],
    [maxLon, minLat],
    [maxLon, maxLat],
    [minLon, maxLat],
    [minLon, minLat],
];

const zoomToH3Resolution = (x: number) =>
    Math.floor((1 / (1 + Math.exp(-0.4 * x + 4))) * 15);

function App() {
    const [hexLayer, setHexLayer] = useState<H3HexagonLayer<string> | null>(
        null
    );

    useEffect(() => {
        setHexLayer(getLayer([]));
    }, []);

    const handleResize = useCallback(
        throttle((viewState: OurViewState) => {
            const zoom = viewState.zoom;
            const resolution = zoomToH3Resolution(zoom);
            const bounds = getVisibleBounds(viewState);

            const all_bounds = splitPolygon(bounds);

            const polygons = all_bounds.map(boundsToPolygon);

            const hexagons = [
                ...new Set(
                    polygons.flatMap((polygon) =>
                        polygonToCells(polygon, resolution, true)
                    )
                ),
            ];

            setHexLayer(getLayer(hexagons));
        }, 200),
        []
    );

    return (
        <DeckGL
            onViewStateChange={({ viewState }) => handleResize(viewState)}
            initialViewState={{
                longitude: -122.4,
                latitude: 37.74,
                zoom: 11,
            }}
            controller
            views={new MapView({ repeat: true })}
            layers={[hexLayer]}
        >
            <Map
                mapStyle="mapbox://styles/mapbox/light-v9"
                mapboxAccessToken="pk.eyJ1IjoicGFsYW50aXItZW50ZXJwcmlzZSIsImEiOiJjazlzcjB2aHgwMWdoM2VtdTR3eHhxd3hzIn0.pHSdjsyiukVMVnWqQeUGaw"
            />
        </DeckGL>
    );
}

export default App;
