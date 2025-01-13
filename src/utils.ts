import {
    cellToLatLng,
    getResolution,
    isValidCell,
    splitLongToH3Index,
} from "h3-js";

export const isNotNull = <T>(value: T): value is NonNullable<T> => {
    return value != null;
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const throttle = (fn: Function, wait: number = 300) => {
    let inThrottle: boolean,
        lastFn: ReturnType<typeof setTimeout>,
        lastTime: number;
    return function (this: unknown, ...args: unknown[]) {
        if (!inThrottle) {
            fn.apply(this, args);
            lastTime = Date.now();
            inThrottle = true;
        } else {
            clearTimeout(lastFn);
            lastFn = setTimeout(() => {
                if (Date.now() - lastTime >= wait) {
                    fn.apply(this, args);
                    lastTime = Date.now();
                }
            }, Math.max(wait - (Date.now() - lastTime), 0));
        }
    };
};

export const getH3Center = (hexes: string[]) => {
    const latLngs = hexes.map(cellToLatLng);
    const lats = latLngs.map(([lat]) => lat);
    const lngs = latLngs.map(([, lng]) => lng);
    const centerLat = lats.reduce((sum, lat) => sum + lat, 0) / lats.length;
    const centerLng = lngs.reduce((sum, lng) => sum + lng, 0) / lngs.length;
    return [centerLat, centerLng];
};

export function split64BitNumber(numberStr: string): [number, number] {
    const bigIntNumber = BigInt(numberStr);
    const mask32Bits = BigInt(0xffffffff);

    const lower = Number(bigIntNumber & mask32Bits);
    const upper = Number((bigIntNumber >> BigInt(32)) & mask32Bits);

    return [lower, upper];
}

export function isBigIntString(str: string): boolean {
    try {
        BigInt(str);
        return true;
    } catch {
        return false;
    }
}

export function toCells(str: string): (string | undefined)[] | undefined {
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

export const getMinResolution = (hexes: string[]) => {
    const resolutions = hexes.map(getResolution);
    return Math.min(...resolutions);
};