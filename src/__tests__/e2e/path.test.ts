/**
 * E2E tests for path operations
 */

import { ClientV1, Position, ObjectType } from '../../index';
import { requireEnvAndFixture } from './test-helpers';

describe('Path E2E Tests', () => {
  // Remove the misleading beforeAll - tests should fail properly if not configured

  test('find paths', async () => {
    const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
    const client = new ClientV1(token, pdfData, baseUrl, 30000);
    await client.init();

    const paths = await client.findPaths();
    expect(paths).toHaveLength(9);
    expect(paths[0].type).toBe(ObjectType.PATH);

    const p1 = paths[0];
    expect(p1).toBeDefined();
    expect(p1.internalId).toBe('PATH_000001');
    expect(p1.position.boundingRect?.x).toBeCloseTo(80, 1);
    expect(p1.position.boundingRect?.y).toBeCloseTo(720, 1);
  });

  test('find paths by position', async () => {
    const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
    const client = new ClientV1(token, pdfData, baseUrl, 30000);
    await client.init();

    const paths = await client.findPaths(Position.onPageCoordinates(0, 80, 720));
    expect(paths).toHaveLength(1);
    expect(paths[0].internalId).toBe('PATH_000001');
  });

  test('delete path', async () => {
    const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
    const client = new ClientV1(token, pdfData, baseUrl, 30000);
    await client.init();

    let paths = await client.findPaths(Position.onPageCoordinates(0, 80, 720));
    expect(paths).toHaveLength(1);
    expect(paths[0].internalId).toBe('PATH_000001');
    expect(await client.delete(paths[0])).toBe(true);

    expect(await client.findPaths(Position.onPageCoordinates(0, 80, 720))).toHaveLength(0);
    expect(await client.findPaths()).toHaveLength(8);
  });

  test('move path', async () => {
    const [baseUrl, token, pdfData] = await requireEnvAndFixture('basic-paths.pdf');
    const client = new ClientV1(token, pdfData, baseUrl, 30000);
    await client.init();

    let paths = await client.findPaths(Position.onPageCoordinates(0, 80, 720));
    const ref = paths[0];
    const pos = ref.position;
    expect(pos.boundingRect?.x).toBeCloseTo(80, 1);
    expect(pos.boundingRect?.y).toBeCloseTo(720, 1);

    expect(await client.move(ref, Position.onPageCoordinates(0, 50.1, 100))).toBe(true);

    expect(await client.findPaths(Position.onPageCoordinates(0, 80, 720))).toHaveLength(0);

    paths = await client.findPaths(Position.onPageCoordinates(0, 50.1, 100));
    const movedRef = paths[0];
    const newPos = movedRef.position;
    expect(newPos.boundingRect?.x).toBeCloseTo(50.1, 0.05);
    expect(newPos.boundingRect?.y).toBeCloseTo(100, 0.05);
  });
});