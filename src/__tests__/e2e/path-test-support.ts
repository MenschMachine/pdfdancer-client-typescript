import {BoundingRect} from '../../models';

interface PathWithBounds {
    internalId: string;
    position: { boundingRect?: BoundingRect };
    strokeColor?: unknown;
    fillColor?: unknown;
}

const BOUNDS_EPSILON = 0.1;

export function pathWithBounds<T extends PathWithBounds>(paths: T[], expected: BoundingRect): T {
    const matches = paths.filter(path => boundsMatch(path.position.boundingRect, expected));
    if (matches.length !== 1) {
        throw new Error(`Expected exactly one path with bounds ${JSON.stringify(expected)}, found ${matches.length}`);
    }
    return matches[0];
}

export function pathIdsWithBounds(paths: PathWithBounds[], ...expected: BoundingRect[]): string[] {
    return expected.map(bounds => pathWithBounds(paths, bounds).internalId);
}

export function boundsMatch(actual: BoundingRect | undefined, expected: BoundingRect): boolean {
    return actual !== undefined
        && close(actual.x, expected.x)
        && close(actual.y, expected.y)
        && close(actual.width, expected.width)
        && close(actual.height, expected.height);
}

function close(actual: number, expected: number): boolean {
    return Math.abs(actual - expected) <= BOUNDS_EPSILON;
}
