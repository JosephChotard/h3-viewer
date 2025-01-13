import { Button, FormGroup, Slider, Switch, TagInput } from "@blueprintjs/core";
import {
    DrawPolygonMode,
    EditableGeoJsonLayer,
    Feature,
    FeatureCollection,
    ViewMode,
} from "@deck.gl-community/editable-layers";
import DeckGL, { DeckGLProps } from "@deck.gl/react";
import { area } from "@turf/area";
import { H3HexagonLayer, MapView, PickingInfo } from "deck.gl";
import * as h3 from "h3-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Map } from "react-map-gl";
import "./App.css";
import { OurViewState, RESOLUTION_TO_ZOOM, useHex } from "./useHex";
import {
    getH3Center,
    getMaximumAcceptableResolution,
    getMinResolution,
    isNotNull,
    toCells,
} from "./utils";

const INITIAL_VIEW_STATE: OurViewState = {
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
};

const getTooltip: DeckGLProps["getTooltip"] = ({
    object: hex,
}: PickingInfo<string>) => {
    if (!hex) {
        return null;
    }
    const areaM2 = h3.cellArea(hex, h3.UNITS.m2);
    let area = areaM2;
    if (areaM2 > 100000) {
        area = areaM2 / 1_000_000;
    }
    return `\
      Hex: ${hex}
      Resolution: ${h3.getResolution(hex)}
      Area (${areaM2 === area ? "m^2" : "km^2"}): ${new Intl.NumberFormat(
        "en-US",
        { maximumSignificantDigits: 2 }
    ).format(area)}
      `;
};

