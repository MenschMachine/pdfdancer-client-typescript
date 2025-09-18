/**
 * E2E tests for image operations
 */

import * as fs from 'fs';
import { ClientV1, Position, ObjectType, Image } from '../../index';
import { requireEnvAndFixture, createTempPath, readImageFixture } from './test-helpers';

describe('Image E2E Tests', () => {
  // Tests should fail properly if environment is not configured

  test('find images', async () => {
    const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
    const client = new ClientV1(token, pdfData, baseUrl, 30000);
    await client.init();

    const images = await client.findImages();
    expect(images).toHaveLength(3);
    expect(images[0].type).toBe(ObjectType.IMAGE);

    const imagesPage0 = await client.findImages(Position.fromPageIndex(0));
    expect(imagesPage0).toHaveLength(2);
  });

  test('delete images', async () => {
    const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
    const client = new ClientV1(token, pdfData, baseUrl, 30000);
    await client.init();

    const images = await client.findImages();
    for (const obj of images) {
      expect(await client.delete(obj)).toBe(true);
    }
    expect(await client.findImages()).toHaveLength(0);

    // Save PDF to verify operation
    const outPath = createTempPath('deleteImage.pdf');
    const outputPdfData = await client.getPdfFile();
    fs.writeFileSync(outPath, outputPdfData);
    expect(fs.existsSync(outPath)).toBe(true);
    expect(fs.statSync(outPath).size).toBeGreaterThan(0);

    // Cleanup
    fs.unlinkSync(outPath);
  });

  test('move image', async () => {
    const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
    const client = new ClientV1(token, pdfData, baseUrl, 30000);
    await client.init();

    let images = await client.findImages();
    const imageRef = images[2];
    const position = imageRef.position;
    expect(position.boundingRect?.x).toBeCloseTo(54, 0.5);
    expect(position.boundingRect?.y).toBeCloseTo(300, 1);

    expect(await client.move(imageRef, Position.onPageCoordinates(11, 50.1, 100.0))).toBe(true);

    images = await client.findImages();
    const movedImageRef = images[2];
    const newPosition = movedImageRef.position;
    expect(newPosition.boundingRect?.x).toBeCloseTo(50.1, 0.05);
    expect(newPosition.boundingRect?.y).toBeCloseTo(100.0, 0.05);
  });

  test('find image by position', async () => {
    const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
    const client = new ClientV1(token, pdfData, baseUrl, 30000);
    await client.init();

    let images = await client.findImages(Position.onPageCoordinates(11, 0, 0));
    expect(images).toHaveLength(0);

    images = await client.findImages(Position.onPageCoordinates(11, 55, 310));
    expect(images).toHaveLength(1);
    expect(images[0].internalId).toBe('IMAGE_000003');
  });

  test('add image', async () => {
    const [baseUrl, token, pdfData] = await requireEnvAndFixture('ObviouslyAwesome.pdf');
    const client = new ClientV1(token, pdfData, baseUrl, 30000);
    await client.init();

    let images = await client.findImages();
    expect(images).toHaveLength(3);

    // Prepare image data
    const imageData = readImageFixture('logo-80.png');
    const image = new Image();
    image.data = imageData;
    const pos = Position.onPageCoordinates(6, 50.1, 98.0);

    expect(await client.addImage(image, pos)).toBe(true);

    images = await client.findImages();
    expect(images).toHaveLength(4);

    const imagesPage6 = await client.findImages(Position.fromPageIndex(6));
    expect(imagesPage6).toHaveLength(1);

    const newImage = imagesPage6[0];
    expect(newImage.position.pageIndex).toBe(6);
    expect(newImage.internalId).toBe('IMAGE_000003');
    expect(newImage.position.boundingRect?.x).toBeCloseTo(50.1, 0.05);
    expect(newImage.position.boundingRect?.y).toBeCloseTo(98.0, 0.05);
  });
});