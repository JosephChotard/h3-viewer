import { FormGroup, Slider, TagInput } from "@blueprintjs/core";
import DeckGL from "@deck.gl/react";
import { MapView } from "deck.gl";
import { isValidCell } from "h3-js";
import { useCallback } from "react";
import { Map } from "react-map-gl";
import "./App.css";
import { useHex } from "./useHex";
import { isNotNull } from "./utils";

function App() {
    const {
        handleResize,
        hexLayer,
        selectedHexes,
        setSelectedHexes,
        resolution,
    } = useHex();

    const handleHexInputChange = useCallback(
        (values: React.ReactNode[]) => {
            setSelectedHexes(
                new Set(
                    values
                        .filter(isNotNull)
                        .map((value) => value.toString())
                        .filter(isValidCell)
                )
            );
        },
        [setSelectedHexes]
    );

    return (
        <div className="root">
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
