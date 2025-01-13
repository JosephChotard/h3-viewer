import { Button, FormGroup, Slider, Switch, TagInput } from "@blueprintjs/core";
import {
    DrawPolygonMode,
    EditableGeoJsonLayer,
    FeatureCollection,
    ViewMode,
} from "@deck.gl-community/editable-layers";
import DeckGL from "@deck.gl/react";
import { MapView } from "deck.gl";
import { useCallback, useEffect, useState } from "react";
import { Map } from "react-map-gl";
import "./App.css";
import { OurViewState, RESOLUTION_TO_ZOOM, useHex } from "./useHex";
import { getH3Center, getMinResolution, isNotNull, toCells } from "./utils";

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

    const [isDrawing, setIsDrawing] = useState(false);

    const [features, setFeatures] = useState<FeatureCollection>({
        type: "FeatureCollection",
        features: [],
    });
    const [selectedFeatureIndexes] = useState([]);

    const drawLayer = new EditableGeoJsonLayer({
        data: features,
        mode: isDrawing ? DrawPolygonMode : ViewMode,
        selectedFeatureIndexes,
        onEdit: ({ editContext, updatedData, editType }) => {
            if (editType !== "addFeature") {
                return;
            }
            setFeatures({
                type: "FeatureCollection",
                features: [updatedData.features[editContext.featureIndexes[0]]],
            });
        },
    });

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

    const toggleDrawing = useCallback(() => {
        setIsDrawing((is) => !is);
        setFeatures({
            type: "FeatureCollection",
            features: [],
        });
    }, [setIsDrawing, setFeatures]);

    return (
        <div className="root">
            <DeckGL
                onViewStateChange={({ viewState }) =>
                    // This is stupid and I'm sure there's a better way to do this. I cba to figure out
                    setViewState(viewState as unknown as OurViewState)
                }
                controller={{
                    doubleClickZoom: false,
                }}
                viewState={viewState}
                views={new MapView({ repeat: true })}
                layers={[hexLayer, drawLayer]}
                onClick={console.log}
                getCursor={(...args) => {
                    try {
                        return drawLayer.getCursor(...args) ?? "default";
                    } catch {
                        return "default";
                    }
                }}
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
                        className="selected-hexes-input"
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
            <div className="draw-overlay">
                <Button
                    icon="draw"
                    aria-label="draw"
                    minimal={true}
                    active={isDrawing}
                    onClick={toggleDrawing}
                />
            </div>
        </div>
    );
}

export default App;