function App() {
    const [resolutionFrozen, setResolutionFrozen] = useState(false);
    const [viewState, setViewState] =
        useState<OurViewState>(INITIAL_VIEW_STATE);
    const [isDrawing, setIsDrawing] = useState(false);
    const [coverShape, setCoverShape] = useState(false);
    const [compactShape, setCompactShape] = useState(false);
    const [maxShapeResolution, setMaxShapeResolution] = useState(3);
    const [shapeResolution, setShapeResolution] = useState(0);
    const [highlightedHexes, setHighlightedHexes] = useState<string[]>([]);
    const [hoverInfo, setHoverInfo] = useState<PickingInfo<string>>();

    console.log({ hoverInfo });

    const clickRemoveHex = useCallback(
        (hexes: string[]) => {
            if (isDrawing) {
                return;
            }
            setHighlightedHexes((selectedHexes) =>
                selectedHexes.filter((hex) => !hexes.includes(hex))
            );
        },
        [setHighlightedHexes, isDrawing]
    );

    const appendHexes = useCallback(
        (hexes: string[]) => {
            if (isDrawing) {
                return;
            }
            setHighlightedHexes((highlighted) => [
                ...new Set([...highlighted, ...hexes]),
            ]);
        },
        [setHighlightedHexes, isDrawing]
    );

    const highlightedHexLayer = useMemo(() => {
        return new H3HexagonLayer<string>({
            id: "HighlightedH3HexagonLayer",
            extruded: false,
            getHexagon: (d: string) => d,
            getFillColor: [255, 100, 100, 150],
            getLineColor: [150, 150, 150, 100],
            getLineWidth: 2,
            lineWidthUnits: "pixels",
            elevationScale: 20,
            pickable: true,
            data: highlightedHexes,
            wrapLongitude: true,
            onClick: (info: PickingInfo<string>) => {
                if (!info.object) {
                    return;
                }
                clickRemoveHex([info.object]);
            },
            onHover: (info: PickingInfo<string>) => {
                setHoverInfo(info);
            },
        });
    }, [highlightedHexes, clickRemoveHex, setHoverInfo]);

    const {
        handleResize: hexHandleResize,
        hexLayer: backgroundHexLayer,
        resolution,
    } = useHex({
        resolutionFrozen,
        addSelectedHexes: appendHexes,
    });

    const [features, setFeatures] = useState<FeatureCollection>({
        type: "FeatureCollection",
        features: [],
    });

    const drawLayer = new EditableGeoJsonLayer({
        data: features,
        mode: isDrawing ? DrawPolygonMode : ViewMode,
        selectedFeatureIndexes: [],
        onEdit: ({ editContext, updatedData, editType }) => {
            if (editType !== "addFeature") {
                return;
            }
            const featureOfInterest: Feature["geoJson"] =
                updatedData.features[editContext.featureIndexes[0]];
            setFeatures({
                type: "FeatureCollection",
                features: [featureOfInterest],
            });
        },
    });

    useEffect(() => {
        if (!features?.features?.[0]?.geometry) {
            return;
        }
        const geometry = features.features[0].geometry;
        const pointArea = area(geometry);
        const maxRes = getMaximumAcceptableResolution(pointArea);
        setMaxShapeResolution(maxRes);
        const shapeRes = Math.min(maxRes, shapeResolution);
        setShapeResolution(shapeRes);
        const points = geometry.coordinates as number[][];

        if (!coverShape) {
            return;
        }
        let hexes = h3.polygonToCells(points, shapeRes, true);
        if (compactShape) {
            hexes = h3.compactCells(hexes);
        }
        setHighlightedHexes(hexes);
    }, [
        features,
        coverShape,
        compactShape,
        shapeResolution,
        maxShapeResolution,
        setShapeResolution,
    ]);

    const handleHexInputChange = useCallback(
        (values: React.ReactNode[]) => {
            const new_hexes = [
                ...new Set(
                    values
                        .filter(isNotNull)
                        .map((value) => value.toString())
                        .flatMap(toCells)
                        .filter(isNotNull)
                ),
            ];
            setHighlightedHexes(new_hexes);
            if (new_hexes.length === 0) {
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
        [setHighlightedHexes, setViewState]
    );

    useEffect(() => {
        hexHandleResize(viewState);
    }, [viewState, hexHandleResize]);

    const handleSetCoverShape = useCallback(() => {
        setCoverShape((f) => !f);
        setHighlightedHexes([]);
    }, []);

    const toggleDrawing = useCallback(() => {
        setIsDrawing((is) => !is);
        setFeatures({
            type: "FeatureCollection",
            features: [],
        });
        setCoverShape(false);
        setCompactShape(false);
    }, [setIsDrawing, setFeatures]);

    return (
        <div className="root">
            <DeckGL
                initialViewState={INITIAL_VIEW_STATE}
                onViewStateChange={({ viewState, interactionState }) => {
                    // This is stupid and I'm sure there's a better way to do this. I cba to figure out
                    const typedVs = viewState as unknown as OurViewState;
                    if (interactionState.isZooming) {
                        setViewState((vs) => ({
                            ...vs,
                            ...typedVs,
                            transitionDuration: 0,
                        }));
                    } else {
                        setViewState((vs) => ({
                            ...vs,
                            ...typedVs,
                        }));
                    }
                }}
                controller={{
                    doubleClickZoom: false,
                }}
                viewState={viewState}
                views={new MapView({ repeat: true })}
                layers={[backgroundHexLayer, drawLayer, highlightedHexLayer]}
                getCursor={(...args) => {
                    try {
                        return drawLayer.getCursor(...args) ?? "default";
                    } catch {
                        return "default";
                    }
                }}
                getTooltip={getTooltip}
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
                    labelInfo={
                        <Button
                            outlined
                            small
                            icon="cross"
                            onClick={() => setHighlightedHexes([])}
                            className="clear-all-button"
                        >
                            {highlightedHexes.length > 0 && (<>Clear all ({highlightedHexes.length})</>)}
                            
                        </Button>
                    }
                    className="selected-hexes"
                >
                    <TagInput
                        onChange={handleHexInputChange}
                        placeholder="Separate values with commas..."
                        values={[...highlightedHexes]}
                        className="selected-hexes-input"
                        tagProps={{
                            minimal: true,
                        }}
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
                >
                    {isDrawing && "Drawing Mode"}
                </Button>
                {isDrawing && (
                    <>
                        <FormGroup>
                            <Switch
                                checked={coverShape}
                                onChange={handleSetCoverShape}
                            >
                                Cover shape with hexes
                            </Switch>
                        </FormGroup>
                        <FormGroup label="H3 Resolution to cover with">
                            <Slider
                                min={0}
                                max={maxShapeResolution}
                                stepSize={1}
                                value={shapeResolution}
                                onChange={setShapeResolution}
                            />
                        </FormGroup>
                        <FormGroup>
                            <Switch
                                checked={compactShape}
                                onChange={() => setCompactShape((c) => !c)}
                            >
                                Compact hexes
                            </Switch>
                        </FormGroup>
                    </>
                )}
            </div>
        </div>
    );
}

export default App;
