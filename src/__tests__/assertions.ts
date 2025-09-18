export function expectWithin(
    actual: number | undefined,
    expected: number,
    tolerance: number
): void {
    if (actual === undefined) {
        throw new Error(`Expected a number but got undefined`);
    }

    const diff = Math.abs(actual - expected);
    expect(diff).toBeLessThanOrEqual(tolerance);
}
