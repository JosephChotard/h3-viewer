import { FormGroup, Slider, TagInput } from "@blueprintjs/core";
import DeckGL from "@deck.gl/react";
import { MapView } from "deck.gl";
import { cellToLatLng, getResolution, isValidCell } from "h3-js";
import { useCallback, useEffect, useState } from "react";
import { Map } from "react-map-gl";
import "./App.css";
import { OurViewState, RESOLUTION_TO_ZOOM, useHex } from "./useHex";
import { isNotNull } from "./utils";

const getH3Center = (hexes: string[]) => {
    const latLngs = hexes.map(cellToLatLng);
    const lats = latLngs.map(([lat, _]) => lat);
    const lngs = latLngs.map(([_, lng]) => lng);
    const centerLat = lats.reduce((sum, lat) => sum + lat, 0) / lats.length;
    const centerLng = lngs.reduce((sum, lng) => sum + lng, 0) / lngs.length;
    return [centerLat, centerLng];
};

const getAverageResolution = (hexes: string[]) => {
    const resolutions = hexes.map(getResolution);
    return Math.floor(
        resolutions.reduce((sum, resolution) => sum + resolution, 0) /
            resolutions.length
    );
};

function App() {
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
    } = useHex();

    const handleHexInputChange = useCallback(
        (values: React.ReactNode[]) => {
            const new_hexes = new Set(
                values
                    .filter(isNotNull)
                    .map((value) => value.toString())
                    .filter(isValidCell)
            );
            setSelectedHexes(new_hexes);
            if (new_hexes.size === 0) {
                return;
            }
            const [centerLat, centerLng] = getH3Center([...new_hexes]);
            setViewState((prev) => ({
                ...prev,
                longitude: centerLng,
                latitude: centerLat,
                zoom: RESOLUTION_TO_ZOOM[getAverageResolution([...new_hexes])],
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
                    setViewState(viewState as any as OurViewState)
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
            </div>
        </div>
    );
}

export default App;
