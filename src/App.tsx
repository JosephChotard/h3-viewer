import { FormGroup, Slider, Switch, TagInput } from "@blueprintjs/core";
import DeckGL from "@deck.gl/react";
import { MapView } from "deck.gl";
import {
    cellToLatLng,
    getResolution,
    isValidCell,
    splitLongToH3Index,
} from "h3-js";
import { useCallback, useEffect, useState } from "react";
import { Map } from "react-map-gl";
import "./App.css";
import { OurViewState, RESOLUTION_TO_ZOOM, useHex } from "./useHex";
import { isNotNull } from "./utils";

const getH3Center = (hexes: string[]) => {
    const latLngs = hexes.map(cellToLatLng);
    const lats = latLngs.map(([lat]) => lat);
    const lngs = latLngs.map(([, lng]) => lng);
    const centerLat = lats.reduce((sum, lat) => sum + lat, 0) / lats.length;
    const centerLng = lngs.reduce((sum, lng) => sum + lng, 0) / lngs.length;
    return [centerLat, centerLng];
};

function split64BitNumber(numberStr: string): [number, number] {
    const bigIntNumber = BigInt(numberStr);
    const mask32Bits = BigInt(0xffffffff);

    const lower = Number(bigIntNumber & mask32Bits);
    const upper = Number((bigIntNumber >> BigInt(32)) & mask32Bits);

    return [lower, upper];
}

function isBigIntString(str: string): boolean {
    try {
        BigInt(str);
        return true;
    } catch {
        return false;
    }
}

function toCells(str: string): (string | undefined)[] | undefined {
    str = str.trim();
    if (isValidCell(str)) {
        return [str];
    }
    if (isBigIntString(str)) {
        const [lower, upper] = split64BitNumber(str);
        const index = splitLongToH3Index(lower, upper);
        if (isValidCell(index)) {
            return [index];
        }
    }
    if (str.includes(",")) {
        return str.split(",").flatMap(toCells);
    }
    if (str.startsWith("[")) {
        return toCells(str.slice(1));
    }
    if (str.endsWith("]")) {
        return toCells(str.slice(0, -1));
    }
    // Check if json
    try {
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed)) {
            return parsed.flatMap(toCells);
        }
    } catch {
        return undefined;
    }
    return undefined;
}

const getMinResolution = (hexes: string[]) => {
    const resolutions = hexes.map(getResolution);
    return Math.min(...resolutions);
};

function App() {
    const [resolutionFrozen, setResolutionFrozen] = useState(false);
    const [viewState, setViewState] = useState<OurViewState>({
        width: 1734,
        height: 1318,
        latitude: 37.635849802603865,
        longitude: -35.383059547989724,
        zoom: 2.415529236018404,
        bearing: 0,
        pitch: 0,
        maxZoom: 20,
        minZoom: 0,
        maxPitch: 60,
        minPitch: 0,
        position: [0, 0, 0],
    });

    const {
        handleResize: hexHandleResize,
        hexLayer,
        selectedHexes,
        setSelectedHexes,
        resolution,
    } = useHex({ resolutionFrozen });

    const handleHexInputChange = useCallback(
        (values: React.ReactNode[]) => {
            const new_hexes = new Set(
                values
                    .filter(isNotNull)
                    .map((value) => value.toString())
                    .flatMap(toCells)
                    .filter(isNotNull)
            );
            console.log(new_hexes);
            setSelectedHexes(new_hexes);
            if (new_hexes.size === 0) {
                return;
            }
            const [centerLat, centerLng] = getH3Center([...new_hexes]);
            setViewState((prev) => ({
                ...prev,
                longitude: centerLng,
                latitude: centerLat,
                zoom: RESOLUTION_TO_ZOOM[getMinResolution([...new_hexes])],
            }));
        },
        [setSelectedHexes, setViewState]
    );

    useEffect(() => {
        hexHandleResize(viewState);
    }, [viewState, hexHandleResize]);

    return (
        <div className="root">
            <DeckGL
                onViewStateChange={({ viewState }) =>
                    // This is stupid and I'm sure there's a better way to do this. I cba to figure out
                    setViewState(viewState as unknown as OurViewState)
                }
                viewState={viewState}
                controller
                views={new MapView({ repeat: true })}
                layers={[hexLayer]}
                // getTooltip={({ object }: PickingInfo<string>) => object ?? ""}
            >
                <Map
                    mapStyle="mapbox://styles/mapbox/light-v9"
                    mapboxAccessToken="pk.eyJ1IjoicGFsYW50aXItZW50ZXJwcmlzZSIsImEiOiJjazlzcjB2aHgwMWdoM2VtdTR3eHhxd3hzIn0.pHSdjsyiukVMVnWqQeUGaw"
                />
            </DeckGL>
            <div className="overlay">
                <FormGroup label="H3 Resolution">
                    <Slider
                        min={0}
                        max={15}
                        stepSize={1}
                        value={resolution}
                        disabled
                    />
                </FormGroup>
                <FormGroup
                    helperText="Select the H3 cells you want to display."
                    label="Selected H3 Cells"
                >
                    <TagInput
                        onChange={handleHexInputChange}
                        placeholder="Separate values with commas..."
                        values={[...selectedHexes]}
                    />
                </FormGroup>
                <FormGroup>
                    <Switch
                        checked={resolutionFrozen}
                        onChange={() => setResolutionFrozen((f) => !f)}
                    >
                        Freeze resolution
                    </Switch>
                </FormGroup>
            </div>
        </div>
    );
}

export default App;
