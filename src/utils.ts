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